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


# Windows that only need their web views and background painted in the theme
# before the first frame (audit 3, R3-26: the editor opened on a grey box).
PAINT_ONLY = {"NewEditCurrent", "Previewer", "MultiCardPreviewer", "BrowserPreviewer", "CardLayout", "FieldDialog"}


def paint_window(window: Any) -> None:
    """Theme background behind and in the window's web views, no adapter."""
    _paint_web_views(window)
    color = _theme_background()
    if not color:
        return
    try:
        from aqt.qt import QColor, QPalette

        pal = window.palette()
        pal.setColor(QPalette.ColorRole.Window, QColor(color))
        window.setPalette(pal)
        window.setAutoFillBackground(True)
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


def _make_toggle_filter():
    from aqt.qt import QEvent, QObject

    class ToggleLabelSync(QObject):
        """Keeps the wrapped label's enabled/visible state with its check box."""

        def __init__(self, box: Any, label: Any) -> None:
            super().__init__(box)
            self._label = label

        def eventFilter(self, obj: Any, event: Any) -> bool:
            try:
                kind = event.type()
                if kind == QEvent.Type.EnabledChange:
                    self._label.setEnabled(obj.isEnabled())
                elif kind == QEvent.Type.Hide:
                    self._label.hide()
                elif kind == QEvent.Type.Show:
                    self._label.show()
            except RuntimeError:
                pass
            return False

    return ToggleLabelSync


def _find_layout_slot(widget: Any):
    """(layout, index) of the layout that holds `widget`, or (None, -1)."""
    try:
        from aqt.qt import QLayout

        parent = widget.parentWidget()
        candidates = ([parent.layout()] if parent is not None and parent.layout() else []) + (
            parent.findChildren(QLayout) if parent is not None else []
        )
        for layout in candidates:
            index = layout.indexOf(widget)
            if index >= 0:
                return layout, index
    except Exception:
        pass
    return None, -1


def _wrap_toggle_text(widget: Any) -> bool:
    """A check box or radio button cannot wrap its text, so a long label is as
    wide as its sentence and pushes the whole page off the screen (audit 3,
    R3-02). Move the text into a word-wrapping label beside the box. The
    widget itself stays (Anki reads and connects it), tapping the label
    toggles it, and the tooltip, enabled and visible state follow it."""
    try:
        from aqt.qt import QGridLayout, QBoxLayout, QHBoxLayout, QLabel, QSizePolicy, Qt

        text = widget.text()
        if not text or widget.property("onigiri_wrapped"):
            return False
        layout, index = _find_layout_slot(widget)
        if layout is None:
            return False
        label = QLabel(text, widget.parentWidget())
        label.setWordWrap(True)
        label.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred)
        label.setMinimumWidth(0)
        label.setToolTip(widget.toolTip())
        label.setBuddy(widget)
        label.setEnabled(widget.isEnabled())
        label.setVisible(widget.isVisibleTo(widget.parentWidget()))
        label.setCursor(Qt.CursorShape.PointingHandCursor)
        label.mousePressEvent = lambda _e, w=widget: w.click() if w.isEnabled() else None
        widget.setText("")
        widget.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Preferred)
        row = QHBoxLayout()
        row.setContentsMargins(0, 0, 0, 0)
        row.setSpacing(8)
        if isinstance(layout, QGridLayout):
            r, c, rs, cs = layout.getItemPosition(index)
            layout.removeWidget(widget)
            row.addWidget(widget, 0)
            row.addWidget(label, 1)
            layout.addLayout(row, r, c, rs, cs)
        elif isinstance(layout, QBoxLayout):
            layout.removeWidget(widget)
            row.addWidget(widget, 0)
            row.addWidget(label, 1)
            layout.insertLayout(index, row)
        else:
            label.deleteLater()
            widget.setText(text)
            return False
        widget.setProperty("onigiri_wrapped", True)
        widget.installEventFilter(_make_toggle_filter()(widget, label))
        return True
    except Exception as exc:  # noqa: BLE001
        _log(f"wrap toggle: {exc}")
        return False


def _wrap_long_toggles(window: Any, margin: int = 80) -> int:
    """Wrap the text of every check box / radio button wider than the screen."""
    count = 0
    try:
        from aqt.qt import QCheckBox, QRadioButton

        limit = _avail_width() - margin
        for box in window.findChildren(QCheckBox) + window.findChildren(QRadioButton):
            try:
                if box.sizeHint().width() > limit and _wrap_toggle_text(box):
                    count += 1
            except Exception:
                continue
    except Exception:
        pass
    return count


