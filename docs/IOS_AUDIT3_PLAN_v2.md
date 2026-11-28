# Plan v2: third iPhone audit, rebuilt on one theming system (for Opus 5.5)

## What changed since v1
v1 (builds 1.1.0-beta.7 to beta.11) was implemented and then reverted. On the phone it was "really broken, especially with theming". The branch `claude/practical-ritchie-w20lag` is back at the tree of `b596ddf` (1.1.0-beta.6), via revert commit `6a0ee6b`.

The five reverted commits are still in history for reference: `c6503e9`, `0acfb1e`, `f025549`, `d011da7`, `b4be8b5`. **Do not cherry-pick them whole.** Each step below says which parts may be reused, and every reused piece must go through this plan's checks again.

v1 tried to fix each colour symptom where it appeared: per-widget stylesheets on Kioku's bar, applied on timers; a separate Pomodoro palette; Bootstrap overrides; new light-mode contrast rules; a re-run profile-pill fix. That added more sources of colour instead of removing the cause. v2 first fixes the theming architecture, ships that alone, has you check it on the phone, and only then redoes the audit items on top.

## Findings: how theming works today (read from the code, beta.6)

### 1. Light/dark is decided in two places that can disagree
- **Onigiri's own setting:** `onigiriThemeMode` (system/light/dark), resolved in `core/config.effective_night_mode()`.
  - "system" follows Anki's `theme_manager.night_mode`.
  - "light" and "dark" force that mode on Onigiri's pages only: `__init__.py` ~286 injects a script that toggles the `night-mode` classes.
- **Anki's theme:** `aqt.theme.ThemeManager`.
  - It decides from the profile's Theme preference (`mw.pm.theme()`: Follow system / Light / Dark).
  - On iOS, "Follow system" reads iOS's appearance through Kioku: `kioku/patches.py:34` replaces `aqt.theme.get_linux_dark_mode` with `kioku_platform.dark_mode()`, which reads `UIScreen.mainScreen.traitCollection.userInterfaceStyle`.
  - `ThemeManager.apply_style()` sets the Qt palette, then Anki's app stylesheet, then fires `theme_did_change`.
- **Onigiri never tells Anki** when it forces a mode: there is no `set_theme`, `set_night_mode` or `apply_style` call anywhere in the add-on.
  - Example: with Onigiri forced to light and iOS in dark mode, Onigiri's pages are light, while Qt windows, Anki's pages (Deck Options, Statistics, editor) and **Kioku's "‹ Back" bar** are dark.
  - On top of that, `mobile_theme.apply_qt_palette()` repaints only the Qt palette, with Onigiri's light colours. Anki's dark app stylesheet stays, so you get a mix.
  - This is the most likely cause of R3-01 (Back unreadable in light mode) and the "theming broken" report.
- The question "dark or light?" is asked at least five ways in the code: `theme_manager.night_mode` (27 places), `effective_night_mode()` (24), `_is_dark_mode()` (21), `mobile_theme.is_dark()` (11), and the `nightMode`/`night-mode` CSS class (about 150 uses in JS and CSS).

