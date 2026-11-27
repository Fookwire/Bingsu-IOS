"""Carry data saved under the old "Onigiri" names over to the Bingsu names.

Bingsu renamed every key, file and deck it stores. Nothing is deleted: old
keys and files stay where they are, so going back to an older build still
works. New names are only filled in when they do not exist yet.

Covers:
  * keys and exact "onigiri" values in the profile settings file and in any
    JSON read through ``safe_storage`` (``normalize``)
  * collection config keys (``migrate_collection``)
  * files in ``user_files`` (``migrate_user_files``)
  * Ready-to-go decks named "Onigiri Ready - ..." / "Onigiri::Ready"
    (``migrate_decks``)
  * AnkiWeb sync files (``LEGACY_SYNC_*``, used by ``core/sync.py``)
"""
import os
import re
import shutil

OLD = "onigiri"
NEW = "bingsu"

# Restaurant tiers keep their saved ids (owned items, current theme).
_KEEP_IDS = re.compile(r"onigiri_(?:ii|iii|iv|v|heaven|stand)(?![A-Za-z])")

LEGACY_SYNC_MANIFEST = "_onigiri_sync_manifest.json"
LEGACY_SYNC_PREFIX = "_onigiri_sync_"

_migrated_cols = set()
_migrated_files = set()


def new_key(key):
    """The Bingsu name for a stored key, or ``key`` when nothing changes."""
    if not isinstance(key, str) or _KEEP_IDS.search(key):
        return key
    if key.startswith(("onigiri", "Onigiri")) or "_onigiri" in key:
        return key.replace("onigiri", NEW).replace("Onigiri", "Bingsu")
    return key


def _has_legacy(value):
    if isinstance(value, dict):
        return any(
            (isinstance(k, str) and new_key(k) != k) or _has_legacy(v)
            for k, v in value.items()
        )
    if isinstance(value, list):
        return any(_has_legacy(v) for v in value)
    return value == OLD


def normalize(value):
    """Return ``value`` with old key names and the exact value "onigiri" renamed.

    Existing new-style keys win over old ones. Anything already in the new
    form is returned untouched (same object), so this is cheap on every read.
    """
    if not _has_legacy(value):
        return value
    return _normalize(value)


def _normalize(value):
    if isinstance(value, dict):
        out = {}
        for key, item in value.items():
            renamed = new_key(key)
            if renamed != key and renamed in value:
                continue  # the new key is already present
            out[renamed] = _normalize(item)
        return out
    if isinstance(value, list):
        return [_normalize(item) for item in value]
    if value == OLD:
        return NEW
    return value


def migrate_collection(col):
    """Copy ``onigiri*`` collection config keys to ``bingsu*`` once per open collection."""
    if col is None or id(col) in _migrated_cols:
        return 0
    _migrated_cols.add(id(col))
    copied = 0
    try:
        config = col.all_config()
    except Exception:
        return 0
    for key in list(config.keys()):
        renamed = new_key(key)
        if renamed == key or renamed in config:
            continue
        try:
            col.set_config(renamed, normalize(config[key]))
            copied += 1
        except Exception as exc:
            print(f"Bingsu: could not carry over setting {key}: {exc}")
    if copied:
        print(f"Bingsu: carried over {copied} saved settings from Onigiri names")
    return copied


def migrate_user_files(user_files_dir):
    """Copy files and folders named ``*onigiri*`` to their Bingsu name (once)."""
    if not user_files_dir or user_files_dir in _migrated_files or not os.path.isdir(user_files_dir):
        return 0
    _migrated_files.add(user_files_dir)
    copied = 0
    for name in os.listdir(user_files_dir):
        low = name.lower()
        if OLD not in low or _KEEP_IDS.search(low):
            continue
        target = os.path.join(user_files_dir, name.replace("onigiri", NEW).replace("Onigiri", "Bingsu"))
        source = os.path.join(user_files_dir, name)
        if os.path.exists(target):
            continue
        try:
            if os.path.isdir(source):
                shutil.copytree(source, target)
            else:
                shutil.copy2(source, target)
            copied += 1
        except OSError as exc:
            print(f"Bingsu: could not carry over {name}: {exc}")
    return copied


_DECK_RENAMES = (
    ("Onigiri Ready — ", "Bingsu Ready — "),
    ("Onigiri::Ready", "Bingsu::Ready"),
)


def migrate_decks(col):
    """Rename old Ready-to-go filtered decks so they are reused, not duplicated."""
    if col is None:
        return 0
    renamed = 0
    try:
        decks = list(col.decks.all_names_and_ids())
    except Exception:
        return 0
    existing = {d.name for d in decks}
    for deck in decks:
        for old, new in _DECK_RENAMES:
            if deck.name.startswith(old):
                target = new + deck.name[len(old):]
                if target in existing:
                    break
                try:
                    col.decks.rename(deck.id, target)
                    existing.add(target)
                    renamed += 1
                except Exception as exc:
                    print(f"Bingsu: could not rename deck {deck.name}: {exc}")
                break
    return renamed


def migrate_all(col=None, user_files_dir=None):
    """Run every migration that needs an open collection. Never raises."""
    try:
        if col is None:
            from aqt import mw
            col = getattr(mw, "col", None)
        if user_files_dir is None:
            user_files_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "user_files")
        migrate_user_files(user_files_dir)
        migrate_collection(col)
    except Exception as exc:
        print(f"Bingsu: legacy migration failed: {exc}")