def _shrinkable_inputs(window: Any) -> None:
    """Spin boxes, combo boxes and line edits may shrink below their sizeHint."""
    try:
        from aqt.qt import QComboBox, QLineEdit, QSizePolicy, QSpinBox, QDoubleSpinBox

        for kind in (QSpinBox, QDoubleSpinBox, QComboBox, QLineEdit):
            for widget in window.findChildren(kind):
                try:
                    widget.setMinimumWidth(0)
                    policy = widget.sizePolicy()
                    policy.setHorizontalPolicy(QSizePolicy.Policy.Preferred)
                    widget.setSizePolicy(policy)
                except Exception:
                    continue
    except Exception:
        pass


def _cap_page_widths(window: Any) -> None:
    """A tab page may never be wider than the screen: Kioku's scroll pages
    pan sideways by touch when it is (audit 3, R3-02). Caps follow the page's
    viewport; without Kioku (tests) the tab pages themselves are capped."""
    try:
        from aqt.qt import QEvent, QObject, QScrollArea, QScroller, QScrollerProperties, QTabWidget

        class Cap(QObject):
            def __init__(self, area: Any) -> None:
                super().__init__(area)
                self._area = area

            def eventFilter(self, obj: Any, event: Any) -> bool:
                try:
                    if event.type() == QEvent.Type.Resize:
                        inner = self._area.widget()
                        if inner is not None:
                            inner.setMaximumWidth(max(0, self._area.viewport().width()))
                except RuntimeError:
                    pass
                return False

        for area in window.findChildren(QScrollArea):
            inner = area.widget()
            if inner is None:
                continue
            cap = Cap(area)
            area.viewport().installEventFilter(cap)
            inner.setMaximumWidth(max(0, area.viewport().width()))
            try:
                scroller = QScroller.scroller(area.viewport())
                props = scroller.scrollerProperties()
                props.setScrollMetric(
                    QScrollerProperties.ScrollMetric.HorizontalOvershootPolicy,
                    QScrollerProperties.OvershootPolicy.OvershootAlwaysOff,
                )
                scroller.setScrollerProperties(props)
            except Exception:
                pass
        avail = _avail_width() - 16
        for tabs in window.findChildren(QTabWidget):
            for i in range(tabs.count()):
                tabs.widget(i).setMaximumWidth(avail)
    except Exception as exc:  # noqa: BLE001
        _log(f"cap pages: {exc}")


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
    _adapt_browse_sidebar(browser)


def _adapt_browse_sidebar(browser: Any) -> None:
    """The sidebar is a layer over the list (audit 3, R3-03): its own search
    field never opens the keyboard by itself, it opens full width instead of
    leaving a sliver of table, and choosing a filter closes it so the filtered
    list is what you see."""
    from aqt.qt import Qt, QTimer

    sidebar = getattr(browser, "sidebar", None)
    if sidebar is None:
        return
    bar = getattr(sidebar, "searchBar", None)
    if bar is not None:
        _keep_keyboard_closed([bar], sidebar, browser)
    dock = getattr(browser, "sidebarDockWidget", None)

    central = browser.centralWidget()

    def fill_width(visible: bool = True) -> None:
        """Shown: the sidebar is the whole screen (the table's own minimum width
        would otherwise leave it a 216pt strip and the table a sliver). Hidden:
        the table comes back."""
        if dock is None:
            return
        try:
            if visible:
                central.hide()
                browser.resizeDocks([dock], [_avail_width()], Qt.Orientation.Horizontal)
            else:
                central.show()
        except Exception as exc:  # noqa: BLE001
            _log(f"sidebar width: {exc}")

    if dock is not None:
        try:
            dock.visibilityChanged.connect(fill_width)
            if dock.isVisible():
                fill_width(True)
        except Exception:
            pass

    def chosen(index: Any) -> None:
        try:
            item = sidebar.model().item_for_index(index)
            if getattr(item, "search_node", None) is None:
                return  # a group row: expand/collapse, stay open
        except Exception:
            return
        QTimer.singleShot(0, lambda: browser.showSidebar(False))

    try:
        sidebar.clicked.connect(chosen)
    except Exception:
        pass


