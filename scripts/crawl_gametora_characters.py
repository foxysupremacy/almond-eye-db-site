#!/usr/bin/env python3
"""
Populate playable-character data, mdb-first, operating directly on the
datasets inside almond-eye-db-site/lib/data/ (no intermediate files):

  reads   lib/data/characters.json — character index (id = base card_id)
  reads   lib/data/skills.json     — known skills
  merges  master.mdb               — new playable characters (card_data rows
                                     where id == chara_id*100 + 1): JP name,
                                     rarity, release, innate/awakening skills
  updates lib/data/characters.json — fills EN name/title, aptitudes, base
                                     stats, unique/innate/awakening/event
                                     skill ids from GameTora
  appends lib/data/skills.json     — referenced skills missing from the site
                                     (e.g. brand-new uniques), built from mdb
                                     skill_data with JP text (cat 47/48)

Queries GameTora's Next.js data endpoint:
  https://gametora.com/_next/data/{buildId}/umamusume/characters/{slug}.json
Character slugs are resolved from GameTora's sitemap, which covers every
character page (listing pages are client-rendered).

Usage:
    python3 scripts/crawl_gametora_characters.py                 # mdb merge + crawl uncrawled
    python3 scripts/crawl_gametora_characters.py --all           # re-crawl every character
    python3 scripts/crawl_gametora_characters.py --card-id 114401  # single character
"""

import argparse
import json
import os
import re
import sqlite3
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from skill_icons import resolve_skill_icon_id
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _env import load_env

load_env()

ROOT_DIR = Path(__file__).resolve().parent.parent
# In-repo layout (scripts/ lives inside the site repo) or legacy sibling layout.
if (ROOT_DIR / "lib" / "data" / "characters.json").exists():
    SITE_LIB_DIR = ROOT_DIR / "lib"
else:
    SITE_LIB_DIR = ROOT_DIR / "almond-eye-db-site" / "lib"
CHARACTERS_JSON = SITE_LIB_DIR / "data" / "characters.json"
SKILLS_JSON = SITE_LIB_DIR / "data" / "skills.json"

CHARACTERS_LIST_URL = "https://gametora.com/umamusume/characters"
SITEMAP_URL = "https://gametora.com/sitemap.xml"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": UA,
    "x-nextjs-data": "1",
    "Referer": "https://gametora.com/umamusume/characters",
    "Accept": "*/*",
}

N_ABILITIES = 3


def resolve_mdb_path() -> str:
    return os.environ.get("UMAMUSUME_MDB_PATH", "")


def strip_brackets(s: str) -> str:
    return re.sub(r"^\s*\[|\]\s*$", "", s or "").strip()


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="replace")


def find_build_id() -> str:
    """Current Next.js buildId from any GameTora page."""
    try:
        m = re.search(r'"buildId":"([^"]+)"', fetch_text(CHARACTERS_LIST_URL))
        if m:
            return m.group(1)
    except Exception as e:
        print(f"[warn] Could not fetch live buildId ({e})")
    raise SystemExit("Error: no buildId available — GameTora unreachable?")


def scrape_character_slugs() -> dict[int, str]:
    """card_id -> url_name slug from GameTora's sitemap (covers every
    character page; the listing page only embeds a few featured links)."""
    body = fetch_text(SITEMAP_URL)
    urls: list[str] = []
    for loc in re.findall(r"<loc>([^<]+)</loc>", body):
        if loc.endswith(".xml"):
            urls += re.findall(r"<loc>([^<]+)</loc>", fetch_text(loc))
        else:
            urls.append(loc)
    slugs: dict[int, str] = {}
    for url in urls:
        m = re.search(r"/umamusume/characters/(\d+)-([a-z0-9-]+)", url)
        if m:
            slugs[int(m.group(1))] = f"{m.group(1)}-{m.group(2)}"
    print(f"Resolved {len(slugs)} character slugs from the GameTora sitemap.")
    return slugs


def crawl_character_data(slug: str, build_id: str) -> dict | None:
    url = f"https://gametora.com/_next/data/{build_id}/umamusume/characters/{slug}.json?id={slug}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("pageProps", {}).get("itemData")
    except Exception as e:
        print(f"[error] Failed to fetch {slug}: {e}")
        return None


