"""core/mobile_theme.py: one token set on phones, a no-op on desktop."""
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def load():
    pkg = types.ModuleType("mobile_theme_test")
    pkg.__path__ = [str(ROOT)]
    sys.modules["mobile_theme_test"] = pkg
    for sub in ("core", "rendering"):
        m = types.ModuleType(f"mobile_theme_test.{sub}")
        m.__path__ = [str(ROOT / sub)]
        sys.modules[f"mobile_theme_test.{sub}"] = m
    mods = {}
    for full, path in (
        ("mobile_theme_test.core.platform", ROOT / "core" / "platform.py"),
        ("mobile_theme_test.rendering.theme_palette", ROOT / "rendering" / "theme_palette.py"),
        ("mobile_theme_test.core.mobile_theme", ROOT / "core" / "mobile_theme.py"),
    ):
        spec = importlib.util.spec_from_file_location(full, path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[full] = module
        spec.loader.exec_module(module)
        mods[full.rsplit(".", 1)[1]] = module
    return mods


class MobileThemeTests(unittest.TestCase):
    def setUp(self):
        self.mods = load()
        self.mt = self.mods["mobile_theme"]
        self.tp = self.mods["theme_palette"]

    def test_tokens_follow_the_theme(self):
        navy = {"--bg": "#1b1b28", "--fg": "#e6e6f0", "--accent-color": "#8aa4ff"}
        t = self.mt.tokens(True, navy)
        self.assertEqual(t["background"], "#1b1b28")
        self.assertEqual(t["text"], "#e6e6f0")
        self.assertEqual(t["accent"], "#8aa4ff")
        # surfaces sit between background and text, close to the background
        self.assertLess(self.tp.contrast(t["surface"], t["background"]), 1.3)
        self.assertGreater(self.tp.contrast(t["text"], t["surface"]), 4.5)

    def test_settings_palette_has_every_chrome_key(self):
        navy = {"--bg": "#1b1b28", "--fg": "#e6e6f0", "--accent-color": "#8aa4ff"}
        themed = self.mt.settings_palette(navy, True)
        neutral = self.tp.chrome_palette(navy, True)
        self.assertEqual(set(neutral), set(themed))
        self.assertEqual(themed["outer"], "#1b1b28")

    def test_noop_off_mobile(self):
        with patch.object(self.mt.onigiri_platform, "IS_MOBILE", False):
            self.assertFalse(self.mt.active())
            self.assertFalse(self.mt.apply_qt_palette())
            self.assertFalse(self.mt.paint_initial_edges())
            self.mt.install()
            self.assertFalse(self.mt._installed["done"])
            self.assertFalse(self.mt.install_toast())
            self.assertFalse(self.mt.style_toast(None))


if __name__ == "__main__":
    unittest.main()
