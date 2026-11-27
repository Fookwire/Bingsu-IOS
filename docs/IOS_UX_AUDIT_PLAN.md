# Plan: act on the Kioku iPhone UX audit (for Sonnet 5.5 to implement)

## Context
You recorded Onigiri for iOS (build `2.0.3-Bento-ios.24`, commit `798fa57`) running in Kioku on a real iPhone. That recording was turned into an audit: `Kioku_Bingsu_UX_Audit.md` plus 23 evidence frames, in `docs/audit_2026-11/` (audit text and evidence frames).

What the audit found:
- 51 issues: 13 High, 26 Medium, 12 Low.
- No crash and no data loss.
- The overall verdict is "a usable beta that does not yet feel like one iPhone app".

Most of the problems come from where three things meet: Qt/Kioku chrome, Onigiri's web pages, and desktop CSS that was never adapted for phones.

This plan turns the audit into ordered, shippable work. Your decisions:
- **Keep the tab bar as Decks · Home · Menu.** Fix navigation inside that structure.
- **On phones, Settings and Qt dialogs follow the active theme.**
- Rename the add-on listing to **"Onigiri for iOS"**. Onigiri stays the in-app name, and "Bingsu" stays only on GitHub and in the README.
- Cover **everything Onigiri owns**.

Kioku-owned items are out of scope, apart from a short upstream note: SYS-01 (launch screen), SYS-02 (restart after install) and SYS-05 (menu drawn under the web view).

## Ground rules (every phase)
- **Do not change** scheduling, FSRS, review logging, sync logic, the collection schema, config keys, deck names or file formats. Every change here is presentation, layout, wording or navigation. Move or relabel Anki features; never remove them.
- **Phone-only:** scope everything with `html.onigiri-phone` or `onigiri-touch` in CSS/JS, and `core/platform.IS_MOBILE` or `is_phone_device()` in Python. iPad and desktop must stay pixel-identical unless an item says otherwise.
- **Before starting:**
  1. Read `docs/audit_2026-11/Kioku_Bingsu_UX_Audit.md` and the evidence frames named in each item.
  2. Treat line numbers in the audit as approximate. They were checked against `798fa57` and match today's tree, but reproduce each issue before fixing it.
- **One phase = one commit and one build** (`ios.25`, `ios.26`, …), built with `harness/build.sh <version>`, which outputs `dist/Onigiri-iOS.ankiaddon`.
- **Where to push:** `claude/practical-ritchie-w20lag`. Do not push to `main` without asking.
- **Tests:** after each phase, `harness/tests.sh` must stay at the 87 known failures. Add tests for new Python helpers next to `tests/test_ios_native.py`.

## Phase 1: quick, safe fixes (audit list E: items 2, 4, 5, 6)
- **LAY-02, settings pages open scrolled**
  - In `web/mobile.js` `setupSettingsDrillDown` (~line 1307), right after `root.classList.add('onigiri-settings-page')`, reset `#oswPageScroll.scrollTop = 0`. Do it again in a `requestAnimationFrame` after the page is visible.
  - Cause: `showPage()` in `web/settings.js:15486` resets scroll while `.osw-main` is `display:none`.
  - Keep search-result jumps working: skip the reset when a search target is pending.
- **LAY-01, deck title over Back when Deck details is open**
  - On phones, override `web/overview.css:2-10` (body flex-centred, `min-height:100vh`) with top alignment.
  - Add `padding-top: calc(var(--onigiri-safe-top) + nav height)` so the fixed `#onigiri-phone-nav` (`mobile.css` ~1333) never overlaps, and let the page scroll.
- **NAV-05, two headers and two Backs in Settings**
  - In `settings_web/dialog.py`, on mobile, call `setProperty("kioku_hide_titlebar", True)` on the settings window before `show()`. This was confirmed in Kioku `a822555` `windows.py`: it is a Qt dynamic property read on Show and DynamicPropertyChange, on top-level Dialog/Window types only.
  - Restore `#oswDone` on phones (currently hidden at `web/mobile.css:1191`) as the single iOS header:
    - **Done** on the root list page;
    - **‹ Settings** on subpages.
  - Older Kioku builds ignore the property. When that happens, detect that the title bar is still present by checking `window.findChild` for a child named TitleBar. In that case, keep today's layout and don't show two Done buttons.
  - Apply the same property to the other full-screen Onigiri web windows that draw their own header, but only where they already have an in-page close.
