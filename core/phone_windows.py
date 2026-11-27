"""Phone adapters for Anki's own desktop windows (audit 2: R2-01, R2-09,
R2-10, R2-14, R2-30, R2-34).

Browse, Add, Deck Options, Choose Deck, Custom Study and Preferences are
Anki's unmodified desktop windows. Kioku fits each to the screen and gives it
a "Back" bar; this module takes the next step from inside the add-on, without
touching Anki's data or logic:

* Browse: a drag scrolls the card list (a tap still selects one row) instead of
  selecting ranges of cards; a "Select" toggle gives range selection back on
  purpose; the keyboard does not open by itself; the title is short.
* Add: the note type and deck choosers stack, so each is a full-width row.
* Deck Options: a short title.
* Choose Deck: no keyboard on open, 44pt rows.
* Custom Study, Preferences: bigger check boxes and radio buttons, full-width
  buttons, rows that were wider than the screen stacked.

Everything here is a no-op off a phone (`IS_MOBILE`), every adapter runs once
per window after Kioku has fitted it, and each is wrapped so a failure only
logs one line.
"""

from __future__ import annotations

from typing import Any, Callable

from . import platform as onigiri_platform

ADAPTED = "onigiri_phone_adapted"
TOUCH_ROW = 44

_state: dict[str, Any] = {"installed": False, "filter": None, "browsers": []}


# ── pure helpers (unit tested) ────────────────────────────────────────────────


def short_browse_title(selected: int, base: str = "Browse") -> str:
    """Anki's Browse title ("Browse (13 of 2454 cards selected)") is cut at
    both ends by Kioku's bar. Short: the name and, when cards are selected,
    how many."""
    base = (base or "Browse").strip() or "Browse"
    try:
        selected = int(selected)
    except (TypeError, ValueError):
        selected = 0
    return f"{base} · {selected}" if selected > 0 else base


def select_button_text(selected: int, label: str = "Select") -> str:
    """The Select toggle shows how many cards are selected."""
    try:
        selected = int(selected)
    except (TypeError, ValueError):
        selected = 0
    return f"{label} · {selected}" if selected > 0 else label


def should_redirect_focus(reason_name: str) -> bool:
    """A search field that gets focus on its own (window opened, window became
    active, Anki called setFocus) would open the keyboard. Only a tap, Tab or
    a keyboard shortcut means the person wants to type."""
    return reason_name not in {"MouseFocusReason", "TabFocusReason", "BacktabFocusReason", "ShortcutFocusReason"}


def layout_needs_stacking(hint_width: int, avail_width: int, margin: int = 32) -> bool:
    """A left-to-right row whose natural width is wider than the screen."""
    return hint_width > max(0, avail_width - margin)


# ── helpers using Qt ──────────────────────────────────────────────────────────


def _log(message: str) -> None:
    try:
        print(f"[Onigiri] phone_windows: {message}")
    except Exception:
        pass


def _avail_width() -> int:
    import os

    forced = os.environ.get("ONIGIRI_PHONE_WIDTH")  # test harness: no real phone screen
    if forced and forced.isdigit():
        return int(forced)
    try:
        from aqt.qt import QGuiApplication

        screen = QGuiApplication.primaryScreen()
        return int(screen.availableGeometry().width()) if screen is not None else 390
    except Exception:
        return 390


def _theme_background() -> str | None:
    try:
        from . import mobile_theme

        return mobile_theme.tokens()["background"]
    except Exception:
        return None


def _paint_web_views(window: Any) -> None:
    """A window's web views open grey for a moment before their page is drawn
    (audit 2, R2-34): give them the theme background from the start."""
    color = _theme_background()
    if not color:
        return
    try:
        from aqt.qt import QColor
        from aqt.webview import AnkiWebView

        for view in window.findChildren(AnkiWebView):
            try:
                view.page().setBackgroundColor(QColor(color))
            except Exception:
                pass
    except Exception:
        pass


def _make_focus_filter():
    from aqt.qt import QEvent, QObject, Qt, QTimer

    class NoAutoFocus(QObject):
        """Moves focus off a text field that got it without a tap."""

        def __init__(self, redirect_to: Any, parent: Any = None) -> None:
            super().__init__(parent)
            self._redirect_to = redirect_to

        def eventFilter(self, obj: Any, event: Any) -> bool:
            try:
                if event.type() == QEvent.Type.FocusIn:
                    name = getattr(event.reason(), "name", str(event.reason()))
                    if should_redirect_focus(name):
                        target = self._redirect_to
                        if target is not None:
                            QTimer.singleShot(0, lambda t=target: t.setFocus(Qt.FocusReason.OtherFocusReason))
            except Exception:
                pass
            return False

    return NoAutoFocus


