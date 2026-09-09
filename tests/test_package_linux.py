import importlib.util
import json
from pathlib import Path
import struct
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("package_linux", Path(__file__).resolve().parents[1] / "scripts/package_linux.py")
packaging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packaging)


class PackagingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        artefacts = self.root / "build/VictorZynth_artefacts/Release"
        self.bundle = artefacts / "VST3/AetherWave.vst3"
        self.module = self.bundle / "Contents/x86_64-linux/AetherWave.so"
        self.module.parent.mkdir(parents=True)
        header = bytearray(64)
        header[:7] = b"\x7fELF\x02\x01\x01"
        struct.pack_into("<HH", header, 16, 3, 62)
        self.module.write_bytes(header)
        self.metadata = self.bundle / "Contents/Resources/moduleinfo.json"
        self.metadata.parent.mkdir(parents=True)
        self.metadata.write_text(json.dumps({"Name": "AetherWave", "Version": "0.4.0", "Classes": [
            {"Category": "Audio Module Class", "CID": "0" * 32}]}))
        self.standalone = artefacts / "Standalone/AetherWave"
        self.standalone.parent.mkdir(parents=True)
        self.standalone.write_bytes(header)
        self.standalone.chmod(0o755)

    def test_valid_bundle(self):
        packaging.validate_bundle(self.bundle, self.standalone)

    def test_steinberg_trailing_commas_and_quoted_strings(self):
        self.metadata.write_text('{"Name":"AetherWave","Version":"0.4.0",'
                                 '"Extra":"quoted ,} text","Classes":[{"Category":"Audio Module Class",'
                                 '"CID":"' + 'A' * 32 + '",},],}')
        result = packaging.validate_bundle(self.bundle)
        self.assertEqual(result["Extra"], "quoted ,} text")

    def test_empty_bundle_fails(self):
        self.module.unlink()
        with self.assertRaises(ValueError):
            packaging.validate_bundle(self.bundle)

    def test_wrong_architecture_fails(self):
        header = bytearray(self.module.read_bytes())
        struct.pack_into("<H", header, 18, 183)  # AArch64 is not the x86-64 target.
        self.module.write_bytes(header)
        with self.assertRaises(ValueError):
            packaging.validate_bundle(self.bundle)

    def test_no_manifest_processor_fails(self):
        self.metadata.write_text('{"Name":"AetherWave", "Version":"0.4.0", "Classes":[]}')
        with self.assertRaises(ValueError):
            packaging.validate_bundle(self.bundle)

    def test_non_executable_standalone_fails(self):
        self.standalone.chmod(0o644)
        with self.assertRaises(ValueError):
            packaging.validate_bundle(self.bundle, self.standalone)

    def test_package_preserves_root_permissions_and_provenance(self):
        archive = packaging.package_build(self.root / "build", self.root / "out", "test-commit")
        with tarfile.open(archive) as tar:
            self.assertIn("AetherWave.vst3/Contents/x86_64-linux/AetherWave.so", tar.getnames())
            self.assertTrue(tar.getmember("standalone/AetherWave").mode & 0o111)
            self.assertEqual(json.load(tar.extractfile("build-info.json"))["source_commit"], "test-commit")
        self.assertTrue((self.root / "out/SHA256SUMS").is_file())


if __name__ == "__main__":
    unittest.main()
