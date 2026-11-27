# Kioku + Bingsu on iPhone: second UX, visual design and QA audit

**Recording:** `recording 2.MP4` (7 min 27 s, 1206 × 2622, portrait; dark appearance, with a short light-mode test)
**Add-on build on screen:** `2.0.3-Bento-ios.31` (shown at 0:04). `Fookwire/Bingsu-IOS` is now at `ddc4b92`; everything after the recorded build (`7898fa6`) only changes the manifest, changelog and release workflow, so the app code is the same.
**Kioku source read:** `krmanik/kioku` at `a822555` (tag `v0.2.12`), also compared with `v0.2.11`.
**Evidence images:** [`audit2_evidence/`](audit2_evidence/). File names start with the timestamp in seconds.
**Previous audit:** 51 issues, in `docs/audit_2026-11/` of the add-on repository. Their status is in the Appendix.

---

## How to use this report (read this first, Claude Code)

- New issues are numbered **R2-01** onwards so they do not collide with the first audit's IDs.
- **Timestamps** are M:SS and accurate to about ±1 s.
- **Type:** *Defect* (visibly wrong), *Inconsistency* (works but conflicts with the rest) or *Opportunity* (a judgement call, not a bug).
- **Owner:** *Bingsu* (this add-on), *Kioku* (the app shell, upstream) or *Anki* (unmodified desktop code). For Kioku and Anki items, prefer a workaround inside Bingsu, or propose it upstream.
- **Cause** is labelled:
  - **Confirmed in code:** I read the code path and it explains what is on screen. I did not run it.
  - **Likely:** plausible, needs testing.
- **The earlier fixes were only checked in desktop emulation.** Several did not work on the phone. Do not mark anything done from emulation alone; verify on the device or the iOS Simulator with the **same Kioku version the phone has**.
- **Do not change** scheduling, FSRS, review logging, sync logic, the collection schema, deck names or file formats. Do not remove Anki functionality.
- **Privacy:** the Preferences → Syncing and Advanced tabs (about 3:21–3:36) show account details. Do not publish those frames. None of the evidence images include them. The add-on repository is public.

### Start here: five fixes with a known cause

| Fix | Issue | Size |
|---|---|---|
| Update Kioku on the phone to `v0.2.12`, and make the header check wait for or detect the Kioku version | R2-04 | Small |
| Give hidden settings rows `min-height: 0` again | R2-12 | One line |
| Send the whole palette back after "Apply theme", not just the accent | R2-05 | Small |
| Stop theme apply from overwriting the Show Answer accent | R2-07 | Small |
| Reserve the nav bar's height on the deck overview | R2-03 | Small |

---

## 0. How the two projects fit together

| Layer | What it is | What you see in this recording |
|---|---|---|
| **Anki** | The unmodified desktop app (Python, Qt 6) | Browse, Add, editor, Preferences, Deck Options, Statistics, Custom Study, Description, Choose Deck are all desktop screens. |
| **Kioku** | Runs Anki on iOS; WKWebView stands in for QtWebEngine; adds a `‹ Back` title bar to each window | The grey back button and clipped titles. Keyboard and touch-scrolling behaviour in desktop widgets. |
| **Bingsu / Onigiri** | Add-on with web pages for deck list, overview, reviewer and settings, plus a phone layer (`web/mobile.css`, `web/mobile.js`, `core/`) | The tab bar, sheets, settings and games. |

---

## A. Overall assessment

**Verdict: clearly better than the first recording, still not a finished iPhone app.**

**What improved, as seen on the phone:**
- Add, Browse, Stats and Sync are now visible on the deck list.
- The Menu page is grouped by task.
- Most settings pages fit the screen and open at the top; colour pickers are usable.
- Deck names wrap instead of being cut off.
- Search opens the keyboard. Toasts are themed. The reviewer no longer flashes a desktop toolbar.
- Settings and window chrome now take theme colours.

**What is still wrong:**
- **Half the app is desktop Anki.** Browse, Preferences, the editor, Add, Statistics and Deck Options look and behave like a computer program. This recording shows them for the first time, and they are the weakest part by far.
- **Three earlier fixes did not work on the phone:** the double header in Settings, the overview title printing over Back, and the Show Answer button.
- **At least one earlier change made things worse:** the editor toolbar is now a tall, broken grid.
- **Theme changes apply only halfway**, leaving one theme's accent on another theme's background.

| Area | First recording | Now |
|---|---|---|
| Core study loop | Fair to good | Good |
| Navigation | Poor | Fair |
| Visual consistency | Poor | Fair on Bingsu screens, poor across the app |
| Settings | Poor | Fair |
| Anki's own screens | Barely shown | Poor |
| Stability | No crash seen | No crash or data loss seen |

**Counts:** 42 issues in this report: 0 Critical, 10 High, 19 Medium, 13 Low. Of the 51 earlier issues: **21 fixed, 17 partly fixed, 5 not fixed, 8 not shown**.

No card was answered in this recording either, so scheduling behaviour is still unverified.

---

## B. Detailed issue inventory

### B1. Regressions and fixes that did not work