def _keep_keyboard_closed(line_widgets: list, redirect_to: Any, owner: Any) -> None:
    """Install the no-auto-focus filter on each text widget of a window."""
    filter_cls = _make_focus_filter()
    flt = filter_cls(redirect_to, owner)
    owner._onigiri_focus_filter = flt  # keep it alive with the window
    for widget in line_widgets:
        if widget is not None:
            widget.installEventFilter(flt)
    # focus is already there when the adapter runs: move it now
    try:
        from aqt.qt import Qt

        for widget in line_widgets:
            if widget is not None and widget.hasFocus() and redirect_to is not None:
                redirect_to.setFocus(Qt.FocusReason.OtherFocusReason)
                break
    except Exception:
        pass


def _touch_sizes(window: Any) -> None:
    """Check boxes and radio buttons are ~14pt on a desktop. Bigger ones, for
    this window only (never app-wide), and buttons at touch height."""
    try:
        existing = window.styleSheet() or ""
        marker = "/* onigiri-touch */"
        if marker in existing:
            return
        window.setStyleSheet(
            existing
            + "\n"
            + marker
            + "\nQCheckBox, QRadioButton { min-height: 36px; spacing: 10px; }"
            + "\nQCheckBox::indicator, QRadioButton::indicator { width: 22px; height: 22px; }"
            + f"\nQDialogButtonBox QPushButton {{ min-height: {TOUCH_ROW - 6}px; }}\n"
        )
    except Exception:
        pass


def _relax_widths(window: Any) -> None:
    """What Kioku's own window fitting does for every dialog (long labels
    wrap, combo boxes stop being as wide as their longest entry, hard
    minimum widths are dropped), repeated here so the stacking below sees
    the same widths on any Kioku version and in tests. Harmless twice."""
    try:
        from aqt.qt import QComboBox, QLabel, QWidget

        narrow = _avail_width()
        for child in [window] + window.findChildren(QWidget):
            try:
                if child.minimumWidth() > narrow:
                    child.setMinimumWidth(0)
                if isinstance(child, QComboBox):
                    child.setSizeAdjustPolicy(QComboBox.SizeAdjustPolicy.AdjustToMinimumContentsLengthWithIcon)
                    child.setMinimumContentsLength(8)
                elif (
                    isinstance(child, QLabel)
                    and not child.wordWrap()
                    and child.pixmap().isNull()
                    and child.sizeHint().width() > narrow * 0.6
                ):
                    child.setWordWrap(True)
            except Exception:
                continue
    except Exception:
        pass


def _stack_wide_rows(window: Any) -> None:
    """Rows that hold several controls side by side and are wider than the
    screen (Preferences) become columns, so nothing runs off the edge."""
    try:
        from aqt.qt import QBoxLayout

        avail = _avail_width()
        for layout in window.findChildren(QBoxLayout):
            try:
                if layout.direction() != QBoxLayout.Direction.LeftToRight:
                    continue
                if layout.count() < 2:
                    continue
                if layout_needs_stacking(layout.sizeHint().width(), avail):
                    layout.setDirection(QBoxLayout.Direction.TopToBottom)
            except Exception:
                continue
        # the pages and the window measure themselves again
        from aqt.qt import QLayout

        for layout in window.findChildren(QLayout):
            try:
                layout.invalidate()
            except Exception:
                continue
        try:
            window.layout().activate()
        except Exception:
            pass
    except Exception:
        pass


# ── adapters ──────────────────────────────────────────────────────────────────


def adapt_browser(browser: Any) -> None:
    from aqt import gui_hooks
    from aqt.qt import QAbstractItemView, QPushButton, QScroller, QScrollerProperties, Qt

    form = browser.form
    view = form.tableView
    viewport = view.viewport()

    # Taller rows for fingers.
    try:
        header = view.verticalHeader()
        header.setDefaultSectionSize(max(header.defaultSectionSize(), 40))
    except Exception:
        pass

    # A drag scrolls the list; a tap still selects one row (R2-01).
    view.setVerticalScrollMode(QAbstractItemView.ScrollMode.ScrollPerPixel)

    def grab() -> None:
        QScroller.grabGesture(viewport, QScroller.ScrollerGestureType.LeftMouseButtonGesture)
        props = QScroller.scroller(viewport).scrollerProperties()
        props.setScrollMetric(
            QScrollerProperties.ScrollMetric.HorizontalOvershootPolicy,
            QScrollerProperties.OvershootPolicy.OvershootAlwaysOff,
        )
        props.setScrollMetric(
            QScrollerProperties.ScrollMetric.VerticalOvershootPolicy,
            QScrollerProperties.OvershootPolicy.OvershootAlwaysOff,
        )
        QScroller.scroller(viewport).setScrollerProperties(props)

    grab()

    # Select mode: dragging selects ranges again, on purpose.
    select = QPushButton(select_button_text(0), browser)
    select.setCheckable(True)
    select.setFocusPolicy(Qt.FocusPolicy.NoFocus)
    select.setToolTip("Drag to select several cards")

    def toggled(on: bool) -> None:
        if on:
            QScroller.ungrabGesture(viewport)
        else:
            grab()

    select.toggled.connect(toggled)

    def count() -> int:
        try:
            return int(browser.table.len_selection())
        except Exception:
            return 0

    def refresh(*_args: Any) -> None:
        try:
            select.setText(select_button_text(count()))
        except RuntimeError:
            pass  # window already gone

    grid = form.gridLayout
    try:
        grid.addWidget(select, grid.rowCount(), 0, 1, grid.columnCount())
    except Exception:
        browser.layout().addWidget(select)

    # Short title (R2-10) and the Select count follow every selection change.
    try:
        from aqt import tr as anki_tr

        base = anki_tr.qt_misc_browse().replace("&", "")
    except Exception:
        base = "Browse"
    original_update_title = browser.updateTitle

    def update_title(*args: Any, **kwargs: Any) -> Any:
        result = original_update_title(*args, **kwargs)
        try:
            browser.setWindowTitle(short_browse_title(count(), base))
        except Exception:
            pass
        refresh()
        return result

    browser.updateTitle = update_title
    update_title()

    def on_row_changed(b: Any) -> None:
        if b is browser:
            refresh()

    gui_hooks.browser_did_change_row.append(on_row_changed)
    browser._onigiri_row_hook = on_row_changed

    # The keyboard only for a tap in the search field (R2-08/R2-09): Anki
    # focuses it on open and again after a sidebar choice.
    search = form.searchEdit
    _keep_keyboard_closed([search, search.lineEdit()], view, browser)


