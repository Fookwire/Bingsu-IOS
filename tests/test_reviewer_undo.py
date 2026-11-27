"""Tests for the Motion-inspired Reviewer 'More' menu override."""

import importlib
import json
import os
import subprocess
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[1]


def _load_module():
    pkg = types.ModuleType("onigiri_test_pkg")
    pkg.__path__ = [str(ROOT)]
    core_pkg = types.ModuleType("onigiri_test_pkg.core")
    core_pkg.__path__ = [str(ROOT / "core")]
    rendering_pkg = types.ModuleType("onigiri_test_pkg.rendering")
    rendering_pkg.__path__ = [str(ROOT / "rendering")]
    fake_config = types.SimpleNamespace(
        effective_night_mode=lambda *_: True,
        get_collection_config=lambda *_: "system",
    )
    core_pkg.config = fake_config
    with patch.dict(
        sys.modules,
        {
            "onigiri_test_pkg": pkg,
            "onigiri_test_pkg.core": core_pkg,
            "onigiri_test_pkg.core.config": fake_config,
            "onigiri_test_pkg.rendering": rendering_pkg,
        },
    ):
        return importlib.import_module("onigiri_test_pkg.rendering.reviewer_more_menu")



class _Action:
    def __init__(self, enabled):
        self._enabled = enabled
        self.triggered = 0

    def isEnabled(self):
        return self._enabled

    def trigger(self):
        self.triggered += 1


class _Reviewer:
    def __init__(self, state="question"):
        self.state = state
        self.shown_question = 0
        self.card = object()

    def _showQuestion(self):
        self.shown_question += 1
        self.state = "question"


def _mw(can_undo, step, undo_text="Undo Answer Card"):
    action = _Action(can_undo)
    mw = types.SimpleNamespace(
        form=types.SimpleNamespace(actionUndo=action),
        undo_actions_info=lambda: types.SimpleNamespace(can_undo=can_undo, undo_text=undo_text),
        col=types.SimpleNamespace(undo_status=lambda: types.SimpleNamespace(last_step=step["n"])),
    )
    return mw, action


class ReviewerUndoTests(unittest.TestCase):
    """The card-actions menu's Undo works like Ctrl+Z in desktop Anki."""

    def setUp(self):
        self.mod = _load_module()
        self.mod._answer_step["step"] = None

    def test_collection_change_is_undone_with_anki_undo(self):
        step = {"n": 5}
        mw, action = _mw(True, step, "Undo Bury Card")
        reviewer = _Reviewer("question")
        self.assertEqual(self.mod._perform_undo(mw, reviewer), "undo")
        self.assertEqual(action.triggered, 1)
        self.assertEqual(reviewer.shown_question, 0)

    def test_just_flipped_to_the_answer_turns_the_card_back_first(self):
        step = {"n": 5}
        mw, action = _mw(True, step)
        reviewer = _Reviewer("answer")
        self.mod._answer_step["step"] = 5  # remembered when the answer was shown
        self.assertEqual(self.mod._perform_undo(mw, reviewer), "question")
        self.assertEqual(reviewer.shown_question, 1)
        self.assertEqual(action.triggered, 0)

    def test_change_made_on_the_answer_side_is_undone_not_the_flip(self):
        step = {"n": 6}  # a flag/tag edit moved the counter after the flip
        mw, action = _mw(True, step, "Undo Update Tag")
        reviewer = _Reviewer("answer")
        self.mod._answer_step["step"] = 5
        self.assertEqual(self.mod._perform_undo(mw, reviewer), "undo")
        self.assertEqual(action.triggered, 1)
        self.assertEqual(reviewer.shown_question, 0)

    def test_nothing_to_undo_on_the_answer_side_turns_the_card_back(self):
        step = {"n": 1}
        mw, action = _mw(False, step)
        reviewer = _Reviewer("answer")
        self.assertEqual(self.mod._perform_undo(mw, reviewer), "question")
        self.assertEqual(reviewer.shown_question, 1)

    def test_nothing_at_all_says_so(self):
        step = {"n": 1}
        mw, action = _mw(False, step)
        reviewer = _Reviewer("question")
        self.assertEqual(self.mod._perform_undo(mw, reviewer), "nothing")
        self.assertEqual(action.triggered, 0)

    def test_payload_state(self):
        step = {"n": 5}
        mw, _ = _mw(True, step, "Undo Suspend Card")
        q = self.mod._undo_state(mw, _Reviewer("question"))
        self.assertEqual(q, {"can": True, "label": "Undo Suspend Card", "answerShown": False, "flip": False})
        self.mod._answer_step["step"] = 5
        a = self.mod._undo_state(mw, _Reviewer("answer"))
        self.assertTrue(a["flip"])
        self.assertTrue(a["can"])
        self.assertEqual(a["label"], "Show Question Again")
        mw2, _ = _mw(False, step, "Undo")
        none = self.mod._undo_state(mw2, _Reviewer("question"))
        self.assertFalse(none["can"])
        self.assertEqual(none["label"], "Undo")

    def test_anki_isolation_marks_are_removed(self):
        mw, _ = _mw(True, {"n": 1}, "Undo \u2068Answer Card\u2069")
        self.assertEqual(self.mod._undo_state(mw, _Reviewer("question"))["label"], "Undo Answer Card")

    def test_payload_survives_a_collection_without_undo(self):
        broken = types.SimpleNamespace()
        state = self.mod._undo_state(broken, _Reviewer("question"))
        self.assertFalse(state["can"])

    def test_run_reviewer_action_routes_undo(self):
        step = {"n": 5}
        mw, action = _mw(True, step)
        reviewer = _Reviewer("question")
        reviewer.mw = mw
        self.assertTrue(self.mod._run_reviewer_action(reviewer, "undo"))
        self.assertEqual(action.triggered, 1)

    def test_shortcut_listed(self):
        self.assertEqual(self.mod._shortcut_map(is_mac=True)["undo"], "\u2318Z")
        self.assertEqual(self.mod._shortcut_map(is_mac=False)["undo"], "Ctrl+Z")


if __name__ == "__main__":
    unittest.main()
