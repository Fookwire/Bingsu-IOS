"""One set of colours on iPhone/iPad (audit THM-01, THM-02, LAY-09).

On a phone the study screens follow the active Onigiri theme, while Settings
used a neutral charcoal and Qt windows (Kioku's title bar, the add-on list,
the note editor, sync progress) another grey: moving between them looked like
switching apps. Here the active theme's colours become one token set used by:

* Settings (``settings_web.render.palette`` on mobile),
* the Qt application palette (dialogs, Kioku's chrome),
* the screen-edge strips painted at start-up, before the first page reports
  its own colours (the black bands seen until a deck was opened).

Desktop Anki is untouched: everything here is a no-op off mobile.
"""

from . import platform as onigiri_platform

# Tokens: background, surface, raised surface, separator, text, secondary
# text, accent, destructive (+ inset for controls).


def _mode_palette(dark):
    from . import config

    try:
        colors = (config.get_config_readonly() or {}).get("colors") or {}
        mode = "dark" if dark else "light"
        palette = dict(config.DEFAULTS.get("colors", {}).get(mode, {}))
        palette.update(colors.get(mode) or {})
        return palette
    except Exception:
        return {}


def is_dark():
    try:
        from . import config

        return bool(config.effective_night_mode())
    except Exception:
        try:
            from aqt.theme import theme_manager

            return bool(theme_manager.night_mode)
        except Exception:
            return False


def tokens(dark=None, palette=None):
    """Semantic colours derived from the theme palette (hex strings)."""
    from ..rendering.theme_palette import mix, readable_text

    dark = is_dark() if dark is None else bool(dark)
    pal = palette if palette is not None else _mode_palette(dark)
    bg = pal.get("--bg") or ("#171717" if dark else "#ffffff")
    fg = pal.get("--fg") or ("#f1f2f4" if dark else "#202124")
    accent = pal.get("--accent-color") or "#00a982"
    secondary = pal.get("--fg-subtle") or mix(fg, bg, 0.65)
    return {
        "dark": dark,
        "background": bg,
        "surface": mix(fg, bg, 0.05),
        "raised": mix(fg, bg, 0.08),
        "inset": mix(fg, bg, 0.10),
        "inset_hover": mix(fg, bg, 0.14),
        "separator": mix(fg, bg, 0.16),
        "separator_soft": mix(fg, bg, 0.10),
        "text": fg,
        "secondary": secondary,
        "faint": mix(fg, bg, 0.45),
        "accent": accent,
        "on_accent": readable_text(accent),
        "destructive": "#ef6461" if dark else "#d64545",
    }


def settings_palette(theme_palette, dark):
    """Settings chrome (same keys as rendering.theme_palette.chrome_palette)
    in the theme's own colours."""
    t = tokens(dark, theme_palette)
    return {
        "outer": t["background"], "panel": t["surface"],
        "surface": t["surface"], "surface_alt": t["raised"],
        "inset": t["inset"], "inset_hover": t["inset_hover"],
        "hairline": t["separator"], "hairline_soft": t["separator_soft"],
        "fg": t["text"], "fg_muted": t["secondary"], "fg_faint": t["faint"],
        "shadow": "rgba(0, 0, 0, 0.35)" if t["dark"] else "rgba(15, 23, 42, 0.12)",
        "danger": t["destructive"],
        "surface_solid": t["surface"], "muted": t["secondary"],
        "accent": t["accent"], "dark": t["dark"],
    }


def active():
    return bool(onigiri_platform.IS_MOBILE)


def apply_qt_palette():
    """Qt windows (Kioku's title bar, Anki dialogs) in the theme's colours."""
    if not active():
        return False
    try:
        from aqt.qt import QApplication, QColor, QPalette

        app = QApplication.instance()
        if app is None:
            return False
        t = tokens()
        pal = app.palette()
        role = QPalette.ColorRole
        for r, key in (
            (role.Window, "background"), (role.WindowText, "text"),
            (role.Base, "surface"), (role.AlternateBase, "raised"),
            (role.Text, "text"), (role.Button, "inset"),
            (role.ButtonText, "text"), (role.BrightText, "text"),
            (role.Highlight, "accent"), (role.HighlightedText, "on_accent"),
            (role.ToolTipBase, "raised"), (role.ToolTipText, "text"),
            (role.PlaceholderText, "faint"), (role.Link, "accent"),
            (role.Mid, "separator"), (role.Midlight, "separator_soft"),
        ):
            pal.setColor(r, QColor(t[key]))
        app.setPalette(pal)
        return True
    except Exception as exc:
        print(f"Onigiri iOS: theme palette failed: {exc}")
        return False


def paint_initial_edges():
    """The safe-area strips in the theme background straight away."""
    if not active():
        return False
    try:
        from . import ios_native
        from ..rendering.theme_palette import rgb

        r, g, b = rgb(tokens()["background"])
        return ios_native.set_edge_color(f"rgb({r}, {g}, {b})")
    except Exception:
        return False


# Show Answer's colours when the user has not picked their own (audit 2, R2-07).
_SHOW_ANSWER_FACTORY = {
    "light": ("#ffffff", "#2c2c2c"),
    "dark": ("#3a3a3a", "#e0e0e0"),
}
_UTILITY_FACTORY = {
    "light": ("#ffffff", "#2c2c2c"),
    "dark": ("#3a3a3a", "#e0e0e0"),
}