def adapt_add_cards(window: Any) -> None:
    from aqt.qt import QBoxLayout

    layout = window.form.horizontalLayout
    layout.setDirection(QBoxLayout.Direction.TopToBottom)  # R2-10: stacked, full width
    # The primary action looks like one (audit 3, R3-15): accent fill, finger height.
    try:
        from aqt.qt import QSizePolicy

        from . import mobile_theme

        t = mobile_theme.tokens()
        add = window.addButton
        add.setStyleSheet(
            "QPushButton { background: %s; color: %s; border: none; border-radius: 10px;"
            " font-weight: bold; padding: 0 24px; }"
            " QPushButton:pressed { background: %s; }" % (t["accent"], t["on_accent"], t["text"])
        )
        add.setMinimumHeight(TOUCH_ROW)
        add.setMinimumWidth(160)
        add.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
    except Exception as exc:  # noqa: BLE001
        _log(f"add button: {exc}")


def _short_title(window: Any, key: str, fallback: str) -> None:
    """Kioku's bar cuts a long title at both ends: a short one (audit 3, R3-14)."""
    try:
        from ..core.translations import tr  # type: ignore
    except Exception:
        try:
            from .translations import tr
        except Exception:
            tr = lambda k, d=None: d  # noqa: E731
    try:
        window.setWindowTitle(tr(key, fallback))
    except Exception:
        pass


def adapt_field_dialog(dialog: Any) -> None:
    """Fields (audit 3, R3-14): the list above its buttons, options that wrap."""
    from aqt.qt import QBoxLayout

    _short_title(dialog, "window_fields", "Fields")
    _touch_sizes(dialog)
    _relax_widths(dialog)
    _shrinkable_inputs(dialog)
    try:
        dialog.form.horizontalLayout.setDirection(QBoxLayout.Direction.TopToBottom)
    except Exception:
        pass
    _wrap_long_toggles(dialog)
    _stack_wide_rows(dialog)


def adapt_card_layout(dialog: Any) -> None:
    """Card Types (audit 3, R3-14): editor above preview instead of side by
    side, the Front/Back/Styling switch fitting the width."""
    from aqt.qt import QPushButton, QRadioButton, QSizePolicy, Qt

    _short_title(dialog, "window_card_types", "Card Types")
    _touch_sizes(dialog)
    try:
        dialog.mainArea.setOrientation(Qt.Orientation.Vertical)
    except Exception:
        pass
    _relax_widths(dialog)
    _shrinkable_inputs(dialog)
    try:
        tform = dialog.tform
        for name in ("front_button", "back_button", "style_button"):
            button = getattr(tform, name, None)
            if button is not None:
                button.setMinimumWidth(0)
                button.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Preferred)
    except Exception:
        pass
    for button in dialog.findChildren(QPushButton):
        try:
            button.setMinimumWidth(0)
        except Exception:
            pass
    _wrap_long_toggles(dialog)
    _stack_wide_rows(dialog)


def adapt_get_text(dialog: Any) -> None:
    """Anki's one-line prompts (rename, new name): finger-sized, full width."""
    _touch_sizes(dialog)
    try:
        dialog.setMinimumWidth(0)
        edit = dialog.l
        edit.setMinimumHeight(TOUCH_ROW)
        edit.setMinimumWidth(0)
    except Exception:
        pass


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
    _shrinkable_inputs(dialog)
    _wrap_long_toggles(dialog)
    _stack_wide_rows(dialog)
    _backup_note(dialog)
    _cap_page_widths(dialog)


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
    "FieldDialog": adapt_field_dialog,
    "CardLayout": adapt_card_layout,
    "GetTextDialog": adapt_get_text,
}


def _style_bar(window: Any) -> None:
    try:
        from . import mobile_theme

        if window.isVisible():
            mobile_theme.style_kioku_bar(window)
    except RuntimeError:
        pass  # window already gone
    except Exception:
        pass


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
        from aqt.qt import QApplication, QEvent, QMenu, QObject, QTimer, QWidget
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
                    and not isinstance(obj, QMenu)
                ):
                    name = type(obj).__name__
                    if name in PAINT_ONLY:
                        paint_window(obj)  # before the first frame
                    if name in ADAPTERS and not obj.property(ADAPTED):
                        # after Kioku has fitted the window to the screen
                        QTimer.singleShot(0, lambda w=obj: adapt_window(w))
                    # Kioku builds its "Back" bar in a deferred step: colour it
                    # once it exists, and again after a re-layout (R3-01)
                    for delay in (0, 150, 600):
                        QTimer.singleShot(delay, lambda w=obj: _style_bar(w))
            except Exception:
                pass
            return False

    app = QApplication.instance()
    if app is None:
        return
    flt = ShowFilter(app)
    _state["filter"] = flt
    app.installEventFilter(flt)