#### R2-01 · Dragging in Browse selects ranges of cards
- **Time:** 1:35–1:39
- **Screen:** Browse card list
- **Type / Severity / Confidence:** Defect / **High** / Medium
- **Owner:** Kioku, Anki
- **What happens:** While the user drags on the list, blue ranges appear and change: 7, then 2, 3, 2, 7, 8, 1, 11 and 13 cards selected. The list mostly stays where it is. Later flicks do scroll it, and the 13 selected cards stay selected.
- **Why it matters:** Trying to scroll silently selects many cards, on a screen whose menus can delete, suspend or move everything selected. There is no obvious way to deselect by touch.
- **Recommendation:** A drag scrolls; a tap selects one row; multi-selection only in an explicit "Select" mode with a visible count and Cancel.
- **Cause (Likely):** The table's extended selection receives touch drags as mouse drags. Kioku already uses `QScroller.grabGesture` for its tab strips (`shared/python/kioku/windows.py:249, 342`) but I found no equivalent for the browser table. Touch points are not visible, so confirm on the device.
- **Evidence:** `t097.0s_browse-drag-selects.jpg`

#### R2-02 · The editor toolbar is a broken three-row grid
- **Time:** 0:34–0:41, 1:29–1:31, 1:37 (editor pane in Browse)
- **Screen:** Edit Current, Add, Browse editor
- **Type / Severity / Confidence:** Defect (regression) / **High** / High
- **Owner:** Bingsu
- **What happens:** Buttons are stacked in uneven vertical columns (Fields above Cards; B, I, U in a column; chevrons floating alone). The toolbar takes roughly a fifth of the screen and runs off the right edge. In the first recording it was two compact rows.
- **Why it matters:** Editing is a core task; this looks like a rendering failure and pushes the fields down.
- **Recommendation:** One horizontal row where each button *group* is also a row, or revert to Anki's default wrapping and only enlarge targets.
- **Cause (Likely):** The phone rules added in `cad3eb6` (`web/mobile.css`, about 2644–2675): `nowrap` on `.editor-toolbar .button-toolbar`, `flex: 0 0 auto` on its children and 44 pt minimums, without handling Anki's nested button groups.
- **Evidence:** `t036.5s_editor-toolbar-stacked.jpg`, `t090.8s_add-window.jpg`

#### R2-03 · The overview still prints its title over Back
- **Time:** 1:11–1:13
- **Screen:** Deck overview, after "Show add-on widgets"
- **Type / Severity / Confidence:** Defect (earlier LAY-01, not fixed) / **High** / High
- **Owner:** Bingsu
- **What happens:** The title lands on top of `‹ Decks` and `⋯`. Scrolling then runs the stats card underneath them.
- **Why it matters:** Unreadable header and an obstructed back button.
- **Recommendation:** Pad the page by safe area plus nav height, and give the nav bar a background that appears on scroll.
- **Cause (Confirmed in code):** `web/mobile.css:2216-2224` top-aligns the column but reserves no space for `#onigiri-phone-nav`, which is `position: fixed; top: 10px` (about line 1333) and transparent.
- **Evidence:** `t071.5s_overview-overlap-widgets.jpg`

#### R2-04 · Settings now has three ways out: Back, Settings and Done
- **Time:** 0:05 onwards, all of Settings; Edit Current 0:34
- **Screen:** Onigiri Settings, Edit Current
- **Type / Severity / Confidence:** Defect (earlier NAV-05, worse) / **High** / High
- **Owner:** Bingsu, plus a Kioku update
- **What happens:** Kioku's `‹ Back` bar is still there, and underneath it the root page now also has "Settings … Done". Subpages keep `‹ Back` and `‹ Settings`. Edit Current keeps both Back and Close.
- **Why it matters:** Redundant, conflicting controls; about 44 pt of height wasted.
- **Recommendation:** (1) Update Kioku to `v0.2.12`, the first tag with `kioku_hide_titlebar`. (2) On older Kioku, do not show Done. Check for support directly, for example `hasattr(kioku.windows, "HIDE_TITLE_BAR")`, or run the title bar check after Kioku's deferred adopt has run.
- **Cause (Confirmed in code, version inferred):** `settings_web/dialog.py` calls `_sync_own_header()` immediately after `show()`. In `v0.2.11` Kioku creates `TitleBar` later, via `QTimer.singleShot(0, …)`, so the check finds none and turns Done on. That the bar remains despite the property implies the phone's Kioku is older than `v0.2.12`; confirm the installed version.
- **Evidence:** `t005.8s_settings-three-exits.jpg`

#### R2-05 · "Apply theme" changes only the accent until Settings is closed
- **Time:** 0:09–0:15 (Machiatto), 4:25–7:10 (Nord)
- **Screen:** Settings
- **Type / Severity / Confidence:** Defect / **High** / High
- **Owner:** Bingsu
- **What happens:** After Apply, buttons and links take the new accent but backgrounds, cards and Kioku's bar keep the old theme. After choosing Nord, teal accents sit on Machiatto brown for the rest of the session. Closing Settings fixes it.
- **Why it matters:** It looks as if the theme is broken or two design systems are fighting. This is where users judge themes.
- **Recommendation:** Repaint the whole Settings window and the Qt chrome as soon as a theme is applied.
- **Cause (Confirmed in code):** `web/settings.js` `applyThisTheme` (about 14288–14304) updates `CTX.accent` but never `CTX.palette`; `_cmd_theme_apply` (`settings_web/dialog.py` about 864–875) returns no palette; `mobile_theme.refresh()` runs only in `closeEvent`.
- **Evidence:** `t011.6s_theme-apply-bar.jpg`, `t015.4s_theme-apply-settings-stays-old.jpg`, `t268.0s_nord-accent-on-old-background.jpg`

