# "Onigiri Ready — …" decks (audit SYS-04): findings and a proposal

Status: **investigated only, nothing changed.** The change below modifies the
collection, so it needs your approval and its own test plan first.

## What happens today (`study_tools/ready_to_go.py`)
- The decks are not created up front. A Ready-to-go action (Inbox, Warm up,
  Today, Cool-Down, Tags) builds a **filtered deck** with that fixed name
  through Anki's own `get_or_create_filtered_deck` / `add_or_update_filtered_deck`,
  then studies it.
- Before the deck list is drawn, `restore_internal_cards` empties every
  Ready-to-go filtered deck (`sched.empty_filtered_deck`), which returns the
  cards to their home decks. Onigiri hides these decks in its own deck list.
- The **empty filtered decks stay in the collection**. They sync, so stock
  Kioku (no add-on), AnkiMobile, AnkiDroid and desktop Anki without Onigiri
  show them as ordinary empty decks. That is what the recording shows at 0:02.

## Proposal
After `restore_internal_cards` empties a Ready-to-go filtered deck, delete it
(`col.decks.remove([did])`). Deleting a *filtered* deck never deletes cards:
Anki returns any cards to their home decks first, the same as emptying it.
The next Ready-to-go action creates it again (it already does
get-or-create).

Points to settle before doing it:
1. **Undo history:** deleting inside the deck-list render adds an undo step
   ("Delete Deck") at a moment the user did nothing. The removal should run
   as a separate, quiet collection operation, or only when the user leaves
   the study session.
2. **Sync:** each create/delete is a normal, small sync change (no full
   sync), but it happens every time a Ready-to-go session is used.
3. **Other devices:** a desktop with Onigiri would also delete them; one
   without Onigiri would just see them come and go.
4. **Tests:** a copy of a collection with each Ready-to-go deck mid-session
   (cards inside), then: answer cards, go back, check every card is back in
   its home deck with unchanged due/interval/FSRS state, and the deck is gone.