def show_answer_uses_accent(conf, mode):
    """True when Show Answer should be filled with the accent on phones.

    That is when its (background, text) is still the factory pair, or equals
    the Edit/More buttons' pair: applying a theme and the old settings
    migration both write the same colours into both, which looked like a
    choice but is not one. A pair that differs from both is the user's own.
    """
    mode = "dark" if mode == "dark" else "light"
    pair = (
        str(conf.get("onigiri_reviewer_show_answer_btn_bg_" + mode, _SHOW_ANSWER_FACTORY[mode][0])).lower(),
        str(conf.get("onigiri_reviewer_show_answer_btn_text_" + mode, _SHOW_ANSWER_FACTORY[mode][1])).lower(),
    )
    if pair == _SHOW_ANSWER_FACTORY[mode]:
        return True
    utility = (
        str(conf.get("onigiri_reviewer_other_btn_bg_" + mode, _UTILITY_FACTORY[mode][0])).lower(),
        str(conf.get("onigiri_reviewer_other_btn_text_" + mode, _UTILITY_FACTORY[mode][1])).lower(),
    )
    return pair == utility


def refresh():
    apply_qt_palette()
    paint_initial_edges()


# ── Toasts (audit INT-02) ─────────────────────────────────────────────────────
# Anki's tooltip is a desktop label at the bottom-left of the active window:
# on a phone it sat over the tab bar and caught the taps meant for it. Kioku
# already routes every tooltip through aqt.utils._kioku_fit_tooltip; Onigiri
# wraps that hook so the label is themed, centred above the tab bar and lets
# taps through. Anki's own timing and text are unchanged.

TOAST_BOTTOM_GAP = 112  # pt above the bottom of the screen (tab bar + margin)


def style_toast(label):
    if label is None:
        return False
    try:
        from aqt.qt import QFrame, Qt

        t = tokens()
        label.setFrameStyle(QFrame.Shape.NoFrame)
        label.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
        label.setStyleSheet(
            "QLabel { background-color: %s; color: %s; border: 1px solid %s;"
            " border-radius: 14px; font-size: 15px; padding: 2px 6px; }"
            % (t["raised"], t["text"], t["separator"])
        )
        screen = label.screen().availableGeometry() if label.screen() else None
        if screen is None:
            return True
        label.adjustSize()
        width = min(label.sizeHint().width(), screen.width() - 32)
        if width < label.sizeHint().width():
            label.setWordWrap(True)
        height = label.heightForWidth(width) if label.wordWrap() else label.sizeHint().height()
        label.resize(width, height)
        x = screen.left() + (screen.width() - width) // 2
        y = screen.top() + screen.height() - height - TOAST_BOTTOM_GAP
        label.move(x, max(screen.top() + 8, y))
        return True
    except Exception as exc:
        print(f"Onigiri iOS: toast style failed: {exc}")
        return False


def install_toast():
    if not active():
        return False
    try:
        import aqt.utils as utils

        if getattr(utils, "_onigiri_toast", False):
            return True
        original_fit = getattr(utils, "_kioku_fit_tooltip", None)
        if original_fit is not None:
            def fit(label):
                try:
                    original_fit(label)
                finally:
                    style_toast(label)

            utils._kioku_fit_tooltip = fit
        else:
            # Not Kioku (a desktop preview with ONIGIRI_FORCE_MOBILE): wrap the
            # module function, which covers callers that go through aqt.utils.
            original_tooltip = utils.tooltip

            def tooltip(*args, **kwargs):
                original_tooltip(*args, **kwargs)
                style_toast(getattr(utils, "_tooltipLabel", None))

            utils.tooltip = tooltip
        utils._onigiri_toast = True
        return True
    except Exception as exc:
        print(f"Onigiri iOS: toast install failed: {exc}")
        return False


_installed = {"done": False}


def install():
    if not active() or _installed["done"]:
        return
    _installed["done"] = True
    from aqt import gui_hooks

    def later():
        try:
            from aqt.qt import QTimer

            # after Anki's and Kioku's own palette/edge setup for the profile
            QTimer.singleShot(0, refresh)
        except Exception:
            refresh()

    gui_hooks.profile_did_open.append(later)
    gui_hooks.theme_did_change.append(later)
    install_toast()
    try:
        gui_hooks.editor_did_init.append(_one_dismiss_for_editor)
    except Exception:
        pass


def _one_dismiss_for_editor(editor):
    """Edit Current had both Kioku's "Back" bar and its own Close button:
    keep Close, drop Kioku's bar (audit THM-02). Add and Browse keep theirs."""
    try:
        window = getattr(editor, "parentWindow", None)
        if window is not None and type(window).__name__ == "EditCurrent":
            from . import ios_native

            # Only where Kioku honours it: older builds keep their bar, and
            # then Anki's Close button stays as the second dismiss.
            if ios_native.kioku_supports("kioku_hide_titlebar"):
                window.setProperty("kioku_hide_titlebar", True)
    except Exception:
        pass