#### R2-06 · Forcing light mode leaves the bars dark
- **Time:** 4:14–4:19
- **Screen:** Settings → Themes → Color mode
- **Type / Severity / Confidence:** Defect / Medium / High
- **Owner:** Bingsu
- **What happens:** The page turns cream; Kioku's title bar and the home-indicator strip stay dark brown.
- **Recommendation:** Refresh the Qt palette and edge colours when the colour mode changes.
- **Cause (Likely):** Same as R2-05: the refresh is tied to closing the window.
- **Evidence:** `t257.0s_light-mode-dark-chrome.jpg`

#### R2-07 · Show Answer still does not look like the main button
- **Time:** 0:28–0:33, 7:18–7:23
- **Screen:** Reviewer bottom bar
- **Type / Severity / Confidence:** Defect (earlier ACC-02, not fixed) / Medium / High
- **Owner:** Bingsu
- **What happens:** Show Answer has the same quiet fill as Edit and `⋯`.
- **Recommendation:** Use the accent by default on phones, including after a theme is applied; keep an explicit user colour if they set one.
- **Cause (Confirmed in code):** `rendering/patcher.py` (about 8751–8765) applies the accent only if the colours equal the factory defaults. `settings_web/theme_store.py` (about 318–335) writes every `onigiri_reviewer_*_bg_*` key, including Show Answer, when any theme is applied. `core/config.py:1470-1483` can also copy the old utility-button colours into these keys.
- **Evidence:** `t439.5s_show-answer-not-accent.jpg`

### B2. Anki's desktop screens

#### R2-08 · Browse is the desktop browser
- **Time:** 1:33–2:04
- **Screen:** Browse
- **Type / Severity / Confidence:** Inconsistency / **High** / High
- **Owner:** Anki, Kioku
- **What happens:** A menu bar (Edit, View, Notes, Cards, Go, Help) with underlined letters and ⌘ shortcuts; four columns with "Kor…ita"; rows about 21 pt; the keyboard opens on entry and covers half the list; search history shows raw `cid:` strings; a search with no results shows a blank area.
- **Why it matters:** One of the three main destinations, and the least phone-like.
- **Recommendation:** On phones: a two-line list row (front text, then deck and due date), 44 pt, a search field that does not auto-focus, a filter sheet in place of the sidebar, and a `⋯` sheet holding every current menu command. Add an empty state.
- **Evidence:** `t097.0s_browse-drag-selects.jpg`, `t113.6s_browse-desktop-menu.jpg`, `t117.0s_browse-cards-menu.jpg`

#### R2-09 · Using the Browse sidebar pushes the window off the top of the screen
- **Time:** 1:45–1:52
- **Screen:** Browse → Sidebar
- **Type / Severity / Confidence:** Defect / **High** / High
- **Owner:** Kioku
- **What happens:** Tapping a sidebar entry (for example Purple) brings up the keyboard, and the whole window slides up. The title bar disappears and list rows run under the clock and Dynamic Island.
- **Why it matters:** No back button, overlapping text, and a keyboard nobody asked for.
- **Recommendation:** Do not focus the search field after a sidebar selection; keep the title bar pinned and shrink only the content when the keyboard shows.
- **Cause (Likely):** Keyboard avoidance moves the window to reveal a focused field hidden behind the sidebar.
- **Evidence:** `t106.3s_browse-window-shifted.jpg`

#### R2-10 · Window titles and chooser buttons are cut at both ends
- **Time:** 0:52–1:06, 1:29–1:31, 1:35–1:44, 2:06–2:21
- **Screen:** Deck Options, Add, Browse, Statistics
- **Type / Severity / Confidence:** Defect / **High** / High
- **Owner:** Kioku (title), Anki (buttons)
- **What happens:** "r Korean Grammar Sentenc", "wse (1 of 2454 cards selec", "orean Sentence" (note type), "ımmar Sentenc" and "mmar Sentenc" (deck).
- **Why it matters:** On Add, the user cannot read which note type or deck the card will go into.
- **Recommendation:** Short phone titles ("Deck Options", "Browse"), middle or end ellipsis, and full-width labelled rows for Type and Deck.
- **Cause (Confirmed in code for titles):** Kioku's `TitleBar` centres a label that does not elide.
- **Evidence:** `t054.5s_deck-options-window.jpg`, `t090.8s_add-window.jpg`

#### R2-11 · Preferences does not fit the screen
- **Time:** 3:08–3:36
- **Screen:** Preferences
- **Type / Severity / Confidence:** Defect / **High** / High
- **Owner:** Anki, Kioku
- **What happens:** Tabs scroll sideways; the Review tab is wider than the screen ("5 hours past mic…", an Answer keys panel off to the right); the Experiments card is a narrow column with one or two words per line; the AnkiHub text is cut at top and bottom; checkboxes are about 15 pt. Desktop-only settings are listed (Video driver, Reset Window Sizes, Spacebar answers, Answer keys).
- **Why it matters:** Important scheduling and sync settings are hard to read and set.
- **Recommendation:** On phones, one vertically scrolling list with section links, controls at full width, and desktop-only items moved into a collapsed "Desktop options" group (not removed).
- **Evidence:** `t196.0s_preferences-clipped.jpg`, `t207.5s_preferences-experiments.jpg`

#### R2-14 · Dialogs are desktop forms
- **Time:** 1:06–1:09, 1:29–1:31, 2:17–2:19
- **Screen:** Custom Study, Description, Add, Choose Deck
- **Type / Severity / Confidence:** Inconsistency / Medium / High
- **Owner:** Anki, Kioku
- **What happens:** Radio buttons about 14 pt; small OK and Cancel in the bottom corner; Description shows raw HTML; deck rows about 19 pt; in Choose Deck the keyboard opens at once and hides the dialog's buttons.
- **Recommendation:** 44 pt rows, a full-width primary button, no auto keyboard in pickers. Keep raw HTML editing available.
- **Evidence:** `t067.2s_custom-study-window.jpg`, `t138.0s_choose-deck-window.jpg`

