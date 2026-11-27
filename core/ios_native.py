"""Native iOS touches for Onigiri running inside Kioku.

Kioku is desktop Anki on iOS: every page is a WKWebView and the main window
is a Qt window. Without its own app, an add-on can still reach far enough to
make Onigiri feel like an iOS app rather than a web page in a desktop shell:

* **Menu row.** Anki's File/Edit/View/Tools/Help row (``mw.form.menubar``)
  stays hidden on iPhones, and on iPads where iPadOS 26 puts the same menus
  in the system menu bar. The menus open from Onigiri's Menu button
  (``webview_handlers.show_app_menu``). Add-on config
  ``ios_show_menu_row: true`` brings the row back.
* **Edges.** The strips under the status bar and the home indicator are the
  main window's background (Kioku keeps them as contents margins), Anki grey
  whatever the theme. mobile.js reports the page's background and the
  window, the web views' under-page colour and the strips take it.
* **No rubber band.** A drag at a page's end pulled the whole interface
  around. The web views' scroll views stop bouncing (pages still scroll).
* **Haptics.** UIKit feedback generators for long-press menus, picking up a
  deck to reorder, and answering a card.

Every native call goes through Kioku's own objects (``page()._web.webview``,
rubicon-objc) and is wrapped: on a desktop, in Kioku's web build, on Android
or with a Kioku that changed its internals, each step quietly does nothing.
"""

from __future__ import annotations

import re
from typing import Any

from . import platform as onigiri_platform

_state: dict[str, Any] = {"edge": None, "installed": False}


def active() -> bool:
    return onigiri_platform.IS_IOS


# --- helpers -------------------------------------------------------------------


def _mw():
    try:
        from aqt import mw

        return mw
    except Exception:
        return None


def _prop(obj: Any, name: str) -> Any:
    """An Objective-C property through rubicon (getters can come back as
    bound methods when the runtime declares no property)."""
    try:
        from kioku_platform.webview import prop  # type: ignore

        return prop(obj, name)
    except ImportError:
        pass
    value = getattr(obj, name)
    if callable(value) and not isinstance(value, (int, float, str)):
        try:
            value = value()
        except TypeError:
            pass
    return value


def native_webview(web: Any) -> Any:
    """The WKWebView behind an AnkiWebView in Kioku, or None."""
    try:
        page = web.page()
        platform_view = getattr(page, "_web", None)
        return getattr(platform_view, "webview", None)
    except Exception:
        return None


def _config() -> dict:
    mw = _mw()
    try:
        return mw.addonManager.getConfig(__name__.split(".")[0]) or {}
    except Exception:
        return {}


# --- menu row ------------------------------------------------------------------


def _system_menu_bar() -> bool:
    try:
        from kioku_platform import menubar  # type: ignore

        return bool(menubar.available())
    except Exception:
        return False


def should_hide_menu_row() -> bool:
    if not active() or _config().get("ios_show_menu_row"):
        return False
    return onigiri_platform.is_phone_device() or _system_menu_bar()


def hide_menu_row() -> None:
    """Hide Anki's menu row and keep it hidden: Anki shows it again whenever
    it leaves its full screen mode."""
    mw = _mw()
    if mw is None or not should_hide_menu_row():
        return
    try:
        import aqt.main

        cls = aqt.main.AnkiQt
        if not getattr(cls, "_onigiri_menu_row", False):
            cls._onigiri_menu_row = True
            original_show = cls.show_menubar

            def show_menubar(self) -> None:  # type: ignore[no-untyped-def]
                if should_hide_menu_row():
                    self.hide_menubar()
                else:
                    original_show(self)

            cls.show_menubar = show_menubar
        mw.hide_menubar()
        _log("menu row hidden")
    except Exception as exc:
        _log(f"could not hide the menu row: {exc}")


# --- edges ---------------------------------------------------------------------

_RGB = re.compile(r"rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+%?))?\s*\)")


def parse_css_color(text: str):
    """(r, g, b) from ``rgb()/rgba()/#rrggbb``; None for transparent or
    anything else."""
    text = (text or "").strip().lower()
    match = _RGB.fullmatch(text)
    if match:
        alpha = match.group(4)
        if alpha is not None:
            a = float(alpha[:-1]) / 100 if alpha.endswith("%") else float(alpha)
            if a < 0.5:
                return None
        return tuple(max(0, min(255, int(float(match.group(i))))) for i in (1, 2, 3))
    if re.fullmatch(r"#[0-9a-f]{6}", text):
        return tuple(int(text[i : i + 2], 16) for i in (1, 3, 5))
    return None


def _log(message: str) -> None:
    # Kioku writes stdout to Documents/kioku.log
    print(f"Onigiri iOS: {message}")


