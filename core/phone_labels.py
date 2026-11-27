"""Wording that only applies on an iPhone/iPad (audit 2, R2-19).

There is no sidebar on a phone: the deck list is a page and the profile is a
sheet. Settings labels written for the desktop still said "Sidebar". Only the
English wording is rewritten; other languages keep their translation. Stored
values and keys are never touched, only what is shown."""

import re

_PROFILE_SIDEBAR = re.compile(r"\bProfile (?:S|s)idebar\b")
_SIDEBAR = re.compile(r"\b(?:S|s)idebar\b")


def phone_text(text):
    """`text` with the desktop word "sidebar" replaced for phones."""
    if not isinstance(text, str) or "idebar" not in text:
        return text
    out = _PROFILE_SIDEBAR.sub(lambda m: "Profile panel" if m.group(0)[8] == "S" else "profile panel", text)

    def repl(m):
        return "Deck list" if m.group(0)[0] == "S" else "deck list"

    return _SIDEBAR.sub(repl, out)
