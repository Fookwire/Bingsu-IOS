# Kioku + Bingsu on iPhone: third UX, visual design and QA audit

**Recording:** `Recordings/Recording 3.MP4` (8 min 19 s, 1206 × 2622, portrait). Dark appearance in the default theme, a short forced-light test, then the Macchiato theme from 3:42 to the end.
**Add-on build on screen:** not shown as text. Features visible on screen (Browse "Select" row, "To sync" label, themed Deck Options, the Activity legend) only exist in the audit-2 fix branch, so this is **`1.1.0-beta.6`** (commit `b596ddf` on `claude/practical-ritchie-w20lag`), or a later local build of it. Inferred, not confirmed.
**Kioku source read:** `krmanik/kioku` at `a822555` (tag `v0.2.12`).
**Evidence images:** [`audit3_evidence/`](audit3_evidence/). File names start with the timestamp in seconds.
**Previous audits:** audit 1 (51 issues, `docs/audit_2026-11/`) and audit 2 (42 issues, `docs/audit2_2026-11/`). The status of audit 2's issues is in the Appendix.

---

## How to use this report (read this first, Claude Code)

- New issues are numbered **R3-01** onwards.
- **Timestamps** are M:SS and accurate to about ±1 s.
- **Type:** *Defect* (visibly wrong), *Inconsistency* (works but conflicts with the rest) or *Opportunity* (a judgement call, not a bug).
- **Owner:** *Bingsu* (this add-on), *Kioku* (the app shell, upstream) or *Anki* (unmodified desktop code). For Kioku and Anki items, prefer a workaround inside Bingsu, or propose it upstream.
- **Cause** is labelled **Confirmed in code** (I read the code path and it explains what is on screen; I did not run it) or **Likely** (plausible, needs testing).
- **Audit-2 fixes were checked in headless Chromium/offscreen Qt only.** This recording is the first on-device check. Most of them work. The ones that do not (Preferences width, Browse keyboard, light-mode chrome) are all in Qt windows, where the harness differs most from the phone. Keep verifying on the device or the iOS Simulator.
- **Do not change** scheduling, FSRS, review logging, sync logic, the collection schema, deck names, theme keys or file formats. Do not remove Anki functionality.
- **Privacy:** Preferences → Syncing and Advanced (about **2:28–2:47**) show the AnkiWeb account email and the sync server password in clear text. Do not publish those frames. No evidence image comes from that range. The add-on repository is public, and the evidence images show deck names and card text.

### Start here: six fixes with a known or likely cause

| Fix | Issue | Size |
|---|---|---|
| Keep the keyboard closed for the Browse **sidebar** filter too, not only the card search | R3-03 | Small |
| Give the reviewer's scrolled nav bar the theme background (it reads Anki's `--canvas`) | R3-07 | One line |
| Turn off horizontal scrolling in Preferences and cap the wide rows | R3-02 | Small |
| Style Kioku's Back button from the theme tokens, not the palette alone | R3-01 | Small |
| Stop the Gallery hint from printing raw ids ("Rdock icon color decks") | R3-16 | Small |
| One exit on the Pomodoro window | R3-05 | Small–medium |

---

## 0. How the two projects fit together

| Layer | What it is | What you see in this recording |
|---|---|---|
| **Anki** | The unmodified desktop app (Python, Qt 6) | Browse, Add, Fields, Card Types, Preview, Preferences, Deck Options, Statistics, Custom Study, Description, the Rename dialog and the sync progress dialog. |
| **Kioku** | Runs Anki on iOS. WKWebView stands in for QtWebEngine, and it adds a `‹ Back` title bar to each window. | The grey `‹ Back` button and titles; keyboard behaviour; the form bar above the keyboard; the sync-server settings. |
| **Bingsu / Onigiri** | The add-on: web pages for the deck list, overview, reviewer, Home and Settings, plus a phone layer (`web/mobile.css`, `web/mobile.js`, `core/mobile_theme.py`, `core/phone_windows.py`) | The tab bar, sheets, Settings, Pomodoro, theming of Anki's pages and windows. |

### What the recording shows, in order

| Time | Screen |
|---|---|
| 0:00–0:08 | Launch: black screen, sync progress, "Welcome!" screen, deck list |
| 0:09–0:11 | Profile sheet |
| 0:12–0:21 | Add |
| 0:22–1:13 | Browse: list, editor pane, Fields (0:34), Card Types (0:38), Preview (0:40), sidebar (0:58), Notes menu (1:08) |
| 1:14–1:20 | Statistics |
| 1:21–1:55 | Deck list: Edit mode, deck search, sort sheet, drag to reorder |
| 1:56–2:14 | Home: Activity in Month, Week and Year views |
| 2:15–2:48 | Menu → Preferences, all tabs (**2:28–2:47 private**) |
| 2:49–5:24 | Menu → Appearance → Onigiri Settings: Profile, Sync, Languages, Themes (forced light 3:27–3:35, Macchiato 3:42), Gallery, Main Menu, Deck list, Deck overview, Reviewer, Prep Station, Hashi Notes, Pomodoro |
| 5:25–5:35 | Home, deck list, sync |
| 5:36–6:27 | Deck overview: deck row sheet (5:42), sort sheet, overview `⋯` (5:50), Rename (5:52), Deck Options (5:57, 6:05), Custom Study (6:18), Description (6:21), add-on widgets (6:24) |
| 6:29–8:02 | Reviewer: Study Tools sheet (6:33), Pomodoro (6:39), Edit Current with Fields and Card Types (6:53–7:28), card actions panel (7:30–7:55), answer side (7:56), next card (8:02) |
| 8:03–8:19 | Overview, deck list, Control Center (recording stops) |

---

## A. Overall assessment

**Verdict: the best of the three recordings. The add-on's own screens are now close to a coherent phone app. Anki's windows are still a desktop program, and that gap is now the main problem.**

