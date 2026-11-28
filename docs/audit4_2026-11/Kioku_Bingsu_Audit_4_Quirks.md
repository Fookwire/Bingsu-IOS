# Kioku + Bingsu on iPhone: short quirk audit (audit 4)

**Recordings:**
- `Recordings/ScreenRecording_11-27-2026 22-33-58_1.MP4` (0:08, 1206 × 2622, dark theme): deck overview pop-in. **Analysed below.**
- `Recordings/15 sec recording.MP4` (0:15): card actions panel Cancel button. **Q4-02.**

**Build on screen:** a 1.1.0-beta build newer than beta.6. The deck list has a "More" button and the overview has a "Deck details" button, which first appear in the audit-3 work on `claude/practical-ritchie-w20lag`. The exact beta number is not shown.
**Code read:** `Fookwire/Bingsu-IOS` at `7ad2104` (`claude/practical-ritchie-w20lag`, build 1.1.0-beta.14). Line numbers refer to that commit.
**Evidence:** [`evidence/`](evidence/). File names start with the timestamp in seconds.

Timestamps are seconds from the start of the recording (60 fps, frame-accurate to about ±0.02 s).

---

## Q4-01 · The card's top border pops in half a second after the overview appears

- **Recording:** 0:08 clip
- **Time:** first visit: slide starts at **2.27 s**, the page is still at 2.57 s, the line appears at **2.82 s**. Second visit: slide 5.72 s, still at 6.02 s, line at **6.27 s**.
- **Screen:** Deck overview ("Korean Grammar Sentences by Evita"), the New / Learning / To Review card just under the deck title
- **Type / Severity / Confidence:** Defect / Low (polish, but visible every time a deck is opened) / High for what happens, Medium for the cause
- **Owner:** Bingsu

**What happens:**
1. Tapping a deck slides the overview in from the right (about 0.3 s).
2. When the slide ends, the counts card under the title is drawn **without the straight top edge of its border**. Only the two rounded corners show, and the top strip of the card is a flat, slightly darker band.
3. About **0.25 s after the page has stopped moving**, in a single frame, the top border line appears. In the same frame the "New" label and the "1" pill re-render slightly (sharper text; see the difference image).
4. Nothing else on the page changes. It happens the same way on both visits in the clip, exactly 0.55 s after the slide starts.

**Why it matters:** The deck overview is opened every study session. A line appearing after the page has settled reads as the page still loading, and draws the eye to the title area.

