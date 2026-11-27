"""Data saved under the old Onigiri names must keep working under Bingsu."""
import importlib.util
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load():
    spec = importlib.util.spec_from_file_location("legacy_names_under_test", ROOT / "core" / "legacy_names.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeCol:
    def __init__(self, config):
        self.config = dict(config)
        self.decks = types.SimpleNamespace(all_names_and_ids=self._decks, rename=self._rename)
        self._deck_list = []

    def all_config(self):
        return dict(self.config)

    def set_config(self, key, value):
        self.config[key] = value

    def _decks(self):
        return [types.SimpleNamespace(name=n, id=i) for i, n in enumerate(self._deck_list)]

    def _rename(self, did, name):
        self._deck_list[did] = name


class LegacyNamesTests(unittest.TestCase):
    def setUp(self):
        self.m = load()

    def test_new_key(self):
        self.assertEqual(self.m.new_key("onigiri_ui_theme"), "bingsu_ui_theme")
        self.assertEqual(self.m.new_key("onigiriWidgetLayout"), "bingsuWidgetLayout")
        self.assertEqual(self.m.new_key("bingsu_ui_theme"), "bingsu_ui_theme")
        self.assertEqual(self.m.new_key("modern_menu_userName"), "modern_menu_userName")
        # saved restaurant ids must not change
        for kept in ("onigiri_ii", "onigiri_heaven", "prev_onigiri_heaven", "onigiri_stand"):
            self.assertEqual(self.m.new_key(kept), kept)

    def test_normalize_renames_keys_and_value_and_prefers_new(self):
        old = {"onigiri_ui_theme": "onigiri", "bingsu_x": 1, "onigiri_x": 2,
               "nested": {"onigiri_a": [{"onigiriWidgetLayout": 3}]},
               "owned_items": ["onigiri_ii"]}
        out = self.m.normalize(old)
        self.assertEqual(out["bingsu_ui_theme"], "bingsu")
        self.assertEqual(out["bingsu_x"], 1)  # new key wins
        self.assertEqual(out["nested"]["bingsu_a"][0]["bingsuWidgetLayout"], 3)
        self.assertEqual(out["owned_items"], ["onigiri_ii"])
        self.assertNotIn("onigiri_ui_theme", out)
        self.assertEqual(old["onigiri_ui_theme"], "onigiri")  # input untouched

    def test_normalize_leaves_new_data_alone(self):
        data = {"bingsu_a": {"b": [1, 2]}}
        self.assertIs(self.m.normalize(data), data)

    def test_collection_keys_are_copied_not_moved_and_only_once(self):
        col = FakeCol({"onigiri_favorite_decks": [1, 2], "bingsu_sort_mode": "a",
                       "onigiri_sort_mode": "b", "other": 1})
        self.assertEqual(self.m.migrate_collection(col), 1)
        self.assertEqual(col.config["bingsu_favorite_decks"], [1, 2])
        self.assertEqual(col.config["onigiri_favorite_decks"], [1, 2])  # old kept
        self.assertEqual(col.config["bingsu_sort_mode"], "a")           # not overwritten
        self.assertEqual(self.m.migrate_collection(col), 0)

    def test_user_files_are_copied(self):
        with tempfile.TemporaryDirectory() as d:
            Path(d, "onigiri_layout.json").write_text("{}")
            Path(d, "settings_x.json").write_text("{}")
            os.mkdir(os.path.join(d, "onigiri_data"))
            Path(d, "onigiri_data", "a.txt").write_text("a")
            self.assertEqual(self.m.migrate_user_files(d), 2)
            self.assertTrue(Path(d, "bingsu_layout.json").exists())
            self.assertTrue(Path(d, "bingsu_data", "a.txt").exists())
            self.assertTrue(Path(d, "onigiri_layout.json").exists())

    def test_ready_decks_are_renamed(self):
        col = FakeCol({})
        col._deck_list = ["Default", "Onigiri Ready — Inbox", "Onigiri::Ready::Inbox", "Bingsu Ready — Today"]
        self.assertEqual(self.m.migrate_decks(col), 2)
        self.assertEqual(col._deck_list[1], "Bingsu Ready — Inbox")
        self.assertEqual(col._deck_list[2], "Bingsu::Ready::Inbox")


if __name__ == "__main__":
    unittest.main()
