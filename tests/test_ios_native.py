"""core/ios_native.py: the Kioku/iOS native layer must be a no-op off iOS
and must never raise, whatever Kioku's internals look like."""
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def load():
    pkg = types.ModuleType("ios_native_test")
    pkg.__path__ = [str(ROOT)]
    core = types.ModuleType("ios_native_test.core")
    core.__path__ = [str(ROOT / "core")]
    sys.modules["ios_native_test"] = pkg
    sys.modules["ios_native_test.core"] = core
    mods = {}
    for name in ("platform", "ios_native"):
        full = f"ios_native_test.core.{name}"
        spec = importlib.util.spec_from_file_location(full, ROOT / "core" / f"{name}.py")
        module = importlib.util.module_from_spec(spec)
        sys.modules[full] = module
        spec.loader.exec_module(module)
        mods[name] = module
    return mods["platform"], mods["ios_native"]


class FakeScroll:
    def __init__(self):
        self.bounces = True
        self.bounces_zoom = True

    def setBounces_(self, value):
        self.bounces = value

    def setBouncesZoom_(self, value):
        self.bounces_zoom = value


class IosNativeTests(unittest.TestCase):
    def setUp(self):
        self.platform, self.native = load()

    def test_parse_css_color(self):
        p = self.native.parse_css_color
        self.assertEqual(p("rgb(30, 30, 46)"), (30, 30, 46))
        self.assertEqual(p("rgba(30,30,46,1)"), (30, 30, 46))
        self.assertEqual(p("rgb(30 30 46 / 100%)"), (30, 30, 46))
        self.assertEqual(p("#1e1e2e"), (30, 30, 46))
        self.assertIsNone(p("rgba(0, 0, 0, 0)"))
        self.assertIsNone(p("transparent"))
        self.assertIsNone(p("url(x)"))
        self.assertIsNone(p(""))

    def test_off_ios_everything_is_a_noop(self):
        with patch.object(self.native.onigiri_platform, "IS_IOS", False):
            self.assertFalse(self.native.active())
            self.assertFalse(self.native.haptic("light"))
            self.assertFalse(self.native.set_edge_color("rgb(1,2,3)"))
            self.assertFalse(self.native.should_hide_menu_row())
            self.native.stop_bounce_everywhere()
            self.native.install()
            self.assertFalse(self.native._state["installed"])

    def test_handle_command_only_takes_its_prefix(self):
        self.assertFalse(self.native.handle_command("onigiri_app_menu"))
        with patch.object(self.native.onigiri_platform, "IS_IOS", False):
            self.assertTrue(self.native.handle_command("onigiri_native:haptic:light"))
            self.assertTrue(self.native.handle_command("onigiri_native:edge:rgb(1,2,3)"))
            self.assertTrue(self.native.handle_command("onigiri_native:ready"))
            self.assertTrue(self.native.handle_command("onigiri_native:unknown"))

    def test_haptic_without_rubicon_does_not_raise(self):
        with patch.object(self.native.onigiri_platform, "IS_IOS", True), \
                patch.dict(sys.modules, {"rubicon": None, "rubicon.objc": None}):
            self.assertFalse(self.native.haptic("medium"))

    def test_native_webview_and_stop_bounce(self):
        scroll = FakeScroll()
        view = types.SimpleNamespace(scrollView=scroll)
        page = types.SimpleNamespace(_web=types.SimpleNamespace(webview=view))
        web = types.SimpleNamespace(page=lambda: page)
        self.assertIs(self.native.native_webview(web), view)
        self.assertTrue(self.native.stop_bounce(web))
        self.assertFalse(scroll.bounces)
        self.assertFalse(scroll.bounces_zoom)

    def test_stop_bounce_tolerates_other_webviews(self):
        # QtWebEngine on a desktop: page() has no _web
        web = types.SimpleNamespace(page=lambda: object())
        self.assertIsNone(self.native.native_webview(web))
        self.assertFalse(self.native.stop_bounce(web))
        broken = types.SimpleNamespace(page=lambda: (_ for _ in ()).throw(RuntimeError()))
        self.assertIsNone(self.native.native_webview(broken))


class Margins:
    def __init__(self, l, t, r, b):
        self.v = (l, t, r, b)

    def left(self): return self.v[0]
    def top(self): return self.v[1]
    def right(self): return self.v[2]
    def bottom(self): return self.v[3]


class FakeMw:
    def __init__(self, state, margins):
        self.state = state
        self.margins = margins
        self.evals = []
        self.web = types.SimpleNamespace(eval=self.evals.append)

    def windowHandle(self):
        return types.SimpleNamespace(safeAreaMargins=lambda: Margins(0, 59, 0, 34))

    def contentsMargins(self):
        return Margins(*self.margins)

    def setContentsMargins(self, *m):
        self.margins = m


class EdgeToEdgeTests(unittest.TestCase):
    def setUp(self):
        self.platform, self.native = load()

    def run_update(self, state, margins):
        mw = FakeMw(state, margins)
        with patch.object(self.native.onigiri_platform, "IS_IOS", True):
            self.native._after_kioku_edges(types.SimpleNamespace(mw=mw))
        return mw

    def test_home_fills_the_screen(self):
        mw = self.run_update("deckBrowser", (0, 59, 0, 34))
        self.assertEqual(mw.margins, (0, 0, 0, 0))
        self.assertEqual(self.native._state["insets"], (59, 34))
        self.assertIn("--onigiri-edge-top','59px'", mw.evals[-1])
        self.assertIn("onigiri-edge-to-edge',true", mw.evals[-1])
        self.assertIn("59px", self.native.edge_vars_css())

    def test_home_with_bottom_bar_keeps_bottom(self):
        mw = self.run_update("deckBrowser", (0, 59, 0, 0))
        self.assertEqual(mw.margins, (0, 0, 0, 0))
        self.assertEqual(self.native._state["insets"], (59, 0))

    def test_other_screens_keep_kiokus_layout(self):
        self.run_update("deckBrowser", (0, 59, 0, 34))
        mw = self.run_update("review", (0, 59, 0, 0))
        self.assertEqual(mw.margins, (0, 59, 0, 0))
        self.assertEqual(self.native._state["insets"], (0, 0))
        self.assertIn("onigiri-edge-to-edge',false", mw.evals[-1])

    def test_off_ios_nothing_changes(self):
        mw = FakeMw("deckBrowser", (0, 59, 0, 34))
        self.native._after_kioku_edges(types.SimpleNamespace(mw=mw))
        self.assertEqual(mw.margins, (0, 59, 0, 34))


class MobileJsContractTests(unittest.TestCase):
    """mobile.js talks to ios_native through these commands."""

    def test_commands_match(self):
        js = (ROOT / "web" / "mobile.js").read_text(encoding="utf-8")
        self.assertIn("'onigiri_native:' + what", js)
        for cmd in ("'ready'", "'edge:'", "'haptic:'"):
            self.assertIn(cmd, js)

    def test_hook_registered(self):
        init = (ROOT / "__init__.py").read_text(encoding="utf-8")
        self.assertIn("gui_hooks.webview_did_receive_js_message.append(_on_native_cmd)", init)
        self.assertIn("ios_native.install()", init)


if __name__ == "__main__":
    unittest.main()