#### R2-15 · Deck Options, Statistics and the editor ignore the theme
- **Time:** 0:34, 0:52–1:06, 2:06–2:21
- **Screen:** Anki's web pages
- **Type / Severity / Confidence:** Inconsistency / Medium / High
- **Owner:** Anki; Bingsu may restyle
- **What happens:** Neutral grey cards and Anki blue controls inside themed brown chrome.
- **Recommendation:** Inject the theme's tokens as CSS variables into these pages on phones.
- **Evidence:** `t054.5s_deck-options-window.jpg`, `t129.0s_statistics-window.jpg`

### B3. Bingsu layout defects

#### R2-12 · Settings pages have large blank gaps
- **Time:** 4:51–4:57, 5:08–5:23, 5:25–5:40, 6:23–6:31
- **Screen:** Main Menu, Heatmap, Deck list, Hashi Notes
- **Type / Severity / Confidence:** Defect / Medium / High
- **Owner:** Bingsu
- **What happens:** Empty areas of 40–120 pt inside cards, where controls that do not apply are invisible but still take space.
- **Why it matters:** Looks half-loaded or broken.
- **Cause (Confirmed in code):** `web/mobile.css:2372` `html.onigiri-phone .osw-shell .osw-row { min-height: 44px }` is more specific than `.osw-designer-deck [data-field-host].is-hidden { min-height: 0 }` (`web/settings.css` about 5735). Add `:not(.is-hidden)`. Also check the `!important` padding on `.osw-slider-card`.
- **Evidence:** `t334.5s_deck-list-blank-gap.jpg`

#### R2-13 · "Font Size" control is unreadable
- **Time:** 6:12–6:20
- **Screen:** Settings → Prep Station → Study Plans Widget
- **Type / Severity / Confidence:** Defect / **High** / High
- **Owner:** Bingsu
- **What happens:** The label and "px" field are crushed into a small square and print over each other.
- **Recommendation:** Its own full-width row with a stepper. Check every widget header that packs several controls into one line.
- **Evidence:** `t378.0s_font-size-control-garbled.jpg`

#### R2-16 · Profile sheet jumps and leaves a blank panel
- **Time:** 2:38–2:56
- **Screen:** Profile sheet
- **Type / Severity / Confidence:** Defect / Medium / High
- **Owner:** Bingsu
- **What happens:** Dragging the sheet down shows an empty background, and closing it flashes a blank card before the deck list returns. A long white scroll line is drawn across the content. The user repeats the gesture many times.
- **Recommendation:** Present the sheet as an overlay above an untouched, dimmed deck list; one scroll container; interactive dismiss that follows the finger.
- **Cause (Likely):** The change that disables ancestor blur and transform while the sheet is open (`55eff77`).
- **Evidence:** `t163.3s_profile-blank-panel.jpg`, `t165.1s_profile-scrollbar-line.jpg`

#### R2-17 · Bio field runs outside its card
- **Time:** 3:51
- **Screen:** Settings → Profile → Profile Sidebar
- **Type / Severity / Confidence:** Defect / Medium / High
- **Owner:** Bingsu
- **Cause (Confirmed in code):** Phone stacking rules list `.osw-text-input` and `select` but not the multiline text area.
- **Recommendation:** Add the textarea to the stacked, full-width rule.
- **Evidence:** `t231.9s_bio-field-overflow.jpg`

#### R2-18 · Previews break words and show broken artwork
- **Time:** 4:58–5:07, 6:48–6:56, 7:01
- **Screen:** Stats Widgets, Onigimon, Bento Games
- **Type / Severity / Confidence:** Defect / Medium / High
- **Owner:** Bingsu
- **What happens:**
  - Stats Widgets: "STUD/IED", "RETE/NTIO/N", and in Expressive style one letter per line. The real Home tab shows two cards per row, so the preview is also wrong.
  - Onigimon HUD preview: names and numbers printed on top of each other.
  - Bento Games: Focumon and Senchado show a "?" placeholder instead of art.
- **Recommendation:** Preview with the phone's two-column layout; give the HUD a phone width; fix or replace the two image paths.
- **Evidence:** `t303.0s_stats-preview-vertical-text.jpg`, `t412.9s_onigimon-hud-overlap.jpg`, `t421.0s_bento-missing-icons.jpg`

#### R2-19 · Settings previews show a desktop app that does not exist on the phone
- **Time:** 5:25–6:10
- **Screen:** Deck list and Reviewer settings
- **Type / Severity / Confidence:** Inconsistency / Medium / High
- **Owner:** Bingsu
- **What happens:** The deck list preview shows a sidebar with a house icon; there are settings for that icon and for Action Buttons position; the reviewer preview shows the toolbar that phones hide; "Stats Numbers: Hover" has no meaning on touch. The word "Sidebar" remains (Profile Sidebar, Sidebar Customization, Hide profile on sidebar). The answer button preview clips "Easy" at the edge.
- **Recommendation:** Make previews render the phone layout; hide inapplicable controls without erasing stored values; use "Deck list" consistently.

