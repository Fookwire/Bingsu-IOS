import ast
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load():
    tree = ast.parse((ROOT / "settings_web/schema.py").read_text())
    wanted = {"_GALLERY_HINT_MAP", "_GALLERY_HINT_DROP", "_gallery_hint"}
    body = []
    for node in tree.body:
        name = None
        if isinstance(node, ast.FunctionDef):
            name = node.name
        elif isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
        if name in wanted:
            body.append(node)
    ns = {}
    exec(compile(ast.Module(body=body, type_ignores=[]), "schema_hint", "exec"), ns)
    return ns["_gallery_hint"]


class GalleryHintTests(unittest.TestCase):
    def setUp(self):
        self.hint = load()

    def test_dock_icon_ids_read_as_button_names(self):
        self.assertEqual(self.hint("rdock_icon_color_decks", "Dock"), "Dock icon: Decks")
        self.assertEqual(self.hint("rdock_icon_color_browse_light", "Dock"), "Dock icon: Browse")

    def test_goo_color(self):
        self.assertEqual(self.hint("rdock_goo_color", "Dock"), "Dock bubble")
        self.assertEqual(self.hint("rdock_goo_color_dark", "Dock"), "Dock bubble")

    def test_old_behaviour_kept(self):
        self.assertEqual(self.hint("modern_menu_title_background_color", "Menu"), "Title background")

    def test_prefixes_dropped_and_no_id_leaks(self):
        for raw in ("swidget_some_thing_color", "dstats_new_text", "bbar_foo_bar", "rdock_whatever_x"):
            out = self.hint(raw, "Section", "Fallback label")
            self.assertNotIn("_", out)
            self.assertFalse(out.lower().startswith(("rdock", "swidget", "dstats", "bbar")))

    def test_falls_back_to_label(self):
        self.assertEqual(self.hint("rdock", "Dock", "Dock Colour"), "Dock Colour")


if __name__ == "__main__":
    unittest.main()
