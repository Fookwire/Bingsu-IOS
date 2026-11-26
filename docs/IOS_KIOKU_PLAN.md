# Plan: Onigiri UI on iOS (Kioku)

## Context

AnkiMobile has no add-on support, so you run **Kioku** (TestFlight, github.com/krmanik/kioku). Kioku is the *unmodified Anki desktop app* (aqt, PyQt6, Qt 6.11, Rust core) built for iOS. That changes the shape of the job:

- **Add-ons install and run as on desktop.** Kioku already tested Onigiri 2.0.2-Bento (web variant): it loads, the main menu, sidebar, heatmap and settings render (`kioku/web/docs/testing.md`, 2026-10-24 j).
- **QtWebEngine is a Python stand-in over WKWebView** (`kioku/shared/python/kioku/webengine.py`). Basics work: `pycmd`, `runJavaScript`, `setHtml`, user scripts, `set_bridge_command`. Unknown APIs become silent no-ops.
- **What breaks is the environment, not the loading:**
  - The screen is 390–430 CSS px (iPhone) or 744–1366 (iPad).
  - Input is touch only: no hover, no right-click, no keyboard.
  - The browser engine is WebKit (Safari), not Chromium.
  - iOS can't start processes and ctypes can't load libraries.
  - Web views are native iOS views, so Qt widgets drawn over a web view are hidden behind it.
  - Inside add-on code, `platform.system()` returns **"Darwin"** on iOS (`kioku/patches.py:_addon_platform`), but `sys.platform == "ios"`.

**Goal:** an iOS-only fork of Onigiri (your choice) that works well on iPhone and iPad across the home screen, overview and reviewer, settings, and gamification. Desktop-only features may be removed rather than kept behind checks.

## Approach

### Phase 0: Foundation (do first)

1. **Platform flag.** Add `core/platform.py`:
   - `IS_IOS = sys.platform == "ios"` and `IS_KIOKU = "kioku" in sys.modules`.
   - Replace every `platform.system() == "Darwin"` / `sys.platform == "darwin"` check: `__init__.py:871`, `gamification/reward_redemption.py:50`, `dialogs/birthday_dialog.py:14`, `study_tools/pomodoro.py:407` (afplay), `version_manager/ui.py:26`, `rendering/reviewer_more_menu.py:107,442`.