def merge_game_tora(entry: dict, item: dict) -> None:
    """Merge a GameTora character payload into its characters.json entry.
    Existing EN names are never clobbered — only filled in when missing."""
    entry["urlName"] = item.get("url_name") or entry.get("urlName")
    if item.get("name_en") and (not entry.get("nameEn") or entry["nameEn"] == entry.get("nameJp")):
        entry["nameEn"] = item["name_en"].strip()
    if item.get("name_jp"):
        entry["nameJp"] = item["name_jp"].strip()
    title_en = (item.get("title") or "").strip()
    if title_en and not entry.get("titleEn"):
        entry["titleEn"] = title_en
    title_jp = strip_brackets(item.get("title_jp") or "")
    if title_jp:
        entry["titleJp"] = title_jp
    if item.get("rarity"):
        entry["rarity"] = int(item["rarity"])
    if item.get("release"):
        entry["release"] = item["release"]
    if isinstance(item.get("aptitude"), list) and item["aptitude"]:
        entry["aptitude"] = [str(a) for a in item["aptitude"]]
    if isinstance(item.get("base_stats"), list) and item["base_stats"]:
        entry["baseStats"] = [int(v) for v in item["base_stats"]]
    uniques = [int(u) for u in item.get("skills_unique") or []]
    if uniques:
        entry["uniqueSkillId"] = uniques[-1]
    if item.get("skills_innate"):
        entry["innateSkills"] = [int(s) for s in item["skills_innate"]]
    if item.get("skills_awakening"):
        entry["awakeningSkills"] = [int(s) for s in item["skills_awakening"]]
    if item.get("skills_event"):
        entry["eventSkills"] = [int(s) for s in item["skills_event"]]


# ---------------------------------------------------------------------------
# master.mdb extraction
# ---------------------------------------------------------------------------

