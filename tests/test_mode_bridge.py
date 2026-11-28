"""Plan v2, T1: on phones Anki's light/dark mode follows Onigiri's Color mode."""
import importlib.util
import sys
import types
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load():
    pkg = types.ModuleType("mode_bridge_test")
    pkg.__path__ = [str(ROOT)]
    sys.modules["mode_bridge_test"] = pkg
    for sub in ("core", "rendering"):
        m = types.ModuleType(f"mode_bridge_test.{sub}")
        m.__path__ = [str(ROOT / sub)]
        sys.modules[f"mode_bridge_test.{sub}"] = m
    mods = {}
    for full, path in (
        ("mode_bridge_test.core.platform", ROOT / "core" / "platform.py"),
        ("mode_bridge_test.rendering.theme_palette", ROOT / "rendering" / "theme_palette.py"),
        ("mode_bridge_test.core.mobile_theme", ROOT / "core" / "mobile_theme.py"),
    ):
        spec = importlib.util.spec_from_file_location(full, path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[full] = module
        spec.loader.exec_module(module)
        mods[full.rsplit(".", 1)[1]] = module
    return mods["platform"], mods["mobile_theme"]


class FakeManager:
    def __init__(self, system_dark):
        self.system_dark = system_dark
        self.calls = 0

    def _determine_night_mode(self):
        self.calls += 1
        return self.system_dark


class ModeBridgeTests(unittest.TestCase):
    def setUp(self):
        self.platform, self.mt = load()

    def test_forced_modes_win_over_anki(self):
        for system_dark in (False, True):
            original = FakeManager(system_dark)._determine_night_mode
            self.assertTrue(self.mt.bridged_night_mode(original, {"onigiriThemeMode": "dark"}))
            self.assertFalse(self.mt.bridged_night_mode(original, {"onigiriThemeMode": "light"}))

    def test_system_passes_anki_through(self):
        for system_dark in (False, True):
            m = FakeManager(system_dark)
            self.assertEqual(self.mt.bridged_night_mode(m._determine_night_mode, {"onigiriThemeMode": "system"}), system_dark)
            self.assertEqual(m.calls, 1)

    def test_missing_or_odd_values_follow_anki(self):
        m = FakeManager(True)
        self.assertTrue(self.mt.bridged_night_mode(m._determine_night_mode, {}))
        self.assertTrue(self.mt.bridged_night_mode(m._determine_night_mode, {"onigiriThemeMode": None}))

    def test_install_wraps_once_on_a_phone_and_never_recurses(self):
        self.platform.IS_MOBILE = True
        m = FakeManager(False)
        self.assertTrue(self.mt.install_mode_bridge(m))
        wrapped = m._determine_night_mode
        self.assertTrue(self.mt.install_mode_bridge(m))  # idempotent
        self.assertIs(m._determine_night_mode, wrapped)
        # config cannot load outside Anki: forced_mode is None -> Anki's answer, once
        self.assertFalse(m._determine_night_mode())
        self.assertEqual(m.calls, 1)

    def test_desktop_is_not_wrapped(self):
        self.platform.IS_MOBILE = False
        m = FakeManager(False)
        original = m._determine_night_mode
        self.assertFalse(self.mt.install_mode_bridge(m))
        self.assertEqual(m._determine_night_mode, original)


if __name__ == "__main__":
    unittest.main()
