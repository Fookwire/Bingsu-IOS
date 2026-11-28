"""Audit 4, Q4-02: the card-actions sheet on touch screens."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JS = (ROOT / "web" / "reviewer_more_menu.js").read_text()
CSS = (ROOT / "web" / "reviewer_more_menu.css").read_text()


def touch_css():
    start = JS.index("function touchCssText()")
    return JS[start:JS.index("function focusableButtons", start)]


class MoreMenuTouchTests(unittest.TestCase):
    def test_cancel_is_not_sticky(self):
        self.assertNotIn("sticky", touch_css())

    def test_cancel_lives_in_a_footer_outside_the_scroller(self):
        self.assertIn('footer.className = "rm-footer"', JS)
        self.assertIn('scroller.className = "rm-scroll"', JS)
        self.assertIn("footer.appendChild(cancel)", JS)

    def test_no_text_selection_or_callout(self):
        css = touch_css()
        self.assertIn("-webkit-user-select: none", css)
        self.assertIn("-webkit-touch-callout: none", css)

    def test_every_hover_rule_is_for_hover_devices_only(self):
        css = re.sub(r"/\*.*?\*/", "", CSS, flags=re.S)
        stack, buf = [], ""
        for ch in css:
            if ch == "{":
                head = buf.strip()
                if ":hover" in head and not head.startswith("@"):
                    self.assertTrue(any("hover: hover" in h for h in stack), head[:60])
                stack.append(head)
                buf = ""
            elif ch == "}":
                if stack:
                    stack.pop()
                buf = ""
            else:
                buf += ch


if __name__ == "__main__":
    unittest.main()
