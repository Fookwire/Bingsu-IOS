"""Every Python module of the add-on must parse, and every generated page
script embedded in an f-string must keep valid braces. A single stray brace in
rendering/patcher.py stopped the whole add-on from loading."""
import ast
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {"tests", "dist", ".git", "tools"}


class SyntaxTests(unittest.TestCase):
    def test_all_python_files_parse(self):
        bad = []
        for path in ROOT.rglob("*.py"):
            if SKIP & set(path.relative_to(ROOT).parts):
                continue
            try:
                ast.parse(path.read_text(encoding="utf-8"))
            except SyntaxError as exc:
                bad.append(f"{path.relative_to(ROOT)}:{exc.lineno}: {exc.msg}")
        self.assertEqual(bad, [])

    def test_mobile_assets_parse_as_javascript(self):
        for name in ("mobile.js", "icon_modal.js", "injector.js", "engine.js", "heatmap.js"):
            result = subprocess.run(["node", "--check", str(ROOT / "web" / name)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, f"{name}: {result.stderr}")


if __name__ == "__main__":
    unittest.main()