2. **Remove desktop-only code** (fork, so delete rather than gate):
   - `integrations/mac_titlebar.py` (ctypes/libobjc) and its call sites.
   - The afplay sound path in pomodoro (use Anki's `av_player` or a web `<audio>`).
   - The `version_manager` desktop update UI.
   - The WebGL context tracker in `__init__.py:386-428`.
   - Full Hide Mode menubar logic (Kioku owns the iOS menubar).
   - **The `version_manager/` self-updater** (`version_manager/service.py:93-97,203-204` downloads upstream releases and swaps the add-on's code on quit; wired at `__init__.py:3-4`). On a fork this would overwrite your iOS changes with upstream desktop code, so remove it entirely.
   - The QtQuickWidgets resize-repaint guard (`rendering/patcher.py:3673-3743`, `install_main_webview_resize_repaint_guard`). It pokes Chromium's internal `QQuickWidget`, which doesn't exist over WKWebView.
   - The mac haptic path (`settings_web/dialog.py:987-1027`) and the mac tests (`tests/test_mac_titlebar_dispatch.py`, `tests/test_mac_haptic_feedback.py`).
   - Note: the birthday dialog's Darwin check (`dialogs/birthday_dialog.py:14`) is *true* on iOS (Kioku reports Darwin to add-ons). Rewrite it to use the plain dialog path on `IS_IOS`.
3. **Fix the startup-aborting JS bug** at `web/injector.js:23-33`. `insertBefore(header, deckListContainer)` targets `.sidebar-expanded-content`, but both nodes live in `<section class="onigiri-sidebar-decks-section">`. The resulting NotFoundError aborts `init()`, so `setupActionButtons`, `setupArchivedHomeButton`, `updateDeckLayouts` and `updateDeckFocusLayout` never run. Fix:
   - Insert relative to `list.parentElement`.
   - Fix the dead selector at `rendering/patcher.py:6317`.
   - Wrap each `init()` step (`injector.js:1270-1280`) in its own try/catch.
4. **Shared mobile base CSS/JS.** Add `web/mobile.css` and `web/mobile.js`, injected into every Onigiri page by the existing `webview_will_set_content` injection (`__init__.py` around line 467, next to `Particles.js`/`MagneticSelect.js`):
   - Viewport meta with `viewport-fit=cover`.
   - `env(safe-area-inset-*)` padding.
   - `100vh` replaced by `100dvh`.
   - `-webkit-tap-highlight-color: transparent`.
   - 44px minimum touch targets under `@media (pointer: coarse)`.
   - Hover reveals rewritten as "always visible" under `@media (hover: none)`.
   - `mobile.js` provides `onigiriLongPress(el, cb)`: a 500 ms pointer timer with movement cancel, which dispatches a synthetic `contextmenu` at the touch point. It sets a `body.onigiri-touch` class.

### Phase 1: Home / deck browser

Markup: `rendering/templates.py:270-346`; renderer: `rendering/onigiri_renderer.py:4648-4816`; CSS: `web/menu.css`.

- **Phone layout (`max-width: 600px`):** turn the flex row into a single column with tab-like switching between **Decks** (the sidebar) and **Home widgets** (`.main-content`). Reuse the existing sidebar-only and main-only "cycle states" (`menu.css:3392`, `saveDeckCycleState`) instead of inventing a new mode.
  - Drop the inline `width: {saved_width}px`, `min-width: 345px` (`menu.css:88`) and `flex-shrink:0`. The resize handle (`injector.js:513-782`) and edge pill are hidden on phones.
  - `.main-content` padding goes from 40px to 16px.
  - The widget grid (`onigiri_renderer.py:2766-2776`) becomes `repeat(auto-fill, minmax(min(100%, 160px), 1fr))` on phones, so cards reflow instead of being squashed.
- **iPad (`601–1100px`):** keep the sidebar, clamp it to `clamp(280px, 34vw, 380px)`, and set the grid to 2 columns.
- **Deck actions without right-click:**
  - Attach `onigiriLongPress` to deck rows: `engine.js:774-784`, the favorites `oncontextmenu` (`onigiri_renderer.py:2059`), and tags (`decks/tree_updater.py:337`).
  - Bring back a visible "⋯" button per row on touch. This is the hidden gear `td.opts`, `menu.css:1609-1631`.
  - Context submenus (`menu.css:1738`, `engine.js:1228-1270`) open on tap: toggle a class, and stop the document click handler from closing the menu when the tap lands on a group row.
  - On phones, show the menu as a bottom sheet instead of positioning it at the cursor.
- **Drag-reorder:** the Onigiri engine already uses Pointer Events (`engine.js:880-1043`). Make the handle visible and 32px wide on touch (`menu.css:1843-1860`), and start dragging only after a long-press so page scroll still works.
  - Replace the HTML5 drag-and-drop in `things_theme/web/decklist.js:408-470` with the same pointer approach, or drop it and use "Move to…".
- **Multi-select** (Ctrl/Shift+click only, `engine.js:468,741`): add a "Select" toggle in the deck header that turns taps into select taps.
- **Hover-only elements:** the deck-mode icon palette (`menu.css:3517`) becomes always visible. The heatmap tooltip (`things_theme/web/heatmap.js:129`, `web/heatmap.js`) shows on tap via `pointerdown`.
- **Performance:** on iOS, disable the full-viewport `filter: blur` background layers (`patcher.py:1258-1272, 1440-1452, 3930-3945`), Particles, and the MagneticSelect rAF loop. Swap to a flat or pre-blurred image.

### Phase 2: Overview and reviewer

- **Bottom bar fixed width:** `reviewer_buttons_shared.css:43,52-54,164-166`. `min(max(540px, …), calc(100cqw - 280px))` leaves about 110px on a phone. Add `@container (max-width: 600px)`:
  - Primary width becomes `100cqw - 16px`.
  - The four ease buttons go in a 4-column grid, with interval text below the label.
  - The side buttons (Edit/More) move into the More menu.
- **Interval display:** force "always" mode on touch (`patcher.py:8987-8997`).
- **Bar height** (`onigiri_reviewer_bar_height`, default 60, `patcher.py:5236`): add `env(safe-area-inset-bottom)`.
- **Reviewer dock** (`rendering/reviewer_dock.py`, `web/reviewer_dock.js`): already touch-aware. Check that "island" mode (`position:fixed`, `reviewer_dock.css:137`) respects the safe-area inset at the top.
- **More menu** (`reviewer_more_menu.css:88`): already `max-width: calc(100vw - 24px)`; show it as a bottom sheet on phones. Hide the shortcut hints on iOS (`reviewer_more_menu.js:404-730`).
- **things_theme reviewer** (`things_theme/web/reviewer.js`):
  - The ease FX moves from `mousedown` (`:458`) to `pointerdown`.
  - The edit bar's `mousedown` preventDefault (`:261`) also gets a `pointerdown` equivalent.
  - Keep Save/Cancel buttons visible.
- **Overview** (`web/overview.css`, `overview_stats.css`): one column on phones, `100dvh`, 44px Study/Options buttons.

### Phase 3: Settings (Bento)

Files: `settings_web/dialog.py:147`, `web/settings.html|css|js`, `bento_settings.*`.

- **Dialog:** on iOS, open the settings `QDialog` maximized (`showMaximized()`), with no fixed or minimum size.
- **CSS:** `settings.css` has about 30 breakpoints from 340 to 1700px. Audit at 390px and 820px:
  - A phone nav becomes a top segmented list or drill-down instead of a left column.
  - Use `100dvh`.
- **Layout editor** (`settings.js:11488`): pointer-based already. Bigger handles and long-press to pick up. The tile menu (`settings.js:10833`) gets long-press.
- **Prefixes:** add the `-webkit-backdrop-filter` prefix wherever it's missing (about 19 places in `settings.js`, 9 in `settings.css`, and `notifications.css:40,183`, `menu.css:590,1772`, `things_theme/web/sidebar.css`).
- **Native Qt pickers:**
  - Replace `ui_kit` color, font, icon and date pickers with web or native iOS equivalents where a Qt widget would be desktop-sized. `QColorDialog`/`QFileDialog` work in Kioku, but are small.
  - `QFontDatabase` font registration should work. Verify it on the device.

### Phase 4: Gamification and study tools

Each opens its own `AnkiWebView` dialog with `set_bridge_command`: `nook_web_ui:223`, `onigimon_web_ui:245`, `hexagon_land:2623`, `communications:184`, `hashi_notes:929`, `prep_station:882`, `api/widget_settings.py:378`.

- **Dialog sizing:** about 20 dialogs set minimum sizes that exceed a phone. The worst:
  - `hexagon_land.py:2616` (min 760x560)
  - `nook_web_ui.py:220` (720x540), `onigimon_web_ui.py:242`, `communications.py:178`
  - `prep_station.py:872`, `hashi_notes.py:908,1080`, `pomodoro.py:1399`
  - `credits_dialog.py:17`, `donations_dialog.py:17`, `sync_ui.py:22` (fixed 500)
  - `font_picker.py:56`, `icon_picker.py:154` (fixed 560 wide)
  - `onigiri_notifications.py:301` (min 390)
  - `mod_transfer_window.py:348`
  - `prep_station_ui.py:192` `fit_dialog_to_screen` (its `max(min_w, …)` still exceeds the screen)

  Add a shared helper, `ui_kit/common.py: present_dialog(dlg)`, maximizes on iPhone and uses about 80% of the screen on iPad. Remove the desktop `setFixedSize`/`setMinimumSize` values.
- **Floating tool windows:** `study_tools/hashi_notes.py:897-1006` moves the window by polling `QCursor.pos()` and resizes it with `startSystemResize`. The Pomodoro island (`pomodoro.py:1155-1323`) drags with mouse events and uses `screen.grabWindow(0)` (`:1214`) for a frosted backdrop. On iOS, show them as maximized/sheet dialogs (Hashi) or as an in-page HTML pill on the main web view (Pomodoro), and drop the grab.
- **`grab()` snapshots** return blank for native web views: `things_theme/cmdk_overlay.py:117,159` (fade snapshot) and `prep_station_ui.py:1227` (drag ghost). Replace them with plain fades and drag outlines.
- **Picker host overlays:** Frameless + Tool + StaysOnTop + translucent windows sized to the parent (`settings_web/dialog.py:870-907`, `rendering/webview_handlers.py:356-379`) host the color, font and icon pickers. Open the pickers as ordinary modal dialogs via the helper, or move them into the web page.
- **No frameless/translucent windows** on iOS (`FramelessWindowHint`, `WA_TranslucentBackground`, e.g. `birthday_dialog.py`). Use plain dialogs.
- **Overlay widgets:**
  - The Onigimon HUD (`gamification/onigimon_hud.py`, `web/onigimon_hud.js`), notifications (`ui_kit/onigiri_notifications.py`) and the cmdk overlay (`things_theme/cmdk_overlay.py`) can't be Qt widgets stacked over `mw.web` (native views are always on top).
  - Render them inside the page as HTML (`mw.web.eval` + `web/notifications.js` already exists), or as top-level windows.
- **Hexagon Land** (`hexagon_land.py`): wheel zoom becomes pinch (`gesturechange`/two pointers), and dblclick becomes double-tap. Onigimon HUD grip dblclick (`onigimon_hud.js:609`) becomes a long-press.
- **Haptics** (`gamification/haptics.py`): route through Kioku's platform layer if it has one, otherwise make it a no-op.
- **Focus Dango / Pomodoro:** use web audio instead of afplay (Phase 0). Timers stop while iOS suspends the app, so store end times rather than counting ticks.
- **Keyboard-only entry points:**
  - Holding Shift+S for 3s opens Settings (`core/settings_shortcut.py:27-53`).
  - Shift+P toggles Pomodoro (`ui_kit/menu_buttons.py:281`).

  Make sure each also has a menu or sidebar button. The Onigiri QMenu (`ui_kit/menu_buttons.py:221-331`) appears in Kioku's iOS menu bar (`kioku_platform/menubar.py`).
- **Settings readiness:** `settings_web/dialog.py:148-265` waits for `loadFinished`, then a `runJavaScript` callback, with a 5s watchdog before revealing the page. Kioku supports callbacks (`WebView.evaluate`), but check that it reveals within 5s on device, or raise the watchdog on iOS. Keep `tests/test_settings_web_startup.py` passing.
- **Network (`redeem_net.py`, communications):** HTTPS works in Kioku (it uses the iOS trust store). Check that no request runs on the GUI thread.

### Phase 4b: Kome (things_theme) embeds

- `things_theme/browse_embed.py:48-453` (and `addcard_embed`, `stats_embed`, `settings_embed`) reparent Anki's Browser/Add/Stats windows into a horizontal `QSplitter` beside a 264px sidebar, with a central minimum of 420 and an editor minimum of 320.
  - On iPhone, skip the embed and open Anki's own windows (`aqt.dialogs.open("Browser", mw)`, `mw.onAddCard()`). Kioku already adapts those for phones (`kioku/windows.py`).
  - On iPad, keep the embed only above 900pt wide.
- The Kome sidebar (`things_theme/web/sidebar.css:12-20`, fixed 264px) gets an off-canvas drawer under 600px.
- The ⌘K palette (`cmdk.js:372`) needs a visible search button, since there's no keyboard.

### Phase 5: Packaging

- Bump `manifest.json`/`meta.json`, then build an `.ankiaddon` zip (exclude `tests/`, `.github/`).
- Install it in Kioku with **Tools › Add-ons › Install from file…** (Files app). Alternatively, publish to AnkiWeb under a new ID and use **Get Add-ons**.

## Critical files

`__init__.py`, `web/injector.js`, `web/engine.js`, `web/menu.css`, `rendering/onigiri_renderer.py`, `rendering/templates.py`, `rendering/patcher.py`, `web/reviewer_buttons_shared.css`, `web/reviewer_more_menu.*`, `things_theme/web/{decklist,reviewer,heatmap}.js`, `web/settings.{css,js}`, `settings_web/dialog.py`, `ui_kit/common.py`, `gamification/*.py`, `integrations/mac_titlebar.py` (delete), new `core/platform.py`, `web/mobile.{css,js}`.

## Verification

1. **Fast loop in the container:** Playwright with WebKit and iPhone/iPad device emulation.
   - Use `devices['iPhone 15']` and `devices['iPad Pro 11']` with `hasTouch`.
   - Run against HTML from the renderers (`rendering/onigiri_renderer.py`, `templates.py`) with a stub `pycmd`.
   - Check:
     - No horizontal overflow (`scrollWidth <= innerWidth`).
     - No console errors, including the injector bug.
     - Long-press opens the deck menu.
     - The four ease buttons fit at 390px.
     - Touch targets are at least 44px.
2. **Unit tests:** run the existing suite (about 60 files that parse source and run JS in node `vm`, needing neither Anki nor Qt) with `python -m pytest tests` plus the `.cjs` tests with node. Update or remove the mac tests. Add tests to `tests/` for `core/platform.py` and the removed Darwin paths. Run them with pytest and Anki stubbed where needed.
3. **Kioku web variant** (Chrome/Safari, the closest to the real app without a phone): install the `.ankiaddon` and go through home, overview, review, settings and each game.
4. **On device (you):** install the `.ankiaddon` in Kioku on iPhone and iPad.
   - Walk through the same checklist in portrait and landscape.
   - Check the Kioku log (Help › Debug log, or Safari Web Inspector on the device) for `unsupported WebEngine API` lines. These are the shim's silent no-ops; each one needs an alternative.

## Status (implemented on this branch)

Install: build with `python3 tools/build_addon.py /path/Onigiri-iOS.ankiaddon`, copy the file to the iPhone/iPad (Files app), then in Kioku use **Tools › Add-ons › Install from file…** and restart Kioku.

The fork installs as its own add-on, `onigiri_ios`, with no AnkiWeb id. Anki's update check can't replace it with the desktop build, and it declares a conflict with `1011095603` so the two never run together.

**Done:**
- Phase 0: `core/platform.py`; self-updater removed; `injector.js` init crash fixed; `web/mobile.js` and `web/mobile.css` on every page.
- Phase 1, home:
  - Phone Decks/Home tabs, an action grid, and long-press or "⋯" deck menus as bottom sheets.
  - Tap-to-open submenus and a Select mode.
  - Override for Kioku's deck-table CSS, which had collapsed Onigiri's deck rows.
  - iPad sidebar sizing.
- Phase 2, review:
  - Icon dock on phones.
  - Bottom bar fits an iPhone SE.
  - Intervals always shown on touch.
- Phase 3, Settings: plain dialog (Kioku fills the screen and adds Close), and a phone list-to-page drill-down.
- Phase 4:
  - Hashi Notes, Pomodoro and the colour pickers no longer use floating Tool windows.
  - Kome inline embeds are off on mobile.
  - Kome layout works on phone and iPad.
  - `-webkit-backdrop-filter` prefixes added.

**Verified:**
- Headless Anki 26.09.4 with the add-on installed through Anki's own installer.
- Pages rendered in Chromium with iPhone 15, iPhone SE, iPad Mini and iPad Pro 11 emulation, with Kioku's own viewport and phone CSS applied (`kioku/webscripts.py`).
- No horizontal overflow and no console errors on the home screen, overview, reviewer, bottom bar, Settings and game pages.
- Long-press menus and submenus tested with real touch events.
- Unit tests: no new failures compared with the baseline.

**Not yet verified / open:**
- Real WebKit and a real device. Playwright's WebKit download was blocked in the build environment, so test on device and check the Kioku log for `unsupported WebEngine API`.
- Kome's deck drag-and-drop (`things_theme/web/decklist.js`) uses HTML5 drag events, which touch does not fire. Use the deck menu's "Move To" instead.
- Hexagon Land zoom uses the page's pinch zoom, and its double-click reset has no touch gesture.
- Haptics are a no-op on iOS.
