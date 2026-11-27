import ast
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load():
    tree = ast.parse((ROOT / "rendering/onigiri_renderer.py").read_text())
    fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "_format_study_time")
    ns = {}
    exec(compile(ast.Module(body=[fn], type_ignores=[]), "renderer_time", "exec"), ns)
    return ns["_format_study_time"]


class StudyTimeFormatTests(unittest.TestCase):
    def setUp(self):
        self.fmt = load()

    def test_under_a_minute_is_seconds(self):
        self.assertEqual(self.fmt(19), ("19", "s"))
        self.assertEqual(self.fmt(0), ("0", "s"))
        self.assertEqual(self.fmt(59.9), ("59", "s"))

    def test_minutes_have_one_decimal(self):
        self.assertEqual(self.fmt(750), ("12.5", "min"))
        self.assertEqual(self.fmt(60), ("1.0", "min"))

    def test_from_an_hour_hours_and_minutes(self):
        self.assertEqual(self.fmt(3900), ("1h 5m", ""))

    def test_none_is_zero_seconds(self):
        self.assertEqual(self.fmt(None), ("0", "s"))

    def test_units_are_passed_through(self):
        self.assertEqual(self.fmt(30, "seg", "min"), ("30", "seg"))


if __name__ == "__main__":
    unittest.main()