def set_edge_color(css_color: str) -> bool:
    """Paint the safe-area strips and the web views' under-page colour.
    ``css_color`` is one colour or ``top|bottom`` (the status-bar strip and
    the home-indicator strip can sit on different surfaces)."""
    parts = (css_color or "").split("|")
    top = parse_css_color(parts[0])
    bottom = parse_css_color(parts[1]) if len(parts) > 1 else top
    top = top or bottom
    bottom = bottom or top
    mw = _mw()
    if top is None or mw is None or not active():
        if active():
            _log(f"no usable edge colour in {css_color!r}")
        return False
    if _state["edge"] == (top, bottom):
        return True
    _state["edge"] = (top, bottom)
    try:
        from aqt.qt import QColor, QPalette

        color = QColor(*top)
        palette = mw.palette()
        palette.setColor(QPalette.ColorRole.Window, color)
        mw.setPalette(palette)
        mw.setAutoFillBackground(True)
        # A stylesheet beats the palette, and Anki's app stylesheet has a
        # `QWidget { ... }` rule: a rule on the main window itself (and
        # nothing under it) wins over both. Top half one colour, bottom
        # half the other; the web views cover everything but the strips.
        if top == bottom:
            declarations = "background-color: rgb(%d, %d, %d);" % top
        else:
            declarations = (
                "background-color: rgb(%d, %d, %d); background: qlineargradient(x1:0, y1:0, x2:0, y2:1, "
                "stop:0 rgb(%d, %d, %d), stop:0.5 rgb(%d, %d, %d), stop:0.5001 rgb(%d, %d, %d), "
                "stop:1 rgb(%d, %d, %d));" % (top + top + top + bottom + bottom)
            )
        _set_window_rule(mw, declarations)
        for name, rgb in (("web", top), ("toolbarWeb", top), ("bottomWeb", bottom)):
            web = getattr(mw, name, None)
            if web is not None:
                try:
                    web.page().setBackgroundColor(QColor(*rgb))
                except Exception:
                    pass
        _log(f"edge colours {top} / {bottom}")
        return True
    except Exception as exc:
        _log(f"could not colour the screen edges: {exc}")
        return False


_RULE_START = "/* onigiri-edges */"
_RULE_END = "/* /onigiri-edges */"


def _set_window_rule(mw, declarations: str) -> None:
    name = mw.objectName() or ""
    selector = "AnkiQt" + (f", QMainWindow#{name}" if name else "")
    rule = f"{_RULE_START} {selector} {{ {declarations} }} {_RULE_END}"
    sheet = mw.styleSheet() or ""
    start = sheet.find(_RULE_START)
    if start >= 0:
        end = sheet.find(_RULE_END, start)
        end = len(sheet) if end < 0 else end + len(_RULE_END)
        sheet = sheet[:start] + sheet[end:]
    mw.setStyleSheet((sheet.strip() + "\n" + rule).strip())
    mw.update()


EDGE_JS = r"""
(function () {
    function opaque(el, pseudo) {
        if (!el) return '';
        var c = getComputedStyle(el, pseudo || null).backgroundColor;
        var m = c && c.match(/rgba?\(([^)]+)\)/);
        if (!m) return '';
        var p = m[1].split(/[\s,\/]+/).filter(Boolean);
        if (p.length > 3 && parseFloat(p[3]) < 0.5) return '';
        return c.replace(/\s+/g, '');
    }
    function at(x, y) {
        var el = document.elementFromPoint(x, y);
        for (; el && el !== document.documentElement; el = el.parentElement) {
            var c = opaque(el) || opaque(el, '::before');
            if (c) return c;
        }
        return opaque(document.body) || opaque(document.body, '::before') || opaque(document.documentElement);
    }
    var h = window.innerHeight || document.documentElement.clientHeight;
    return at(2, 2) + '|' + at(2, h - 2);
})()
"""


def query_edge_color() -> None:
    """Ask the main page for its edge colours from Python as well, in case
    mobile.js's own report did not arrive."""
    mw = _mw()
    if mw is None or not active():
        return
    try:
        mw.web.evalWithCallback(EDGE_JS, lambda value: set_edge_color(value or ""))
    except Exception as exc:
        _log(f"edge colour query failed: {exc}")


# --- bounce --------------------------------------------------------------------


def stop_bounce(web: Any) -> bool:
    view = native_webview(web)
    if view is None:
        return False
    try:
        scroll = _prop(view, "scrollView")
        scroll.setBounces_(False)
        scroll.setBouncesZoom_(False)
        return True
    except Exception:
        return False


def stop_bounce_everywhere() -> None:
    """Every Anki web view that exists now (main window and open dialogs)."""
    if not active():
        return
    try:
        from aqt.qt import QApplication
        from aqt.webview import AnkiWebView

        for widget in QApplication.allWidgets():
            if isinstance(widget, AnkiWebView) and not getattr(widget, "_onigiri_no_bounce", False):
                if stop_bounce(widget):
                    widget._onigiri_no_bounce = True
    except Exception:
        pass


# --- haptics -------------------------------------------------------------------

_IMPACT = {"light": 0, "medium": 1, "heavy": 2, "soft": 3, "rigid": 4}
_NOTIFY = {"success": 0, "warning": 1, "error": 2}
_generators: dict[str, Any] = {}


