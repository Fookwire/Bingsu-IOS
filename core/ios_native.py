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
    except Exception as exc:
        print(f"Onigiri: could not hide the menu row: {exc}")


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


def set_edge_color(css_color: str) -> bool:
    """Paint the safe-area strips and the web views' under-page colour."""
    rgb = parse_css_color(css_color)
    mw = _mw()
    if rgb is None or mw is None or not active():
        return False
    if _state["edge"] == rgb:
        return True
    _state["edge"] = rgb
    try:
        from aqt.qt import QColor, QPalette

        color = QColor(*rgb)
        palette = mw.palette()
        palette.setColor(QPalette.ColorRole.Window, color)
        mw.setPalette(palette)
        mw.setAutoFillBackground(True)
        for name in ("web", "toolbarWeb", "bottomWeb"):
            web = getattr(mw, name, None)
            if web is not None:
                try:
                    web.page().setBackgroundColor(color)
                except Exception:
                    pass
        return True
    except Exception as exc:
        print(f"Onigiri: could not colour the screen edges: {exc}")
        return False


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


# --- wiring --------------------------------------------------------------------


def handle_command(cmd: str) -> bool:
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
        go_back()
    return True


def go_back() -> None:
    """The nav bar's ‹ and the edge swipe: reviewer -> overview -> decks."""
    mw = _mw()
    if mw is None or mw.col is None:
        return
    try:
        if mw.state == "review":
            mw.moveToState("overview")
        elif mw.state in ("overview", "resetRequired"):
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


def install() -> None:
    if not active() or _state["installed"]:
        return
    _state["installed"] = True
    from aqt import gui_hooks

    gui_hooks.main_window_did_init.append(_after_main_window)
    gui_hooks.profile_did_open.append(_after_main_window)