**What improved, seen working on the phone for the first time:**
- **Browse no longer selects cards when you drag.** The list scrolls and stays at "Select · 1" (0:23–0:29). The window title is short ("Browse · 1").
- **The editor toolbar is one row** that scrolls sideways (0:12–0:21, 6:54), in Add, Browse and Edit Current.
- **Picking a theme repaints everything at once**, including Kioku's bar and the edges (Macchiato, 3:42).
- **Show Answer is the accent-filled main button** (6:29).
- **Anki's web pages follow the theme:** Statistics, Deck Options and the editor have the theme's background, text and borders (1:14, 5:57, 6:54).
- **Sheets are consistent:** the deck row sheet has the deck name, a red Delete Deck and Cancel (5:42). The overview `⋯` holds only deck actions (5:50). Study Tools holds only Hashi Notes and Pomodoro and has a wrench icon (6:33).
- **Settings has one header** and no blank gaps; Font Size is readable (5:13). Settings pages open at the top.
- **Activity Year view is readable**, with a legend and today outlined (2:08–2:13). The red dot on Sync is explained by "To sync" (5:28).

**What is still wrong:**
- **Anki's windows look and behave like desktop software.** Browse's sidebar opens the keyboard on every tap and squeezes the card list into a sliver. Preferences still slides sideways and cuts off its labels. Fields, Card Types and Rename are small desktop dialogs with truncated text.
- **Theming is still leaky at the edges:** Kioku's Back button becomes unreadable in light mode, the reviewer's scrolled header is grey on a brown theme, Deck Options keeps Anki's bright blue buttons, the Pomodoro timer is black, and the tap highlight in Settings is blue.
- **A few new rough edges came with the fixes:** Gallery labels show internal ids ("Dock — Rdock icon color decks"), the card actions panel is taller than its sheet, and the Menu tab now opens as a separate page with Done.

| Area | Recording 2 | Recording 3 |
|---|---|---|
| Core study loop | Good | Good (one card answered at 8:02, see F) |
| Navigation | Fair | Fair to good |
| Visual consistency | Fair on Bingsu screens, poor across the app | Good on Bingsu screens, fair across the app |
| Settings | Fair | Good |
| Anki's own screens | Poor | Fair (themed web pages, untouched dialogs) |
| Stability | No crash or data loss seen | No crash or data loss seen |

**Counts:** 33 issues in this report: 0 Critical, 3 High, 11 Medium, 19 Low. Of audit 2's 42 issues: **18 fixed, 18 partly fixed, 4 not fixed, 2 not shown**.

---

## B. Detailed issue inventory

### B1. Fixes that held only partly on the phone