- **SET-01, Sync page wording**
  - Change the Sync page title to "Sync Onigiri settings and progress".
  - Add the subtitle "Your cards and review history sync separately through Anki."
  - Move "made by h0tp" to a footer, and change "this computer" to "this device".
  - Disable (dim) the category switches while the main switch is off. Files: `settings_web/schema.py`, `core/translations.py` (all languages where the key exists; English text for the others).
- **SYS-03 and LAY-06, the recovery dialog after reinstall**
  1. **Investigate first.** Find out why `core/safe_storage.py` (~434 and 744-753) reports progress as "unreadable" when it is really absent after a fresh install. Absent should be silent, or should say "restored" if restored.
  2. **Reword** only after confirming that the collection is never touched by this path: "Your Onigiri settings and game progress were restored. Your cards and review history were not affected."
  3. **Re-layout `OnigiriInfoDialog`** (`ui_kit/onigiri_notifications.py:290`) on mobile: icon, heading and text aligned to the top, one full-width button, no repeated title.
  4. **Shorten the window title on mobile.** `_branded_title` (:260) prefixes "Onigiri · ", and Kioku's title bar doesn't elide, so use "Recovery". Or set `kioku_hide_titlebar` and show the in-panel heading only.
- **THM-07, add-on name:** in `manifest.json`, change the name to "Onigiri for iOS". Change nothing else.
- **Also quick (THM-03, THM-06, INT-06, CON-02):**
  - **THM-03:** set `font-family` explicitly on `.onigiri-quick-menu` and on every sheet (`mobile.css` ~375 and ~477) so the reviewer's sheets don't inherit the card font.
  - **THM-06:** replace the Pomodoro `▶ ⏸ ⏭` glyphs with inline SVG in `web/settings.js` ~6998-7000 and `study_tools/pomodoro.py` ~967-1104, including the running timer.
  - **INT-06:** rename "Click to reveal" to "Show add-on widgets" (`rendering/patcher.py` ~2591 and 2640-2722), styled as a disclosure row. Remember the choice in an existing config key if there is one, or a new namespaced key with a default.
  - **CON-02:**
    - Make plurals correct ("1 card"; `rendering/onigiri_renderer.py` ~2355).
    - Show seconds for study times under a minute.
    - Rename "Overviewer" to "Deck overview" (display only).
    - Label the weekly chart number and the "≈ … days" estimate.

## Phase 2: Settings that fit a phone (audit item 1: LAY-03, LAY-04, LAY-05, LAY-08, ACC-03, NAV-06, THM-05, SET-02 to SET-07)
- **Build shared phone components once** in `web/mobile.css` and `web/settings.js`, scoped to phones:
  - **Settings row:** label, optional description, trailing control, at least 44pt tall.
  - **Segmented control:** label above, full width, equal segments. When labels don't fit, it automatically turns into a menu picker (measure `scrollWidth > clientWidth`).
  - **Colour row:** label plus full-width light and dark swatches. Override `.osw-deck-color-grid` (`settings.css:5917`) to one column below 600px. Check Hashi Notes and Deck Stats (`settings.js` ~6253).
  - **Switch:** a 51×31 capsule with a visible off track. Replace the "D" knob text with a label (`settings.css` `.osw-switch` ~1449).
  - **Tab strip:** labelled, scrollable chips or a list. Stop `fitTabs` (`settings.js:15317`) from collapsing to icon-only on phones.
- **LAY-04, Organize Widgets on phones:** a form with one labelled row per property, steppers, full-width sliders, a full-width "Add Widget" button and a single "Restore Defaults". If drag arrangement can't fit, use a reorderable list.
- **LAY-08:** give gallery tiles short, distinct labels under group headings, with two lines allowed.
- **NAV-06:** keep the Background tab visible but disabled, with the hint "Background applies to the Bar style" (`settings.js:2003` `syncProfileTabs`).
- **SET-02:** on phones, hide controls that only apply to desktop: the Windows/Linux-only mode, "restart Anki", menu-bar hiding, sidebar position and width pin. Their stored values stay untouched. Rename "Sidebar" to "Deck list" on phones, and label the stops on the Modes slider.
- **SET-03 to SET-07:**
  - Make previews compact, and hide the language preview for the source language.
  - Dim settings that depend on a disabled feature, and hide disabled features' widgets (Nook Level 0).
  - Themes: three swatches per row, with a check on the active theme.
  - Pomodoro: put the play button on the picker row and remove the duplicate rows.
  - Style the reset buttons as destructive and confirm each one asks for confirmation.
- **Overflow check:** add a harness script that opens every Settings page at 375, 390 and 430pt and runs `OnigiriMobile.findOverflow()` (`mobile.js:443`). It fails on any horizontal overflow, and asserts that each page opens with `scrollTop` at 0.

