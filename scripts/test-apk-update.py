import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("apk_update", Path(__file__).with_name("check-apk-update.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class UpdateSafety(unittest.TestCase):
    def setUp(self):
        self.old = {"package": "app.jeet", "certificates": ["a" * 64], "versionCode": 4, "versionName": "1.3.0", "minSdk": 26, "debuggable": True}
        self.new = {**self.old, "versionCode": 5, "versionName": "2.0.0", "debuggable": False}
        self.version = {"versionCode": 5, "version": "2.0.0"}

    def test_accepts_original_certificate_and_higher_version(self):
        module.verify_update(self.old, self.new, self.version)

    def test_rejects_incompatible_or_debug_updates(self):
        for change in [{"certificates": ["b" * 64]}, {"package": "app.jeet.new"}, {"versionCode": 4}, {"versionName": "1.3.0"}, {"debuggable": True}, {"minSdk": 27}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                module.verify_update(self.old, {**self.new, **change}, self.version)


if __name__ == "__main__":
    unittest.main()
