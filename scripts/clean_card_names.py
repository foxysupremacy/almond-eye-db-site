#!/usr/bin/env python3
"""Strip the bracketed title prefix from card nameEn in lib/data/cards.json.

"[Make These Feelings Reach You!] Bamboo Memory" -> "Bamboo Memory".
The bracket content is already preserved in each card's titleEn field, so no
information is lost. nameJp is left untouched (user preference: EN only).

Usage: python3 scripts/clean_card_names.py [path/to/cards.json]
"""
import json
import re
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
# In-repo layout (scripts/ lives inside the site repo) or legacy sibling layout.
if (_root / "lib" / "data" / "cards.json").exists():
    DEFAULT_PATH = _root / "lib" / "data" / "cards.json"
else:
    DEFAULT_PATH = _root / "almond-eye-db-site" / "lib" / "data" / "cards.json"

# Leading bracketed group + following whitespace. $1 = the rest of the name.
BRACKET_PREFIX = re.compile(r"^\s*\[[^\]]*\]\s*")


def clean(name: str) -> str:
    return BRACKET_PREFIX.sub("", name).strip()


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PATH
    cards = json.loads(path.read_text(encoding="utf-8"))

    changed = 0
    for card in cards:
        old = card.get("nameEn") or ""
        new = clean(old)
        if new != old:
            card["nameEn"] = new
            changed += 1

    path.write_text(
        json.dumps(cards, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"{path}: cleaned {changed}/{len(cards)} nameEn values")


if __name__ == "__main__":
    main()