**Cause (Likely, timing confirmed in code):**
- `web/mobile.js` about lines 62-82 (`screenTransition`) adds `onigiri-entering` after two animation frames and removes `onigiri-enter-forward`/`onigiri-enter-back` and `onigiri-entering` with `setTimeout(…, 520)`. Two frames + 520 ms after the slide starts is 2.27 + 0.55 = **2.82 s**, the exact frame where the line appears (and 5.72 + 0.55 = 6.27 s on the second visit).
- While those classes are on `<html>`, `body` carries a transform/opacity animation (`web/mobile.css` about lines 1976-2009: `transform: translateX(28%)`, `animation: onigiri-push-from-right … both`). WebKit draws the whole page into a separate composited layer for that animation. At the end of the slide the layer is still there (the `both` fill keeps it), and inside it the card's 1-CSS-px top border is lost, most likely because the vertically centred column (`margin-top: auto; margin-bottom: auto`, `web/mobile.css` about lines 2244-2247) puts the card at a fractional y position and the layer snaps that edge away. When the classes are removed the layer goes away, the page is repainted normally, and the border and crisper text appear.
- The border itself is `border: var(--overview-box-stroke, 1px) solid …` (`web/overview.css`, `rendering/patcher.py` about lines 7486/7508 set the stroke from the user's settings). If the stroke is below 1 px it disappears even more easily. Check the value on the phone.

**Recommendation (pick in this order, verify on the device):**
1. End the transition on the animation itself: listen for `animationend` on `body` and remove the classes there, and make the final keyframe exactly the resting state. This removes the 0.25 s gap so any repaint happens as the motion ends, where it is not noticeable.
2. Remove the compositing difference: with the classes removed, nothing should differ between "during" and "after". Either do not leave `transform`/`opacity` on `body` once the animation has finished (no `both` fill; set the end state explicitly), or animate a wrapper element instead of `body`.
3. Make the card's position whole-pixel: avoid fractional offsets from the auto-margin centring (for example round the top padding, or position the column with a fixed top padding on phones), and keep the border at least 1 px. Optionally draw the border as `box-shadow: inset 0 0 0 1px …`, which is not lost to edge snapping.
4. Respect `prefers-reduced-motion` as today (no slide, no pop).

**How to verify:** record the screen at 60 fps while opening a deck twice. Step through the frames after the slide ends: the card border should be complete in the first still frame, and no frame after that should change.

**Evidence:**
- `popin_t2.79s-vs-2.84s_card-top-crop.jpg`: top = 2.79 s (no top edge), bottom = 2.84 s (edge present)
- `popin_t2.79s-vs-2.84s_difference.jpg`: amplified difference of the two frames; the border line, the "New" label and the "1" change, nothing else
- `popin_t6.24s-vs-6.29s_card-top-crop.jpg`: the same on the second visit
- `popin_t2.79s_full.jpg`, `popin_t2.84s_full.jpg`, `popin_t6.24s_full.jpg`, `popin_t6.29s_full.jpg`: full screens

---

## Q4-02 · The card actions Cancel row is see-through, floats over other rows, and its text can be selected

- **Recording:** `Recordings/15 sec recording.MP4` (0:15, 1206 × 2622, dark theme)
- **Time:** panel opens at about 1.8 s; scrolling 2.0–9.9 s; panel closes at about 10.2 s; reopened 11.2 s; Cancel text selected 12.2–13.0 s; panel closes 13.0 s
- **Screen:** Reviewer, question side → `⋯` card actions panel (Flag Card, Mark Note, Options, Undo, Bury, Suspend, Set Due Date, Reset Card, Create Copy, Delete Note, the audio row, Record / Replay Recording, Cancel)
- **Type / Severity / Confidence:** Defect / Medium / High for what happens, Medium for the causes
- **Owner:** Bingsu (`web/reviewer_more_menu.js`, `web/reviewer_more_menu.css`, `rendering/reviewer_more_menu.py`)

**What happens:**
1. **Cancel floats in the middle of the list instead of ending it.** It stays at a fixed height near the bottom of the panel while the list scrolls. The audio row ("−5 s · Replay Audio · ⏸ · +5 s") and the "Record · Replay Recording" row scroll **underneath** it. Even fully scrolled down, part of the Record row shows below Cancel, cut off by the answer bar (2.3 s, 9.9 s).
2. **Cancel is see-through.** Its band is only slightly darker than the panel, so the rows behind it show through. At 6.3–9.0 s the label reads "Replay Audio" with "Cancel" printed on top of it; at other moments "Cancel" sits between two half-hidden rows. It looks like a text label, not a button.
3. **Pressing Cancel can select its text.** At 12.2 s, after the user presses Cancel, the word "Cancel" turns blue with the two iOS text-selection handles, and the panel stays open for about 0.8 s until it closes at 13.0 s. A quick tap at about 10.1 s did close the panel normally (fade-out).
4. **Delete Note lights up red while scrolling** (3.7–4.2 s): the user's finger passed over it during a scroll and the row stayed highlighted red. Nothing was deleted; the card is still there at the end. (Also seen in audit 3, R3-06.)
5. The panel is still taller than the screen, so the user has to scroll to reach Delete Note and the audio rows (as in R3-06).

**Why it matters:** Cancel is the main way to leave this panel. A label that changes position, overlaps other text, and sometimes selects text instead of closing makes the panel feel broken, and a destructive row that turns red during a scroll looks like a near miss.

**Causes:**
- **Floating Cancel (Confirmed in code):** `web/reviewer_more_menu.js:393` (inside `touchCssText()`) styles `.rm-cancel` with `position: sticky; bottom: 0; z-index: 2` and only a 6 px `box-shadow` ring as a mask. Sticky keeps Cancel at the bottom of the visible area of the scrolling panel, so every row above it slides underneath. Cancel was added this way in `5e25bcc` (audit 2 phase 3) and changed in `d011da7`.
- **See-through background (Likely):** `.rm-cancel` uses `background: var(--rm-elevated)`. The default dark value is `rgba(255, 255, 255, 0.062)` (`web/reviewer_more_menu.css:53`), i.e. almost transparent; on phones `rendering/reviewer_more_menu.py:163` replaces it with the theme's `inset` token. In addition, the same touch stylesheet sets `.rm-item-btn:hover { background: transparent; }` (`web/reviewer_more_menu.js:396`); that rule is more specific than `.rm-cancel`, and on iOS `:hover` sticks to the last touched element, so after a touch Cancel loses its background completely. Check on the device which of the two is active (Web Inspector on the Kioku web view).
- **Selectable text (Likely):** the panel root sets only the unprefixed `user-select: none` (`web/reviewer_more_menu.css:45`). WebKit on iOS needs `-webkit-user-select: none`; without it a press on a button's text starts a text selection. `-webkit-touch-callout: none` is also missing.
- **Red Delete Note during scroll (Likely):** the same sticky `:hover` on iOS. `.rm-item-btn.is-danger:hover { background: var(--rm-danger-soft) }` (`web/reviewer_more_menu.css:552`) outranks the touch rule that clears `:hover`, so the red stays after the finger passes over it.

**Recommendation:**
1. **Pin Cancel outside the scroller.** Split the panel into a scrolling list and a fixed footer: the footer holds Cancel with an opaque background (`--rm-surface-solid`) and a hairline separator above it. No `position: sticky`, no rows ever under Cancel. Every action must be reachable above it.
2. **Give Cancel a real button look:** opaque fill, full width, 50 pt tall, rounded like the sheets elsewhere (deck row sheet, Study Tools sheet).
3. **No text selection anywhere in the panel:** add `-webkit-user-select: none; -webkit-touch-callout: none;` on the panel root and buttons, and `touch-action: manipulation` on buttons.
4. **No hover styles on touch devices:** wrap all `:hover` rules (including `.is-danger:hover`) in `@media (hover: hover)`, and show pressed states with `:active` only.
5. **Shorten the list** so it fits on an iPhone without scrolling (see audit 3, R3-06: audio row next to Mark Note / Auto Advance; Bury and Suspend with Card/Note toggles on one row; Delete Note last, set apart).

**How to verify:** on the device, open `⋯`, scroll the list fully up and down: nothing may pass under or over Cancel. Long-press Cancel: no blue selection; release closes the panel. Drag a finger across Delete Note: it must not turn red. Tap Cancel quickly ten times in a row: it closes every time.

**Evidence:**
- `cancel_t2.3s_cancel-hides-record-row.jpg`: Cancel near the bottom with the Record row cut off below it
- `cancel_t3.8s_delete-row-lit-while-scrolling.jpg`: Delete Note red during a scroll
- `cancel_t7.3s_cancel-printed-over-replay-audio.jpg`: "Cancel" printed over "Replay Audio"
- `cancel_t9.9s_cancel-between-two-rows.jpg`: Cancel between two half-hidden rows
- `cancel_t12.5s_cancel-text-selected.jpg`: the word Cancel selected, with iOS selection handles

---

## Notes for Claude Code

- Do not change scheduling, FSRS, review logging, sync, deck names or the collection.
- The 0:08 clip also shows the slide itself (2.27–2.57 s and 5.72–6.02 s) and the Control Center at the start and end; neither shows a defect.
- Verify on the device or the iOS Simulator; this effect depends on WebKit's compositing and will likely not reproduce in desktop Chromium.