#### R3-01 · Forced light mode makes Kioku's Back button unreadable
- **Time:** 3:27–3:35
- **Screen:** Onigiri Settings → Themes, Color mode "Force light mode"; Kioku title bar
- **Type / Severity / Confidence:** Defect (audit 2's R2-06, partly fixed) / **High** / High
- **Owner:** Bingsu, Anki
- **What happens:** The page, the title bar background and the status bar area turn light, but the `‹ Back` button stays a dark grey pill and its text turns dark. "Back" is barely visible. It returns to normal when dark mode is forced again (3:35).
- **Why it matters:** It is the only way out of the window, and it disappears.
- **Recommendation:** Give Kioku's title-bar buttons an explicit stylesheet built from the theme tokens (inset background, text colour), set and refreshed whenever the colour mode changes. Do not rely on `QPalette` alone.
- **Cause (Likely):** `core/mobile_theme.apply_qt_palette()` (about line 98) changes only palette roles. Anki's own theme is "Follow System" (Preferences, 2:16), and the phone is in dark mode, so Anki's dark-mode button stylesheet still paints the button dark while `ButtonText` now comes from the light tokens. Compare with Anki's theme manager stylesheet for `QPushButton`.
- **Evidence:** `t211.0s_light-mode-back-unreadable.jpg`

#### R3-02 · Preferences still pans sideways and cuts off its labels
- **Time:** 2:20–2:27 (Review tab); also Syncing (about 2:29, private, do not publish)
- **Screen:** Preferences (Anki window)
- **Type / Severity / Confidence:** Defect (R2-11, partly fixed) / Medium / High
- **Owner:** Bingsu (`core/phone_windows.py` Preferences adapter), Anki
- **What happens:** The Appearance tab fits. On the Review tab, scrolling moves the whole page left as well as down: the first letters of labels disappear ("ext day starts at", "earn ahead limit", "imebox time limit"), checkmarks are cut, and "Show next review time above answer butt" runs off the right. The content snaps back and shifts again on the next scroll.
- **Why it matters:** Settings with scheduling effects (next day starts at, learn ahead limit) are hard to read, and the page feels unstable.
- **Recommendation:** In the phone adapter, turn off horizontal scrolling on the tab's scroll area (`ScrollBarAlwaysOff`, `widgetResizable(True)`), drop fixed minimum widths on the spin boxes and combo boxes, and let long check-box labels wrap. Check every tab, including Syncing and Advanced, on the device.
- **Cause (Likely):** One row is still wider than the viewport, so the scroll area scrolls horizontally and Kioku's touch scrolling pans it. The adapter was measured offscreen (Review tab 515 → 344 pt), where fonts and spin-box widths differ from iOS.
- **Evidence:** `t142.2s_preferences-review-clipped-left.jpg`

#### R3-03 · Browse sidebar opens the keyboard on every tap and squeezes the card list
- **Time:** 0:58–1:13
- **Screen:** Browse with the sidebar shown
- **Type / Severity / Confidence:** Defect (R2-08/R2-09, partly fixed) / **High** / High
- **Owner:** Bingsu (`core/phone_windows.py`), Anki
- **What happens:** "Sidebar" opens the filter tree on the left and shrinks the card table to a strip about 60 pt wide that shows fragments ("ec", "Sort", "안으"). Each tap on a filter (Red, Orange, Blue, New, Green) brings up the keyboard, which covers half the tree; it goes down and comes back up with the next tap. The window no longer slides under the status bar (that part of R2-09 is fixed).
- **Why it matters:** Filtering is the main reason to open the sidebar, and every filter tap now costs a keyboard dismissal. The result of a filter cannot be seen while the sidebar is open.
- **Recommendation:**
  1. Apply the same keep-the-keyboard-closed filter to the sidebar's search field.
  2. On phones, show the sidebar as a full-width layer that closes after a filter is chosen, so the filtered list is visible, instead of a side-by-side split.
- **Cause (Likely, partly confirmed):** `core/phone_windows.py:348-350` guards only `form.searchEdit` and its line edit. The sidebar's own filter field is not covered, and Anki focuses it when the sidebar is used.
- **Evidence:** `t062.2s_browse-sidebar-keyboard.jpg`

#### R3-04 · Anki windows still have two ways out, which suggests Kioku is older than v0.2.12
- **Time:** 0:12–0:21 (Add), 6:53–7:28 (Edit Current); Settings 2:49–5:24
- **Screen:** Add, Edit Current, Onigiri Settings
- **Type / Severity / Confidence:** Inconsistency (R2-04, partly fixed) / Medium / Medium
- **Owner:** Bingsu, Kioku
- **What happens:** Settings now has one header (Kioku's `‹ Back` plus the page's own "‹ Settings" breadcrumb), no Done. Edit Current and Add still have `‹ Back` at the top and Close at the bottom.
- **Why it matters:** This is the "older Kioku" path the fix was designed for. If the phone has Kioku v0.2.12, the capability check is failing; if not, updating Kioku gives the intended single exit.
- **Recommendation:** Check the Kioku version on the phone. Show it, and whether `kioku_hide_titlebar` is supported, on the Menu's Help/version line, so recordings can be diagnosed. If v0.2.12 is installed, log what `kioku.windows.OPTIONS` contains at runtime.
- **Cause (Confirmed in code):** `core/ios_native.kioku_supports()` (about line 49) returns true only when `kioku.windows.OPTIONS` lists the option. That tuple exists from v0.2.12 (`kioku/windows.py:65`). With it false, `settings_web/dialog.py` keeps Kioku's bar and hides Done, and `_one_dismiss_for_editor` (`core/mobile_theme.py`, about line 368) keeps Close, which is what the recording shows.
- **Evidence:** `t414.2s_edit-current-grey-placeholder.jpg` (Back and Close), `t012.6s_add-window-desktop-buttons.jpg`

#### R3-05 · Pomodoro has three ways out and ignores the theme
- **Time:** 6:39–6:47
- **Screen:** Pomodoro (opened from Study Tools in the reviewer)
- **Type / Severity / Confidence:** Defect / **High** / High
- **Owner:** Bingsu (`study_tools/pomodoro.py`), Kioku
- **What happens:** The window has Kioku's `‹ Back` / "Pomodoro" bar, a second `‹ Back` pill with a divider inside the timer card, and an `×` in the card's top bar. The timer card is near-black with grey text on the brown Macchiato app.
- **Why it matters:** Two identical Back buttons look like a rendering error, and three exits make users wonder which one stops the timer. The black card is the most visible theme break in the recording.
- **Recommendation:** On phones, show the timer as a full-screen page with one exit: either hide Kioku's bar (where supported) and keep `×`, or keep Kioku's bar and hide the card's top bar. Take the card colours from `mobile_theme` tokens unless the user has set custom Pomodoro colours. Find which widget the inner `‹ Back` belongs to.
- **Cause (Likely):** `PomodoroWidget` (`study_tools/pomodoro.py:1195-1240`) is a frameless, translucent `Tool` dialog with its own top bar (close button) and is passed to `make_managed_window`. Kioku adds its title bar to managed windows. The inner `‹ Back` looks like a second Kioku title bar attached to an inner widget; this needs checking on the device. Colours come from `_palette(self.dark, settings)`, not from the phone theme.
- **Evidence:** `t400.5s_pomodoro-double-back.jpg`

#### R3-06 · The card actions panel is taller than its sheet; Cancel sits mid-list
- **Time:** 7:30–7:55
- **Screen:** Reviewer, `⋯` card actions panel
- **Type / Severity / Confidence:** Defect (R2-27, partly fixed) / Medium / High
- **Owner:** Bingsu (`web/reviewer_more_menu.js/.css`)
- **What happens:** The panel is now themed and has a handle and Cancel (good). But it is longer than the screen: Flag Card scrolls off the top, and "−5 s · Replay Audio · +5 s", "Record" and "Replay Recording" sit below Cancel, visible only when scrolling. The user scrolls it up and down for about 25 s. During one scroll the Delete Note row lights up red (7:38); no note was deleted. Behind the panel, Edit is dimmed but Show Answer stays fully bright.
- **Why it matters:** Rows hidden below Cancel are effectively hidden. A destructive row that highlights during a scroll gesture is risky.
- **Recommendation:** Keep Cancel pinned at the bottom (sticky) and every action above it. Make the list fit: put the audio row next to Mark Note / Auto Advance, and use one row with Card/Note toggles for Bury and Suspend. Highlight a row only after the touch ends without movement. Move Delete Note to the bottom of the list, set apart. Dim the whole answer bar consistently.
- **Evidence:** `t458.5s_card-actions-delete-highlight.jpg`, `t466.0s_card-actions-rows-below-cancel.jpg`

#### R3-07 · The reviewer's header turns grey when the answer scrolls
- **Time:** 7:56–8:02
- **Screen:** Reviewer, answer side
- **Type / Severity / Confidence:** Defect (side effect of the R2-03 fix) / Medium / High
- **Owner:** Bingsu
- **What happens:** When the answer is shown, the page opens scrolled to the answer. The top bar (`‹`, progress pill, wrench) gets a cool grey band across the full width, unlike the brown theme, and the question line is cut under it ("Is the weather cold?").
- **Why it matters:** A grey band on a warm theme looks like an unthemed toolbar, which earlier audits flagged.
- **Recommendation:** Use the Onigiri theme token for this background (the same variable the page body uses), not Anki's `--canvas`.
- **Cause (Likely, partly confirmed):** `web/mobile.css:2261-2270` sets `background: var(--canvas, var(--bg, #fff))` for `html.onigiri-nav-scrolled #onigiri-phone-nav`. On the overview that is fine, but in the reviewer `--canvas` is Anki's default night-mode grey: `mobile_theme.anki_page_css` is only injected into Deck Options, Statistics and the editor (`anki_page_style_tag` returns empty for other contexts).
- **Evidence:** `t478.2s_reviewer-grey-scrolled-header.jpg`

#### R3-08 · Deck Options keeps Anki's blue buttons and switches
- **Time:** 5:57–6:13
- **Screen:** Deck Options (Anki web page)
- **Type / Severity / Confidence:** Inconsistency (R2-15, partly fixed) / Medium / High
- **Owner:** Bingsu
- **What happens:** Backgrounds, cards, text and the Save button follow Macchiato. "Help Me Decide", "Optimize Current Preset", "Optimize All Presets", "FSRS Simulator" and every switch that is on are bright blue. The preset row runs edge to edge, and the Save split button touches the right edge.
- **Why it matters:** Bright blue next to the cream Save button reads as two design systems on one page.
- **Recommendation:** Map Anki's Bootstrap colours too (`--bs-primary`, `.btn-primary`, `.form-check-input:checked`) to the accent, scoped to phones. Add side padding to the preset row. Do not change any option or its layout.
- **Cause (Likely):** `core/mobile_theme.anki_page_css()` (about lines 199-226) sets Anki's own variables (`--button-primary-bg` and others). These buttons and switches use Bootstrap's colours, which do not read those variables.
- **Evidence:** `t360.2s_deck-options-blue-controls.jpg`

### B2. New issues

#### R3-09 · "Rename Deck" opens a small desktop dialog
- **Time:** 5:52–5:54
- **Screen:** Deck overview → `⋯` → Rename Deck
- **Type / Severity / Confidence:** Inconsistency / Medium / High
- **Owner:** Bingsu
- **What happens:** A Qt text dialog ("New deck name:", Cancel, OK) appears over the overview with no dimming. When the keyboard opens it jumps to the top of the screen. Its buttons are about 22 pt tall.
- **Why it matters:** The sheet that leads to it is a polished phone sheet; the dialog behind it is not. Small buttons right above the keyboard invite mis-taps.
- **Recommendation:** A themed bottom sheet with a full-width text field and Cancel / Rename buttons, then call Anki's existing rename operation (as now, so undo keeps working). Use the same sheet for the deck row's Rename.
- **Evidence:** `t352.0s_rename-desktop-dialog.jpg`

#### R3-10 · The Menu tab opens as a separate page with "Done"
- **Time:** 2:15, 2:46–2:49
- **Screen:** Menu
- **Type / Severity / Confidence:** Inconsistency / Medium / Medium
- **Owner:** Bingsu
- **What happens:** Tapping Menu in the tab bar slides in a full-screen "Menu" page with a Done button and no tab bar. Choosing Appearance first shows Home again for about half a second, then Onigiri Settings opens.
- **Why it matters:** A tab should keep the tab bar and not need dismissing. The Home flash makes the jump feel unplanned.
- **Recommendation:** Show Menu as a tab page (tab bar visible, no Done). Open its destinations directly from it, and return to Menu when they close.
- **Evidence:** `t135.6s_menu-modal-done.jpg`

#### R3-11 · Launch: black screen, sync dialog over a welcome screen
- **Time:** 0:01–0:08
- **Screen:** App launch
- **Type / Severity / Confidence:** Defect / Medium / Medium
- **Owner:** Bingsu, Kioku, Anki
- **What happens:** About 1.5 s of black screen. Then a desktop sync progress bar ("Checking…", then "Added/modified …") appears over an empty page. An Onigiri "Welcome! Proceed to Settings to start customizing · Continue" screen appears underneath, its title hidden by the progress dialog, then the deck list takes over.
- **Why it matters:** The first two seconds look like several layers loading over each other. The welcome screen seems to be first-run onboarding, but this profile has a 176-day streak.
- **Recommendation:** Paint the launch background in the theme colour. Show the welcome screen once and remember it (check whether it appears on every launch). Show sync as a slim themed status in the deck list header instead of the Qt dialog (see R3-12).
- **Evidence:** `t003.6s_launch-sync-over-welcome.jpg`, `t004.2s_launch-welcome-screen.jpg`

#### R3-12 · Sync progress is a desktop dialog
- **Time:** 0:03, 5:30–5:32
- **Screen:** Deck list during sync
- **Type / Severity / Confidence:** Inconsistency / Medium / High
- **Owner:** Anki (progress dialog), Bingsu
- **What happens:** A grey strip with "Added/modified: 1↑ 0↓ / Removed: 0↑ 0↓", a striped bar and a tiny Cancel button floats across the middle of the deck list, then "Collection sync complete." appears as a toast.
- **Why it matters:** Sync is frequent. This is the most common desktop element a phone user sees.
- **Recommendation:** While syncing, animate the Sync button and show "Syncing…" in its caption; keep the toast for the result. If the Qt progress dialog cannot be suppressed safely, theme it and place it under the header. Do not change sync logic.
- **Evidence:** `t331.0s_sync-progress-dialog.jpg`

#### R3-13 · The profile pill reloads empty every time the deck list is rebuilt
- **Time:** 0:04–0:07, 5:32, 8:04
- **Screen:** Deck list header
- **Type / Severity / Confidence:** Defect (part of R2-34) / Low / High
- **Owner:** Bingsu
- **What happens:** After launch, after sync and after leaving the overview, the profile pill appears without avatar or name, then fills in.
- **Why it matters:** A visible flicker on the most-used screen.
- **Recommendation:** Render the name and avatar into the initial HTML, or keep the previous header until the new data arrives.
- **Evidence:** `t332.0s_profile-pill-empty-after-sync.jpg`

#### R3-14 · Fields and Card Types windows are still truncated desktop forms
- **Time:** 0:34–0:38, 6:58–6:59
- **Screen:** Fields for Korean Sentence; Card Types for Korean Sentence (from the editor)
- **Type / Severity / Confidence:** Defect / Medium / High
- **Owner:** Bingsu (`core/phone_windows.py` has no adapter for them), Anki
- **What happens:** Card Types' title reads "rd Types for Korean Senten"; its buttons read "dd Fie", "Flip", "Save", "Cance"; the Front/Back/Styling radios read "Fro", "Bac", "Sty". In Fields, option labels are cut ("Sort by this field in the b", "Exclude from unqualifie") and the font picker shows "ademy Engraved LET". The field list takes the top third and leaves a large empty area.
- **Why it matters:** These windows change the note type for thousands of notes ("Changes below will affect the 2454 notes"). Truncated controls in that context are risky.
- **Recommendation:** Add adapters like the other windows: elide the title at the end, stack the list above the options, let labels wrap, full-width buttons. In Card Types, make Front/Back/Styling a segmented control and put the template editor above the preview. Do not change what the windows do.
- **Evidence:** `t034.5s_fields-dialog-clipped.jpg`, `t038.0s_card-types-truncated.jpg`

#### R3-15 · Window footers are desktop button rows
- **Time:** 0:12–0:21 (Add), 1:14–1:20 (Statistics)
- **Screen:** Add, Statistics
- **Type / Severity / Confidence:** Inconsistency (R2-14) / Low / High
- **Owner:** Anki, Bingsu
- **What happens:** Add ends with small "Help · Add · History ▾ · Close" buttons. Statistics ends with "Deck [mmar Sentenc] · Save PDF · Close"; the deck field is cut at both ends.
- **Why it matters:** The main action of Add is one of four equal small buttons at the bottom of the screen.
- **Recommendation:** Make Add a full-width primary button and move Help and History into a `⋯` menu. In Statistics, give the deck/search field a full-width row.
- **Evidence:** `t012.6s_add-window-desktop-buttons.jpg`, `t075.8s_statistics-footer.jpg`

#### R3-16 · Gallery labels show internal setting names
- **Time:** 3:45–4:07
- **Screen:** Onigiri Settings → Gallery
- **Type / Severity / Confidence:** Defect (side effect of the R2-23 fix) / Low / High
- **Owner:** Bingsu
- **What happens:** Tiles read "Dock — Rdock icon color decks", "Dock — Rdock icon color browse", "Profile Name Appearance — Profile…". Many tiles still share a title and differ only in a small caption (eight "Overview Style", many "Deck Stats").
- **Why it matters:** "Rdock" is an internal id, and users cannot find a colour by its tile name.
- **Recommendation:** Build hints from readable words: a small map of known prefixes (`rdock_icon_color_` → "Dock icon:"), then the button name ("Dock icon: Decks"). Show the caption under the title in the same size, not as a faint second line.
- **Cause (Confirmed in code):** `settings_web/schema.py:5903` `_gallery_hint()` removes only the `gallery_`, `modern_menu_` and `onigiri_` prefixes and the `_color` suffix, so `rdock_icon_color_decks` becomes "Rdock icon color decks".
- **Evidence:** `t234.5s_gallery-rdock-labels.jpg`

#### R3-17 · The forced light palette is low in contrast
- **Time:** 3:27–3:35
- **Screen:** Onigiri Settings in "Force light mode"
- **Type / Severity / Confidence:** Inconsistency / Medium / Medium
- **Owner:** Bingsu
- **What happens:** Cards are nearly the same pale blue as the page; section labels and secondary text are faint grey; the selected segment is distinguished only by a white pill. Only Settings was seen in light mode.
- **Why it matters:** Light mode is used outdoors and by people who need more contrast.
- **Recommendation:** Check the light tokens against WCAG: secondary text at least 4.5:1, card versus page difference visible (a border or a darker page). Check the other pages in light mode on the device.
- **Evidence:** `t211.0s_light-mode-back-unreadable.jpg`

#### R3-18 · Settings rows flash a fixed blue when tapped
- **Time:** 4:57, 5:14
- **Screen:** Onigiri Settings home list
- **Type / Severity / Confidence:** Inconsistency / Low / High
- **Owner:** Bingsu
- **What happens:** Tapping "Deck overview" and "Prep Station" fills the row with slate blue on the brown Macchiato theme.
- **Why it matters:** A small but frequent theme break.
- **Recommendation:** Use the accent at low opacity for the pressed state.
- **Cause (Likely):** A fixed `:active` background on the settings list rows; `-webkit-tap-highlight-color` is already transparent in `web/mobile.css:60`, so the colour comes from a CSS rule.
- **Evidence:** none saved (the flash lasts a fraction of a second); visible at 4:57.

#### R3-19 · Settings tab strips cut labels at the left; Restore Default looks like a tab
- **Time:** 4:10–4:50
- **Screen:** Onigiri Settings → Main Menu, Deck list
- **Type / Severity / Confidence:** Inconsistency / Low / High
- **Owner:** Bingsu
- **What happens:** After the sideways strip scrolls, the left item is cut ("idgets", "ckground", "on"). Only the right edge fades. "Restore Default" sits first in the same strip and looks like a tab.
- **Why it matters:** Cut words look broken, and a destructive-sounding action styled as a tab is easy to hit by accident.
- **Recommendation:** Fade both edges and scroll the selected tab fully into view. Move Restore Default out of the strip, to the bottom of the page or a `⋯` menu, with confirmation.
- **Evidence:** `t251.0s_tab-strip-clipped-labels.jpg`

#### R3-20 · Empty preview boxes remain
- **Time:** 4:58–5:00, 5:06
- **Screen:** Onigiri Settings → Deck overview, Reviewer
- **Type / Severity / Confidence:** Inconsistency (R2-21, not done) / Low / High
- **Owner:** Bingsu
- **What happens:** "Deck overview Background" has a large empty preview box under the Image / Color only / Match Main Menu control. Reviewer shows the same.
- **Why it matters:** Empty boxes look unfinished.
- **Recommendation:** Hide the preview when it has nothing to show, or show a small swatch of the current background.
- **Evidence:** `t297.8s_empty-preview-box.jpg`

#### R3-21 · "Machiatto" is misspelled
- **Time:** 3:42
- **Screen:** Themes grid and the "Theme selected: Machiatto" toast
- **Type / Severity / Confidence:** Defect / Low / High
- **Owner:** Bingsu
- **What happens:** The theme is labelled "Machiatto". "Catppuccin Macchiato" a few tiles away is spelled correctly.
- **Recommendation:** Show "Macchiato" through a display label. Keep the stored key `Machiatto` so saved themes still load.
- **Cause (Confirmed in code):** `rendering/themes.py:559` uses `"Machiatto"` as both key and name.
- **Evidence:** `t223.2s_theme-toast-machiatto.jpg`

#### R3-22 · "Sidebar Fonts" is still shown on phones
- **Time:** 4:35
- **Screen:** Onigiri Settings → Deck list
- **Type / Severity / Confidence:** Inconsistency (R2-19) / Low / High
- **Owner:** Bingsu
- **What happens:** The font button under the Deck list preview reads "Sidebar Fonts". The page and the preview call it the deck list.
- **Recommendation:** Add this string to `core/phone_labels.py` ("Deck list fonts").
- **Evidence:** `t275.0s_sidebar-fonts-label.jpg`

#### R3-23 · Activity: month label cut, card mostly empty
- **Time:** 2:08–2:13
- **Screen:** Home → Activity, Year view
- **Type / Severity / Confidence:** Defect / Low / High
- **Owner:** Bingsu
- **What happens:** The Year scroller opens at today (good) but the first visible month label is cut to "ug". Below the grid the card is empty for about a third of its height.
- **Recommendation:** Start the scroll position at a month boundary, or pad the label row. Let the card's height follow its content on phones (audit 2 left this to the widget grid on purpose; reconsider for phones only).
- **Evidence:** `t133.0s_year-view-label-clipped.jpg`

#### R3-24 · Toasts cover rows and sheets
- **Time:** 1:29–1:35, 3:42, 5:32
- **Screen:** Deck list, sort sheet, Themes
- **Type / Severity / Confidence:** Inconsistency / Low / High
- **Owner:** Bingsu
- **What happens:** "Deck sort: Most reviews" appears on top of the open sort sheet's rows. "Collection sync complete." sits on the "Warm up" row. "Theme selected: Machiatto" covers a theme tile.
- **Why it matters:** The sort sheet already shows a checkmark, so the toast repeats it while hiding options.
- **Recommendation:** No toast for choices the sheet already confirms. Otherwise place toasts above the tab bar with clear spacing, and above any open sheet.
- **Evidence:** `t093.0s_sort-sheet-toast-overlap.jpg`, `t332.0s_profile-pill-empty-after-sync.jpg`

#### R3-25 · The form bar still floats above the keyboard in deck search
- **Time:** 1:28–1:29
- **Screen:** Deck list search
- **Type / Severity / Confidence:** Inconsistency (R2-32, not fixed) / Low / High
- **Owner:** Kioku
- **What happens:** A bar with ⌃ ⌄ ✓ appears between the search field and the keyboard.
- **Recommendation:** Hide WKWebView's input accessory view in Kioku, or propose it upstream.
- **Evidence:** `t088.6s_deck-search-form-bar.jpg`

#### R3-26 · Anki windows open on a blank or grey placeholder
- **Time:** 1:14, 5:57, 6:05, 6:53
- **Screen:** Statistics, Deck Options, Edit Current
- **Type / Severity / Confidence:** Defect (R2-34, partly fixed) / Low / High
- **Owner:** Bingsu, Kioku
- **What happens:** Statistics and Deck Options show an empty page for a moment. Edit Current shows a mid-grey rectangle (not the theme colour) for about 1 s before the fields appear.
- **Recommendation:** Give the editor's web view the theme background before it loads, as was done for the other windows, and fade the content in.
- **Evidence:** `t414.2s_edit-current-grey-placeholder.jpg`

#### R3-27 · Profile sheet closes through an empty frame
- **Time:** 0:10–0:11
- **Screen:** Profile sheet
- **Type / Severity / Confidence:** Defect (R2-16, partly fixed) / Low / High
- **Owner:** Bingsu
- **What happens:** On closing, the sheet's content disappears first and an empty outlined panel slides away.
- **Recommendation:** Animate the sheet with its content (transform the whole sheet), and dim the page behind while it is open.
- **Evidence:** `t010.7s_profile-sheet-blank-on-close.jpg`

#### R3-28 · Add-on widgets keep their own colours and spacing
- **Time:** 6:24–6:27
- **Screen:** Deck overview → Show add-on widgets
- **Type / Severity / Confidence:** Opportunity / Low / Medium
- **Owner:** Third-party add-on, Bingsu
- **What happens:** A third-party heatmap appears in bright blue on the brown theme. It now stays inside the screen (R2-20 fixed), but its text block is left-aligned and wraps "days" onto its own line.
- **Recommendation:** Do not restyle another add-on's colours. Put revealed widgets in a themed card with consistent padding so they at least sit in the layout.
- **Evidence:** `t384.0s_addon-widget-unthemed.jpg`

#### R3-29 · Opening the Browse sidebar shows one stretched frame
- **Time:** 0:57–0:58
- **Screen:** Browse
- **Type / Severity / Confidence:** Defect / Low / Medium
- **Owner:** Anki, Kioku
- **What happens:** For one frame the card table is drawn stretched and blurred (huge letters) before the sidebar appears.
- **Recommendation:** Investigate whether the splitter resize repaints a scaled cached image. If the sidebar becomes an overlay (R3-03) this goes away.
- **Evidence:** none saved (single frame).

#### R3-30 · Study time is written three ways
- **Time:** 0:09 (profile sheet), 1:15 (Statistics), 1:56 (Home)
- **Screen:** Profile sheet, Statistics, Home
- **Type / Severity / Confidence:** Inconsistency (R2-37) / Low / High
- **Owner:** Bingsu (profile sheet, Home), Anki (Statistics)
- **What happens:** Today's study time reads "1m" on the profile sheet, "1.4 min" on Home and "1.38 minutes" in Statistics.
- **Recommendation:** One formatter for Bingsu screens ("1.4 min" or "1 min 23 s"). Statistics is Anki's and can stay.

#### R3-31 · The app still goes by several names
- **Time:** throughout
- **Screen:** Menu ("Appearance"), the settings window ("Onigiri Settings"), Home ("Welcome to Onigiri!"), launch ("Onigiri · Welcome!"), Preferences ("…after you restart Anki")
- **Type / Severity / Confidence:** Inconsistency (R2-40) / Low / High
- **Owner:** Bingsu, Kioku
- **What happens:** The Menu entry is now "Appearance", but the window it opens is titled "Onigiri Settings".
- **Recommendation:** Title the window "Appearance" on phones to match the entry that opens it. The plan keeps "Onigiri" inside the app, so leave the other uses unless the user decides otherwise.
- **Evidence:** `t135.6s_menu-modal-done.jpg`

#### R3-32 · Reviewer progress pill looks like an empty loading bar
- **Time:** 6:29–8:02
- **Screen:** Reviewer top bar
- **Type / Severity / Confidence:** Opportunity / Low / Medium
- **Owner:** Bingsu
- **What happens:** At "0/23" the pill holds an empty grey track. The wrench icon appears about a second after the card.
- **Recommendation:** Show a thin filled track only once progress is above zero, or show the count alone. Render the wrench with the bar so the top bar does not change after load.
- **Evidence:** `t389.0s_reviewer-show-answer-accent.jpg`

#### R3-33 · Deck description opens as raw HTML
- **Time:** 6:21
- **Screen:** Description (Anki window)
- **Type / Severity / Confidence:** Opportunity / Low / High
- **Owner:** Anki, Bingsu
- **What happens:** Tapping Description shows the editable source, including `<a href='https://ankiweb.net/…'>shared deck page</a>`, an "Interpret as Markdown" check box and a lone OK button.
- **Why it matters:** Most users tap Description to read it, not to edit HTML.
- **Recommendation:** On phones, show the rendered description in a sheet with an Edit button that opens Anki's existing editor. The overview already shows the rendered text at the bottom ("Please see the shared deck page for more info").

---

## C. Design and consistency recommendations

1. **One source of colour for everything.** `core/mobile_theme.tokens()` already exists. Every remaining theme break in this recording bypasses it: Kioku's Back button styled by Anki's stylesheet (R3-01), the reviewer nav bar reading Anki's `--canvas` (R3-07), Bootstrap blue in Deck Options (R3-08), Pomodoro's own palette (R3-05), a fixed pressed colour in Settings (R3-18), the grey editor placeholder (R3-26). Rule: phone code reads tokens only, and anything that cannot read them (Qt widgets, third-party pages) gets an explicit stylesheet generated from them, refreshed on every theme or mode change.
2. **A phone adapter for every Anki window that is shown.** `core/phone_windows.py` is the right pattern and visibly works for Browse, Add and Choose Deck. Extend it to Fields, Card Types, Rename (QInputDialog), Description and the sync progress dialog, with one shared recipe: elided title, stacked layout, wrapped labels, no horizontal scrolling, 44 pt rows, one full-width primary button.
3. **One sheet component.** The deck row sheet, overview `⋯`, Study Tools and sort sheet now look alike. Bring the card actions panel (R3-06) and the profile sheet (R3-27) onto the same component: handle, title, rows, Cancel pinned at the bottom, content that fits or scrolls above Cancel.
4. **One exit per screen, decided in one place.** Count the exits: Settings 1 (good), Add and Edit Current 2, Pomodoro 3, Menu has Done although it is a tab. Decide per window type which control dismisses it (Kioku's Back for Anki windows, the page's own control for Bingsu pages), and enforce it in the same helper that applies the Kioku capability check.
5. **Feedback that does not cover content.** Toasts (R3-24), the sync dialog (R3-12) and the welcome screen (R3-11) all appear on top of content. Use in-place feedback first (checkmark in the sheet, Sync button state), and toasts only for results that have nowhere else to appear.
6. **Readable labels from ids are a trap.** The Gallery hint (R3-16) and "Sidebar Fonts" (R3-22) show that generated or English-only labels slip through. Keep a small label table for phone wording and test it with a quick dump of every label shown in Settings.

---

## D. Navigation and usability recommendations

- **Make the three tabs behave like tabs.** Decks, Home and Menu should all keep the tab bar. Menu should not need Done (R3-10). Destinations opened from Menu return to Menu.
- **Browse for touch.** The drag-to-select fix works. Next: sidebar as a full-width layer that closes after choosing a filter, no keyboard unless the filter field is tapped (R3-03), and the desktop menu bar (Edit, View, Notes, Cards, Go, Help) grouped into one `⋯` menu with the same commands. The Notes menu at 1:08 shows keyboard shortcuts (⌘E, ⌥⌘E), which mean nothing on a phone; hide shortcuts on phones.
- **Editing note types is a deep, risky path** (editor → Fields / Cards). Make the windows readable first (R3-14). They are reached from a toolbar that now scrolls sideways, so "Fields…" and "Cards…" stay visible at its left end; keep it that way.
- **Reviewer:** the main loop is clean: Edit · Show Answer · `⋯`, then Fail · Pass with intervals. Keep the card actions panel short (R3-06), and keep the Study Tools sheet as it is.
- **Settings:** the "‹ Settings" breadcrumb inside the page plus Kioku's `‹ Back` are two different "back" controls on one screen. That is acceptable (one goes up a level, one closes), but label Kioku's as "Done" or "Close" in this window if Kioku allows it, so the two are not confused.
- **Launch:** go straight to the deck list in theme colours, with sync shown in place (R3-11, R3-12).

---

## E. Most important improvements (ranked)

| # | Improvement | Issues | Why first |
|---|---|---|---|
| 1 | Browse sidebar: no keyboard on filter taps; full-width layer that closes after choosing | R3-03, R3-29 | Every filter tap is broken today; small code change for the keyboard part |
| 2 | Kioku Back button and other Qt chrome styled from tokens; light palette contrast | R3-01, R3-17 | The only exit becomes invisible in light mode |
| 3 | Pomodoro: one exit, theme colours | R3-05 | Duplicate Back buttons look like a bug in a headline feature |
| 4 | Preferences: no horizontal panning, wrap labels | R3-02 | Scheduling settings are cut off |
| 5 | Theme leaks: reviewer nav bar, Deck Options blue, pressed colour, editor placeholder | R3-07, R3-08, R3-18, R3-26 | One rule (tokens only) fixes four visible breaks |
| 6 | Card actions panel fits, Cancel pinned, safe Delete row | R3-06 | Used on every review session; hides rows today |
| 7 | Phone adapters for Fields, Card Types, Rename | R3-14, R3-09 | Truncated controls on screens that change many notes |
| 8 | Launch and sync feedback: theme-coloured start, one-time welcome, in-place sync status, no empty profile pill | R3-11, R3-12, R3-13 | First impression and the most frequent desktop element |
| 9 | Menu as a real tab | R3-10 | Removes a modal and a Home flash from the main navigation |
| 10 | Confirm the Kioku version on the phone and show it in the app | R3-04 | Decides whether the single-exit design is active; makes future recordings diagnosable |

---

## F. Uncertainties and additional testing

- **Kioku version on the phone.** Not visible in the recording. The behaviour matches the "older than v0.2.12" path (R3-04). Check it before working on exits.
- **Add-on build.** Inferred as `1.1.0-beta.6` from visible features; no version line was shown.
- **Answering a card.** At 8:02 the reviewer moved to the next card ("1/23"), but the tap is not visible, so it is unclear whether Pass or Fail was pressed. Check in Browse → Card Info that the review was logged as expected. No scheduling problem was seen.
- **Delete Note highlight (7:38).** The row lit up during a scroll; the note and card were still there afterwards. Test on the device whether a scroll that starts on that row can ever trigger it.
- **Welcome screen.** Unclear whether it appears on every launch or was triggered by the new build (first run of a new version). Launch twice in a row to check.
- **Undo in the card actions panel.** The row was dimmed ("nothing to undo") each time the panel was opened on the question side. Its "Show Question Again" and "Undo Answer Card" states were not shown.
- **Browse "Select" mode** (multi-selection toggle) was not used.
- **Light mode** was seen only in Themes. Check the deck list, reviewer, Anki windows and sheets in light mode.
- **Pomodoro's inner `‹ Back`:** which widget owns it (a second Kioku title bar or the add-on's own) needs checking on the device.
- **Preferences horizontal scrolling** depends on iOS fonts and widths; reproduce in the iOS Simulator, not the offscreen harness.
- **Not shown in this recording:** Hashi Notes window, games pages (Onigimon, Mochi, Hexagon Land), Modes, Hide/Undo flows, Export, Delete Deck, Add-on actions, Custom Study results, keyboard in the editor, landscape orientation, and iPad.
- **Audio:** the recording has short UI sounds only, no speech; no audio problems noticed.

