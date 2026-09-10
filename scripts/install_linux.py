#!/usr/bin/env python3
"""Install the extracted AetherWave Linux package, or check it with --check."""

import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tempfile
import uuid


BUNDLE = "AetherWave.vst3"
MODULE = "Contents/x86_64-linux/AetherWave.so"


def verify_package(package):
    bundle = package / BUNDLE
    if bundle.is_symlink() or not bundle.is_dir():
        raise ValueError(f"Missing complete {BUNDLE} directory in {package}")
    if any(path.is_symlink() for path in bundle.rglob("*")):
        raise ValueError("Package contains symbolic links; use the complete CI package")
    metadata = json.loads((package / "build-info.json").read_text())
    digest = hashlib.sha256((bundle / MODULE).read_bytes()).hexdigest()
    if digest != metadata.get("module_sha256"):
        raise ValueError("Plugin checksum mismatch; download and extract the package again")
    if not (bundle / "Contents/Resources/moduleinfo.json").is_file():
        raise ValueError("Missing VST3 manifest")
    if not metadata.get("source_commit") or not metadata.get("plugin_version"):
        raise ValueError("Missing package version or source commit")
    return metadata


def check_runtime(module):
    if platform.system() != "Linux" or platform.machine().lower() not in ("x86_64", "amd64"):
        raise ValueError("This package requires Linux x86-64")
    if shutil.which("ldd") is None:
        raise ValueError("ldd is required to check runtime dependencies (libc-bin on Ubuntu)")
    result = subprocess.run(["ldd", str(module.resolve())], capture_output=True, text=True, timeout=30)
    if result.returncode or "not found" in result.stdout + result.stderr:
        raise ValueError("Unresolved plugin runtime dependencies:\n" + result.stdout + result.stderr)
    # JUCE loads these lazily, so they do not necessarily appear in ldd output.
    missing = []
    for library in ("libwebkit2gtk-4.1.so.0", "libgtk-3.so.0", "libcurl.so.4"):
        try:
            ctypes.CDLL(library)
        except OSError as error:
            missing.append(str(error))
    if missing:
        raise ValueError("Missing editor runtime libraries:\n" + "\n".join(missing)
                         + "\nSee README-Linux.md for runtime package names.")


def install_bundle(package, destination, backup_dir, replace=False):
    verify_package(package)
    destination = destination.expanduser().resolve()
    backup_dir = backup_dir.expanduser().resolve()
    if backup_dir == destination or destination in backup_dir.parents:
        raise ValueError("Backups must be outside the VST3 scan directory")
    source = (package / BUNDLE).resolve()
    if source == destination or source in destination.parents:
        raise ValueError("Destination must be outside the source bundle")
    destination.mkdir(parents=True, exist_ok=True)
    lock = destination / ".aetherwave-install.lock"
    try:
        lock.mkdir()
    except FileExistsError:
        raise ValueError(f"Another install may be active: {lock}. Remove this empty directory only after it exits.") from None
    try:
        target = destination / BUNDLE
        if target.is_symlink() or (target.exists() and not target.is_dir()):
            raise ValueError(f"Refusing to replace a symlink or non-directory: {target}")
        if target.exists() and not replace:
            raise ValueError(f"Already installed: {target}. Close REAPER and use --replace to back up and update it.")
        if source == target:
            raise ValueError("Source package is already in the destination")
        backup = None
        with tempfile.TemporaryDirectory(prefix=".aetherwave-stage-", dir=destination) as stage:
            staged = Path(stage) / BUNDLE
            shutil.copytree(source, staged)
            shutil.copy2(package / "build-info.json", Path(stage) / "build-info.json")
            verify_package(Path(stage))
            if target.exists():
                backup_dir.mkdir(parents=True, exist_ok=True)
                backup = backup_dir / ("AetherWave-" + uuid.uuid4().hex)
                shutil.move(str(target), str(backup))
            try:
                staged.rename(target)
            except OSError:
                if backup is not None and not target.exists():
                    shutil.move(str(backup), str(target))
                raise
        return target, backup
    finally:
        lock.rmdir()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package-dir", type=Path, default=Path(__file__).resolve().parent,
                        help="extracted package directory (default: directory containing this script)")
    parser.add_argument("--destination", type=Path, default=Path.home() / ".vst3",
                        help="VST3 scan directory (default: ~/.vst3)")
    data_dir = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local/share")
    parser.add_argument("--backup-dir", type=Path, default=data_dir / "AetherWave/backups")
    parser.add_argument("--replace", action="store_true", help="back up an existing installation before updating")
    parser.add_argument("--check", action="store_true", help="check package and runtime dependencies without installing")
    args = parser.parse_args()
    try:
        metadata = verify_package(args.package_dir)
        check_runtime(args.package_dir / BUNDLE / MODULE)
        print(f"PASS: AetherWave {metadata['plugin_version']} ({metadata['source_commit']}) and runtime dependencies")
        if not args.check:
            target, backup = install_bundle(args.package_dir, args.destination, args.backup_dir, args.replace)
            print(f"Installed: {target}")
            if backup:
                print(f"Previous installation: {backup}")
            print("Open REAPER, rescan VST3 plugins, and insert VST3i: AetherWave.")
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        parser.exit(1, f"ERROR: {error}\n")


if __name__ == "__main__":
    main()