#### R2-20 · Add-on widgets overflow the overview
- **Time:** 1:11–1:13
- **Screen:** Deck overview
- **Type / Severity / Confidence:** Defect / Medium / High
- **Owner:** Bingsu (container), third-party add-on (content)
- **What happens:** "175 days" breaks onto two lines and "Current streak" is clipped at the right. The heatmap stays desktop blue.
- **Recommendation:** Constrain external content to the screen width with its own horizontal scroll.
- **Evidence:** `t071.5s_overview-overlap-widgets.jpg`

#### R2-21 · Empty previews and an empty section
- **Time:** 3:59–4:07, 4:51, 5:52–6:00
- **Screen:** Modes, Main Menu background, Deck overview, Reviewer
- **Type / Severity / Confidence:** Defect (Modes), Opportunity (previews) / Low / High
- **Owner:** Bingsu
- **What happens:** Modes shows an "INDEPENDENT" heading with nothing under it. Background previews are large blank boxes. The Modes slider has three unlabelled stops and truncates "Everything in focus mod…".
- **Cause (Confirmed in code):** The phone adaptation removes the section's controls but keeps the section (`settings_web/schema.py`, `_adapt_for_phone` and the `modes_extras` section).
- **Recommendation:** Drop empty sections; label the slider stops; shrink previews that have nothing to show.
- **Evidence:** `t247.0s_modes-empty-heading.jpg`

#### R2-22 · Truncated and misspelled text
- **Time:** 5:22, 6:52, 7:07
- **Screen:** Several
- **Type / Severity / Confidence:** Defect / Low / High
- **Owner:** Bingsu
- **What happens:** "Mochi cheers you on every" (sentence unfinished), "Bulbassaur", "Particles Hetamap Animation".
- **Cause (Confirmed in code):** `core/translations.py` `mochi_cheer_on` is only the first half of a sentence and is used alone (`settings_web/games.py:1217`); `settings_web/games.py:921` and `gamification/onigimon.py:28`; `settings_web/schema.py:4195`. Change visible labels only, not the stored value `bulbassaur`.
- **Evidence:** `t427.8s_mochi-text-cut.jpg`

#### R2-23 · Tiles and tabs that cannot be told apart
- **Time:** 4:30–4:41, 4:42–4:50, 0:07
- **Screen:** Gallery, Main Menu tabs, Themes
- **Type / Severity / Confidence:** Defect / Low / High
- **Owner:** Bingsu
- **What happens:** Two Gallery tiles both read "Organize Widgets / Color"; two read "Profile Name Appearance / Color". Theme names truncate ("Catppuccin Fra…", "Catppuccin Ma…"). Tab strips cut labels at the edge with no scroll cue. Widget grid tiles read "Studied …", "Time Ca…" with remove buttons about 14 pt.
- **Recommendation:** Distinct names, two-line labels, an edge fade on scrollable tabs, 28 pt or larger remove buttons.

#### R2-24 · Switched-off games still show all their settings
- **Time:** 6:40–7:10
- **Screen:** Onigimon, Hexagon Land, Mochi, Focus Dango
- **Type / Severity / Confidence:** Opportunity / Low / High
- **Owner:** Bingsu
- **What happens:** Long option pages while the feature is off, including Onigimon when Ankimon is not installed.
- **Recommendation:** Collapse options below the master switch, as Nook Level now does.

### B4. Navigation, menus and sheets

#### R2-25 · The overview `⋯` sheet repeats the buttons behind it
- **Time:** 0:47–0:51, 1:14, 7:15
- **Screen:** Deck overview
- **Type / Severity / Confidence:** Inconsistency / Medium / High
- **Owner:** Bingsu
- **What happens:** Options, Custom Study and Description (already on screen) appear first, without icons and so oddly indented, followed by six app actions. The sheet has to scroll to reach Cancel.
- **Recommendation:** Deck-only actions here (Options, Export, Rename…), with icons. Leave app actions to the deck list and Menu.
- **Evidence:** `t049.9s_overview-more-sheet.jpg`

#### R2-26 · "Study Tools" holds app navigation, and its icon matches Home
- **Time:** 0:41–0:45, 7:20
- **Screen:** Reviewer and overview
- **Type / Severity / Confidence:** Inconsistency / Medium / High
- **Owner:** Bingsu
- **What happens:** The sheet is Add, Browse, Stats, Sync, Hashi Notes, Pomodoro. Its four-square button is the same shape as the Home tab icon. The answer bar stays visible and tappable below the sheet.
- **Recommendation:** Only study tools here, a distinct icon, and a sheet that covers the bottom bar.
- **Evidence:** `t043.2s_study-tools-sheet.jpg`

#### R2-27 · Card actions panel ignores the theme and is not quite a sheet
- **Time:** 0:30, 7:22
- **Screen:** Reviewer bottom `⋯`
- **Type / Severity / Confidence:** Inconsistency / Medium / High
- **Owner:** Bingsu
- **What happens:** Neutral near-black on a brown theme; no grab handle or Cancel; it stops above the answer bar.
- **Cause (Confirmed in code):** `web/reviewer_more_menu.css` defines its own fixed `--rm-*` palette.
- **Recommendation:** Map those variables to theme tokens and use the shared sheet container.
- **Evidence:** `t030.4s_card-actions-not-themed.jpg`

#### R2-28 · Deck row sheet differs from the others
- **Time:** 2:29–2:36
- **Screen:** Deck list row `⋯`
- **Type / Severity / Confidence:** Inconsistency / Low / High
- **Owner:** Bingsu
- **What happens:** No deck name in the header; Delete Deck is not red or set apart (Delete Note is); "Add-on actions…" and "Deck Options" share an icon.
- **Evidence:** `t149.6s_deck-row-sheet.jpg`

