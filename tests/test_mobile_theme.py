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


class ShowAnswerAccentTests(unittest.TestCase):
    """Audit 2, R2-07: Show Answer takes the accent unless the user chose colours."""

    def setUp(self):
        self.mt = load()["mobile_theme"]

    def test_factory_colours_use_the_accent(self):
        self.assertTrue(self.mt.show_answer_uses_accent({}, "light"))
        self.assertTrue(self.mt.show_answer_uses_accent({}, "dark"))

    def test_theme_applied_colours_use_the_accent(self):
        # theme_store writes the same inset/fg pair into Show Answer and Edit/More
        conf = {
            "onigiri_reviewer_show_answer_btn_bg_dark": "#2b2020",
            "onigiri_reviewer_show_answer_btn_text_dark": "#e8d9c8",
            "onigiri_reviewer_other_btn_bg_dark": "#2B2020",
            "onigiri_reviewer_other_btn_text_dark": "#E8D9C8",
        }
        self.assertTrue(self.mt.show_answer_uses_accent(conf, "dark"))

    def test_users_own_colours_are_kept(self):
        conf = {
            "onigiri_reviewer_show_answer_btn_bg_light": "#ff0000",
            "onigiri_reviewer_show_answer_btn_text_light": "#ffffff",
            "onigiri_reviewer_other_btn_bg_light": "#eeeeee",
            "onigiri_reviewer_other_btn_text_light": "#222222",
        }
        self.assertFalse(self.mt.show_answer_uses_accent(conf, "light"))


if __name__ == "__main__":
    unittest.main()
