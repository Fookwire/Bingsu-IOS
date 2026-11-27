# Kioku + Bingsu on iPhone: UX, visual design and QA audit

**Recording:** `ScreenRecording_11-26-2026 22-47-16_1.MP4` (3 min 11 s, 1206 × 2622, dark appearance, portrait)
**Add-on build on screen:** `2.0.3-Bento-ios.24`, which matches the head of `Fookwire/Bingsu-IOS` (`798fa57`)
**Kioku source read:** `krmanik/kioku` at `a822555`. The Kioku version installed on the phone is not visible in the recording.
**Evidence images:** [`audit_evidence/`](audit_evidence/). File names start with the timestamp.

---

## How to use this report (read this first, Claude Code)

- **Timestamps** are accurate to about ±0.5 s.
- **Type** is one of:
  - **Defect**: visibly wrong in the recording.
  - **Inconsistency**: works, but conflicts with the rest of the app.
  - **Opportunity**: a judgement call. Do not treat it as a bug.
- **Owner** says where the fix belongs: **Bingsu** (this add-on), **Kioku** (the app shell, upstream), **Anki** (unmodified desktop code) or **Card** (the deck's card template). For Kioku or Anki items, prefer a workaround inside Bingsu, or propose an upstream change.
- **Cause** is labelled:
  - **Code**: I found the responsible code by reading it. Nothing was run, so reproduce before fixing.
  - **Likely**: a plausible explanation that needs testing.
- Line numbers refer to the commits above and are approximate.
- **Do not change** scheduling, FSRS, review logging, sync or collection schema. Every fix below is presentation, layout, wording or navigation. Do not remove Anki functionality; move or relabel it.
- `docs/IOS_AUDIT.md` in the add-on says its earlier fixes were checked in Chromium emulation and that "Nothing here has run on a real iPhone or in WebKit." Verify new fixes on the device or the iOS Simulator.

---

## 0. How the two projects fit together

| Layer | What it is | What it means for the UI |
|---|---|---|
| **Anki** | The unmodified desktop app (Python, Qt 6, Rust core) | Add-ons window, deck description, note editor, sync progress and toasts are desktop widgets. |
| **Kioku** | Runs Anki on iOS. WKWebView stands in for QtWebEngine. It makes every dialog full screen and adds a `‹ Back` title bar (`shared/python/kioku/windows.py`). | Qt chrome is grey and ignores the add-on's theme. |
| **Bingsu** (Onigiri fork) | Add-on that replaces the deck list, overview, reviewer and settings with web pages. A phone layer (`web/mobile.css`, `web/mobile.js`, `core/ios_native.py`) is applied on top of desktop layouts. | Looks most native where `mobile.*` rewrote the layout, and breaks where desktop CSS still applies. |

Most problems below come from the seams between these layers.

---

## A. Overall assessment

**Verdict: a usable beta that does not yet feel like one iPhone app.** The deck list, tab bar, bottom sheets and answer buttons are a real improvement over stock Kioku (compare 0:03 with 0:17). The rest still reads as a desktop product fitted onto a phone.

| Area | Rating | Why |
|---|---|---|
| Core study loop | Fair to good | Clear and quick. Weak button boundaries, a toolbar flash on entry, two different `⋯` menus. |
| Navigation | Poor | At least four different "menu" surfaces and two things called "Home". |
| Visual consistency | Poor | Three colour systems and at least three type treatments. |
| Settings | Poor | Clipped controls, unusable colour pickers, pages that open half-scrolled, desktop-only text. |
| iPhone fit | Fair | Safe areas mostly respected. Many dialogs and editors are desktop layouts. |
| Stability | No crash or data loss seen | One alarming recovery message after reinstall. |

I found **no Critical issue**: nothing crashed, and no data was visibly lost. The recording never answers a card, so scheduling behaviour was not exercised.

**Issue count:** 51 in total: 13 High, 26 Medium, 12 Low. Many High items cluster in settings layout, navigation structure and theme consistency, so a few shared fixes remove many symptoms.

---

## B. Detailed issue inventory

### B1. Navigation and information architecture

#### NAV-01 · Several unrelated "menu" and "more" surfaces
- **Time:** 0:19–0:29, 2:23–2:25, 2:30–2:32, 2:37–2:39, 2:56–2:58
- **Screen:** Tab bar, deck list header, overview, reviewer
- **Type / Severity / Confidence:** Defect (structure) / **High** / High
- **Owner:** Bingsu
- **What happens:**
  1. Tab bar **Menu** opens a full-screen page: File, Edit, View, Tools, Help, Onigiri.
  2. The **house icon** beside "Decks" opens a sheet with 10 actions (Add, Browse, Stats, Sync, Settings…).
  3. Overview and reviewer **top `⋯`** opens a sheet with 6 actions (Add, Browse, Stats, Sync, Hashi Notes, Pomodoro).
  4. Reviewer **bottom `⋯`** opens a floating card-actions popover.
  5. Each deck row also has its own `⋯`.
- **Why it matters:** Users cannot predict what a "menu" control will show. Two identical `⋯` glyphs on the reviewer do different things.
- **Recommendation:** Define three roles and no more: (a) one global destination for app actions, (b) one contextual deck or study menu, (c) one card-actions sheet. Present all three with the same bottom-sheet component, each with a title.
- **Cause (Code):** `web/mobile.js` `addPhoneTabs` (`pycmd('onigiri_app_menu')`) and `setupNavBar`; `rendering/webview_handlers.py` `show_app_menu`; `web/engine.js:1600` `showHomeMenu`; `web/reviewer_more_menu.js`.
- **Evidence:** `t023.0s_menu-tab-desktop-menus.jpg`, `t144.3s_home-icon-action-sheet.jpg`, `t158.3s_reviewer-sheet-font.jpg`, `t177.0s_card-actions-popover.jpg`

#### NAV-02 · Add, Browse, Stats and Sync hide behind a second "Home"
- **Time:** 0:17 onwards; sheet opens 2:23
- **Screen:** Deck list header
- **Type / Severity / Confidence:** Defect (discoverability) / **High** / High
- **Owner:** Bingsu
- **What happens:** The tab bar has **Home** (widget dashboard). The deck header has a small grey **house icon** that opens the main action list. The most used Anki actions appear nowhere else on the main screen.
- **Why it matters:** Nobody expects a house icon to mean "Add / Browse / Stats / Sync", and it collides with the Home tab.
- **Recommendation:** Give Add, Browse and Stats permanent places (a tab bar such as Decks · Browse · Add · Stats · More is the iOS norm), and put Sync in the deck-list top bar with a status indicator. At minimum, replace the house glyph with a labelled "Actions" or `+` control.
- **Cause (Code):** `web/injector.js:251` `setupArchivedHomeButton`, shown when `sidebarActionsMode === 'archived'`. The default is `"list"` (`core/config.py:452`), but `core/config.py:1571` migrates `"collapsed"` to `"archived"`. Check which path put this phone in that mode.

#### NAV-03 · The Menu tab is a desktop menu bar in list form
- **Time:** 0:19–0:29
- **Screen:** Menu → File / Edit / View / Tools / Help / Onigiri
- **Type / Severity / Confidence:** Inconsistency / Medium / High
- **Owner:** Bingsu (presentation), Anki (contents)
- **What happens:** Includes Toggle Full Screen, Zoom In/Out/Reset and Exit. Edit contains only a disabled Undo. Useful items (Import, Export, Backup, Check Database) are two taps deep under desktop headings.
- **Why it matters:** "File" and "Edit" are not how iPhone users look for anything.
- **Recommendation:** Regroup by task: Library (Import, Export, Backups, Profiles), Maintenance (Check Database, Check Media, Empty Cards), Decks and note types, Add-ons, Settings, Help. Keep every action reachable; put zoom and full screen under an "Advanced" group.

#### NAV-04 · Settings are split across several places
- **Time:** 0:22–0:30, 2:23
- **Screen:** Menu → Onigiri → Onigiri Settings; house sheet → Settings; Menu → Tools → Preferences
- **Type / Severity / Confidence:** Inconsistency / Medium / High
- **Owner:** Bingsu
- **What happens:** Add-on settings are three levels deep from one entry point and one level from another. Anki Preferences lives elsewhere.
- **Recommendation:** One "Settings" screen with two clearly named groups: Study (Anki Preferences) and Appearance (Bingsu).

#### NAV-05 · Two back buttons and two headers on every settings page
- **Time:** 0:30–2:01
- **Screen:** All of Onigiri Settings
- **Type / Severity / Confidence:** Defect / **High** / High
- **Owner:** Bingsu (using a Kioku option)
- **What happens:** Kioku's grey `‹ Back` + "Onigiri Settings" bar sits above the page's own `‹ Settings` + page title. The top one closes the whole window; the lower one goes up one level.
- **Why it matters:** The larger, higher button is the one that throws the user out. It also costs about 44 pt of height.
- **Recommendation:** Set `kioku_hide_titlebar` on the settings window and provide one iOS-style header: **Done** on the list page, `‹ Settings` on subpages. Note that `mobile.css` currently hides `#oswDone` on phones, so it has to be restored.
- **Cause (Code):** `kioku/shared/python/kioku/windows.py` documents `kioku_hide_titlebar` and `kioku_edge_to_edge`; the add-on sets neither (`settings_web/dialog.py`). Confirm the installed Kioku has this option.
- **Evidence:** `t032.5s_settings-double-header.jpg`

#### NAV-06 · A settings tab vanishes without explanation
- **Time:** 0:34
- **Screen:** Settings → Profile
- **Type / Severity / Confidence:** Opportunity / Low / High
- **Owner:** Bingsu
- **What happens:** Choosing profile style "Ring" removes the "Background" tab and the tab strip reflows.
- **Why it matters:** It looks like something broke.
- **Recommendation:** Keep the tab, disabled, with "Background applies to the Bar style".
- **Cause (Code):** `web/settings.js:2003` `syncProfileTabs` (intentional).

### B2. Layout defects

#### LAY-01 · "Deck details" pushes the title over the Back button
- **Time:** 2:44–2:47
- **Screen:** Deck overview
- **Type / Severity / Confidence:** Defect / **High** / High
- **Owner:** Bingsu
- **What happens:** Expanding Deck details moves the whole column up. The deck title prints directly over `‹ Decks` and level with `⋯`.
- **Why it matters:** Unreadable header, and the Back target is obstructed.
- **Recommendation:** Top-align the overview, reserve the nav height plus safe area as top padding, and let the page scroll.
- **Cause (Code, likely mechanism):** `web/overview.css:2-10` centres `body` vertically; `#onigiri-phone-nav` is `position: fixed; top: 10px` (`web/mobile.css:1333`). As content grows, the centred column rises under the fixed bar.
- **Evidence:** `t165.5s_deck-details-overlap.jpg`

#### LAY-02 · Settings subpages open already scrolled
- **Time:** 0:55 (Gallery), 1:28 (Hashi Notes), 1:35 (Pomodoro)
- **Screen:** Settings drill-down
- **Type / Severity / Confidence:** Defect / **High** / High
- **Owner:** Bingsu
- **What happens:** A newly opened page starts at roughly where the previous page was left. Headings and the first settings are off screen.
- **Why it matters:** Users miss settings and think the page starts mid-sentence.
- **Recommendation:** Reset the scroll position **after** the page becomes visible. In `setupSettingsDrillDown`, right after adding `onigiri-settings-page`, set `#oswPageScroll.scrollTop = 0`. Check that jumping to a search result still scrolls to its target.
- **Cause (Code):** The nav button's handler calls `showPage()` (`web/settings.js:15064-15076`), which sets `scrollTop = 0` (`:15486`) while `.osw-main` is still `display: none` (`web/mobile.css:1080`). The class that shows it is added afterwards, when the click bubbles to the shell (`web/mobile.js`, `setupSettingsDrillDown`). WebKit does not apply a scroll position to a hidden element.
- **Evidence:** `t088.3s_hashi-opens-prescrolled.jpg`

#### LAY-03 · Colour pickers are crushed into slivers
- **Time:** 1:30–1:34
- **Screen:** Settings → Hashi Notes → bottom
- **Type / Severity / Confidence:** Defect / **High** / High
- **Owner:** Bingsu
- **What happens:** Note Card Color, Accent, Title Color and Excerpt Color show only 2–3 pt vertical slivers where the swatches should be.
- **Why it matters:** Four settings cannot be seen and are practically untappable.
- **Recommendation:** One column below 600 px, with full-width light and dark swatch rows like the ones on Main Menu.
- **Cause (Code):** `.osw-deck-color-grid` is a fixed two-column grid (`web/settings.css:5917`) with no phone override in `mobile.css`. It is used when `full_width_color_grid` is set and for Deck Stats (`web/settings.js:6253`), so check Deck Stats too.
- **Evidence:** `t092.0s_colour-pickers-crushed.jpg`

#### LAY-04 · The Main Menu layout editor is clipped
- **Time:** 1:03–1:08
- **Screen:** Settings → Main Menu → Organize Widgets
- **Type / Severity / Confidence:** Defect / **High** / High
- **Owner:** Bingsu
- **What happens:** "Restore Default" is cut on both sides. The Columns value is hidden. "Widget Heigh", "Grid Width px" (no visible field) and "+ Add Widge" run off the edge. Slider tracks are about 30 pt wide, and labels truncate to "Border Ra…" and "Border Wi…". There are also two "Restore Default" buttons. No widget arrangement canvas is visible on this tab during the recording.
- **Why it matters:** The main customisation tool cannot be operated reliably.
- **Recommendation:** A phone-specific form: one labelled row per property with a stepper, full-width sliders, "Add Widget" as a full-width button, and one "Restore Defaults" at the bottom. If drag arrangement is not supported on phones, show a simple reorderable list.

#### LAY-05 · Segmented controls and buttons are truncated across Settings
- **Time:** 1:10–1:55
- **Screen:** Sidebar, Hashi Notes, Pomodoro, Prep Station, Gamification
- **Type / Severity / Confidence:** Defect / **High** / High
- **Owner:** Bingsu
- **What happens:** "Righ" (Right), "Custor" (Custom), a lone "C" (third Background Source option), "Singl" (Single), "Dashb" (Dashboard), "Font S", "estore Defaul", "ustomization", and "Class / ic" split mid-word (1:52).
- **Why it matters:** Options are unreadable or undiscoverable, and it is the clearest "unfinished" signal in the app.
- **Recommendation:** One shared phone segmented control: label above, control full width, equal segments; fall back to a list or menu picker when labels do not fit. Add an automated check for horizontal overflow on every settings page at 390 px (`web/mobile.js` already has `findOverflow`).
- **Evidence:** `t066.5s_main-menu-clipped.jpg`, `t099.0s_pomodoro-emoji-glyphs.jpg`, `t112.0s_classic-wraps.jpg`

#### LAY-06 · The Backup and recovery dialog is badly laid out
- **Time:** 0:14–0:17
- **Screen:** First launch after install
- **Type / Severity / Confidence:** Defect / **High** / High
- **Owner:** Bingsu (content), Kioku (title bar)
- **What happens:** The title bar reads ")nigiri · Backup and recover|", clipped at both ends. The title repeats inside the panel. About half the screen is empty above the text, the text is indented far from the left, and the icon floats in a corner.
- **Why it matters:** This is the first thing shown after installing, and it concerns user data.
- **Recommendation:** A short window title ("Recovery"), a top-aligned icon, heading and message, one full-width button, and no second title.
- **Cause (Code):** `ui_kit/onigiri_notifications.py` `OnigiriInfoDialog` (desktop layout, `_branded_title` prefixes "Onigiri · "). The Kioku `TitleBar` does not elide long titles.
- **Evidence:** `t015.8s_recovery-dialog.jpg`

#### LAY-07 · Deck names are cut off
- **Time:** 0:17 onwards; worst 2:17–2:18
- **Screen:** Deck list
- **Type / Severity / Confidence:** Defect / Medium / High
- **Owner:** Bingsu
- **What happens:** "Korean Grammar Cheat She", "Korean Vocabulary by Ev", "Korean Sentences (Be", cut mid-letter with no ellipsis. Edit mode shortens them further.
- **Why it matters:** Names that share opening words lose the part that tells them apart as they get longer.
- **Recommendation:** Allow two lines or end with an ellipsis. Remove the unused indent before the file icon for top-level decks (about 40 pt) and consider hiding the icon when every row has the same one.
- **Cause (Likely):** `.deck-name` rules in `web/mobile.css:325` and `web/menu.css`.
- **Evidence:** `t136.2s_deck-list.jpg`

#### LAY-08 · Gallery tiles cannot be told apart
- **Time:** 0:55–1:01
- **Screen:** Settings → Gallery
- **Type / Severity / Confidence:** Defect / Medium / High
- **Owner:** Bingsu
- **What happens:** Adjacent tiles both read "Profile Name Appeara… / Color". Two others read "Profile Page Backgrou…".
- **Recommendation:** Group under a heading ("Profile name") and give each tile a short distinct label, with two lines allowed.
- **Evidence:** `t058.0s_gallery-truncated.jpg`

#### LAY-09 · Black bands at top and bottom until a deck is first opened
- **Time:** 0:16–0:29 and 2:01–2:05; gone from 2:05
- **Screen:** Deck list, Home, Menu
- **Type / Severity / Confidence:** Defect / Medium / High (observed)
- **Owner:** Bingsu
- **What happens:** The status bar strip and home indicator strip are pure black against the navy page. Every main screen shown before the first deck overview has them; none shown afterwards does. The layout shifts when they disappear.
- **Why it matters:** Looks letterboxed on launch.
- **Recommendation:** Paint the edge colour from the theme at start-up, before the first page shows, and repaint after any dialog closes.
- **Cause (Likely):** `web/mobile.js` `paintEdges` → `core/ios_native.py` `set_edge_color`. The latter returns early when `_state["edge"]` matches the cached colour, even if the window was restyled since.
- **Evidence:** `t017.0s_black-bands-toast-over-tabs.jpg`

#### LAY-10 · Profile sheet is not full height and has weak controls
- **Time:** 2:11–2:14
- **Screen:** Profile sheet
- **Type / Severity / Confidence:** Defect / Medium / Medium
- **Owner:** Bingsu
- **What happens:** The panel ends well above the bottom, leaving an empty band. Scrolled content runs up under the status area. The close `×` is small and faint on lavender.
- **Recommendation:** Use the same sheet component as other sheets: grab handle, full height to the safe area, sticky header, 44 pt close target.
- **Evidence:** `t133.0s_profile-sheet.jpg`

#### LAY-11 · Overview repeats the profile pill and overlaps the card border
- **Time:** 2:05 onwards
- **Screen:** Deck overview
- **Type / Severity / Confidence:** Opportunity / Low / High
- **Owner:** Bingsu
- **What happens:** A large "USER" pill straddles the top of the stats card, between the deck name and its counts.
- **Why it matters:** It adds no information about the deck and competes with the title.
- **Recommendation:** Hide it on phones by default, keeping the existing setting to enable it.

### B3. Theming, typography and visual consistency

#### THM-01 · Three competing colour systems
- **Time:** 0:03–0:12, 0:16–0:29, 0:30–2:01, 2:48–2:50, 2:59–3:01
- **Screen:** Whole app
- **Type / Severity / Confidence:** Inconsistency / **High** / High
- **Owner:** Bingsu (settings), Kioku and Anki (Qt chrome)
- **What happens:** Study screens are blue-navy (about `#1B1B28`). Settings are neutral charcoal (`#171717`). Qt title bars and dialogs are a different grey. Moving between them looks like switching apps.
- **Why it matters:** This is the most direct visible conflict between Kioku's interface and Bingsu's.
- **Recommendation:** One set of semantic tokens (background, surface, raised surface, separator, text, secondary text, accent, destructive) derived from the active theme, used by web pages, settings and a Qt stylesheet applied on mobile. Previews can still show their own palettes.
- **Cause (Code):** Deliberate. `settings_web/render.py:54` says "Settings keeps neutral chrome; only its accent follows the theme" (`rendering/theme_palette.py` `chrome_palette`). Revisit that decision for phones.

#### THM-02 · Anki's Qt windows are unstyled desktop forms
- **Time:** 0:05–0:11, 2:48–2:50, 2:59–3:01
- **Screen:** Add-ons, Description, Edit Current
- **Type / Severity / Confidence:** Inconsistency / **High** / High
- **Owner:** Anki and Kioku; Bingsu may restyle
- **What happens:**
  - Add-ons is two desktop columns with seven stacked buttons, and the add-on name is truncated.
  - Description shows a raw HTML `<a href>` string in a large text box with a tiny OK button.
  - Edit Current has a dense toolbar of roughly 20 pt icons, very small field text, and both `‹ Back` and `Close`.
- **Why it matters:** Editing a note is a core, frequent task and is the least phone-like screen.
- **Recommendation:** Start with the editor: larger field text (16 pt or more), a horizontally scrolling toolbar with 44 pt targets, one dismiss button. Apply the theme stylesheet to dialogs. Keep raw HTML editing available in Description.
- **Evidence:** `t169.0s_description-qt-window.jpg`, `t180.0s_edit-current-window.jpg`

#### THM-03 · Fonts change between and within screens
- **Time:** 2:30 versus 2:37; 3:03
- **Screen:** Sheets, reviewer, Qt windows
- **Type / Severity / Confidence:** Defect (sheet) and Inconsistency (rest) / Medium / High
- **Owner:** Bingsu; Card for the answer text
- **What happens:** The same `⋯` sheet is in Poppins on the overview but in a different face on the reviewer. Qt windows use the system font. The answer ("English:") uses an Arial-like card font.
- **Recommendation:** Set `font-family` explicitly on `.onigiri-quick-menu`. Leave card content to the card template.
- **Cause (Code):** Sheet rules set sizes but no family (`web/mobile.css:375, 477`), so on the reviewer they inherit the card's font.
- **Evidence:** `t158.3s_reviewer-sheet-font.jpg`

#### THM-04 · Too many button, card and toggle styles
- **Time:** Throughout; clearest 2:05 and 1:15–1:55
- **Screen:** Overview, deck list, settings, dialogs
- **Type / Severity / Confidence:** Inconsistency / Medium / High
- **Owner:** Bingsu
- **What happens:** Filled pill (Study Now), thin outlined rectangles (Options, Custom Study), outlined rows (Ready to go), Qt buttons, pill chips, capsule Reset buttons, bordered and borderless cards, several corner radii.
- **Recommendation:** Three button levels (primary filled, secondary tinted, plain), one card style, one list-row style, two corner radii.

#### THM-05 · Toggles do not look like iOS switches
- **Time:** 0:41–1:55
- **Screen:** Settings
- **Type / Severity / Confidence:** Opportunity / Low / High
- **Owner:** Bingsu
- **What happens:** 38 × 22 rounded-square switches with a square knob; the off state is nearly invisible. One toggle in the Sidebar preview has an unexplained "D" in its knob (1:10).
- **Recommendation:** 51 × 31 capsule switch with a visible off track; replace "D" with a text label.
- **Cause (Code):** `web/settings.css` `.osw-switch` (about line 1449).

#### THM-06 · Pomodoro controls render as emoji
- **Time:** 1:37–1:45
- **Screen:** Settings → Pomodoro → preview
- **Type / Severity / Confidence:** Defect / Medium / High
- **Owner:** Bingsu
- **What happens:** Play and skip appear as Apple's blue emoji tiles inside the accent circle.
- **Recommendation:** Use SVG icons.
- **Cause (Code):** Text glyphs `▶ ⏸ ⏭` in `web/settings.js:6998-7000` and `study_tools/pomodoro.py:967-1104`. Check the running timer as well; it was not shown.
- **Evidence:** `t099.0s_pomodoro-emoji-glyphs.jpg`

#### THM-07 · Product naming is inconsistent
- **Time:** 0:10, 0:14, 0:18, 0:25, 2:23
- **Screen:** Add-ons list versus everywhere else
- **Type / Severity / Confidence:** Inconsistency / Medium / High
- **Owner:** Bingsu
- **What happens:** The add-on installs as "Bingsu: Onigiri for iOS (Kioku)", then calls itself Onigiri: "Welcome to Onigiri!", "Onigiri Settings", "Onigiri Games", "Onigiri · Backup and recovery", "Onigiri Ready — …" decks and a rice-ball icon.
- **Recommendation:** Decide on a name. Commit `798fa57` deliberately reverted an in-app rename, so treat visible strings separately from data keys, file formats and deck names, which affect compatibility. Keep upstream credit and licence notices. Replace the long manifest name with a short one.
- **Cause (Code):** `core/config.py:155` (`statsTitle`), `core/translations.py`, `manifest.json`.

### B4. Icons, legibility and touch

#### ACC-01 · Deck header controls are faint and small
- **Time:** 0:17 onwards
- **Screen:** Deck list header (Edit, search, sort, house)
- **Type / Severity / Confidence:** Defect (contrast) / Medium / High
- **Owner:** Bingsu
- **What happens:** Grey on navy, measured at about **3.25 : 1** from the video. "Edit" is text and looks disabled; icons are about 14 pt.
- **Recommendation:** Use the accent or primary text colour, 20–22 pt glyphs, 44 pt targets.

#### ACC-02 · Reviewer buttons have almost no boundary
- **Time:** 2:33–2:41, 2:55–3:03
- **Screen:** Reviewer bottom bar (Edit, Show Answer, `⋯`)
- **Type / Severity / Confidence:** Opportunity / Medium / High
- **Owner:** Bingsu
- **What happens:** The labels are readable, but button fill against the page measures about **1.05 : 1**, so Show Answer does not look like the primary action.
- **Recommendation:** Give Show Answer an accent or clearly raised fill; keep Fail and Pass as they are (they read well).

#### ACC-03 · Icon-only tab strips
- **Time:** 0:55–1:23, 1:48
- **Screen:** Gallery, Main Menu, Sidebar, Reviewer, Gamification settings
- **Type / Severity / Confidence:** Defect (usability) / Medium / High
- **Owner:** Bingsu
- **What happens:** Only the selected tab has a label; others are bare glyphs (a "T", flags, lightning, folder). Gallery has about a dozen destinations in one scrolling strip, including look-alike chart icons. Strips are clipped at the edge.
- **Recommendation:** Replace with a list or labelled, scrollable chips.
- **Cause (Code):** `web/settings.js:15315-15335` `fitTabs` switches to icons when labels do not fit, and always for Main Menu and Sidebar at narrow widths.

#### ACC-04 · Reused or unclear icons
- **Time:** 0:30, 2:20–2:22
- **Screen:** Settings list, sort sheet
- **Type / Severity / Confidence:** Inconsistency / Low / High
- **Owner:** Bingsu
- **What happens:** Overviewer and Prep Station share a bar-chart icon. A–Z, Z–A and Custom order share one icon.
- **Recommendation:** One glyph per meaning.

### B5. Interaction and feedback

#### INT-01 · Search opens without a keyboard
- **Time:** 2:19–2:20
- **Screen:** Deck list search
- **Type / Severity / Confidence:** Possible defect / Medium / Medium
- **Owner:** Bingsu
- **What happens:** The field appears focused and the tab bar hides, but no keyboard appears during the roughly one second it is open.
- **Why it matters:** The user would need a second tap.
- **Recommendation:** Test on the device. If confirmed, call `focus()` synchronously inside the tap handler.
- **Cause (Likely):** `web/engine.js:434-455` `toggleDeckSearch` focuses inside `requestAnimationFrame`, which iOS may not count as a user gesture.

#### INT-02 · Toasts cover controls
- **Time:** 0:04–0:07, 0:10–0:11, 0:14–0:17
- **Screen:** Any
- **Type / Severity / Confidence:** Defect / Medium / High
- **Owner:** Anki and Kioku; Bingsu may override
- **What happens:** A white-bordered desktop tooltip sits bottom-left over Create Deck, Add-ons buttons, the recovery dialog and the **Decks and Home tabs**.
- **Recommendation:** On mobile, show a themed, centred toast above the tab bar that never intercepts taps.
- **Cause (Code):** Anki's `aqt.utils.tooltip`; Kioku only resizes it (`shared/python/kioku/patches.py` `_fit_tooltip`).
- **Evidence:** `t004.0s_toast-stock-deck-list.jpg`, `t017.0s_black-bands-toast-over-tabs.jpg`

#### INT-03 · Sync progress is a desktop modal that stacks over other dialogs
- **Time:** 0:02–0:04, 0:14–0:15
- **Screen:** Launch sync
- **Type / Severity / Confidence:** Inconsistency / Medium / High
- **Owner:** Anki and Kioku
- **What happens:** A square grey box with striped bar appears over the deck list, and on the next launch over the recovery dialog.
- **Recommendation:** A slim themed banner for normal sync, a modal only when a decision is needed, and queued dialogs. Do not change sync logic or the conflict prompts.

#### INT-04 · Reviewer toolbar and stock bottom bar flash on entry
- **Time:** 2:54.3–2:54.5
- **Screen:** Overview → reviewer
- **Type / Severity / Confidence:** Defect / Medium / High
- **Owner:** Bingsu
- **What happens:** First Anki's stock "Options / Custom Study / Description" bar appears at the bottom. Then a row of seven circular toolbar icons appears and shifts the card down. Both disappear.
- **Why it matters:** Visible desktop interface and layout shift in the most repeated flow.
- **Recommendation:** Hide the desktop header and bottom bar with CSS present before first paint, and swap the bottom web view only when its new content is ready.
- **Cause (Likely):** `web/mobile.js` `setupNavBar` / `hideHeaderButtonsInShadow` inject the hiding style after the header mounts, retrying every 250 ms.
- **Evidence:** `t174.4s_reviewer-toolbar-flash.jpg`

#### INT-05 · Card-actions popover is dense and ambiguous
- **Time:** 2:56–2:58
- **Screen:** Reviewer bottom `⋯`
- **Type / Severity / Confidence:** Inconsistency / Medium / High
- **Owner:** Bingsu
- **What happens:**
  - Two buttons are both labelled **Replay** (card audio, and your recording).
  - The "Card" and "Note" chips for Bury and Suspend are about 24 pt tall.
  - Delete Note looks like any other row.
  - It is a floating popover, unlike the app's other sheets.
- **Recommendation:** Bottom sheet; rename the second to "Replay Recording"; 44 pt targets; red destructive row separated from the rest, and confirm that deletion can be undone.
- **Evidence:** `t177.0s_card-actions-popover.jpg`

#### INT-06 · "Click to reveal" does not say what it reveals
- **Time:** 2:05 onwards
- **Screen:** Deck overview
- **Type / Severity / Confidence:** Defect (wording) / Medium / High
- **Owner:** Bingsu
- **What happens:** A full-width button with desktop wording and no subject.
- **Recommendation:** "Show add-on widgets", styled as a disclosure row; remember the choice.
- **Cause (Code):** `rendering/patcher.py:2591` and `:2640-2722`. It reveals other add-ons' content injected into the overview (possibly Review Heatmap, which is installed).

#### INT-07 · Edit mode has two "Done" buttons
- **Time:** 2:17–2:18
- **Screen:** Deck list edit mode
- **Type / Severity / Confidence:** Inconsistency / Low / High
- **Owner:** Bingsu
- **Recommendation:** Keep the header Done; the bottom bar holds Actions and the selection count.

#### INT-08 · Long, untitled action sheet
- **Time:** 2:23–2:25
- **Screen:** House-icon sheet
- **Type / Severity / Confidence:** Opportunity / Low / High
- **Owner:** Bingsu
- **What happens:** Ten rows fill most of the screen with no title or grouping, and the list has to scroll to show Cancel.
- **Recommendation:** Group (Study, Create, Settings). Largely solved by NAV-02.

### B6. Settings content and behaviour

#### SET-01 · "AnkiWeb Sync" reads as if Anki sync were off
- **Time:** 0:41–0:43
- **Screen:** Settings → Sync
- **Type / Severity / Confidence:** Defect (wording) / **High** / High
- **Owner:** Bingsu
- **What happens:** The page's main switch is titled "AnkiWeb Sync made by h0tp" and is **off**, even though the collection synced at launch. It actually controls syncing the add-on's own data through the media folder.
- **Why it matters:** Users may believe their reviews are not backed up, or toggle something they did not mean to.
- **Recommendation:** "Sync Onigiri settings and progress", with "Your cards and review history sync separately through Anki." Move the credit to a footer. Disable the category switches while the main switch is off (they currently look active). Replace "this computer" with "this device".
- **Evidence:** `t041.3s_sync-page.jpg`

#### SET-02 · Desktop-only options and wording on iPhone
- **Time:** 0:43–0:45, 1:10–1:16
- **Screen:** Modes, Sidebar
- **Type / Severity / Confidence:** Defect / Medium / High
- **Owner:** Bingsu
- **What happens:** "Works on Windows and Linux only", "Restart Anki when applying this mode", "Hide the top menu bar (File, Edit, …)", sidebar position Left/Center/Right, "Pin sidebar width … edge resizing". The phone has no sidebar. The Modes slider has no labels for its positions.
- **Recommendation:** Hide inapplicable controls on phones **without erasing their synced values**; rename "Sidebar" to "Deck list". Label the slider stops.

#### SET-03 · Empty or uninformative previews
- **Time:** 0:31–0:39, 0:47, 1:19–1:23, 1:50
- **Screen:** Profile, Languages, Overviewer, Reviewer, Typography
- **Type / Severity / Confidence:** Opportunity / Low / High
- **Owner:** Bingsu
- **What happens:** Large blank preview boxes; the English preview shows "Save → Save"; the Typography preview is mostly empty with the sample text below the fold.
- **Recommendation:** Compact previews with real content; hide the language preview for the source language.

#### SET-04 · Disabled features look enabled
- **Time:** 1:55–1:59, 2:11
- **Screen:** Nook Level settings, profile sheet
- **Type / Severity / Confidence:** Inconsistency / Low / High
- **Owner:** Bingsu
- **What happens:** Nook Level is off, but its sub-switches look active and the profile sheet still shows "Nook Level 0".
- **Recommendation:** Dim dependent settings and hide widgets for disabled features.

#### SET-05 · Themes page is slow to scan and shows no current palette
- **Time:** 0:50–0:53
- **Screen:** Settings → Themes
- **Type / Severity / Confidence:** Opportunity / Medium / Medium
- **Owner:** Bingsu
- **What happens:** Very large palette tiles, two per row. No tile visible while scrolling is marked as selected. "Light · Dark" captions with tiny dots add little.
- **Recommendation:** Smaller swatches, three per row, with a check mark on the active one.

#### SET-06 · Pomodoro sound rows are duplicated
- **Time:** 1:42–1:45
- **Screen:** Settings → Pomodoro → Sound
- **Type / Severity / Confidence:** Inconsistency / Low / High
- **Owner:** Bingsu
- **What happens:** "Start tone" and "End tone" each appear twice: once as a picker, again as a Preview row.
- **Recommendation:** Put the play button on the picker row.

#### SET-07 · Reset buttons look harmless
- **Time:** 1:58
- **Screen:** Nook Level → Reset Progress
- **Type / Severity / Confidence:** Opportunity / Low / Medium
- **Owner:** Bingsu
- **What happens:** Reset Level, Coins and Purchases use neutral capsules.
- **Recommendation:** Destructive styling, and verify each asks for confirmation (not tested).

### B7. Home, text and content

#### CON-01 · Home dashboard uses space poorly
- **Time:** 0:18–0:19, 2:02
- **Screen:** Home tab
- **Type / Severity / Confidence:** Opportunity / Medium / Medium
- **Owner:** Bingsu
- **What happens:** Four large cards mostly empty around one number each. The activity calendar has no day numbers or legend, and today is not clearly identified. A greeting takes the title position.
- **Recommendation:** Lead with what is due and a Study button; compact the four stats into one row or a 2 × 2 of half the height; add a legend.

#### CON-02 · Copy and number formatting
- **Time:** 0:18, 2:05, 2:11
- **Screen:** Home, overview, profile
- **Type / Severity / Confidence:** Defect (minor) / Low / High
- **Owner:** Bingsu
- **What happens:** "1 cards"; Home says study time 0.2 min while the profile sheet says "0m"; "Overviewer" is internal jargon; the weekly chart's "514" has no unit and the chart no scale; "≈ 224 days · 7/8/27" does not say it is an estimate of finishing.
- **Recommendation:** Pluralise, show seconds under a minute, rename to "Deck overview", label the numbers.
- **Cause (Code):** `rendering/onigiri_renderer.py:2355` uses a fixed "cards" unit.

### B8. Launch, install, data and performance

#### SYS-01 · Black screen on launch
- **Time:** 0:01–0:02.5, 0:13–0:14.6
- **Screen:** Launch
- **Type / Severity / Confidence:** Defect (feel) / Medium / High
- **Owner:** Kioku
- **What happens:** Solid black for about 1.3 s and 1.6 s with no logo or progress.
- **Recommendation:** A themed launch screen; then profile start-up time on the device.

#### SYS-02 · Installing an add-on means force-quitting
- **Time:** 0:10–0:12
- **Screen:** Add-ons
- **Type / Severity / Confidence:** Opportunity / Medium / High
- **Owner:** Kioku
- **What happens:** After "Changes will take effect when Anki is restarted", the app is closed from the app switcher.
- **Recommendation:** Offer a restart or reload button.

#### SYS-03 · Alarming recovery message after reinstall
- **Time:** 0:14–0:17
- **Screen:** Recovery dialog
- **Type / Severity / Confidence:** Defect (to investigate) / **High** / Medium
- **Owner:** Bingsu
- **What happens:** It reports an empty data folder (4 files restored) and "Your Onigiri progress was unreadable". The restore apparently succeeded.
- **Why it matters:** Users will think study data was lost.
- **Recommendation:** Find out why progress was "unreadable" and not simply absent. Reword: "Your Onigiri settings and game progress were restored. Your cards and review history were not affected." Confirm that second sentence is true before shipping it.
- **Cause (Code):** `core/safe_storage.py:744-753` and about `:434`.

#### SYS-04 · Add-on decks are visible when the add-on is not running
- **Time:** 0:02–0:05
- **Screen:** Stock Kioku deck list (before install)
- **Type / Severity / Confidence:** Opportunity (compatibility) / Medium / High (observed), Low for other clients
- **Owner:** Bingsu
- **What happens:** Four empty "Onigiri Ready — …" decks appear as ordinary decks.
- **Why it matters:** They are real decks in the collection, so they will likely also show in AnkiMobile, AnkiDroid or desktop Anki after sync.
- **Recommendation:** Consider creating them on demand and removing empty ones afterwards. Any change must first return cards to their home decks (`ready_to_go.restore_internal_cards` exists). Needs careful testing.
- **Cause (Code):** `study_tools/ready_to_go.py:26-45`.

#### SYS-05 · Stock Kioku's menu dropdown is overdrawn
- **Time:** 0:05–0:06
- **Screen:** Tools menu, before Bingsu was installed
- **Type / Severity / Confidence:** Defect / Medium / High
- **Owner:** Kioku
- **What happens:** The lower part of the menu is hidden behind the deck table.
- **Why it matters:** Affects stock Kioku, and Bingsu only if `ios_show_menu_row` is on.
- **Cause (Likely):** Native web views draw above Qt widgets.
- **Evidence:** `t005.8s_stock-tools-menu-clipped.jpg`

#### SYS-06 · Transitions replace instead of push
- **Time:** about 2:05, 2:07, 2:09, 2:27
- **Screen:** Deck list ↔ overview
- **Type / Severity / Confidence:** Opportunity / Low / High
- **Owner:** Bingsu
- **What happens:** The old screen vanishes, a blank frame shows (1–2 frames, 17–33 ms), then the new page slides in over empty background.
- **Recommendation:** Keep the outgoing page visible during the slide, or use a short cross-fade.
- **Cause (Code):** `web/mobile.js` `screenTransition` animates only the incoming page.

**Performance otherwise:** sheets, tab changes and settings drill-ins looked prompt. I saw no sustained stutter at the sampling rates used. A screen recording cannot establish frame pacing on the device.

**Audio:** two bursts of about 3 s, at 2:33.7 and 2:54.9, each just after a card appeared, which is consistent with card audio autoplay. I measured the levels but did not listen, so quality is unverified.

---

## C. Design and consistency recommendations

### C1. Repeated patterns behind the issues

| Pattern | Issues | Shared fix |
|---|---|---|
| Desktop layouts squeezed to 390 pt | LAY-03, 04, 05, 08, ACC-03 | Phone form components and an overflow test |
| Several design systems | THM-01 to 05 | One token set and component library |
| Desktop wording and concepts | NAV-03, SET-01, SET-02, INT-06 | Phone copy review |
| Layer seams (Qt, web, add-on) | NAV-05, THM-02, INT-02, 03, 04, LAY-09 | A single "mobile chrome" module in Bingsu |
| Many ways to show a menu | NAV-01, INT-05, INT-08 | One sheet component |

### C2. Components to build once

1. **Navigation bar:** back, title, one or two trailing actions, safe-area aware. Used by study screens, settings and (restyled) Qt dialogs.
2. **Bottom sheet:** grab handle, optional title, grouped rows, destructive style, Cancel, explicit font. Replaces the action sheet, card popover and profile panel.
3. **Settings row:** label, optional description, trailing control; 44 pt minimum.
4. **Segmented control:** full width, with automatic fallback to a picker.
5. **Colour row:** label plus full-width light and dark swatches.
6. **Buttons:** primary, secondary, plain, destructive.
7. **Toast and dialog:** themed, safe-area aware.

### C3. Suggested starting values
These are proposals, not observations.

- Spacing: 4, 8, 12, 16, 24 pt; 16 pt screen margins.
- Radii: 12 pt for controls and cards, 20 pt for sheets.
- Type: Large title 28, title 17 semibold, body 17, secondary 15, caption 13. Nothing below 12.
- One font for app chrome. If Poppins stays, apply it to every surface Bingsu controls.
- Contrast: 4.5 : 1 for text, 3 : 1 for control boundaries and icons.
- Respect Dynamic Type and Reduce Motion where WKWebView allows.

Keep what already works: the three-tab bar shape, the sheet visual style, the coloured count badges, the large Study Now button and the two-button Fail/Pass bar with intervals.

---

## D. Navigation and usability recommendations

**Proposed structure** (everything Anki offers stays reachable):

```
Tab bar:  Decks      Browse      Add (+)      Stats      More
Decks:    top bar with Search, Sort, Edit, Sync status
Deck:     Overview → Study Now; ⋯ = Options, Custom Study, Description, Export…
Reviewer: ‹ back · progress · one ⋯ (card actions); study tools in its own section
More:     Settings (Study / Appearance) · Study tools · Games ·
          Library (Import, Export, Backups, Get Shared, Create Deck, Profiles) ·
          Maintenance · Add-ons · Help
```

Home widgets can sit above the deck list or remain a tab; avoid also having a house icon.

**Quick wins:** fix the settings scroll reset (LAY-02), hide the duplicate settings header (NAV-05), set the sheet font (THM-03), rename the Sync switch (SET-01), rename "Click to reveal" (INT-06), replace emoji glyphs (THM-06), fix plurals (CON-02).

**Efficiency:** the stat cards and deck counts could be tappable shortcuts to study; settings search should be tested with the keyboard; consider making "Simple" the default settings mode (the code currently defaults to Advanced, `settings_web/dialog.py`).

---

## E. Ten most valuable improvements

| # | Improvement | Fixes | Impact | Effort |
|---|---|---|---|---|
| 1 | Make Settings fit a phone: shared segmented, colour and form rows, plus an overflow test | LAY-03, 04, 05, 08, ACC-03 | Very high | Large |
| 2 | Reset settings scroll after the page is visible | LAY-02 | High | Very small |
| 3 | One navigation model; surface Add, Browse, Stats, Sync | NAV-01, 02, 03, INT-08 | Very high | Large |
| 4 | Fix the overview overlap by top-aligning and reserving the nav height | LAY-01 | High | Small |
| 5 | One header in Settings | NAV-05 | High | Small |
| 6 | Clarify Sync wording and the recovery message; investigate "unreadable" | SET-01, SYS-03, LAY-06 | High (trust) | Small to medium |
| 7 | One theme token system, including Qt chrome and screen edges | THM-01, 02, LAY-09 | High | Medium to large |
| 8 | Polish the study loop: no flash, clear Show Answer, one font, clearer card actions | INT-04, 05, ACC-02, THM-03, NAV-01 | High (used constantly) | Medium |
| 9 | Make the note editor and other Qt dialogs phone-friendly | THM-02 | High | Medium to large |
| 10 | Themed toasts and sync banner that never cover controls | INT-02, 03 | Medium | Medium |

**Suggested order of work:** 2, 4, 5, 6 (small and safe), then 1 and 7 (shared components), then 3, 8, 9, 10.

---

## F. Uncertainties and additional testing

### Not shown in the recording
- **Add, Browse, Stats, manual Sync, Deck Options, Custom Study, Preferences, Get Shared, Create Deck, Import, Export, Backups.** These are probably the most desktop-like screens left and need their own recording.
- **Answering a card.** Fail and Pass were shown but not pressed (the counter stayed at 0/21). Scheduling, FSRS, review history, undo and the congratulations screen are unverified.
- **Light appearance** and **any theme change.** Theme switching and persistence cannot be judged.
- **Games, Prep Station, Hashi Notes and Pomodoro in use.** Only their settings were shown.
- **On-screen keyboard** in any field.
- **Landscape, iPad, smaller iPhones, Dynamic Type, VoiceOver, offline and sync-conflict states.**
- **Long or nested deck names**, large deck counts and subdeck trees.

### Cannot be determined from video
- Touch locations are not shown, so which control was tapped is inferred from the result and the code.
- Whether any control that was not tapped works.
- True frame rate, memory and battery use.
- The installed Kioku version and which add-on settings are defaults.

### Tests to run after fixing
1. Every settings page at 375, 390 and 430 pt: no horizontal overflow, opens at the top.
2. Overview with Deck details open, a very long deck name and add-on widgets revealed.
3. Search: keyboard appears on the first tap.
4. Cold launch: no black bands, theme correct from the first frame.
5. Light and dark, plus two non-default themes, across study screens, settings and Qt dialogs.
6. Study a full session on a **copy** of the collection; compare review log, due dates and FSRS values with desktop Anki after sync.
7. Run the existing tests in `tests/` before and after. `docs/IOS_AUDIT.md` records 87 already-failing tests, so compare against that baseline.

### Method
Contact sheets at 2 frames per second covering the full 3:11, 5–10 frames per second strips and full-resolution frames at suspect moments, a per-frame scan for blank screens, and colour sampling for the contrast figures. Both repositories were read, not built or run. No speech was transcribed. The recording was analysed locally.
