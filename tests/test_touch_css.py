"""core/touch_css.py: :hover rules limited to hover-capable devices."""

import importlib.util
import os
import unittest

_PATH = os.path.join(os.path.dirname(__file__), "..", "core", "touch_css.py")
_spec = importlib.util.spec_from_file_location("touch_css", _PATH)
touch_css = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(touch_css)


class HoverOnlyTest(unittest.TestCase):
    def test_wraps_hover_rules_only(self):
        css = "a { color: red; }\n#outer button:hover .x { opacity: 0; }\nb { c: d }"
        out = touch_css.hover_only(css)
        self.assertIn("a { color: red; }", out)
        self.assertIn("@media (hover: hover) {#outer button:hover .x { opacity: 0; }}", out)
        self.assertIn("b { c: d }", out)

    def test_selector_list_with_hover_is_wrapped_whole(self):
        css = ".a, .b:hover { x: 1 }"
        self.assertEqual(touch_css.hover_only(css), "@media (hover: hover) {.a, .b:hover { x: 1 }}")

    def test_at_blocks_and_comments_pass_through(self):
        css = "/* :hover in a comment */ @media (max-width: 9px) { .a:hover { x: 1 } } .b { y: 2 }"
        self.assertEqual(touch_css.hover_only(css), css)

    def test_braces_inside_strings(self):
        css = '.a:hover::after { content: "}"; } .b { z: 3 }'
        out = touch_css.hover_only(css)
        self.assertTrue(out.startswith('@media (hover: hover) {.a:hover::after { content: "}"; }}'))
        self.assertTrue(out.endswith(".b { z: 3 }"))

    def test_no_hover_unchanged(self):
        css = ".a { x: 1 }"
        self.assertIs(touch_css.hover_only(css), css)

    def test_html_style_blocks(self):
        html = "<style>.a:hover{x:1}</style><script>var s = ':hover';</script>"
        out = touch_css.hover_only_html(html)
        self.assertEqual(out, "<style>@media (hover: hover) {.a:hover{x:1}}</style><script>var s = ':hover';</script>")


if __name__ == "__main__":
    unittest.main()