## Phase 3: theme tokens across pages, Settings, edges and Qt (audit item 7: THM-01, THM-02 styling, THM-04, LAY-09, ACC-01, ACC-02)
- **Shared token set:** one semantic set (background, surface, raised, separator, text, secondary text, accent, destructive) derived from the active theme in `rendering/theme_palette.py`, exposed as CSS variables on every Onigiri page.
- **Settings follow the theme:** on phones, Settings use these tokens instead of `chrome_palette`'s neutral chrome. Desktop keeps its current behaviour (`settings_web/render.py:54`).
- **Qt stylesheet on mobile:** derive an app-level Qt stylesheet from the same tokens and apply it on mobile (QDialog, QPushButton, QLineEdit, QListWidget, QTextEdit). That restyles Kioku's title bar, Add-ons, Description, the editor and sync progress, without touching their logic.
- **LAY-09, black bands at the screen edges:**
  - Paint the edge colour from the theme at profile open, before the first page shows.
  - Fix `core/ios_native.set_edge_color` (~174): it returns early when the cached colour matches, even after the window was restyled. Force a repaint after any dialog closes and after a stylesheet change.
- **THM-04:** three button levels (primary filled, secondary tinted, plain) plus destructive, one card style, one list-row style, and two radii (12 and 20).
- **ACC-01:** deck header controls in the accent or primary text colour, with 20-22pt glyphs and 44pt targets.
- **ACC-02:** a clearly filled accent Show Answer button. Leave Fail and Pass as they are.

## Phase 4: navigation model (audit item 3: NAV-01 to NAV-04, INT-07, INT-08, ACC-04)
- **The tab bar stays Decks · Home · Menu.** `addPhoneTabs` and `TAB_ORDER` in `web/mobile.js` keep the same three tabs, in the same order and with the same behaviour.
- **Add, Browse, Stats and Sync become visible on the Decks screen (NAV-02):**
  - Replace the house icon in the deck-list header (`web/injector.js:251` `setupArchivedHomeButton`) on phones, because it collides with the Home tab.
  - In its place, add a labelled **`+` Add** button plus **Browse** and **Stats** icon buttons with text labels or accessible names. Use the same command names `web/engine.js` `showHomeMenu` already sends (`add`, `browse`, `stats`).
  - Add a Sync button with a status dot to the same top bar.
  - Remaining actions (Create Deck, Import, Get Shared, Settings, Hashi Notes, games) live on the Menu tab, not in an untitled house sheet (INT-08).
  - Check why this phone was in `sidebarActionsMode == "archived"`: `core/config.py:1571` migrates "collapsed" to "archived". Leave the stored value unchanged.
- **The Menu tab page (NAV-03)**, built by `rendering/webview_handlers.py` (reuse `_menu_tree`, `show_app_menu` and `_run_app_menu_action`), regrouped by task so every action from the old File/Edit/View/Tools/Help menus stays reachable:
  - **Settings:** Study (Anki Preferences) and Appearance (Onigiri Settings). This is NAV-04.
  - **Study tools:** Hashi Notes, Pomodoro, Prep Station.
  - **Games.**
  - **Library:** Import, Export, Backups, Get Shared, Create Deck, Switch Profile.
  - **Maintenance:** Check Database, Check Media, Empty Cards.
  - **Add-ons.**
  - **Help.**
  - **Advanced:** full screen, zoom, exit.

  Map them by QAction identity, not by translated label text.
- **Home tab:** stays the widget dashboard (CON-01 polish is in Phase 7).
- **NAV-01, one sheet component for every menu:**
  - Overview `⋯`: Options, Custom Study, Description, Export.
  - Reviewer: a single `⋯` for card actions. Study tools are reachable from the Menu tab.
  - Deck-row `⋯`.
  - All use the same titled bottom sheet.
- **INT-07:** keep only the header Done in edit mode.
- **ACC-04:** one icon per meaning (Overviewer vs Prep Station; A-Z, Z-A, Custom).
- **iPad:** this restructure is phone-only unless it is trivially safe on iPad. Check that iPad screens are unchanged.

## Phase 5: study loop polish (audit item 8: INT-04, INT-05, LAY-10, LAY-11, INT-01, SYS-06)
- **INT-04, toolbar flash on entering review:** add the CSS that hides the reviewer header and bottom bar at document creation, through `inject_mobile_assets` in `__init__.py`, not later from `setupNavBar` or `hideHeaderButtonsInShadow` retries. For the shadow-root header, put the hiding rule in the style the header creates itself.
- **INT-05, card-actions popover:**
  - Turn `web/reviewer_more_menu.js` into the shared bottom sheet.
  - Rename the second "Replay" to "Replay Recording".
  - Make the Card/Note chips 44pt.
  - Separate Delete Note as a red row, and confirm it can be undone.
