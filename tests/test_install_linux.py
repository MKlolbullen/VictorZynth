import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("install_linux", Path(__file__).resolve().parents[1] / "scripts/install_linux.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.package = self.root / "package with spaces"
        self.destination = self.root / "vst3"
        self.backups = self.root / "backups"
        self.module = self.package / installer.BUNDLE / installer.MODULE
        self.module.parent.mkdir(parents=True)
        self.module.write_bytes(b"fixture module")
        self.module.chmod(0o755)
        manifest = self.package / installer.BUNDLE / "Contents/Resources/moduleinfo.json"
        manifest.parent.mkdir()
        manifest.write_text("{}")
        (self.package / "build-info.json").write_text(json.dumps({
            "source_commit": "a" * 40, "plugin_version": "0.4.0",
            "module_sha256": hashlib.sha256(self.module.read_bytes()).hexdigest(),
        }))

    def install(self, replace=False):
        return installer.install_bundle(self.package, self.destination, self.backups, replace)

    def old_install(self):
        target = self.destination / installer.BUNDLE
        target.mkdir(parents=True)
        (target / "old.txt").write_text("keep this")
        return target

    def test_install_preserves_whole_bundle_and_permissions(self):
        target, backup = self.install()
        self.assertIsNone(backup)
        self.assertEqual((target / installer.MODULE).read_bytes(), self.module.read_bytes())
        self.assertEqual((target / installer.MODULE).stat().st_mode & 0o777, 0o755)
        self.assertEqual(list(self.destination.iterdir()), [target])

    def test_existing_install_requires_replace(self):
        old = self.old_install()
        with self.assertRaisesRegex(ValueError, "Already installed"):
            self.install()
        self.assertEqual((old / "old.txt").read_text(), "keep this")
        self.assertFalse(self.backups.exists())

    def test_update_backs_up_without_merging_old_files(self):
        self.old_install()
        target, backup = self.install(replace=True)
        self.assertEqual((backup / "old.txt").read_text(), "keep this")
        self.assertFalse((target / "old.txt").exists())
        self.assertNotIn(self.destination, backup.parents)

    def test_corrupt_package_leaves_existing_install_untouched(self):
        old = self.old_install()
        self.module.write_bytes(b"truncated download")
        with self.assertRaisesRegex(ValueError, "checksum mismatch"):
            self.install(replace=True)
        self.assertEqual((old / "old.txt").read_text(), "keep this")

    def test_failed_publish_restores_previous_install(self):
        old = self.old_install()
        with patch.object(Path, "rename", side_effect=OSError("simulated publish failure")):
            with self.assertRaisesRegex(OSError, "simulated publish failure"):
                self.install(replace=True)
        self.assertEqual((old / "old.txt").read_text(), "keep this")
        self.assertEqual(list(self.destination.iterdir()), [old])

    def test_symlink_destination_bundle_is_not_replaced(self):
        self.destination.mkdir()
        (self.destination / installer.BUNDLE).symlink_to(self.package / installer.BUNDLE)
        with self.assertRaisesRegex(ValueError, "symlink"):
            self.install(replace=True)
        self.assertTrue(self.module.exists())

    def test_backup_inside_scan_path_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "outside the VST3 scan"):
            installer.install_bundle(self.package, self.destination, self.destination / "backups", True)
        self.assertFalse(self.destination.exists())

    def test_check_does_not_install(self):
        with patch.object(installer, "check_runtime") as runtime, patch("sys.argv", [
            "install-linux.py", "--check", "--package-dir", str(self.package),
            "--destination", str(self.destination),
        ]):
            installer.main()
        runtime.assert_called_once_with(self.module)
        self.assertFalse(self.destination.exists())


if __name__ == "__main__":
    unittest.main()
