"""core/phone_windows.py: pure helpers and the no-op off a phone."""
import importlib.util
import sys
import types
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load():
    pkg = types.ModuleType("phone_windows_test")
    pkg.__path__ = [str(ROOT)]
    core = types.ModuleType("phone_windows_test.core")
    core.__path__ = [str(ROOT / "core")]
    sys.modules["phone_windows_test"] = pkg
    sys.modules["phone_windows_test.core"] = core
    mods = {}
    for name in ("platform", "phone_windows"):
        full = f"phone_windows_test.core.{name}"
        spec = importlib.util.spec_from_file_location(full, ROOT / "core" / f"{name}.py")
        module = importlib.util.module_from_spec(spec)
        sys.modules[full] = module
        spec.loader.exec_module(module)
        mods[name] = module
    return mods["platform"], mods["phone_windows"]


class PhoneWindowsTests(unittest.TestCase):
    def setUp(self):
        self.platform, self.pw = load()

    def test_browse_title_is_short(self):
        self.assertEqual(self.pw.short_browse_title(0), "Browse")
        self.assertEqual(self.pw.short_browse_title(13), "Browse · 13")
        self.assertEqual(self.pw.short_browse_title("x"), "Browse")
        self.assertEqual(self.pw.short_browse_title(2, "Durchsuchen"), "Durchsuchen · 2")

    def test_select_button_text(self):
        self.assertEqual(self.pw.select_button_text(0), "Select")
        self.assertEqual(self.pw.select_button_text(7), "Select · 7")

    def test_focus_redirect_only_for_focus_nobody_asked_for(self):
        for name in ("OtherFocusReason", "ActiveWindowFocusReason", "PopupFocusReason"):
            self.assertTrue(self.pw.should_redirect_focus(name), name)
        for name in ("MouseFocusReason", "TabFocusReason", "BacktabFocusReason", "ShortcutFocusReason"):
            self.assertFalse(self.pw.should_redirect_focus(name), name)

    def test_wide_rows_are_stacked(self):
        self.assertTrue(self.pw.layout_needs_stacking(600, 390))
        self.assertFalse(self.pw.layout_needs_stacking(300, 390))
        self.assertTrue(self.pw.layout_needs_stacking(360, 390))  # inside the 32pt margin

    def test_adapters_registered_by_class_name(self):
        for name in ("Browser", "AddCards", "DeckOptionsDialog", "StudyDeck", "CustomStudy", "Preferences",
                     "FieldDialog", "CardLayout", "GetTextDialog"):
            self.assertIn(name, self.pw.ADAPTERS)
            self.assertTrue(callable(self.pw.ADAPTERS[name]))

    def test_paint_only_windows_are_named(self):
        for name in ("NewEditCurrent", "BrowserPreviewer", "CardLayout"):
            self.assertIn(name, self.pw.PAINT_ONLY)

    def test_install_is_a_noop_off_a_phone(self):
        self.platform.IS_MOBILE = False
        self.pw.install()
        self.assertFalse(self.pw._state["installed"])

    def test_unknown_windows_are_left_alone(self):
        class Plain:
            def property(self, _name):
                return None

            def setProperty(self, *_a):
                raise AssertionError("must not touch an unknown window")

        self.assertFalse(self.pw.adapt_window(Plain()))


if __name__ == "__main__":
    unittest.main()
