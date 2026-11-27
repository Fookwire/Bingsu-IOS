# Plan: make Bingsu on Kioku feel like a native iOS app

Target: the **bingsu_ios add-on** installed in Kioku (not the Bingsu app,
which is paused; its repo stays as it is). Version after this update:
`2.0.3-Bento-ios.2`.

Goal: on iPhone and iPad, Bingsu should behave like an iOS app. Taps
respond instantly, nothing selects or zooms by accident, the screen doesn't
slide around when you drag, controls are at least 44 pt, and menus come up
as iOS sheets.

## 1. What the screenshots show

Each screenshot is from a phone running the Catppuccin theme.

| # | Where | Problem |
|---|-------|---------|
| 1 | Every screen | Kioku's desktop menu row (File, Edit, View, Tools, Help, Bingsu) takes the top of the screen. |
| 2 | Every screen | The status-bar strip and the band under the home indicator are Anki grey (#2c2c2c), not the theme colour. |
| 3 | Home, Profile | The whole page scrolls: the action buttons and profile slide up *under* the menu row. Nothing stays put like a native header. |
| 4 | Settings › Themes | The page pans sideways; the left column of themes is cut off ("n Latte", "rk"). This is "dragging moves the UI around". |
| 5 | Home | Deck names run under the count pills ("Cheat S 10", "by▸1"). The drag handles (⠿) are always visible and take space. |
| 6 | Home | A tapped "⋯" gets a grey square highlight. Tapped rows stay highlighted (the Active cards "New" row). These are sticky hover states. |
| 7 | Home › More | "More" grows into a tall tile, with three unlabeled icons floating next to it (the desktop flyout drawn into the grid). |
| 8 | Home | "Bingsu …" is truncated. The profile name "USER" is barely visible (pale text on lavender). |
| 9 | Sort / deck menus | The sheets have no dimmed backdrop, grab handle, swipe-to-dismiss or Cancel. A second sheet edge shows under the first (a double border). |
| 10 | Home tabs | The tab bar floats above a strip of scrolling content, then the grey band. Content (the heatmap card, the deck rows) hides behind it with no bottom padding. The icons are tiny. The Menu tab is missing. |
| 11 | Home widgets | Stat cards keep desktop heights (mostly empty). The year heatmap is tiny dots. The donut's "11,209" spills out of its ring. **Studied 0 / Time 0.0** while Profile says 41 reviews and 11 min today. |
| 12 | Profile | The overlay sits inside three nested rounded frames, and the tab bar stays on top of it. |
| 13 | Settings | There are two sets of chrome: Kioku's "‹ Back" bar plus Bingsu's "Done" bar and a rounded card with margins. The nav list scrolls in a short clipped box ("Sidebar" is cut off). |
| 14 | Settings › Themes | "Hold 3 s to apply" is a desktop gesture. On touch it fights scrolling and iOS long-press. |
| 15 | Settings › Reviewer | The "Image / Color only" segmented control overflows the card. The tab strip is off-centre. |
| 16 | Overview | The top is a row of seven circled desktop toolbar icons and there's no back button. The profile pill overlaps the card border. |
| 17 | Reviewer | The same toolbar row. The Edit and ⋯ buttons are small. The bottom bar doesn't reach the screen edge. |

Things the screenshots can't show but that are also part of "web app feel":

- Long-pressing any label selects text and brings up the iOS callout (Copy, Look Up).
- A double-tap can still zoom some pages.
- Buttons only light up after the finger lifts. iOS WebKit ignores `:active` unless a touch listener exists.

## 2. What Kioku lets an add-on change

I checked this in Kioku's source (`kioku/webengine.py`, `kioku/screenedges.py`, `kioku_platform/webview.py`).

- **The menu row is Anki's own `QMenuBar`** (`mw.form.menubar`). An add-on can hide it with `mw.hide_menubar()` and keep it hidden by wrapping `AnkiQt.show_menubar`, as Bingsu did. Its menus stay reachable from Bingsu's Menu button (`bingsu_app_menu` → `show_app_menu()`, already in the add-on). On iPadOS 26 they are also in the system menu bar.
- **The native `WKWebView` is reachable.** `mw.web.page()._web.webview` is a rubicon-objc object, and Kioku ships rubicon. On Bingsu's pages the add-on can turn off rubber-band bounce and zoom bounce (`scrollView.setBounces_(False)`, `setBouncesZoom_(False)`). This is the fix Bingsu had, done from the add-on. Every native call is guarded: if the attribute is missing (Kioku web, Android, a newer Kioku), it does nothing.
- **The grey bands are the page background.** Kioku pads `<html>` with `--kioku-safe-bottom/left/right`, and the padding shows Anki's page colour. Fix it by setting `page().setBackgroundColor(theme bg)` on `mw.web`, `mw.toolbarWeb` and `mw.bottomWeb`, and painting `html` in the theme colour. The tab bar and the reviewer bar can then extend into that band and pad themselves with `var(--kioku-safe-bottom)`, like native bars.
- **The status-bar strip** is the main window's background. Try setting `mw`'s palette `Window` colour (and the top web view's background) to the theme colour on theme change. Check on the device; if Kioku paints it itself, leave it.
- **Haptics:** `UIImpactFeedbackGenerator` / `UISelectionFeedbackGenerator` through rubicon, behind the existing `gamification/haptics.py` API. Use them for long-press menus, reorder pick-up and drop, and the ease buttons. They are a no-op elsewhere.

All of this goes in a new `core/ios_native.py`. It only acts when `IS_KIOKU and IS_IOS`, and every call is wrapped so a Kioku change can't break startup.

## 3. Native-feel rules (applied everywhere)

These go in `web/mobile.css` / `web/mobile.js`, under `html.bingsu-touch`:

1. **No sticky hover.** At load (and when new stylesheets appear), walk `document.styleSheets` and move every rule whose selector has `:hover` into `@media (hover: hover)`. This covers the about 210 hover rules in `menu.css` and `settings.css` without hand-editing them, and an iPad with a trackpad keeps its hover effects.
2. **Instant press feedback.** Add a passive `touchstart` listener so `:active` works. Add an `.is-pressed` class on pointerdown that is cleared on move, cancel or up. Pressed style: dim to 0.55 opacity, or a theme-tinted fill for list rows. Remove the grey highlight square.
3. **No accidental selection or zoom.** Set `-webkit-user-select:none; -webkit-touch-callout:none` on all Bingsu chrome. Inputs, text areas and card content (`#qa`, the editor) keep selection. Set `touch-action: manipulation` everywhere (no double-tap zoom, no 300 ms delay). Inputs get `font-size: 16px` so iOS doesn't zoom on focus.
4. **App shell, not a scrolling page.** `html` and `body` are fixed at `100dvh` with `overflow: hidden`. The header (title, action grid) and the tab bar stay put, and only the content area scrolls, with `overscroll-behavior: contain` and the native momentum. Together with the native bounce switch-off in section 2, a drag no longer moves the frame.
5. **No horizontal panning.** Set `overflow-x: hidden` on the shell and on each scroller, and `touch-action: pan-y` on vertical lists. A debug check (`BingsuMobile.findOverflow()`) lists any element wider than the viewport so the cause gets fixed rather than hidden. Themes is the known one.
6. **Touch targets.** Every control is at least 44×44 pt. Icon-only buttons get padding, not a larger icon.
7. **One gesture per thing.** Tap means open or act. Long-press (450 ms, cancelled by 8 px of movement) means context menu, with haptics. Reordering happens only in Edit mode. A press that becomes a scroll never fires a tap.
8. **Edge to edge.** On phones, drop the outer rounded "bento" frame and the nested card borders. Content runs to the screen edges with 16 pt margins, like iOS lists.

## 4. Changes by screen

### A. Shell and Kioku (Python)

Files: `core/ios_native.py` (new), `__init__.py`, `rendering/webview_handlers.py`.

- Hide the menu row on iPhone by default. A setting, "Show Anki's menu row", turns it back on. On iPad, hide it only when the iPadOS 26 system menu bar is there (`kioku_platform.menubar.available()`); otherwise keep it.
- Paint the theme colour into the edges (section 2), and repaint whenever the theme or light/dark mode changes.
- Turn off bounce on `mw.web` while an Bingsu page is showing. Turn it back on for pages that aren't Bingsu's, such as another add-on's screens.
- Route `haptics.py` to the native generators.
- Recompute the **Studied/Time cache** after a sync (`sync_did_finish`) and when the collection changes. The 0-vs-41 mismatch fits a stale `_DASHBOARD_STATS_CACHE` from before the sync brought in reviews made on another device. Check this against `day_cutoff` on the device.

### B. Home (deck list)

Files: `web/mobile.css`, `web/mobile.js`, `web/engine.js`, `web/menu.css`.

- **Large title header:** "Decks" in iOS large-title style, with Edit, search and sort on the right. The profile pill becomes a small avatar button that opens Profile. This also fixes the unreadable "USER" text.
- **Action grid:** at most 4 tiles in one row (Add, Browse, Stats, Sync). Settings, Bingsu games and the old More items go into a **"⋯" sheet with labels**. The inline flyout is no longer drawn on touch.
- **Deck rows:**
  - Use a grid of `chevron | icon | name (ellipsis, min-width:0) | pills | ⋯` so names never run under the pills.
  - Pills shrink on phones and show only non-zero counts.
  - Collapse chevrons get a 44 pt target.
- **Edit mode** (replaces Select, like iOS Reminders): reorder handles appear on the **right**, with checkboxes for multi-select. A bottom toolbar holds Move, Delete and Done. Outside Edit mode there are no handles, so a vertical drag always scrolls.
- **Tab bar:**
  - Full-width bar fixed to the bottom, background extending into the safe area.
  - Decks, Home and Menu tabs; 24 pt icons with 10 pt labels.
  - The content gets matching bottom padding so the last row and the heatmap card are never hidden.

### C. Sheets (one component for all menus)

Files: `web/mobile.js` (`BingsuMobile.sheet`), `web/mobile.css`.

- The deck ⋯ menu, sort menu, More, tag menu, reviewer More and heatmap tooltips all use one iOS-style sheet:
  - Dimmed backdrop; tap it to close.
  - Grab handle; swipe down to dismiss.
  - Grouped rows at least 50 pt tall, with a separate Cancel button.
  - Bottom safe-area padding and a slide-up animation.
- Submenus (Markers ›) push inside the sheet with a back row instead of opening a fly-out.
- On iPad, the same menus open as popovers anchored to the button.
- This also fixes the double border (two stacked `.is-sheet` containers).

### D. Home widgets and Profile

- On phones, widget cards size to their content (no fixed desktop heights). The 4 stat cards become a 2×2 grid of compact tiles.
- **Heatmap:** on phones, default to the last 20 weeks with larger cells. Tapping a cell shows its date and count in a tooltip. Year view scrolls sideways *inside the card only*.
- **Donut:** the centre number scales to fit the ring (`clamp()` against the ring size).
- **Profile:** a full-screen page with a ‹ back button and swipe-down to close. The tab bar is hidden while it is open, and the nested frames are gone.

### E. Overview and reviewer

Files: `web/overview.css`, `reviewer_buttons_shared.css`, `rendering/reviewer_dock.py`, `web/mobile.*`.

- **Nav bar** on phones: "‹ Decks", the deck name, and ⋯ (Options, Custom Study, Description, Add, Browse, Stats, Sync). It replaces the 7-icon circle toolbar. On iPad the toolbar stays, at 44 pt.
- **Swipe from the left edge to go back** to the deck list, like iOS navigation. It only starts in the first 20 pt and has to move mostly sideways, so card content isn't affected.
- **Overview:** the profile pill no longer overlaps the card border. The Study Now, Options, Custom Study and Description buttons are 50 pt.
- **Reviewer:**
  - The bottom bar is flush with the screen bottom, its background running under the home indicator.
  - Edit and ⋯ are 44 pt buttons.
  - The answer bar is 4 equal ease buttons with the interval under each label, plus haptics.
  - Optional setting: tap the empty card area to show the answer, off by default. Taps on links, audio buttons and inputs in the card are never intercepted.

### F. Settings

Files: `web/settings.css`, `web/settings.js`, `settings_web/dialog.py`.

- **One set of chrome:** inside Kioku's window, drop Bingsu's outer card and margins. Remove the Done bar on phones, since Kioku's "‹ Back" closes the window and changes already save automatically.
- **Nav list:** an iOS inset grouped list with › chevrons. The whole page scrolls as one, which fixes the clipped "Sidebar" row. Donate and Report Bugs become the last group.
- **Sub-pages** slide in from the right and keep "‹ Settings". Swipe from the left edge goes back.
- **Themes:**
  - Grid `repeat(auto-fill, minmax(150px, 1fr))` inside the viewport, with no sideways pan.
  - On touch, tap a theme to preview it (checkmark), then an **Apply** button at the bottom. This replaces Hold 3 s; the mouse keeps hold-to-apply.
- **Segmented controls** wrap or turn into a picker row when they don't fit (Reviewer Background, the icon tab strip).
- All inputs, switches and sliders get 44 pt rows and 16 px text.

### G. iPad

The same rules apply. The sidebar stays (`clamp(300px, 40vw, 420px)`), menus are popovers, and toolbars are kept at 44 pt. Trackpad hover keeps working through `(hover: hover)`. Both orientations will be checked.

## 5. Order of work

1. **Shell and interaction layer:** sections 2, 3 and 4A. This should remove most of the "web app" feel on every screen at once.
2. **Sheets and Home:** 4B and 4C.
3. **Overview and reviewer:** 4E.
4. **Settings:** 4F.
5. **Widgets and Profile:** 4D, plus the Studied/Time fix.
6. Package `2.0.3-Bento-ios.2` as `dist/Bingsu-iOS.ankiaddon`, with a GitHub download link.

Each step is pushed separately, so you can test on the phone between steps.

## 6. Verification

- **In the container:** the headless-Anki harness with Chromium iPhone and iPad emulation (WebKit can't be downloaded here). Automated checks on every Bingsu page:
  - `scrollWidth <= innerWidth` (no sideways pan).
  - No active `:hover` rules on touch.
  - Every visible control is at least 44×44.
  - The tab bar and reviewer bar reach the bottom.
  - Nothing is hidden under the tab bar.
  - No console errors.
- **Unit tests:** the existing suite must have no new failures against the current baseline. New tests cover `core/ios_native.py`'s guards (no Kioku or rubicon → no-op) and the stats-cache invalidation.
- **On your phone** (the real check, since WebKit and Kioku's native layer can only be checked there): install the `.ankiaddon` in Kioku and go through this list in portrait and landscape:
  - Home, then scroll, drag sideways and long-press a deck.
  - Edit mode reorder, and the sort sheet.
  - Overview, then review a card.
  - Settings, then Themes and Reviewer.
  - Profile.

  Send screenshots of anything off, and `kioku.log` if something fails to load.

## 7. Defaults I chose (easy to change)

- The menu row is hidden on iPhone. On iPad it is hidden only with the iPadOS 26 system menu bar.
- Tap-the-card-to-show-answer is off by default.
- Theme apply on touch is tap, then Apply.
- Bingsu isn't deleted or changed. It just isn't developed further.

## Status (2.0.3-Bento-ios.2)

Done, and checked in iPhone 15 / iPad Pro 11 emulation (Chromium; WebKit
and Kioku's native layer can only be checked on a device):

- Steps 1-5 as above. Not done from the plan: the optional "tap the card
  to show the answer" setting (left out; the bottom bar is unchanged), and
  the large-title "Decks" header stays inside the sidebar card rather than
  replacing the profile bar.
- Only on a device: the menu row hiding, edge colours, bounce and haptics
  (core/ios_native.py). Each is a no-op if Kioku's internals differ; the
  add-on keeps working either way.
- Settings: Kioku's Back closes the window without Bingsu's Done. Changes
  save as they are made; a slider moved in the last half second before
  closing may not be saved.
