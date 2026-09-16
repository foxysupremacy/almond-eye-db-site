# Agent Prompt: Integrate hachimi-tl-en Community Translations

Copy everything below this line into a fresh agent prompt. This is a self-contained task — no prior context needed.

---

You are working in `/Users/fubuki/Documents/AlmondEyeDB`. Your task: **integrate English community translations from the hachimi-tl-en project** so the visualizer can display English names for tracks, characters, skills, and game terms alongside (or instead of) the current Japanese-only labels.

## Background

[UmaTL/hachimi-tl-en](https://github.com/UmaTL/hachimi-tl-en) is a fan translation project for Umamusume. Its `localized_data/` directory contains JSON dictionaries that the Hachimi tool uses to replace Japanese game text with English at runtime. We want to consume these dictionaries as **static reference data** so our visualizer frontend can show English names.

## What We Currently Have (Japanese-only)

| Data | Current State | Example |
|------|--------------|---------|
| Track names | Japanese only in `scripts/process_tracks.py` TRACK_NAMES dict | `10001: "札幌"`, `10005: "東京"` |
| Phase labels | Bilingual (hardcoded) | `0: "序盤"` / `"early"` |
| Ground types | English only (hardcoded) | `1: "turf"`, `2: "dirt"` |
| Turn directions | English only (hardcoded) | `1: "right"`, `2: "left"` |
| Character names | **None** — not in project at all | — |
| Skill names | **None** — not in project at all | — |
| Distance types | English only (hardcoded) | `1: "short"`, `2: "mile"`, `3: "middle"`, `4: "long"` |

## What hachimi-tl-en Provides

The repo is at `https://github.com/UmaTL/hachimi-tl-en/tree/main/localized_data`. Key files:

| File | Format | Content |
|------|--------|---------|
| `text_data_dict.json` | `{"category": {"id": "text"}}` | **Character names** (cat 4=card full, cat 5=card title, cat 6=base name), **items** (cat 10), UI messages (cat 1/2), tutorial (cat 3) |
| `localize_dict.json` | `{"ScreenPrefixNNNN": "text"}` | UI strings organized by game screen — skill labels, training terms, gacha text, common UI |
| `character_system_text_dict.json` | `{"char_id": {"context_code": "text"}}` | Per-character dialogue lines |
| `race_jikkyo_comment_dict.json` | `{"id": "text"}` | Race commentary/announcer lines |
| `race_jikkyo_message_dict.json` | `{"id": "text"}` | Race message text |
| `hashed_dict.json` | `{"hash": "text"}` | Hash-keyed translation lookup table |
| `config.json` | Metadata | Translation config, font settings, plural rules |
| `info.json` | Metadata | Project name, homepage, maintainer |

## What To Do

### Phase 1 — Clone & Inventory

```bash
cd /tmp
git clone --depth 1 https://github.com/UmaTL/hachimi-tl-en.git
```

Then inventory exactly what's useful:
```bash
python3 -c "
import json, os

base = '/tmp/hachimi-tl-en/localized_data'

# text_data_dict — check all categories
with open(f'{base}/text_data_dict.json') as f:
    tdd = json.load(f)
print('=== text_data_dict.json ===')
for cat in sorted(tdd.keys(), key=int):
    ids = list(tdd[cat].keys())
    print(f'  category {cat}: {len(ids)} entries, sample ids {ids[:5]}, sample: {list(tdd[cat].values())[:2]}')

# localize_dict — count by prefix
with open(f'{base}/localize_dict.json') as f:
    ld = json.load(f)
from collections import Counter
prefixes = Counter()
for k in ld:
    prefix = ''.join(c for c in k if c.isalpha())
    prefixes[prefix] += 1
print(f'\n=== localize_dict.json: {len(ld)} entries ===')
for p, c in prefixes.most_common(15):
    print(f'  {p}: {c} entries')

# character_system_text_dict — which char IDs
with open(f'{base}/character_system_text_dict.json') as f:
    cst = json.load(f)
print(f'\n=== character_system_text_dict.json: {len(cst)} characters ===')
print(f'  char ids: {sorted(cst.keys())[:10]}...')

# hashed_dict — count
with open(f'{base}/hashed_dict.json') as f:
    hd = json.load(f)
print(f'\n=== hashed_dict.json: {len(hd)} hashed entries ===')

# race_jikkyo_comment_dict
with open(f'{base}/race_jikkyo_comment_dict.json') as f:
    rjc = json.load(f)
print(f'\n=== race_jikkyo_comment_dict.json: {len(rjc)} entries ===')

# race_jikkyo_message_dict
with open(f'{base}/race_jikkyo_message_dict.json') as f:
    rjm = json.load(f)
print(f'\n=== race_jikkyo_message_dict.json: {len(rjm)} entries ===')
"
```

### Phase 2 — Extract & Map to Our Data Model

Create a new directory `data/translations/` and produce these mapping files:

#### 2a — `data/translations/track_names.json`

Map our `race_track_id` → English name. Source options (try in order):
1. **hashed_dict.json** — if it contains track name hashes, cross-reference with known Japanese names
2. **text_data_dict.json** — look for track-related categories
3. **Master.mdb `text_data` category=34** — if master.mdb is available, query it for Japanese names, then find matches in the hachimi dictionaries
4. **Manual mapping** — if none of the above work, fall back to constructing a manual map using well-known English names

Format:
```json
{
  "10001": {"ja": "札幌", "en": "Sapporo"},
  "10002": {"ja": "函館", "en": "Hakodate"},
  "10003": {"ja": "福島", "en": "Fukushima"},
  "10004": {"ja": "新潟", "en": "Niigata"},
  "10005": {"ja": "東京", "en": "Tokyo"},
  "10006": {"ja": "中山", "en": "Nakayama"},
  "10007": {"ja": "中京", "en": "Chukyo"},
  "10008": {"ja": "京都", "en": "Kyoto"},
  "10009": {"ja": "阪神", "en": "Hanshin"},
  "10010": {"ja": "小倉", "en": "Kokura"},
  "10011": {"ja": "大井", "en": "Oi"},
  "10012": {"ja": "川崎", "en": "Kawasaki"},
  "10013": {"ja": "船橋", "en": "Funabashi"},
  "10014": {"ja": "盛岡", "en": "Morioka"}
}
```

#### 2b — `data/translations/character_names.json`

Extract from `text_data_dict.json`:
- **category 6** (4-digit IDs) → base character names (e.g., `"1001": "Special Week"`)
- **category 4** (7-digit IDs) → full card names (e.g., `"100101": "[Special Dreamer] Special Week"`)

Format:
```json
{
  "1001": {"en": "Special Week", "card_ids": ["100101", "100102", ...]},
  "1006": {"en": "Oguri Cap", "card_ids": ["100601", ...]}
}
```

#### 2c — `data/translations/game_terms.json`

Extract relevant UI/game terms from `localize_dict.json`:

| Our Field | hachimi Key Pattern | Example Value |
|-----------|-------------------|---------------|
| Phase labels | Look in `Common` section | `"early", "mid", "late", "last spurt"` |
| Ground types | Look in `Common` / `Race` sections | `"turf", "dirt"` |
| Turn directions | Look in `Common` / `Race` sections | `"right", "left", "straight"` |
| Distance types | Look in `Common` section | `"short", "mile", "middle", "long"` |
| Skill types | Look in `Character` section keys around 0019-0100 | The 7 skill type names |
| General UI | `Common` prefix | Yes/No, Confirm, Cancel, etc. |

Format:
```json
{
  "phases": {
    "0": {"ja": "序盤", "en": "Early"},
    "1": {"ja": "中盤", "en": "Mid"},
    "2": {"ja": "終盤", "en": "Late"},
    "3": {"ja": "追込", "en": "Last Spurt"}
  },
  "ground_types": {
    "1": {"ja": "芝", "en": "Turf"},
    "2": {"ja": "ダート", "en": "Dirt"}
  },
  "turn_directions": {
    "1": {"ja": "右", "en": "Right"},
    "2": {"ja": "左", "en": "Left"},
    "4": {"ja": "直線", "en": "Straight"}
  },
  "distance_types": {...},
  "skill_types": {...}
}
```

#### 2d — `data/translations/skill_names.json` (stretch goal)

Skill names are likely in **hashed_dict.json** or derived from master.mdb `text_data` category=145. Strategy:
1. Check if `hashed_dict.json` has skill name hashes
2. If master.mdb is available, query `text_data WHERE category=145` for Japanese skill names, then find hash matches in hachimi
3. If neither works, document the gap and the query that would fill it

#### 2e — `data/translations/README.md`

Document:
- Source repo URL, commit hash, and date of clone
- Which hachimi files were used for which mapping
- Which fields have complete coverage and which are partial/missing
- How to update when hachimi-tl-en publishes new translations
- The update command: `git -C /tmp/hachimi-tl-en pull && python3 scripts/rebuild_translations.py`

### Phase 3 — Wire Into Existing Scripts

#### 3a — Update `scripts/process_tracks.py`

Add an optional `--lang en` flag. When set, read `data/translations/track_names.json` and output `track_name_en` alongside `track_name_jp`:

```python
# Near the top of main()
TRANSLATIONS_DIR = Path("data/translations")
if args.lang == "en" and (TRANSLATIONS_DIR / "track_names.json").exists():
    with open(TRANSLATIONS_DIR / "track_names.json") as f:
        TRACK_NAMES_EN = json.load(f)
    # Use TRACK_NAMES_EN.get(str(race_track_id), {}).get("en", fallback)
```

Add `track_name_en` field to the process_course output dict. Leave `track_name_jp` intact as the canonical key.

#### 3b — Add `scripts/rebuild_translations.py`

A simple script that:
1. Reads the hachimi clone at a configurable path (default `/tmp/hachimi-tl-en/localized_data/`)
2. Regenerates all files in `data/translations/`
3. Prints coverage stats (how many tracks/characters/terms have en translations)

```python
"""
Rebuild translation mapping files from hachimi-tl-en localized_data.

Usage:
  python scripts/rebuild_translations.py                           # use /tmp/hachimi-tl-en
  python scripts/rebuild_translations.py --source ~/hachimi-tl-en  # custom path
"""
```

### Phase 4 — Verification

After building `data/translations/`, verify:

```
[ ] data/translations/track_names.json has all 14+ tracks with en names
[ ] data/translations/character_names.json has 100+ characters (text_data_dict cat 6)
[ ] data/translations/game_terms.json covers phases, ground, turn, distance, skill types
[ ] All JSON files are valid (parse with python -m json.tool)
[ ] Japanese names match existing TRACK_NAMES dict in process_tracks.py (no regressions)
[ ] process_tracks.py --lang en produces output with track_name_en field
[ ] README.md has source commit hash and update instructions
[ ] No hachimi data is checked into git — only our derived mapping files go in data/translations/
```

### Phase 5 — Clean Up

- Delete the `/tmp/hachimi-tl-en` clone (or leave it if `--keep-clone` flag was used)
- Add `data/translations/` to `.gitignore` exception if needed (the derived files SHOULD be tracked — they're small JSON)
- Print summary: count of translated tracks, characters, terms, skills

## Ground Rules

- **The hachimi repo is the source of truth** — always clone fresh or `git pull` before rebuilding
- **Don't modify hachimi files** — we only read them, never write
- **Derived files go in `data/translations/`** — these are our curated subset of the full translation data
- **Keep Japanese as the canonical key** — English is a display convenience, not a replacement
- **If a term doesn't exist in hachimi**, leave it empty in the mapping rather than guessing
- **Track the hachimi commit hash** in the README so we know which version of translations we're using
- **Document gaps clearly** — if 90% of character names are covered but 10% are missing, say so