- **LAY-10, profile panel:** use the shared sheet (grab handle, full height to the safe area, sticky header, 44pt close).
- **LAY-11:** hide the overview "USER" pill on phones by default, keeping the existing setting so it can be turned back on.
- **INT-01, search keyboard:** in `web/engine.js` ~448, `toggleDeckSearch` focuses inside `requestAnimationFrame`. Call `focus()` synchronously in the tap handler instead.
- **SYS-06, deck list ↔ overview transition:** keep the outgoing page visible, or use a short cross-fade (`mobile.js` `screenTransition`), without regressing the decks↔overview-only rule from build 10.

## Phase 6: Qt dialogs, toasts and sync banner (audit items 9-10: THM-02, INT-02, INT-03)
- **Note editor on mobile:**
  - Inject CSS into the editor web view for 16pt or larger field text.
  - Make the toolbar scroll horizontally with 44pt targets.
  - Keep one dismiss button: set `kioku_hide_titlebar` and keep Close, or the reverse.
- **Description dialog:** use the Qt stylesheet and keep raw HTML editing available.
- **INT-02, toasts:** on mobile, wrap `aqt.utils.tooltip` in a themed toast that sits centred above the tab bar and doesn't take taps. Call the original function when not on mobile.
- **INT-03, sync progress:**
  - Show a slim themed banner for normal sync progress, and queue Onigiri dialogs so they never stack on top of it.
  - Leave Anki's sync logic and conflict prompts unchanged, and keep them as modals.

## Phase 7: content and compatibility (CON-01, SYS-04, LAY-07)
- **CON-01, Home dashboard:**
  - Lead with what's due and a Study button.
  - Compact the four stat cards to a single row.
  - Add a legend and day markers to the activity calendar, and mark today.
- **LAY-07, deck names:** allow two lines or end with an ellipsis. Remove the unused top-level indent (about 40pt), and hide the icon when every row uses the same one.
- **SYS-04, "Onigiri Ready" decks:** investigate only, and do not change behaviour. Write up how `study_tools/ready_to_go.py` could create them on demand and remove empty ones using `restore_internal_cards`, then stop for your approval. This changes the collection, so it needs its own testing plan.

## Verification
- **Unit tests:** `harness/tests.sh` stays at 87 known failures. `node --check` passes on changed JS, and there are new unit tests for the new Python helpers (toast wrapper, title-bar property, recovery wording path).
- **Emulation:**
  - Use the existing harness (`harness/restart.sh`, `snap.sh <out>`, Chromium iPhone 15 and iPad Pro 11). Confirm the harness forces phone mode with `ONIGIRI_FORCE_MOBILE=phone` in `harness/run_anki.sh`; the earlier rename work showed it can silently drop out.
  - Compare against the `new4` baseline after each phase: expected changes only, and iPad unchanged.
  - Run the new Settings overflow script at 375, 390 and 430pt.
- **Audit retests, section F:**
  1. Every settings page opens at the top with no overflow.
  2. Overview with Deck details open, a long deck name and widgets revealed.
  3. Search focuses on the first tap.
  4. Cold launch shows no black bands.
  5. Light, dark and two other themes across study screens, Settings and Qt dialogs.
  6. Answer cards in a copy of the collection. The review log, due dates and FSRS values must match desktop Anki after sync, using the existing `harness/answer_test.py` integrity check.
- **On the iPhone (you):** Phase 1 and Phase 4 each end with a short device checklist. It covers the keyboard, the Settings single header (and which Kioku build has `kioku_hide_titlebar`), edge colours on cold launch, the toast position, the new Add/Browse/Stats/Sync header buttons and the regrouped Menu page. Anything WebKit-only is reported as untested until you confirm it.
- **Upstream note for Kioku:** list SYS-01, SYS-02 and SYS-05, and the title-bar elision, in `docs/IOS_AUDIT.md` as Kioku items, with no code changes.

---

## Progress log