def open_mdb():
    mdb_path = resolve_mdb_path()
    if not mdb_path or not os.path.exists(mdb_path):
        print(
            "[warn] master.mdb unavailable — skipping mdb index merge and "
            "mdb skill backfill (set UMAMUSUME_MDB_PATH in .env)."
        )
        return None
    conn = sqlite3.connect(f"file:{mdb_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def mdb_index_merge(db, characters: list[dict]) -> int:
    """Add skeleton entries for playable characters missing from the site.
    Playable base cards: card_data rows where id == chara_id*100 + 1."""
    text = lambda cat, idx: db.execute(
        'SELECT text FROM text_data WHERE category=? AND "index"=?', (cat, idx)
    ).fetchone()

    known = {int(c["id"]) for c in characters}
    rows = db.execute(
        """SELECT cd.id, cd.chara_id, cd.default_rarity, ch.start_date
           FROM card_data cd JOIN chara_data ch ON ch.id = cd.chara_id
           WHERE cd.id = cd.chara_id * 100 + 1 AND cd.id < 9000000"""
    ).fetchall()
    added = 0
    for card_id, chara_id, rarity, start_date in rows:
        if card_id in known:
            continue
        name_jp = (text(6, chara_id) or [""])[0].strip()
        release = None
        if start_date and int(start_date) > 0:
            release = __import__("datetime").datetime.fromtimestamp(
                int(start_date) + 9 * 3600, __import__("datetime").timezone.utc
            ).strftime("%Y-%m-%d")
        innate, awakening = [], []
        for (skill_id, need_rank) in db.execute(
            "SELECT skill_id, need_rank FROM available_skill_set "
            "WHERE available_skill_set_id=? ORDER BY skill_id",
            (card_id,),
        ):
            if need_rank == 0:
                innate.append(int(skill_id))
            elif need_rank >= 2:
                awakening.append(int(skill_id))
        characters.append({
            "id": int(card_id),
            "charId": int(chara_id),
            "variant": "01",
            "nameEn": "",
            "nameJp": name_jp,
            "titleEn": "",
            "titleJp": "",
            "rarity": int(rarity),
            "release": release,
            "aptitude": [],
            "baseStats": [],
            "uniqueSkillId": None,
            "innateSkills": innate,
            "awakeningSkills": awakening,
            "eventSkills": [],
        })
        added += 1
        print(f"  mdb index: added character {card_id} ({name_jp or '?'})")
    return added


def build_condition_groups(row) -> list[dict]:
    """Mirror the GameTora condition_groups schema (same as
    generate_inherit_skills.py): one group per skill detail."""
    groups = []
    for d in (1, 2):
        cond = row[f"condition_{d}"]
        base_time = row[f"float_ability_time_{d}"]
        if not cond or not base_time:
            continue
        effects = []
        for a in range(1, N_ABILITIES + 1):
            atype = row[f"ability_type_{d}_{a}"]
            if not atype:
                continue
            effect = {"type": atype, "value": row[f"float_ability_value_{d}_{a}"]}
            target = row[f"target_type_{d}_{a}"]
            if target not in (0, 1):
                effect["target"] = target
            effects.append(effect)
        if not effects:
            continue
        groups.append({
            "condition": cond,
            "precondition": row[f"precondition_{d}"] or None,
            "base_time": base_time,
            "effects": effects,
        })
    return groups


def mdb_skill_backfill(db, characters: list[dict], skills: list[dict]) -> int:
    """Append site skills.json entries for referenced skill ids that are
    missing (brand-new uniques etc.), built from mdb skill_data."""
    known = {int(s["id"]) for s in skills}
    referenced = {
        int(sid)
        for c in characters
        for k in ("uniqueSkillId", "innateSkills", "awakeningSkills", "eventSkills")
        for sid in (c.get(k) if isinstance(c.get(k), list) else [c.get(k)])
        if sid
    }
    missing = sorted(referenced - known)
    if not missing:
        return 0

    hangul = re.compile(r"[\uac00-\ud7af\u1100-\u11ff]")
    text = lambda cat, idx: (db.execute(
        'SELECT text FROM text_data WHERE category=? AND "index"=?', (cat, idx)
    ).fetchone() or [""])[0]
    added = 0
    for sid in missing:
        row = db.execute(
            "SELECT * FROM skill_data WHERE id=?", (sid,)
        ).fetchone()
        if row is None:
            print(f"  [warn] skill {sid} not in mdb skill_data — skipped")
            continue
        name_jp = text(47, sid).strip()
        desc_jp = text(48, sid).strip()
        # No EN source available offline (hachimi/GameTora dumps are legacy
        # workspace files) — EN falls back to the JP name until generate-data
        # runs with fresh dumps.
        name_en = name_jp if name_jp and not hangul.search(name_jp) else name_jp
        skills.append({
            "id": sid,
            "nameEn": name_en,
            "nameJp": name_jp,
            "descEn": "",
            "descJp": desc_jp,
            "rarity": int(row["rarity"]),
            "iconId": resolve_skill_icon_id(row),
            "tags": [],
            "conditionGroups": build_condition_groups(row),
        })
        added += 1
        print(f"  skill backfill: added {sid} ({name_jp}) from mdb")
    return added


def main() -> None:
    parser = argparse.ArgumentParser(description="Populate playable-character data (mdb + GameTora)")
    parser.add_argument("--all", action="store_true", help="Re-crawl every character from GameTora")
    parser.add_argument("--card-id", type=int, help="Crawl a single character by card id")
    args = parser.parse_args()

    characters: list[dict] = json.loads(CHARACTERS_JSON.read_text(encoding="utf-8"))
    skills: list[dict] = json.loads(SKILLS_JSON.read_text(encoding="utf-8"))
    by_id = {int(c["id"]): c for c in characters}

    db = open_mdb()
    if db is not None:
        mdb_index_merge(db, characters)
        by_id = {int(c["id"]): c for c in characters}

    to_crawl: list[dict] = []
    if args.card_id:
        card = by_id.get(args.card_id)
        if card is None:
            print(f"Character {args.card_id} not found in lib/data/characters.json.")
            return
        to_crawl = [card]
    elif args.all:
        to_crawl = characters
    else:
        to_crawl = [c for c in characters if not c.get("nameEn")]

    if to_crawl:
        slugs = scrape_character_slugs()
        build_id = find_build_id()
        print(f"Using GameTora buildId: {build_id}")
        print(f"Crawling {len(to_crawl)} characters live from GameTora...")

        def worker(c: dict):
            slug = slugs.get(int(c["id"]))
            if not slug:
                return int(c["id"]), None
            return int(c["id"]), crawl_character_data(slug, build_id)

        updated = 0
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(worker, c) for c in to_crawl]
            for i, fut in enumerate(as_completed(futures), 1):
                cid, item = fut.result()
                if item:
                    merge_game_tora(by_id[cid], item)
                    updated += 1
                    print(f"  [{i}/{len(to_crawl)}] {cid} ({by_id[cid].get('nameEn') or '?'})")
                else:
                    print(f"  [{i}/{len(to_crawl)}] {cid}: failed to fetch")

        print(f"Updated {updated}/{len(to_crawl)} characters from GameTora.")

    if db is not None:
        mdb_skill_backfill(db, characters, skills)
        db.close()

    # Keep the generate-data ordering: rarity desc, then nameEn, then id.
    characters.sort(key=lambda c: (-int(c.get("rarity") or 0),
                                   str(c.get("nameEn") or ""), int(c["id"])))
    CHARACTERS_JSON.write_text(
        json.dumps(characters, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    SKILLS_JSON.write_text(
        json.dumps(skills, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Wrote {len(characters)} characters -> {CHARACTERS_JSON}")
    print(f"Wrote {len(skills)} skills -> {SKILLS_JSON}")


if __name__ == "__main__":
    main()