#### R2-29 · Six ways to close things
- **Time:** Throughout
- **Screen:** Whole app
- **Type / Severity / Confidence:** Inconsistency / Medium / High
- **Owner:** Bingsu, Kioku, Anki
- **What happens:** Done, `‹ Back`, Close, Cancel, `×` and OK, in different corners. Add and Edit Current show two of them at once.
- **Recommendation:** iOS rule: Back for drill-down, Done or Cancel at the top of a modal. One per screen.

#### R2-30 · Backups text points to a menu that no longer exists
- **Time:** 3:23
- **Screen:** Preferences → Backups
- **Type / Severity / Confidence:** Defect (wording) / Low / High
- **Owner:** Anki text, Bingsu navigation
- **What happens:** "You can restore backups via File > Switch Profile." There is no File menu on the phone.
- **Recommendation:** Keep the Menu → Library "Revert to Backup" entry discoverable, and mention it, for example with a short note added beside the Anki text.

#### R2-31 · Deck list header is tall and its status dot unexplained
- **Time:** 0:02 onwards; dot from 0:16
- **Screen:** Deck list
- **Type / Severity / Confidence:** Opportunity / Low / High
- **Owner:** Bingsu
- **What happens:** The profile pill and action tiles take about a third of the screen before the first deck, and "Ready to go" is cut off by the tab bar. A red dot appears on Sync after the theme change and stays, with no explanation.
- **Recommendation:** Compact the pill into the title row; label the dot ("Changes to sync") for VoiceOver and visually.

### B5. Keyboard, feedback and platform

#### R2-32 · Web form bar floats over the deck search
- **Time:** 1:22–1:24
- **Screen:** Deck list search
- **Type / Severity / Confidence:** Inconsistency / Low / High
- **Owner:** Kioku
- **What happens:** Above the keyboard, a Safari-style bar with up, down and check arrows covers deck rows. The keyboard itself now opens correctly.
- **Recommendation:** Suppress the web view's input accessory bar for single-field search.
- **Evidence:** `t083.0s_search-keyboard-bar.jpg`

#### R2-33 · Sync server password is shown in clear text
- **Time:** 3:29–3:36
- **Screen:** Preferences → Advanced
- **Type / Severity / Confidence:** Opportunity (privacy) / Low / High
- **Owner:** Kioku
- **What happens:** The phone's sync server password is plainly visible, even with the server off.
- **Recommendation:** Mask it with a show button.

#### R2-34 · Brief blank and shifting frames
- **Time:** 0:28, 0:34, 0:51, 1:03, 1:29, 2:05
- **Screen:** Reviewer entry; opening Anki windows
- **Type / Severity / Confidence:** Defect (feel) / Low / High
- **Owner:** Kioku, Anki
- **What happens:** Windows open as blank grey for about 0.15–0.2 s before content appears. On entering review the answer bar sits higher for one frame, then drops.
- **Recommendation:** Theme-colour the web view before load; fix the bar's height before it is shown.

### B6. Home and content

#### R2-35 · Home presents "no data" as zero results
- **Time:** 0:17–0:19, 2:56–3:07
- **Screen:** Home tab
- **Type / Severity / Confidence:** Defect (wording) / Medium / Medium
- **Owner:** Bingsu
- **What happens:** With nothing studied it shows "0%" retention with five faint stars, and "0.0 s/card".
- **Why it matters:** Reads as total failure rather than "not studied yet".
- **Recommendation:** Show "—" and "Nothing studied yet today", with the number due and a Study button.

#### R2-36 · Activity chart is unreadable in Year view
- **Time:** 2:59–3:06
- **Screen:** Home → Activity
- **Type / Severity / Confidence:** Defect / Medium / High
- **Owner:** Bingsu
- **What happens:** A year is drawn as dots about 2 pt wide in a mostly empty card. Week view is one row in the same tall card. The year picker is a very small pop-up. Month view has no day numbers or legend.
- **Recommendation:** Scroll the year horizontally with 10 pt cells, size the card to its content, add a legend and mark today.
- **Evidence:** `t182.0s_home-year-view.jpg`

#### R2-37 · Profile sheet numbers are still unclear
- **Time:** 2:38–2:50
- **Screen:** Profile sheet
- **Type / Severity / Confidence:** Defect / Low / High
- **Owner:** Bingsu
- **What happens:** "609" has no unit; study time shows "0m" while Home shows "0 s"; "Nook Level 0" appears although Nook Level is off. The overview's "≈ 224 days · 7/9/27" still does not say what it estimates.

#### R2-38 · "Ready to go" decks appear as normal decks
- **Time:** 1:50, 2:17
- **Screen:** Browse sidebar, Choose Deck
- **Type / Severity / Confidence:** Opportunity (compatibility) / Medium / High
- **Owner:** Bingsu
- **What happens:** Four empty "Onigiri Ready — …" decks are listed among real decks.
- **Recommendation:** The proposal in `docs/READY_TO_GO_DECKS.md` is waiting for your approval and a test plan. It changes the collection, so treat it separately.

### B7. Smaller consistency items

#### R2-39 · Too many button and card styles remain
- **Time:** Throughout
- **Screen:** Overview, deck list, settings, dialogs
- **Type / Severity / Confidence:** Inconsistency / Medium / High
- **Owner:** Bingsu
- **What happens:** Filled pill, bordered rectangles, outlined rows, tiles, capsules and Qt buttons (earlier THM-04, deliberately left).
- **Recommendation:** Three button levels and one card style, with user colour customisation applied on top.