### Phase 1 (build ios.25), done in emulation, not yet on a device
Done: LAY-02 (pages open at the top; checked: scrollTop 0 after switching pages, but the bug itself is WebKit-only so only a phone can confirm), NAV-05 (Kioku `kioku_hide_titlebar` set; page shows its own Settings header with Done when the title bar is absent/hidden; the dialog detects Kioku's `TitleBar` child), SET-01 wording (title, subtitle, credit moved to a footer, "this device"), SYS-03/LAY-06 (missing files now say "was missing", the folder-restored notice says settings and game progress were restored and that cards and review history were not affected, and the info dialog is laid out for phones with a short title), THM-07 (add-on name "Onigiri for iOS"), THM-03 (sheet typeface), THM-06 (drawn icons in Settings preview and the Pomodoro window), INT-06 (English wording only), CON-02 (plural, seconds under a minute, "Deck overview" in English).

Not done / differences from the plan:
- LAY-01: could not reproduce the overlap in Chromium. The overview is now top-aligned with auto margins (centred while it fits, scrolls when it does not); needs a check on the phone with Deck details open.
- SET-01: dimming the category switches while the main switch is off is moved to Phase 2 (needs a generic "depends on" mechanism for settings rows, which also covers SET-04).
- INT-06: the choice is not remembered between visits (not implemented).
- New strings are English in all eight languages (rows in the translation table carry the English text); the old translated wording remains for the keys that were reused.
- Settings "Done" relies on a Kioku build that honours `kioku_hide_titlebar`; older builds keep today's layout.

### Phase 2 (build ios.26), done in emulation
Checked with an automated sweep of all 51 Settings pages and sub-tabs at 375, 390 and 430pt: no element runs off the screen and every page opens at the top (`harness` script `settings_sweep_js.txt`). Before: 162 overflow/clipping findings at 390pt.
Done: stacked rows for segmented/text/select controls; segmented controls fall back to a vertical list when words do not fit (no more mid-word breaks); tab strips keep labels and scroll (phones only); Organize Widgets laid out for phones (number chips 2 per row, full-width sliders, full-width actions); colour grids one column; gallery names wrap to two lines; slider titles and image-slot names wrap; iOS-size switches; Profile "Background" tab stays visible, dimmed, with an explanation (NAV-06); desktop-only controls removed on phones (Full mode, sidebar position, pin sidebar width, "restart Anki" notes) without touching stored values; "Sidebar" page is "Deck list" on phones; sync categories/preset and Nook options only shown while their switch is on (SET-01/SET-04); Nook resets styled destructive (they already require a 3 s hold); Themes three per row with the theme in use checked (SET-05); Pomodoro tone preview button on its picker row (SET-06); English language preview hidden (SET-03).
Not done: "D"/"L" letters on light/dark colour swatches are intentional labels, not a switch knob (left); Modes slider stop labels; compact previews (Typography, Overviewer) beyond the overflow fixes.

### Phase 3 (build ios.27), done in emulation
Done: `core/mobile_theme.py` derives one token set (background, surface, raised, inset, separator, text, secondary, accent, destructive) from the active theme. On phones Settings use it instead of the neutral chrome (THM-01); the Qt application palette is set from it at profile open, on theme change and when Settings closes (Kioku's title bar and Anki's dialogs, THM-02 colours); the safe-area strips are painted from it at profile open (LAY-09), `set_edge_color` repaints when the main window lost its rule, and edges are re-checked when the focused window changes (dialog closed). Show Answer gets the accent fill on phones unless the user set their own colours (ACC-02). Deck header controls use the accent, 21px glyphs, 44pt targets (ACC-01). Tests: `tests/test_mobile_theme.py`.
Not done: THM-04 (one button system) was not forced over user-customisable button colours; THM-02 layout of Qt windows (editor, Description) is Phase 6. Qt palette and edge painting only run on a real device (the harness is not iOS for edges); checked: palette applied in the harness with the theme background.

### Phase 4 (build ios.28), done in emulation
Tab bar unchanged (Decks · Home · Menu). Done: on phones the house icon (sidebar actions "archived") is replaced by a labelled Add / Browse / Stats / Sync row under the deck list header; Sync shows the existing sync-needed status as a dot (NAV-02). The Menu tab is grouped by task (Settings with Preferences and the Onigiri menu, Study, Library incl. Create Deck and Get Shared, Maintenance, Add-ons, Help, Advanced; add-on entries under More), matched by Anki's QAction objects, falling back to the plain menu on error (NAV-03/04, INT-08). Sheets have titles; the overview ⋯ lists the deck's Options / Custom Study / Description first, then app actions; the reviewer's top button is a distinct "Study Tools" grid icon so it no longer looks like the card-actions ⋯ (NAV-01). Edit mode keeps only the header Done (INT-07). Distinct icons for A–Z / Z–A sort, Deck overview and Prep Station (ACC-04). Header icons 21px.
Checked: tapping Add and Sync in the new row sends `add` and `sync`; the grouped menu renders all Anki actions.
Not done: the card-actions sheet itself (Phase 5).