def adapt_add_cards(window: Any) -> None:
    from aqt.qt import QBoxLayout

    layout = window.form.horizontalLayout
    layout.setDirection(QBoxLayout.Direction.TopToBottom)  # R2-10: stacked, full width


def adapt_deck_options(dialog: Any) -> None:
    try:
        from aqt import tr as anki_tr

        title = anki_tr.deck_config_title()
    except Exception:
        title = "Deck Options"
    dialog.setWindowTitle(title)


def adapt_study_deck(dialog: Any) -> None:
    form = dialog.form
    _keep_keyboard_closed([form.filter], form.list, dialog)  # R2-14
    try:
        form.list.setStyleSheet(f"QListWidget::item {{ min-height: {TOUCH_ROW}px; }}")
    except Exception:
        pass
    _touch_sizes(dialog)


def adapt_custom_study(dialog: Any) -> None:
    _touch_sizes(dialog)


def adapt_preferences(dialog: Any) -> None:
    _touch_sizes(dialog)
    _relax_widths(dialog)
    _stack_wide_rows(dialog)
    _backup_note(dialog)


def _backup_note(dialog: Any) -> None:
    """Anki's text says "restore backups via File > Switch Profile", and there
    is no File menu on a phone (R2-30). Say where it is."""
    try:
        from aqt import tr as anki_tr
        from aqt.qt import QLabel

        original = anki_tr.preferences_you_can_restore_backups_via_fileswitch()
        for label in dialog.findChildren(QLabel):
            if label.text().strip() == original.strip():
                label.setText(
                    original.strip()
                    + "\n"
                    + "On iPhone: Menu → Library → Revert to Backup."
                )
                label.setWordWrap(True)
                break
    except Exception:
        pass


ADAPTERS: dict[str, Callable[[Any], None]] = {
    "Browser": adapt_browser,
    "AddCards": adapt_add_cards,
    "DeckOptionsDialog": adapt_deck_options,
    "StudyDeck": adapt_study_deck,
    "CustomStudy": adapt_custom_study,
    "Preferences": adapt_preferences,
}


def adapt_window(window: Any) -> bool:
    """Run the adapter for `window` once. Returns True if one ran."""
    name = type(window).__name__
    adapter = ADAPTERS.get(name)
    if adapter is None:
        return False
    try:
        if window.property(ADAPTED):
            return False
        window.setProperty(ADAPTED, True)
    except Exception:
        return False
    try:
        adapter(window)
    except Exception as exc:  # noqa: BLE001
        _log(f"{name}: {exc}")
    _paint_web_views(window)
    return True


# ── install ───────────────────────────────────────────────────────────────────


def install() -> None:
    if not onigiri_platform.IS_MOBILE or _state["installed"]:
        return
    try:
        from aqt.qt import QApplication, QEvent, QObject, QTimer, QWidget
    except Exception:
        return
    _state["installed"] = True

    class ShowFilter(QObject):
        def eventFilter(self, obj: Any, event: Any) -> bool:
            try:
                if (
                    event.type() == QEvent.Type.Show
                    and isinstance(obj, QWidget)
                    and obj.isWindow()
                    and type(obj).__name__ in ADAPTERS
                    and not obj.property(ADAPTED)
                ):
                    # after Kioku has fitted the window to the screen
                    QTimer.singleShot(0, lambda w=obj: adapt_window(w))
            except Exception:
                pass
            return False

    app = QApplication.instance()
    if app is None:
        return
    flt = ShowFilter(app)
    _state["filter"] = flt
    app.installEventFilter(flt)
