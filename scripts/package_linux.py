#!/usr/bin/env python3
"""Validate/package the Linux x86-64 build without stripping the VST3 bundle root."""

import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import subprocess
import tarfile


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate_elf(path):
    require(path.is_file(), f"Missing ELF binary: {path}")
    with path.open("rb") as binary:
        header = binary.read(64)
    require(len(header) == 64 and header[:7] == b"\x7fELF\x02\x01\x01",
            f"Not a 64-bit little-endian ELF: {path}")
    kind, machine = struct.unpack_from("<HH", header, 16)
    require(kind in (2, 3) and machine == 62, f"Not an x86-64 executable/shared object: {path}")


def validate_bundle(bundle, standalone=None, load=False):
    require(bundle.name == "AetherWave.vst3" and bundle.is_dir(),
            f"Expected an enclosing AetherWave.vst3 directory: {bundle}")
    module = bundle / "Contents/x86_64-linux/AetherWave.so"
    validate_elf(module)
    # Steinberg's manifest writer emits trailing commas. Remove only commas
    # outside quoted strings, retaining strict JSON validation for everything else.
    manifest = (bundle / "Contents/Resources/moduleinfo.json").read_text()
    manifest = re.sub(r'("(?:\\.|[^"\\])*")|,\s*(?=[}\]])',
                      lambda match: match.group(1) or "", manifest)
    metadata = json.loads(manifest)
    require(metadata.get("Name") == "AetherWave", "Unexpected VST3 manifest name")
    require(bool(metadata.get("Version")), "Missing VST3 manifest version")
    classes = metadata.get("Classes", [])
    require(any(c.get("Category") == "Audio Module Class" for c in classes),
            "Manifest contains no audio processor class")
    for entry in classes:
        cid = entry.get("CID", "")
        require(len(cid) == 32 and all(c in "0123456789abcdefABCDEF" for c in cid),
                "Invalid VST3 class identifier")
    if standalone is not None:
        validate_elf(standalone)
        require(os.access(standalone, os.X_OK), f"Standalone is not executable: {standalone}")
    if load:
        # Test the binary built by this job, never an arbitrary downloaded module.
        # WebKit/GTK/curl may be loaded lazily by JUCE and not appear in ldd.
        for library in ("libwebkit2gtk-4.1.so.0", "libgtk-3.so.0", "libcurl.so.4"):
            ctypes.CDLL(library)
        handle = ctypes.CDLL(str(module.resolve()), mode=os.RTLD_NOW | os.RTLD_LOCAL)
        for symbol in ("GetPluginFactory", "ModuleEntry", "ModuleExit"):
            require(getattr(handle, symbol, None) is not None, f"Missing VST3 export: {symbol}")
        for binary in (module, standalone):
            if binary is not None:
                result = subprocess.run(["ldd", str(binary)], text=True, capture_output=True, check=True)
                print(result.stdout)
                require("not found" not in result.stdout, f"Missing runtime dependency: {binary}")
    return metadata


def package_build(build_dir, output_dir, revision):
    artefacts = build_dir / "VictorZynth_artefacts/Release"
    bundle = artefacts / "VST3/AetherWave.vst3"
    standalone = artefacts / "Standalone/AetherWave"
    metadata = validate_bundle(bundle, standalone)
    output_dir.mkdir(parents=True, exist_ok=True)
    archive = output_dir / "AetherWave-linux-x86_64.tar.gz"
    require(not archive.exists(), f"Refusing to overwrite existing package: {archive}")
    build_info = output_dir / "build-info.json"
    build_info.write_text(json.dumps({
        "source_commit": revision,
        "plugin_version": metadata["Version"],
        "platform": "Linux x86_64; Ubuntu 24.04 build baseline",
        "module_sha256": hashlib.sha256((bundle / "Contents/x86_64-linux/AetherWave.so").read_bytes()).hexdigest(),
    }, indent=2) + "\n")
    with tarfile.open(archive, "w:gz") as tar:
        tar.add(bundle, arcname="AetherWave.vst3")
        tar.add(standalone, arcname="standalone/AetherWave")
        tar.add(build_info, arcname="build-info.json")
        tar.add(Path(__file__).resolve().parents[1] / "docs/REAPER-Linux.md", arcname="README-Linux.md")
    # Check the actual archive, not only the pre-upload directory.
    with tarfile.open(archive) as tar:
        require(tar.getmember("AetherWave.vst3/Contents/x86_64-linux/AetherWave.so").size > 0,
                "Package lost the VST3 bundle root")
        require(tar.getmember("standalone/AetherWave").mode & 0o111,
                "Package lost standalone executable permissions")
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    (output_dir / "SHA256SUMS").write_text(f"{digest}  {archive.name}\n")
    print(archive)
    return archive


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    validate = commands.add_parser("validate")
    validate.add_argument("bundle", type=Path)
    validate.add_argument("--standalone", type=Path)
    validate.add_argument("--load", action="store_true")
    package = commands.add_parser("package")
    package.add_argument("build_dir", type=Path)
    package.add_argument("output_dir", type=Path)
    package.add_argument("--revision", required=True)
    args = parser.parse_args()
    try:
        if args.command == "validate":
            validate_bundle(args.bundle, args.standalone, args.load)
            print("PASS: Linux VST3 bundle validation")
        else:
            package_build(args.build_dir, args.output_dir, args.revision)
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        parser.exit(1, f"ERROR: {error}\n")


if __name__ == "__main__":
    main()
