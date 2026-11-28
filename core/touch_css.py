"""Hover rules that do not stick on touch screens.

iOS (WKWebView) keeps ``:hover`` on whatever the finger touched last. A style
meant for a mouse pointer then stays on after a tap: the "Show Answer" label
fading out under the finger (counts mode "hover"), the More button left
highlighted, a destructive row staying red after a scroll passed over it.

``hover_only(css)`` wraps every top-level rule whose selector uses ``:hover``
in ``@media (hover: hover)``, so it applies only where a real pointer can
hover. In a selector list only the ``:hover`` selectors move there; the others
(``.btn:focus-visible`` next to ``.btn:hover``) keep applying. Everything else
(including rules already inside @-blocks) is returned unchanged. Used for
phones only; desktop CSS is not touched.
"""

from __future__ import annotations

import re

_STYLE_RE = re.compile(r"(<style\b[^>]*>)(.*?)(</style>)", re.IGNORECASE | re.DOTALL)


def _top_level_rules(css: str):
    """Yield (text, is_rule, selector) chunks of ``css`` at nesting depth 0.

    ``is_rule`` is True for a plain ``selector { ... }`` block; @-blocks,
    comments and stray text are passed through as non-rules."""
    i = 0
    n = len(css)
    while i < n:
        # comments and whitespace pass through
        if css.startswith("/*", i):
            end = css.find("*/", i + 2)
            end = n if end < 0 else end + 2
            yield css[i:end], False, ""
            i = end
            continue
        if css[i].isspace():
            j = i
            while j < n and css[j].isspace():
                j += 1
            yield css[i:j], False, ""
            i = j
            continue
        brace = css.find("{", i)
        semi = css.find(";", i)
        if brace < 0:
            yield css[i:], False, ""
            return
        if css[i] == "@" and 0 <= semi < brace:
            # @import / @charset ...;
            yield css[i : semi + 1], False, ""
            i = semi + 1
            continue
        # find the matching closing brace
        depth = 0
        j = brace
        in_str = ""
        while j < n:
            ch = css[j]
            if in_str:
                if ch == "\\":
                    j += 2
                    continue
                if ch == in_str:
                    in_str = ""
            elif ch in "\"'":
                in_str = ch
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        end = min(n, j + 1)
        selector = css[i:brace]
        yield css[i:end], not selector.lstrip().startswith("@"), selector
        i = end


def _split_selectors(selector: str):
    """Split a selector list on top-level commas (not inside :is(), [attr])."""
    parts, depth, start = [], 0, 0
    for i, ch in enumerate(selector):
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth -= 1
        elif ch == "," and depth == 0:
            parts.append(selector[start:i])
            start = i + 1
    parts.append(selector[start:])
    return parts


def hover_only(css: str) -> str:
    """Return ``css`` with top-level ``:hover`` rules limited to hover devices."""
    if ":hover" not in css:
        return css
    out = []
    for text, is_rule, selector in _top_level_rules(css):
        if not (is_rule and ":hover" in selector):
            out.append(text)
            continue
        body = text[len(selector):]
        parts = _split_selectors(selector)
        hover = [p.strip() for p in parts if ":hover" in p]
        other = [p.strip() for p in parts if ":hover" not in p and p.strip()]
        if not other:
            out.append("@media (hover: hover) {" + text + "}")
            continue
        out.append(", ".join(other) + " " + body)
        out.append("@media (hover: hover) {" + ", ".join(hover) + " " + body + "}")
    return "".join(out)


def hover_only_html(html: str) -> str:
    """Apply ``hover_only`` to the contents of every <style> element in ``html``."""
    if ":hover" not in html:
        return html
    return _STYLE_RE.sub(lambda m: m.group(1) + hover_only(m.group(2)) + m.group(3), html)