#### R2-40 · The app is still called three things
- **Time:** 0:04, 0:17, 0:05
- **Screen:** Menu, Home, Settings
- **Type / Severity / Confidence:** Inconsistency / Low / High
- **Owner:** Bingsu
- **What happens:** "Onigiri" in menus and the Home greeting, "Bento" in the version string, and "Bingsu" only on GitHub. This follows an earlier decision; it is listed so you can revisit it.

#### R2-41 · Menu → Onigiri → Onigiri Settings
- **Time:** 0:03–0:05
- **Screen:** Menu
- **Type / Severity / Confidence:** Inconsistency (earlier NAV-04, partly fixed) / Medium / High
- **Owner:** Bingsu
- **What happens:** Appearance settings are still one level behind an "Onigiri" submenu.
- **Recommendation:** Put "Appearance" directly in the Settings group; keep Gamification and Study Tools as their own rows.

#### R2-42 · Deck list drag handles and widget editing rely on small targets
- **Time:** 1:24–1:27, 4:45–4:50
- **Screen:** Edit mode, widget grid
- **Type / Severity / Confidence:** Opportunity / Low / Medium
- **Owner:** Bingsu
- **What happens:** Edit mode works and shows a selection count, but the drag handles are faint; widget dragging works with small remove buttons.
- **Recommendation:** Higher-contrast handles; confirm before removing a widget.

---

## C. Design and consistency recommendations

### C1. The patterns behind the issues

| Pattern | Issues | Fix once |
|---|---|---|
| Anki's desktop screens untouched or only recoloured | R2-01, 02, 08–11, 14, 15, 32 | A "phone adapter" per Anki window |
| Theme values copied into several places and not refreshed together | R2-05, 06, 07, 15, 27 | One token source and one `refresh()` called on every change |
| Phone CSS layered over desktop CSS, fighting on specificity | R2-02, 03, 12, 13, 17 | Component classes with phone variants instead of overrides |
| Fixes verified only in emulation | R2-03, 04, 07 | A device or Simulator check with the real Kioku version |
| Each surface builds its own sheet and header | R2-25–29 | One sheet component and one nav bar |

### C2. Components to share
1. **Nav bar** with a background, reserved height and one dismiss control.
2. **Bottom sheet** with title, grouped rows, destructive style, Cancel, covering the bottom bar. Use it for all five menus.
3. **Settings row, segmented control, stepper, colour row, text area.**
4. **List row** (44 pt, two lines) for Browse, pickers and sidebars.
5. **Theme tokens**, consumed by Bingsu pages, the card actions panel, Anki web pages and the Qt stylesheet.

### C3. Suggested values (proposals, not observations)
16 pt screen margins; 12 pt radius for cards and controls, 20 pt for sheets; body 17, secondary 15, caption 13; 44 pt minimum targets; 4.5 : 1 text contrast.

**Keep:** the tab bar, the action tiles, two-line deck names, the themed toast, labelled settings chips and the Fail/Pass bar.

---

## D. Navigation and usability recommendations

1. **Make the three main destinations feel native.** Add and Browse are on the deck list now; the screens they open need to match. A native-style Browse list and a clean Add form matter more than further settings polish.
2. **One menu per context:** deck list (app actions), deck (deck actions only), reviewer (card actions), study tools (tools only).
3. **One way out per screen** (R2-29).
4. **Pickers should not summon the keyboard** until the user taps the filter.
5. **Shorten the path to appearance settings:** Menu → Appearance.
6. **Scope Settings for phones.** The reviewer, deck list and widget pages are very long and mix everyday choices with pixel values. Make "Simple" the default and keep radius, padding, blur and per-colour values under Advanced.
7. **Give Home a purpose:** what is due, a Study button, then history.

---

## E. Ten most valuable improvements

| # | Improvement | Issues | Impact | Effort |
|---|---|---|---|---|
| 1 | Stop drag from selecting cards in Browse | R2-01 | Very high (risk to cards) | Medium |
| 2 | Fix the editor toolbar | R2-02 | Very high | Small |
| 3 | Update Kioku and fix the header check; fix overview padding | R2-04, 03 | High | Small |
| 4 | Repaint everything on theme and colour-mode change; accent Show Answer | R2-05, 06, 07 | High | Small |
| 5 | Phone titles and full-width Type and Deck rows | R2-10 | High | Small to medium |
| 6 | Keep Browse on screen when the sidebar or keyboard is used | R2-09 | High | Medium |
| 7 | Phone-friendly Browse list and menus | R2-08 | Very high | Large |
| 8 | Fix settings gaps, Font Size, Bio, previews and text | R2-12, 13, 17, 18, 22 | Medium to high | Small |
| 9 | Phone-friendly Preferences, dialogs and Anki web pages | R2-11, 14, 15 | High | Large |
| 10 | One sheet component; trim the overview and study menus | R2-25–28 | Medium | Medium |

**Suggested order:** 2, 3, 4, 8 (small, known causes), then 1, 6, 5, then 7, 9, 10.

---

## F. Uncertainties and additional testing

### Not shown
- **Cold launch.** The recording starts with the app already running, so launch screen, edge colours at start-up and the recovery notice are unverified.
- **Answering a card.** Fail and Pass were shown but not pressed. FSRS, review log, due dates, undo and the finished screen are unverified.
- **Manual sync, sync progress and conflicts; Import, Export, backups; Get Shared; Create Deck; Add-ons.**
- **The lower part of the Menu page.** The code defines Maintenance, Add-ons, Help and Advanced below Library (`rendering/webview_handlers.py` about 590–600), but the page is never scrolled. Check that it scrolls and everything is reachable.
- **Light mode outside Settings,** landscape, iPad, Dynamic Type, VoiceOver.
- **Games, Prep Station, Hashi Notes and Pomodoro in use.**
- **Typing and saving** in Add or the editor.

