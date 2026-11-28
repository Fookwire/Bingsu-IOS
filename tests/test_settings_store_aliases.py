"""settings_web/store.py: bind aliases map an old stored spelling to an option."""
import copy
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = "_store_alias_tests"


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


class StoreAliasTests(unittest.TestCase):
    def setUp(self):
        self.conf = {"profile_bg": "color", "other": "image"}
        config = types.ModuleType(PACKAGE + ".core.config")
        config.get_config = lambda: copy.deepcopy(self.conf)
        config.get_config_readonly = lambda: self.conf
        config.write_config = lambda conf: self.conf.update(copy.deepcopy(conf))
        modules = {"aqt": types.SimpleNamespace(mw=None), config.__name__: config}
        for suffix in ("", ".core", ".settings_web"):
            name = PACKAGE + suffix
            modules[name] = types.ModuleType(name)
            modules[name].__path__ = []
        self.module_patch = patch.dict(sys.modules, modules)
        self.module_patch.start()
        self.addCleanup(self.module_patch.stop)
        self.store_module = load_module(PACKAGE + ".settings_web.store", "settings_web/store.py")

    def test_alias_maps_old_value_to_its_option(self):
        store = self.store_module.Store()
        store.register("bg", {"kind": "config", "key": "profile_bg", "aliases": {"color": "accent"}}, "image")
        self.assertEqual(store.read("bg"), "accent")

    def test_values_without_alias_are_unchanged(self):
        store = self.store_module.Store()
        store.register("bg", {"kind": "config", "key": "other", "aliases": {"color": "accent"}}, "image")
        store.register("plain", {"kind": "config", "key": "profile_bg"}, "image")
        self.assertEqual(store.read("bg"), "image")
        self.assertEqual(store.read("plain"), "color")


if __name__ == "__main__":
    unittest.main()
