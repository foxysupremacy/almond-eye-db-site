"""Shared name helpers for the GameTora data crawlers."""

import re


_JAPANESE_SCRIPT_RE = re.compile(r"[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]")


def is_japanese_fallback(value: str | None) -> bool:
    """Return whether a name contains Japanese-script text used as fallback."""
    return bool(value and _JAPANESE_SCRIPT_RE.search(value))