---

## Appendix: status of audit 2's issues on the phone

| Issue | Status | What the recording shows |
|---|---|---|
| R2-01 Browse drag selects ranges | **Fixed** | Drags scroll the list; selection stays "Select · 1" (0:23–0:29) |
| R2-02 Editor toolbar grid | **Fixed** | One row that scrolls sideways (0:12–0:21, 6:54) |
| R2-03 Overview title over Back | **Fixed** | Title below the bar with and without widgets (5:36, 6:24); see R3-07 for the reviewer |
| R2-04 Three ways out of Settings | Partly | Settings has one header; Add and Edit Current two exits; Pomodoro three (R3-04, R3-05) |
| R2-05 Apply theme only changes accent | **Fixed** | Macchiato repaints page, bar and edges at once (3:42) |
| R2-06 Light mode leaves bars dark | Partly | Bars turn light; Back button unreadable (R3-01) |
| R2-07 Show Answer not accented | **Fixed** | Accent-filled (6:29) |
| R2-08 Browse is the desktop browser | Partly | Select row, short title; sidebar and menus still desktop (R3-03) |
| R2-09 Browse sidebar pushes the window | Partly | Window stays put; keyboard still opens (R3-03) |
| R2-10 Titles and choosers cut | Partly | Browse, Deck Options, Add fixed; Card Types and Fields cut (R3-14) |
| R2-11 Preferences does not fit | Partly | Appearance fits; Review and Syncing pan sideways (R3-02) |
| R2-12 Settings blank gaps | **Fixed** | No gaps on about 20 pages |
| R2-13 Font Size unreadable | **Fixed** | Full-width row (Prep Station, 5:13) |
| R2-14 Dialogs are desktop forms | Partly | Custom Study has larger controls (6:18); Rename, Fields, Card Types unchanged (R3-09, R3-14) |
| R2-15 Anki pages ignore the theme | Partly | Themed; Bootstrap blue remains (R3-08) |
| R2-16 Profile sheet blank panel | Partly | Empty frame on close (R3-27) |
| R2-17 Bio field overflow | **Fixed** | Fits its card (Profile, about 3:00) |
| R2-18 Previews break words | **Fixed** (where shown) | Stats Widgets preview two per row (about 4:13); Onigimon and Bento not shown |
| R2-19 Desktop wording in previews | Partly | "Deck list" used; "Sidebar Fonts" remains (R3-22) |
| R2-20 Add-on widgets overflow | **Fixed** | Contained (6:24); colours are the add-on's (R3-28) |
| R2-21 Empty previews and section | Partly | Empty preview boxes remain (R3-20); Modes not opened |
| R2-22 Truncated and misspelled text | Partly | "Particles Heatmap Animation" fixed; "Machiatto" (R3-21) |
| R2-23 Tiles and tabs that look alike | Partly | Hints added but show ids (R3-16); left edge of tab strips (R3-19) |
| R2-24 Switched-off games show settings | Not shown | Game pages not opened |
| R2-25 Overview `⋯` repeats buttons | **Fixed** | Rename Deck, Deck Options, Export Deck, Cancel (5:50); Rename dialog is R3-09 |
| R2-26 Study Tools holds navigation | **Fixed** | Hashi Notes and Pomodoro only, wrench icon (6:33) |
| R2-27 Card actions panel | Partly | Themed with handle and Cancel; too long (R3-06) |
| R2-28 Deck row sheet differs | **Fixed** | Title, red Delete Deck, Cancel (5:42) |
| R2-29 Six ways to close things | Partly | Fewer, but see R3-04, R3-05, R3-10 |
| R2-30 Backups text | **Fixed** | Note now says "On iPhone: Menu → Library → Revert to Backup" (about 2:34) |
| R2-31 Unexplained Sync dot | **Fixed** | "To sync" caption (5:28) |
| R2-32 Form bar over deck search | Not fixed | R3-25 |
| R2-33 Sync password in clear text | Not fixed | Still shown on Preferences → Advanced (private range; do not publish) |
| R2-34 Blank and shifting frames | Partly | R3-13, R3-26 |
| R2-35 "No data" shown as zero | Not shown | Cards were studied today |
| R2-36 Activity Year view unreadable | **Fixed** | Scroller, legend, today outlined (2:08–2:13); label cut (R3-23) |
| R2-37 Unclear profile numbers | Partly | "615 cards" and "Finish ≈ 224 days · 7/9/27" are clear; time formats differ (R3-30) |
| R2-38 "Ready to go" decks look like decks | Not fixed | Unchanged; the proposal awaits the user's decision |
| R2-39 Too many button and card styles | Partly | Bingsu screens consistent; Anki windows and Pomodoro differ |
| R2-40 Three names | Not fixed | R3-31 |
| R2-41 Menu → Onigiri → Settings | **Fixed** | "Appearance" under Preferences (2:15); Menu is now modal (R3-10) |
| R2-42 Small targets for reordering | **Fixed** | Drag to reorder decks works (1:39) |