### 2. Colours have several sources
| Surface | Colour source today |
|---|---|
| Onigiri pages | `config["colors"][mode]` + `patcher.generate_dynamic_css` |
| Phone layer (`web/mobile.css`) | a mix of Anki's variables (`--fg`, `--canvas`, `--highlight-bg`, `--border`), Onigiri's (`--accent-color`, `--onigiri-surface*`), `--osw-*`, and about 30 fixed colours |
| Settings | desktop: fixed greys + accent (`theme_palette.chrome_palette`); phones: `mobile_theme.settings_palette` (theme-derived); `--osw-*` (about 890 uses) |
| Card-actions panel | its own `--rm-*` set (`reviewer_more_menu.mobile_theme_css`) |
| Pomodoro, Hashi Notes, Prep Station, pickers | `theme_palette.utility_chrome_palette` + ~200 `setStyleSheet` calls with ~2,600 hex literals across the Python |
| Qt windows and Kioku's bar | Anki's palette + app stylesheet (Anki's mode), plus Onigiri's palette overwrite on phones (`mobile_theme.apply_qt_palette`, on `profile_did_open`, `theme_did_change`, and after Settings applies a theme) |
| Anki's pages | Anki's `:root` variables; on phones beta.5 overrides them with tokens (`mobile_theme.anki_page_css`) |

### 3. Kioku has no theming API
Its `TitleBar` (`kioku/windows.py:73`) is a plain `QWidget` with `autoFillBackground` and a flat `QPushButton`. It is painted entirely by the app palette and Anki's app stylesheet. If those two agree, Kioku's bar is correct with no Onigiri code at all. **Nothing needs to change in Kioku.**

## Target architecture
1. **One mode.** On phones Anki's night mode *is* Onigiri's effective mode, so Qt, Kioku's bar, Anki's pages and Onigiri's pages always agree. This is done without writing Anki's stored Theme preference; see T1.
2. **One token set.** `core/mobile_theme.tokens(dark)` is the only place phone colours are derived. Everything else reads tokens or CSS variables made from them.
3. **One delivery to web pages:** one `<style id="onigiri-tokens">` with `--onigiri-*` variables, injected into every page from one hook. Existing families (`--osw-*`, `--rm-*`, Anki's `--fg`/`--canvas`/…) are mapped onto them, not redefined with their own values.
4. **One delivery to Qt:** palette (and at most one small app-level stylesheet addition) applied once, from `theme_did_change`, after Anki has applied its own. No per-widget colour stylesheets, no timers.
5. **Desktop untouched.** Everything is gated by `IS_MOBILE`.

## Ground rules (unchanged, plus theming rules)
- **Data and logic:**
  - Do not change scheduling, FSRS, review logging, sync, the collection schema, deck names, theme keys, file formats or stored config values.
  - Do not write Anki's profile Theme preference.
  - Do not remove Anki functionality.
- **Phone-only:** `IS_MOBILE` in Python, `html.onigiri-phone`/`onigiri-touch` in CSS. iPad and desktop stay as they are unless a step says otherwise.
- **Kioku options** only via `core/ios_native.kioku_supports()`.
- **Translation keys** go in the `COPY` pipe table in `core/translations.py` (9 fields).
- **Functions exec'd in isolation by tests** (`tests/test_profile_sidebar_study.py` and similar) use inline try-imports.
- **Theming rules (new):**
  - No new hex literals in phone code; use tokens or variables.
  - No `setStyleSheet` for colour on individual Anki or Kioku widgets.
  - No timers to re-apply colour.
  - Every colour change is verified on two themes, one light and one dark, in both modes (see Verification).
- **Releases:** one step = one commit = one build (`harness/build.sh 1.1.0-beta.N`). T1 shipped as beta.12; Part P is beta.13; T2 continues from beta.14. Push only to `claude/practical-ritchie-w20lag`. No `main`, tag or release without asking.
- **Stop points:** after T1 and again after T3, stop and ask the user to test on the phone before continuing.

## Harness
`H=/tmp/claude-0/-home-user-Onigiri-IOS/9b1f06bd-8611-5b7a-93de-6aa1ac0e7d46/scratchpad/harness`. Tools as before:
- `restart.sh` (`EXTRA_ENV="ONIGIRI_PHONE_WIDTH=390"` for Qt checks);
- `cmd.sh` (use the `exec(open(f).read())` pattern);
- `shot2.js <id|web> "<device>" out.png "<js>"` prints `RESULT`;
- `reopen_settings.sh` + `setid.sh` for the Settings page id;
- `settings_sweep_js.txt`, `/tmp/hidden_probe.js`, `answer_test.py`, `tests.sh` (87 known failures), `build.sh`.

Facts and gotchas:
- Settings JS is cached in-process: after editing `web/settings.js`, run `restart.sh` before `reopen_settings.sh`.
- In page JS, `SyncStatusManager` is a global `const`, not `window.*`.
- No Kioku in the harness: to check Kioku's bar, build a fake `QWidget` named `kiokuTitleBar` with a flat `QPushButton` child and grab it.
- Set the harness theme mode with `config.get_config()` / `write_config` (`onigiriThemeMode`) and Anki's with `mw.pm.set_theme(Theme.X)` + `theme_manager.apply_style()` (harness only).

---

## Part T: theming foundation (do first, ship alone)

### T1, one mode (build beta.12). Done: shipped as `5958b69`.
- **`core/mobile_theme.py`:** `install_mode_bridge()`, called from `install()` on mobile.
  - Wrap `aqt.theme.theme_manager._determine_night_mode`. When Onigiri's `onigiriThemeMode` is "light" or "dark", return that. When it is "system", return Anki's original result, which on iOS is Kioku's `dark_mode()`.
  - Guard against recursion: `effective_night_mode()` in "system" mode reads `theme_manager.night_mode` (the *value*, not `_determine_night_mode`), so there is no loop. Keep it that way and add a test.
  - Nothing is written to Anki's profile; the wrap only changes what Anki computes in memory.
- **When Onigiri's mode changes:**
  - Settings writes `onigiriThemeMode` (find the patch path in `settings_web/dialog.py`, near `"onigiri_theme_mode" in touched`); on mobile, call `theme_manager.apply_style()`.
  - Anki then re-applies palette and stylesheet and fires `theme_did_change`, which already triggers `mobile_theme.refresh` and Onigiri's page refresh.
  - Check that `apply_style` early-returns when nothing changed (it does: `theme_changed`/`style_changed`).
- **When iOS appearance changes while "system":** check whether Kioku calls `apply_style` on activation or on a trait change (grep the Kioku clone for `apply_style` and `applicationDidBecomeActive`).
  - If it doesn't, call `theme_manager.apply_style()` from Onigiri's existing app-activation path in `core/ios_native.py`, if one exists. Otherwise leave it and document it.
- **`apply_qt_palette` stays,** but only runs from `theme_did_change` and after a theme is applied in Settings, as today. Check its roles agree with Anki's stylesheet in both modes. If Anki's stylesheet hardcodes button colours (read `aqt/stylesheets.py`), note which ones for T3.
- **Tests (new `tests/test_mode_bridge.py`):** with fake `theme_manager` and config:
  - forced light gives False and forced dark gives True, whatever "system" says;
  - "system" passes the original through;
  - no recursion;
  - desktop: no wrap.
- **Harness:** with the forced-dark harness palette and Anki set to light, after `apply_style` check that:
  - `theme_manager.night_mode` equals `effective_night_mode()`;
  - a fake Kioku bar's button text and background contrast is ≥ 4.5;
  - Deck Options reports night-mode;
  - then repeat with forced light.
- **Phone checklist for the user:**
  - Onigiri mode Light with the iPhone in Dark, and Dark with the iPhone in Light: Back bar, Preferences, Deck Options, Browse and the editor all match Onigiri's pages.
  - "System" follows the iPhone.

### T2, one token set and one web delivery (build beta.14, after Part P)
- **`mobile_theme.tokens()` is the single source.** Keep beta.6's derivation. Do not add v1's light-mode contrast rules yet; contrast is a separate, measured step (T4).
- **Add `token_css(dark)`:** `:root{--onigiri-bg, --onigiri-surface, --onigiri-raised, --onigiri-inset, --onigiri-separator, --onigiri-text, --onigiri-text-2, --onigiri-text-3, --onigiri-accent, --onigiri-on-accent, --onigiri-danger}` for the current mode.
  - Inject it once, from `inject_mobile_assets` in `__init__.py` (the `_anki_page_style` slot pattern), on every page Onigiri touches on mobile.
  - For Anki's Svelte pages, `inject_anki_page_theme` already injects there; prepend the same variables.
  - Both modes can be emitted (`:root` and `:root.night-mode`, `.night_mode`) so a page whose mode toggles client-side stays right.
- **Map, don't redefine:**
  - on phones, set `--osw-*` from `--onigiri-*` in one block (Settings' `render.palette` already derives from tokens; make its CSS variables come from the same values);
  - make `--rm-*` (`reviewer_more_menu.mobile_theme_css`) read `--onigiri-*`;
  - make `anki_page_css` read tokens (it already does), with no new Bootstrap overrides yet.
- **Replace the ~30 hex literals in `web/mobile.css`** with `--onigiri-*` variables, keeping each fallback. List each replacement in the commit message.
- **Tests:** `token_css` contains each variable for both modes; `settings_palette` values equal tokens; no `#rrggbb` added to `mobile.css` (a test that counts them).
- **Harness:** for each Onigiri page (deck list, overview, reviewer, Settings) in both modes, read the computed `--onigiri-bg`/`--onigiri-text` and compare with `tokens(dark)`. Screenshots at iPhone 15 on two themes (light and dark).

### T3, one Qt delivery (build beta.15). Stop for a phone test after this.
- Remove the need for per-widget fixes by making the app-level palette and stylesheet right.
- **If T1's findings show Anki's stylesheet paints buttons with its own colours:** append one small app-level rule block on mobile from `theme_did_change`, after Anki's `_apply_style`. Use `app.setStyleSheet(app.styleSheet() + marker + block)`, idempotent through the marker, with `QPushButton[flat="true"]` and `QWidget#kiokuTitleBar` rules from tokens. One place, re-applied only when Anki re-applies.
- **Pomodoro, Hashi Notes, Prep Station:** on mobile, `utility_chrome_palette` gets its base surfaces from `mobile_theme.settings_palette` (one change in `rendering/theme_palette.py` or `study_tools/pomodoro.base_chrome_palette`). User custom colours still win. This is v1's `add_utility_aliases` idea and can be reused; v1's other Pomodoro colour changes cannot.
- **Paint-before-first-frame** (R3-26, grey editor placeholder): v1's `PAINT_ONLY` + `paint_window` in `core/phone_windows.py` may be reused; it sets only the web-view background colour from tokens.
- **Harness:** fake Kioku bar, Preferences, Browse, Add and Pomodoro grabbed in both modes on two themes; contrast of button text over its background ≥ 4.5.
- **Phone checklist:** Back bar in both modes, Pomodoro card, the editor opening with no grey box, Preferences and Browse in light and dark.

### T4, measured contrast (build beta.16, only if the phone test shows low contrast)
- Re-introduce v1's light-mode contrast rules (R3-17) **one at a time**, each checked on every bundled light theme. Write a harness script that loops over `THEMES` and prints contrast for secondary/faint/surface/separator before and after; include its output in the commit.
- Dark mode unchanged.

---

## Part P: phone feedback on beta.12 (do next, before T2)
These come from your screenshots of beta.12 on the phone (2026-11-28, five images: Edit mode, the deck list, Menu, Home top, overview). The screenshots don't report a theming problem with T1. All five changes are phone-only layout and wording, with **no new colours**: borders and fills use variables that already exist (`--onigiri-ready-*`, `--accent-color`, `--border`, `--fg-subtle`). They ship together as **build beta.13**. T2 moves, to beta.14 and on, after it.

**Shared look: "like Ready to go".** In `web/menu.css` (~1157), a Ready to go row (`.onigiri-ready-action`) is drawn with:
- `border: var(--onigiri-ready-border-width, 1px) solid var(--onigiri-ready-border-color, var(--border))`;
- `border-radius: var(--onigiri-ready-radius, 9px)`;
- `background: var(--onigiri-ready-button-bg, transparent)`.

Everything below reuses **these same variables**, so a theme that restyles Ready to go restyles the decks too, and the corners always match.

### P1, deck rows as outlined cards (the 10:00 screenshot)
- **Where:**
  - `web/mobile.css`, phone block for `#deck-list-container tr.deck` (~2763 on). On phones each `tr.deck` is `display: flex`, with cells `td.decktd` (flex), `td.opts` (hidden) and `td.onigiri-row-more-cell` (flex).
  - The table is `border-collapse: collapse`.
- **Change**, under `html.onigiri-phone`:
  - each `tr.deck` gets the Ready to go border, radius and background, `box-sizing: border-box`, `margin` so cards have the same gap as the Ready to go rows (`--onigiri-ready-gap`, 6px), and the same side insets as the Ready to go list. Measure both in the harness and match them.
  - Set the table to `border-collapse: separate; border-spacing: 0`, and/or make `tbody` a flex column with `gap`. Use whichever renders the rounded border in Chromium **and** keeps `jquery-ui` drag-reorder working in Edit mode; check both.
  - Keep row padding so the text, pills and ⋯ keep their current positions inside the card.
  - Remove any row separator lines the phone layout draws between decks, if present; the cards replace them.
  - Sub-decks (`is-folder` rows, expanded children): each child is its own card, indented by the existing depth indent. The expand arrow stays inside the parent's card.
  - The "current deck" row (`tr.deck.current`) keeps its existing highlight inside its card.
- **Accept when:**
  - in the harness at iPhone 15, every deck row's computed `border-radius` and `border-color` equal those of `.onigiri-ready-action`;
  - rows don't overlap;
  - the gap between rows equals the Ready to go gap;
  - drag-reorder in Edit mode still moves a deck (simulate it, or at least confirm the `ui-draggable` handles still receive pointer events).

  Screenshot in light and dark.

### P2, Edit, Search and Sort as outlined buttons (the 10:00 screenshot, your answer "Yes, outline them")
- **Where:** `#deck-list-header .deck-header-btn` and `.onigiri-select-toggle` (the Edit/Done text button), `web/mobile.css` ~2555.
- **Change:**
  - give the three the same Ready to go border and radius, at least 44×44pt;
  - keep their current icon/text colour (accent);
  - Edit/Done keeps its text, padded to fit;
  - in Edit mode the Done button keeps the same outline.
- **Accept when:** all three have the Ready to go border/radius, none wraps or overflows at 375pt (iPhone SE), and the "Decks" title still fits on the same line. If it doesn't fit at 375, shrink the gap between buttons before shrinking the title.

### P3, selected deck in Edit mode: a rounded outline, not a bar (the 10:04 screenshot)
- **Cause:** `web/menu.css` ~4116 draws the selected-row look for all platforms: `tr.deck.is-multi-selected::before` is a 3px accent bar at the left, and `> td` gets a 14% accent fill.
- **Change**, phone only (`html.onigiri-touch.onigiri-select-mode`):
  - hide that `::before` bar;
  - drop the per-cell fill;
  - instead the selected row's card (from P1) gets a 2px accent border (the same radius as P1), plus optionally a faint accent fill on the whole card (`color-mix(in srgb, var(--accent-color) 12%, transparent)`), so the fill follows the rounded corners;
  - the selection circle with its checkmark stays.
- Desktop keeps its bar.
- **Accept when:** in Edit mode with one deck selected, there is no `::before` bar (computed `display: none`), the row's border colour is the accent, and the corners are rounded; unselected rows keep the normal P1 border.

### P4, Menu: "Appearance" goes back to "Onigiri Settings" (the 9:57 screenshot)
- **Where:** `rendering/webview_handlers.py` ~710, in `_grouped_menu_tree`, where the Menu page relabels Onigiri's settings entry: `rows.append(dict(entry, t=tr("menu_appearance", "Appearance")))`.
- **Change:**
  - use the action's own label (`entry` as is, which is `tr("onigiri_settings")`, "Onigiri Settings", translated);
  - keep its position under Settings, right after Preferences;
  - leave the `menu_appearance` translation row in place (harmless).
  - Since v1 was reverted, the Settings window title is already "Onigiri Settings"; keep it.
- **Test:** update any test that asserts "Appearance" in the menu (grep `menu_appearance` in `tests/`).
- **Accept when:** the Menu dump (`/tmp/menu_dump.py`) shows "Onigiri Settings" under Settings and no other entry changed.

### P5, Home: the panel starts below the top fade (the 9:54 screenshot)
- **Your clarification:** "move all elements down starting from the top of the card edge so they don't touch the blur; keep all spacing between the elements."
- **Cause:** on phones `#onigiri-top-fade` (`web/mobile.css` ~1885) is a fixed 28px gradient at the very top of the page, so content dissolves into the status-bar strip as it scrolls. The deck-list panel (`.container.modern-main-menu .sidebar-left`) starts only 8px from the top (`margin: 8px 8px 0`, ~640). So at rest, its top edge and the USER pill sit under the fade.
- **Change:**
  - only the panel's **top margin** grows, by the fade's height (a new variable `--onigiri-top-fade-h: 28px` used by both rules, so they can't drift apart): `margin-top: calc(8px + var(--onigiri-top-fade-h))`.
  - Padding and the gaps between pill, tiles, Decks header and rows are unchanged.
  - Check the Kome layout (`.ba-home`/`.ba-side`), which the fade also covers; apply the same offset there if it starts under the fade.
- **Accept when:** in the harness at iPhone 15, the panel's top edge is at least the fade's height below the top of the page; the distances pill → tiles → Decks header are unchanged (measure before and after; they must be equal); the Home tab and the overview are unaffected.

### P6, overview: "Deck details" centred and clearly a button (the 9:53 screenshot)
- **Where:**
  - markup: `rendering/overview_stats.py` ~252, `<details class="onigiri-deck-progress-details"><summary>Deck details</summary>`;
  - styles: `web/overview_stats.css` ~68–80.
- **Change**, phone only (`html.onigiri-phone`), CSS only, keeping the `<details>` behaviour:
  - the `summary` becomes a centred pill button: `display: flex; justify-content: center; align-items: center; margin: 12px auto 4px; width: fit-content; min-height: 44px; padding: 0 18px;`, with the Ready to go border/radius (or `999px` for a pill; use the Ready to go radius for consistency), text in the accent colour;
  - hide the default marker (`list-style: none`, `::-webkit-details-marker { display: none }`) and replace it with a chevron that turns when open (`details[open] > summary::after` rotated);
  - when open, the grid shows below, as now.
- **Accept when:** in the harness the summary's centre x equals the card's centre x (±1pt), its height is ≥ 44pt, it has a visible border, and tapping it opens and closes the details.

### Part P verification
- `tests.sh` at 87 with the same set; `tests.test_syntax`; any Menu label test updated.
- **Harness screenshots** at iPhone SE and iPhone 15, in **both** modes, on two themes (the harness theme plus one light theme). Screens:
  - the deck list (rest and scrolled);
  - Edit mode with one deck selected;
  - the Menu page;
  - the overview with Deck details closed and open.

  Look at each one before committing.
- Settings sweep unaffected (no Settings change); `answer_test.py` (the overview is touched).
- Build **1.1.0-beta.13**, one commit, push to `claude/practical-ritchie-w20lag`, progress entry "Part P" in `docs/IOS_UX_AUDIT_PLAN.md`.
- **Stop for a phone check:** deck cards and their corners vs Ready to go, the Edit/Search/Sort outlines, the Edit-mode selection outline, "Onigiri Settings" in Menu, the top of Home no longer under the fade, the Deck details button.

### Part P uncertainties
- Rounded borders on table rows that are `display: flex` inside a collapsed table: Chromium and WebKit may differ. If WebKit drops the radius on the phone, the fallback is to draw the card on `td.decktd` plus `td.onigiri-row-more-cell` as one visual box (left cell rounded on the left, right cell on the right), or to wrap the row contents. Decide after the harness check, and say which was used.
- The Ready to go radius is a theme variable: if a theme sets it to 0, the deck cards are square too (intended: they match).

---

## Part A: audit-3 items on top of the foundation
Order: non-theming items first (low risk), then theming items that now only need tokens. "Reuse" means: take the hunk from the named reverted commit, re-read it, adapt it to the T-foundation, re-test it.

### A1, labels, diagnostics and Browse (build after T3)
- **R3-04 Kioku version line in Help:** reuse `ios_native.kioku_version`/`kioku_summary` + the `_onigiri_menu_parts` hunk and tests (`c6503e9`).
- **R3-03 Browse sidebar:** reuse `_adapt_browse_sidebar` (`c6503e9`). Covers the focus filter on `sidebar.searchBar`, hiding the central widget while the dock is shown so the dock fills the screen, and closing after a search row.
- **R3-16 Gallery hints:** reuse `_GALLERY_HINT_MAP`, `_gallery_hint`, the `_tell_gallery_tiles_apart` dedupe and `tests/test_gallery_hint.py` (`c6503e9`).
- **R3-21 "Macchiato" label:** reuse `THEME_LABELS` + `settings.js` `theme.label || theme.name` (`c6503e9`).
- **R3-22:** `font_menu_label` through `phone_text` (`c6503e9`).
- **R3-24:** no sort toast on phones (`c6503e9`).
- **R3-31: dropped.** You asked for "Onigiri Settings" instead of "Appearance" (Part P4), so the window keeps its "Onigiri Settings" title.
- **Not reused:** R3-07 header colour (redo in A3 with tokens) and R3-18 pressed colour (redo in A3).

### A2, Anki windows (build)
- **R3-02 Preferences wrapping and page caps:** reuse `_wrap_toggle_text`, `_wrap_long_toggles` (margin 80), `_shrinkable_inputs`, `_cap_page_widths` (`f025549`). They touch layout only, no colour.
- **R3-14 Fields and Card Types:** reuse `adapt_field_dialog`, `adapt_card_layout`, `_short_title` + the COPY rows `window_fields` and `window_card_types` (`f025549`).
- **R3-09 Rename sheet:** reuse the `rename_to:` handler, `showRenameSheet`, `formSheet`/`mountFormSheet` and `adapt_get_text` (`f025549`). Its CSS must use `--onigiri-*`; v1 added `--onigiri-accent`/`--onigiri-on-accent` through the nav-bg style tag, so replace that with T2's tokens.
- **R3-15 Add button:** v1 set a per-widget accent stylesheet on `addButton`. Redo it as an object name plus the one T3 app-level rule (`QPushButton#onigiriPrimary`), or skip it if T3 has no stylesheet block.
- **R3-33 Description sheet:** reuse `setupDescriptionSheet` (`f025549`), CSS on tokens.

### A3, sheets, navigation and colour details (build)
- **R3-06 card-actions panel:** reuse the `.rm-scroll` column, Cancel outside the scroller, the media dock moved up, the touch hover/active reset and the dim rule incl. `.onigiri-show-answer-btn` (`d011da7`). Its colours come from `--rm-*`, which T2 maps to tokens.
- **R3-10 Menu as a tab:** reuse (`d011da7`).
- **R3-27 profile sheet close:** reuse the closing class and `#onigiri-profile-dim` element (not `body::after`) (`d011da7`).
- **R3-19 tab strips and Restore Default at the page end:** reuse (`d011da7`). Restart the harness after editing `settings.js`.
- **R3-20 empty background previews:** reuse `stage.__bgMode` + `is-empty` (`d011da7`).
- **R3-28 add-on widget card:** CSS with `--onigiri-surface`.
- **R3-07 reviewer scrolled header:** background `var(--onigiri-bg)` from T2; no extra style tag.
- **R3-18 pressed row in Settings:** `--onigiri-accent` at 14% (`color-mix` or a token `--onigiri-accent-soft` added in T2).
- **R3-08 Deck Options blue:** now an extension of `anki_page_css` mapping `--bs-primary`, `.btn-primary` variables and `.form-check-input:checked` to `--onigiri-accent`. Do it only after T1, because Deck Options will then already be in the right mode. Verify the computed colour, and check both modes on two themes.

### A4, launch, sync and Home (build)
- **R3-11 welcome once on phones:** reuse `_welcome_seen_on_phone` (`b4be8b5`). It writes `showWelcomePopup=False`, which is the same value Continue already writes, so it is allowed.
- **R3-12 "Syncing…" caption:** reuse (`b4be8b5`) + COPY row `sync_in_progress`.
- **R3-23 Year label trim:** reuse `trimClippedMonthLabels` (`b4be8b5`). Card height stays out of scope.
- **R3-30 one time format on phones:** reuse `_format_study_time`, the inline profile branch and `tests/test_study_time_format.py` (`b4be8b5`).
- **R3-32:** reuse the wrench visibility and the empty progress track at 0 (`b4be8b5`).
- **R3-13 profile pill:** do **not** reuse v1's pending/opacity approach. With T1/T2 the name colour and the accent come from the same mode; check it on the phone first, and only then decide whether a fix is needed.

## Out of scope (unchanged)
- Kioku items: R3-25 form bar, R2-33 sync password shown, black launch screen, R3-29, title elision.
- A rebuilt Browse, a "Desktop options" group in Preferences, the Ready decks, the button system, naming beyond the Appearance title, the Statistics footer, the Home Activity card height, drag-to-dismiss for the profile sheet.
- Desktop theming unification: possible later; not part of this plan.

## Verification (every build)
1. `tests.sh` at 87 with the same set; new tests pass; `tests.test_syntax`; `node --check` on changed JS.
2. **Theme matrix (new, required for any colour change):** two bundled themes, one mainly light and one mainly dark (pick from `rendering/themes.py`, for example the default and "Machiatto"). For each: Onigiri mode light and dark, plus "system" with Anki light and dark. Screens:
   - deck list, overview, reviewer (question and answer), Settings (Themes + one page);
   - Deck Options, the Add window;
   - a fake Kioku bar, Preferences, Pomodoro.

   Save the grabs to the scratchpad, look at every one, and record any contrast below 4.5 for text.
3. Settings sweep at 375/393/430: 0 off-screen; hidden probe 0.
4. `answer_test.py` after any build touching the reviewer: review log +1, reps +1, undo available, no tracebacks.
5. Progress log per build in `docs/IOS_UX_AUDIT_PLAN.md` ("Progress (audit 3, v2)"): done / emulation only / needs the phone.
6. **Stop and ask the user to test on the phone after T1 and after T3.**

## Uncertainties
- Whether Kioku re-applies Anki's theme when iOS switches appearance at runtime (T1 checks the Kioku clone).
- Whether Anki's app stylesheet sets button colours that override the palette on iOS (T1/T3 read `aqt/stylesheets.py`).
- R3-05, the second Back in Pomodoro: v1's fix (hiding the old body instead of `setParent(None)`) is plausible and colour-free. It may be reused in A2, but its effect is unconfirmed.
- R3-13: the cause is unknown; it may disappear with T1/T2.