### Cannot be determined from video
- Where the user touched. R2-01 in particular relies on the selection pattern.
- The installed Kioku version (R2-04).
- Frame pacing, memory and battery.
- Why the location arrow appears in the status bar around 2:06–2:20, while Statistics is open. "Keep running in the background", which uses location, is unticked in Preferences. Check whether Kioku or another app requested it.
- **Audio:** two short bursts at about 0:29 and 7:19, each as a card appeared, consistent with autoplay. I measured levels but did not listen.
- "Reduce motion" is ticked in Preferences, which may change how transitions behave.

### Tests to run after fixing
1. Browse: slow and fast drags never change the selection; the window stays below the status bar.
2. Edit and Add: toolbar in one clean row at 375, 390 and 430 pt.
3. Overview with widgets and Deck details open: nothing under the nav bar.
4. Apply three themes and both forced colour modes without closing Settings.
5. Every settings page: no overflow, no empty gaps, every switch state.
6. Study a full session on a **copy** of the collection; compare review log, due dates and FSRS values with desktop Anki after sync.
7. Run the tests in `tests/` and compare with the recorded baseline of 87 known failures.

### Method
Frames sampled at 4 per second across the full 7:27, with 474 distinct moments reviewed on contact sheets; 2–10 frames per second strips and full-size frames at suspect moments. Both repositories were read, not built or run. The recording was analysed on this Mac; no speech was transcribed.

---

## Appendix: status of the 51 issues from the first audit

| Status | Count |
|---|---|
| Fixed | 21 |
| Partly fixed | 17 |
| Not fixed | 5 |
| Not shown in this recording | 8 |

| Old ID | Subject | Status | Note |
|---|---|---|---|
| NAV-01 | Many menu surfaces | Partly | Sheets titled; still overlapping (R2-25, 26) |
| NAV-02 | Actions hidden behind house icon | Fixed | |
| NAV-03 | Desktop menu bar as menu | Fixed | Lower groups not scrolled to |
| NAV-04 | Split settings | Partly | R2-41 |
| NAV-05 | Double header | **Not fixed** | R2-04 |
| NAV-06 | Vanishing Background tab | Partly | Dimmed; no explanation seen |
| LAY-01 | Title over Back | **Not fixed** | R2-03 |
| LAY-02 | Pages open scrolled | Fixed | |
| LAY-03 | Crushed colour pickers | Fixed | |
| LAY-04 | Clipped layout editor | Partly | Two "Restore Default" buttons |
| LAY-05 | Truncated controls | Partly | R2-13, 23 |
| LAY-06 | Recovery dialog layout | Not shown | |
| LAY-07 | Cut deck names | Fixed | |
| LAY-08 | Identical Gallery tiles | Partly | R2-23 |
| LAY-09 | Black bands | Not shown | None seen; no cold launch |
| LAY-10 | Profile sheet | Partly | R2-16 |
| LAY-11 | Overview profile pill | Fixed | |
| THM-01 | Three colour systems | Partly | R2-05 |
| THM-02 | Desktop Qt windows | Partly | Recoloured; R2-02, 08–11, 14 |
| THM-03 | Mixed fonts | Fixed | |
| THM-04 | Many button styles | **Not fixed** | Deliberate; R2-39 |
| THM-05 | Toggles | Fixed | "D" toggle remains in previews |
| THM-06 | Emoji glyphs | Fixed | |
| THM-07 | Naming | Not shown | Add-ons list not opened |
| ACC-01 | Faint header controls | Fixed | |
| ACC-02 | Show Answer | **Not fixed** | R2-07 |
| ACC-03 | Icon-only tabs | Fixed | |
| ACC-04 | Reused icons | Fixed | |
| INT-01 | Search keyboard | Fixed | R2-32 |
| INT-02 | Toasts cover controls | Fixed | Theme toast only was seen |
| INT-03 | Sync progress stacking | Not shown | |
| INT-04 | Toolbar flash | Fixed | |
| INT-05 | Card actions popover | Partly | R2-27 |
| INT-06 | "Click to reveal" | Fixed | |
| INT-07 | Two Done buttons in edit mode | Fixed | |
| INT-08 | Long untitled sheet | Partly | R2-25 |
| SET-01 | Sync wording | Fixed | |
| SET-02 | Desktop-only options | Partly | R2-19, 21 |
| SET-03 | Empty previews | Partly | Language preview gone; others still blank (R2-21) |
| SET-04 | Disabled features look on | Partly | R2-24, 37 |
| SET-05 | Themes page | Fixed | |
| SET-06 | Duplicate sound rows | Fixed | |
| SET-07 | Reset styling | Fixed | |
| CON-01 | Home layout | Partly | R2-35, 36 |
| CON-02 | Copy and numbers | Partly | R2-37 |
| SYS-01 | Black launch screen | Not shown | |
| SYS-02 | Restart after install | Not shown | |
| SYS-03 | Recovery message | Not shown | |
| SYS-04 | Ready decks visible | **Not fixed** | Awaiting approval; R2-38 |
| SYS-05 | Menu drawn under web view | Not shown | |
| SYS-06 | Transitions | Partly | Fade and slide now |
