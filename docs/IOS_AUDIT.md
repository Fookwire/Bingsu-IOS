# iPhone audit of Bingsu (formerly Onigiri) on Kioku (builds 2.0.3-Bento-ios.15 to .21)

Method: a read of the add-on's Python and web code, Kioku's sources, and the
history of earlier builds, then fixes, each checked in headless Anki with
Chromium emulating an iPhone 15 and iPad Pro 11 (screenshots against a
baseline, frame sampling, real touch events through the DevTools protocol),
real-Qt reproductions for Python/Qt changes, and the unit tests (87 known
failures before and after; no new ones). **Nothing here has run on a real
iPhone or in WebKit.**

## Fixed

| Build | Area | Problem | Fix |
|---|---|---|---|
| .15 | Deck icon colour | Qt colour popup opened behind the web view and waited for a mouse press that never came (looked frozen) | iOS system colour picker from the page; the Qt picker refuses to open on mobile |
| .15 | File pickers | `QFileDialog` returned paths the app can't read (icon images, gallery, theme import/export, Pomodoro sound, Prep Station photo) | `core/platform.pick_files/save_file` over Anki's getFile/getSaveFile, which Kioku turns into the iOS document picker |
| .15 | Add-on actions, FSRS Helper | Desktop QMenu at a stale cursor position | Any QMenu opens as the list page (`show_menu_page`) |
| .15 | Back / edge swipe | Also appeared in card previewers and ended the review behind them; skipped Focus Dango | Only Onigiri's own overview/study screens, only for the main window's screens, through `onOverview` |
| .15 | Game progress | Write queue (1.5 s) lost when iOS kills the backgrounded app | Flushed when the app leaves the foreground |
| .16 | Study bottom bar | 100 ms and 500 ms timers ran all session | Event-driven refresh, short start-up poll, re-measure on rotation |
| .16 | Per-card work | 4 evals per card from the More menu; 2 DB queries + eval per operation for a sync indicator that is off screen | Skipped when nothing to do |
| .16 | Tab switch | Fake window resize woke every listener | Removed (Home tab pixel-identical) |
| .16 | Deck list | One forced layout per row; rows and widgets re-animated on every tab switch | Batched reads/writes; animations run once |
| .17 | CSS | Universal overscroll selector, global transition override, `[class*=close]` that never matched, triple sheet definition | Replaced / merged; profile close button now a real 44pt target |
| .18 | Settings sliders | A vertical swipe on a slider row changed the setting (seen on the Modes ladder) | Shared gesture: tap or sideways drag only; verified with touch events |
| .18 | Deck rows | Stayed highlighted after a tap (iOS mouse events) | Hover only for real pointers |
| .18 | Press feedback | Flickered at the start of every scroll | Shown after 80 ms or on lift |
| .18 | Sheets | Swipe-down could be cancelled by iOS | Sheets with nothing to scroll take the gesture |
| .18 | Scroll restore | Used the deck list, which doesn't scroll on phones | Uses the real scroller |
| .18 | Keyboard | Bottom bars floated over content | Hidden while a text field is focused |
| .18 | Search | A sliver ("De" + tiny pill) | Takes the whole header row; 44pt, 16px |
| .18 | Settings and similar windows | No hover/press handling | Same treatment as the main screens |
| .19 | More menu (study) | Keyboard hints, small rows, keyboard-focus mode | Touch rules inside its shadow root |
| .19 | Hashi gallery | Every swipe dragged a card; couldn't scroll | Hold 380 ms to pick up |
| .19 | Layout editor | Tile options on right-click only | Long press |
| .20 | Finished screen | No nav bar, clipped | Nav bar, scrolls, 44pt buttons |
| .20 | Shima | Home tab was blank | Tab only offered when a Home pane exists |
| .20 | Deck dialogs | Under the keyboard | Anchored to the top, 16px, 44pt |
| .20 | Hexagon Land | Mouse-only | One-finger pan, pinch zoom, tap to open (touch-verified) |
| .20 | Pomodoro | Countdown stalled while suspended; finger dragged the full-screen window; sound cut card audio | Real elapsed time (simulated 5 min gap checked); no drag on mobile; own AVAudioPlayer |
| .20 | Audio | Onigimon made a new AudioContext per effect, outside a gesture | One context resumed from a touch; Hexagon resumes |
| .20 | Dialogs | Info dialog see-through; fixed widths | Solid and full width on phones |
| .21 | File sync | Hashed every user file before each sync | Finished signature cached by file name, size, mtime (same value) |

## Audit findings that did not hold up

- Kioku already clears minimum sizes and fills the screen for normal
  dialogs/windows, so most "desktop minimum size" findings needed no change.
- The hover-stripping pass costs about 3 ms of rule deletions per page.
- `setStyleSheet` for the screen edges costs about 9 ms per colour change.
- Setting the stylesheet once and changing only the palette does not work.
- The Ready-to-go restore and favourites cleanup that run in the deck render
  are intentional and only act when needed (left unchanged).
- The bottom bar's measuring work was already close to zero in the default
  mode; what was removed is two timers that ran forever.

## Not done, and why

- **Kome theme:** floating deck popover, HTML5 drag-to-reparent, `mousedown`
  focus handling. Not touched.
- **Layout editor canvas** can't be scrolled by dragging on a tile
  (`touch-action:none`); needs a design for 2D drag vs scroll.
- **Blurred full-page background layers** and slideshows: need a theme with an
  image to see; only the slideshow tick was paused while hidden.
- **`:has()` rules in Settings** and the iOS 16.2 floor for `color-mix()`.
- **Pomodoro** is still a full-screen window (a compact in-page sheet would be
  a redesign); its stats layout is unchanged. **Focus Dango's** blocking dialog,
  the Birthday dialog and the date picker are unchanged.
- **Onigimon HUD** can't be hidden by touch on purpose: a hidden HUD would have
  no on-screen way back.
- **Config-list sync conflicts** (Hashi notes, Pomodoro sessions, plans, deck
  order, icons stored as single collection-config keys): with a phone as a
  second device, edits on both between syncs can overwrite each other. Needs a
  migration-safe design; not changed.
- **Sync conflict timing** (checked before media sync finishes): not changed.

## Needs a real iPhone to confirm

Keyboard and dialogs, all audio (card audio, Pomodoro's AVAudioPlayer, games),
haptics, edge colours, sheet swipe-to-dismiss under WKWebView, app
suspension (game save, Pomodoro), real scrolling smoothness, and the iOS
colour picker.
