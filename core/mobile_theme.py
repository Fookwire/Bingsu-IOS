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


def refresh():
    apply_qt_palette()
    paint_initial_edges()


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
