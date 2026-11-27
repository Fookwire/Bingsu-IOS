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

    def test_kioku_version_from_bundle_and_cached(self):
        class Bundle:
            mainBundle = None

            def objectForInfoDictionaryKey_(self, key):
                assert key == "CFBundleShortVersionString"
                return "0.2.9"

        bundle = Bundle()
        bundle.mainBundle = bundle
        objc = types.ModuleType("rubicon.objc")
        objc.ObjCClass = lambda name: bundle
        rubicon = types.ModuleType("rubicon")
        rubicon.objc = objc
        self.native.forget_kioku_support()
        with patch.dict(sys.modules, {"rubicon": rubicon, "rubicon.objc": objc}):
            self.assertEqual(self.native.kioku_version(), "0.2.9")
        # cached: still answers without rubicon
        self.assertEqual(self.native.kioku_version(), "0.2.9")
        self.assertIn("Kioku 0.2.9", self.native.kioku_summary())
        self.assertIn("single header: no", self.native.kioku_summary())

    def test_kioku_version_none_without_rubicon(self):
        self.native.forget_kioku_support()
        with patch.dict(sys.modules, {"rubicon": None, "rubicon.objc": None}):
            self.assertIsNone(self.native.kioku_version())
            self.assertIn("version unknown", self.native.kioku_summary())

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


class AuditStepOneTests(unittest.TestCase):
    def setUp(self):
        self.platform, self.native = load()

    def test_pick_files_uses_ankis_getfile_on_mobile(self):
        calls = []
        utils = types.ModuleType("aqt.utils")
        utils.getFile = lambda parent, title, cb, filter="*", multi=False: (calls.append((filter, multi)) or (["/a.png", "/b.png"] if multi else "/a.png"))
        aqt = types.ModuleType("aqt")
        aqt.utils = utils
        with patch.dict(sys.modules, {"aqt": aqt, "aqt.utils": utils}), \
                patch.object(self.platform, "IS_MOBILE", True):
            self.assertEqual(self.platform.pick_files(None, "t", "Images (*.png)", multi=True), ["/a.png", "/b.png"])
            self.assertEqual(self.platform.pick_files(None, "t", "Images (*.png)"), ["/a.png"])
        self.assertEqual(calls, [("Images (*.png)", True), ("Images (*.png)", False)])

    def test_pick_files_cancel_and_errors_give_empty(self):
        utils = types.ModuleType("aqt.utils")
        utils.getFile = lambda *a, **k: None
        aqt = types.ModuleType("aqt")
        aqt.utils = utils
        with patch.dict(sys.modules, {"aqt": aqt, "aqt.utils": utils}), \
                patch.object(self.platform, "IS_MOBILE", True):
            self.assertEqual(self.platform.pick_files(None, "t", "*"), [])
            utils.getFile = lambda *a, **k: (_ for _ in ()).throw(RuntimeError())
            self.assertEqual(self.platform.pick_files(None, "t", "*"), [])

    def test_back_only_from_main_screens(self):
        went = []
        mw = types.SimpleNamespace(reviewer=object(), overview=object(), deckBrowser=object())
        with patch.object(self.native, "_mw", lambda: mw), \
                patch.object(self.native, "go_back", lambda: went.append(1)):
            self.native.handle_command("onigiri_native:back", object())  # a previewer
            self.native.handle_command("onigiri_native:back", None)
            self.assertEqual(went, [])
            self.native.handle_command("onigiri_native:back", mw.reviewer)
            self.assertEqual(went, [1])

    def test_back_from_review_goes_through_onoverview(self):
        # onOverview is what Focus Dango guards
        calls = []
        mw = types.SimpleNamespace(col=object(), state="review",
                                   onOverview=lambda: calls.append("onOverview"),
                                   moveToState=lambda s: calls.append(s))
        with patch.object(self.native, "_mw", lambda: mw):
            self.native.go_back()
            mw.state = "overview"
            self.native.go_back()
        self.assertEqual(calls, ["onOverview", "deckBrowser"])

    def test_background_flushes_pending_writes(self):
        flushed = []
        storage = types.ModuleType("ios_native_test.core.safe_storage")
        storage.flush_pending = lambda: flushed.append(1)
        qt = types.ModuleType("aqt.qt")
        qt.Qt = types.SimpleNamespace(ApplicationState=types.SimpleNamespace(ApplicationActive="active"))
        aqt = types.ModuleType("aqt")
        aqt.qt = qt
        with patch.dict(sys.modules, {"aqt": aqt, "aqt.qt": qt, "ios_native_test.core.safe_storage": storage}):
            sys.modules["ios_native_test.core"].safe_storage = storage
            self.native.flush_on_background("active")
            self.assertEqual(flushed, [])
            self.native.flush_on_background("suspended")
            self.assertEqual(flushed, [1])

    def test_play_sound_is_a_noop_off_ios_and_safe_without_rubicon(self):
        with patch.object(self.native.onigiri_platform, "IS_IOS", False):
            self.assertFalse(self.native.play_sound("/x.wav"))
        with patch.object(self.native.onigiri_platform, "IS_IOS", True), \
                patch.dict(sys.modules, {"rubicon": None, "rubicon.objc": None}):
            self.assertFalse(self.native.play_sound("/x.wav"))


class KiokuSupportTests(unittest.TestCase):
    """Audit 2, R2-04: Kioku honours kioku_hide_titlebar only from v0.2.12."""

    def setUp(self):
        self.platform, self.native = load()
        self.native.forget_kioku_support()
        self._saved = {k: sys.modules.get(k) for k in ("kioku", "kioku.windows")}

    def tearDown(self):
        for k, v in self._saved.items():
            if v is None:
                sys.modules.pop(k, None)
            else:
                sys.modules[k] = v

    def _fake_kioku(self, **attrs):
        kioku = types.ModuleType("kioku")
        windows = types.ModuleType("kioku.windows")
        for k, v in attrs.items():
            setattr(windows, k, v)
        kioku.windows = windows
        sys.modules["kioku"] = kioku
        sys.modules["kioku.windows"] = windows

    def test_supported_when_listed_in_options(self):
        self._fake_kioku(OPTIONS=("kioku_hide_titlebar", "kioku_edge_to_edge"))
        self.assertTrue(self.native.kioku_supports("kioku_hide_titlebar"))
        self.assertFalse(self.native.kioku_supports("something_else"))

    def test_older_kioku_without_options(self):
        self._fake_kioku()
        self.assertFalse(self.native.kioku_supports("kioku_hide_titlebar"))

    def test_no_kioku_at_all(self):
        sys.modules["kioku"] = None  # import raises ImportError
        sys.modules["kioku.windows"] = None
        self.assertFalse(self.native.kioku_supports("kioku_hide_titlebar"))


if __name__ == "__main__":
    unittest.main()
