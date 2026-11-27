"""core/phone_labels.py: desktop wording rewritten for phones (audit 2, R2-19)."""
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("phone_labels_under_test", ROOT / "core" / "phone_labels.py")
phone_labels = importlib.util.module_from_spec(spec)
spec.loader.exec_module(phone_labels)
phone_text = phone_labels.phone_text


class PhoneTextTests(unittest.TestCase):
    def test_sidebar_becomes_deck_list(self):
        self.assertEqual(phone_text("Sidebar Customization"), "Deck list Customization")
        self.assertEqual(phone_text("Hide profile on sidebar"), "Hide profile on deck list")

    def test_profile_sidebar_becomes_profile_panel(self):
        self.assertEqual(phone_text("Profile Sidebar"), "Profile panel")
        self.assertEqual(phone_text("Show in Profile Sidebar"), "Show in Profile panel")

    def test_other_text_is_untouched(self):
        for text in ("Deck list", "Reviewer", "", "Seitenleiste", "Sidebars are fine?".replace("Sidebars", "Bars")):
            self.assertEqual(phone_text(text), text)

    def test_non_strings_pass_through(self):
        self.assertIsNone(phone_text(None))
        self.assertEqual(phone_text(5), 5)


if __name__ == "__main__":
    unittest.main()