def haptic(kind: str = "light") -> bool:
    if not active():
        return False
    try:
        from rubicon.objc import ObjCClass  # type: ignore

        gen = _generators.get(kind)
        if kind == "selection":
            if gen is None:
                gen = ObjCClass("UISelectionFeedbackGenerator").alloc().init()
            gen.selectionChanged()
        elif kind in _NOTIFY:
            if gen is None:
                gen = ObjCClass("UINotificationFeedbackGenerator").alloc().init()
            gen.notificationOccurred_(_NOTIFY[kind])
        else:
            if gen is None:
                gen = ObjCClass("UIImpactFeedbackGenerator").alloc().initWithStyle_(
                    _IMPACT.get(kind, 0)
                )
            gen.impactOccurred()
        _generators[kind] = gen
        return True
    except Exception:
        return False


# --- sound ---------------------------------------------------------------------

_players: list = []


def play_sound(path: str) -> bool:
    """Play a short cue (Pomodoro) through its own AVAudioPlayer, apart from
    Anki's audio queue: playing it through Anki stopped the card's audio.
    False if this can't be done (the caller falls back)."""
    if not active():
        return False
    try:
        from rubicon.objc import ObjCClass, at  # type: ignore

        url = ObjCClass("NSURL").fileURLWithPath_(at(path))
        player = ObjCClass("AVAudioPlayer").alloc().initWithContentsOfURL_error_(url, None)
        if player is None:
            return False
        player.prepareToPlay()
        player.play()
        # the player must stay alive while it plays
        _players.append(player)
        del _players[:-4]
        return True
    except Exception as exc:
        _log(f"sound playback failed: {exc}")
        return False


# --- wiring --------------------------------------------------------------------


def _is_main_screen(context) -> bool:
    """The deck list, overview or reviewer in the main window: not a card
    previewer or another window that also shows a card (#qa)."""
    mw = _mw()
    if mw is None or context is None:
        return False
    return any(context is getattr(mw, name, None) for name in ("reviewer", "overview", "deckBrowser"))


def handle_command(cmd: str, context=None) -> bool:
    """``onigiri_native:<what>[:<arg>]`` from web/mobile.js."""
    if not cmd.startswith("onigiri_native:"):
        return False
    _, _, rest = cmd.partition(":")
    what, _, arg = rest.partition(":")
    if what == "edge":
        set_edge_color(arg)
    elif what == "ready":
        stop_bounce_everywhere()
    elif what == "haptic":
        haptic(arg or "light")
    elif what == "back":
        if _is_main_screen(context):
            go_back()
    return True


def go_back() -> None:
    """The nav bar's ‹ and the edge swipe: reviewer -> overview -> decks.
    Through Anki's onOverview/onDeckBrowser, which Focus Dango guards (a
    direct moveToState walked out of a locked study session)."""
    mw = _mw()
    if mw is None or mw.col is None:
        return
    try:
        if mw.state == "review":
            mw.onOverview()
        elif mw.state in ("overview", "resetRequired"):
            # Focus Dango only guards leaving a review
            mw.moveToState("deckBrowser")
    except Exception as exc:
        print(f"Onigiri: back failed: {exc}")


def _after_main_window() -> None:
    try:
        from aqt.qt import QTimer

        # after Kioku's own main-window setup (menu bar, edges)
        QTimer.singleShot(0, hide_menu_row)
        QTimer.singleShot(0, stop_bounce_everywhere)
    except Exception:
        pass
    _watch_app_state()


def flush_on_background(state) -> None:
    """iOS suspends a backgrounded app and may then kill it without any
    close event: game progress still waiting in Onigiri's write queue (Nook
    XP, Onigimon; written ~1.5 s after an answer) was lost. Write it now."""
    try:
        from aqt.qt import Qt

        if state == Qt.ApplicationState.ApplicationActive:
            return
        from . import safe_storage

        safe_storage.flush_pending()
    except Exception as exc:
        _log(f"background flush failed: {exc}")


def _watch_app_state() -> None:
    mw = _mw()
    if mw is None or _state.get("app_state_watch"):
        return
    try:
        mw.app.applicationStateChanged.connect(flush_on_background)
        _state["app_state_watch"] = True
    except Exception as exc:
        _log(f"could not watch the app state: {exc}")


def _after_state_change(*_args) -> None:
    try:
        from aqt.qt import QTimer

        QTimer.singleShot(900, query_edge_color)
    except Exception:
        pass


def install() -> None:
    if not active() or _state["installed"]:
        return
    _state["installed"] = True
    from aqt import gui_hooks

    gui_hooks.main_window_did_init.append(_after_main_window)
    gui_hooks.profile_did_open.append(_after_main_window)
    gui_hooks.state_did_change.append(_after_state_change)
    gui_hooks.theme_did_change.append(lambda: _state.update(edge=None))
    _log("native layer installed")
