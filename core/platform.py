"""Where Onigiri is running: Kioku on iPhone/iPad, or a desktop Anki.

This fork targets Kioku (github.com/krmanik/kioku), the unmodified Anki
desktop app built for iOS. Things to know about that environment:

* ``sys.platform`` is ``"ios"``, but ``platform.system()`` answers
  ``"Darwin"`` to add-on code (Kioku patches it for old add-ons), so never use
  ``platform.system()`` to tell iOS from macOS.
* Qt WebEngine is a stand-in over WKWebView: pages are native iOS views,
  so Qt widgets drawn *over* a web view are hidden behind it, ``grab()``
  of a web view is blank, and unknown WebEngine APIs are silent no-ops.
* No subprocesses, no ctypes libraries, touch only, phone-sized screens.

Set ``ONIGIRI_FORCE_MOBILE=1`` on a desktop Anki to preview the iOS code
paths (dialog sizing, touch UI) without a device; ``=phone`` also treats the
screen as a phone's.
"""

from __future__ import annotations

import os
import sys

IS_IOS: bool = sys.platform == "ios"
IS_ANDROID: bool = sys.platform == "android"
IS_KIOKU: bool = "kioku" in sys.modules or "kioku_platform" in sys.modules
_FORCE = os.environ.get("ONIGIRI_FORCE_MOBILE", "").strip().lower()
FORCE_MOBILE: bool = _FORCE not in ("", "0")
FORCE_PHONE: bool = _FORCE == "phone"

# Phone/tablet code paths: touch UI, full-screen dialogs, no floating windows.
IS_MOBILE: bool = IS_IOS or IS_ANDROID or FORCE_MOBILE

# Below this width (points / CSS px) we use the phone layout. Matches Kioku's
# own breakpoint (kioku/webscripts.py, kioku/mainsplit.py).
PHONE_MAX_WIDTH = 600


def screen_size(widget=None) -> tuple[int, int]:
    """Available size of the screen showing ``widget`` (or the primary one)."""
    try:
        from aqt.qt import QGuiApplication

        screen = None
        if widget is not None:
            try:
                screen = widget.screen()
            except Exception:
                screen = None
        if screen is None:
            screen = QGuiApplication.primaryScreen()
        if screen is not None:
            geo = screen.availableGeometry()
            return geo.width(), geo.height()
    except Exception:
        pass
    return (1280, 800)


def is_phone(widget=None) -> bool:
    """True on a phone-sized screen (portrait iPhone, iPad split view)."""
    if not IS_MOBILE:
        return False
    if FORCE_PHONE:
        return True
    return screen_size(widget)[0] <= PHONE_MAX_WIDTH


def is_phone_device(widget=None) -> bool:
    """True on a phone in either orientation (the screen's shorter side is
    phone-sized). iPads, including split view, are not phones here: use the
    CSS classes from web/mobile.js for width-based layout."""
    if not IS_MOBILE:
        return False
    if FORCE_PHONE:
        return True
    w, h = screen_size(widget)
    return min(w, h) <= PHONE_MAX_WIDTH


def body_classes() -> str:
    """Classes for <body>/<html> so CSS can target the iOS build."""
    if not IS_MOBILE:
        return ""
    classes = ["onigiri-mobile"]
    if IS_IOS:
        classes.append("onigiri-ios")
    return " ".join(classes)


def make_managed_window(widget) -> bool:
    """Turn a floating Tool/frameless/translucent window into a plain dialog
    on mobile. Returns True when it did.

    Kioku fills the screen with every top-level Window/Dialog and gives it a
    title bar with a Close button (kioku/windows.py). It leaves Tool windows
    alone, so those would open at their desktop size with no way to close
    them. Size floors and caps are cleared so the window can fill the screen.
    """
    if not IS_MOBILE:
        return False
    try:
        from aqt.qt import Qt

        widget.setWindowFlags(Qt.WindowType.Dialog)
        widget.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, False)
        widget.setMinimumSize(0, 0)
        widget.setMaximumSize(16777215, 16777215)
        return True
    except Exception as exc:
        print(f"Onigiri: could not adapt window for mobile: {exc}")
        return False
