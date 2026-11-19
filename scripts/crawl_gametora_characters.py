#!/usr/bin/env python3
"""
Add GameTora-owned fields to playable characters (English name/title,
urlName, event skills), operating on lib/data/generated/characters.json.

The character index itself (new entries, innate/awakening/unique skills,
aptitude, base stats) and skills.json backfill come from master.mdb via
scripts/extract-mdb.ts, which must run first.

Queries GameTora's Next.js data endpoint:
  https://gametora.com/_next/data/{buildId}/umamusume/characters/{slug}.json
Character slugs are resolved from GameTora's sitemap, which covers every
character page (listing pages are client-rendered).

Usage:
    python3 scripts/crawl_gametora_characters.py                 # crawl characters lacking an English name
    python3 scripts/crawl_gametora_characters.py --all           # re-crawl every character
    python3 scripts/crawl_gametora_characters.py --card-id 114401  # single character
"""

import argparse
import json
import os
import re
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _env import load_env
from _names import is_japanese_fallback

load_env()

ROOT_DIR = Path(__file__).resolve().parent.parent
# In-repo layout (scripts/ lives inside the site repo) or legacy sibling layout.
if (ROOT_DIR / "lib" / "data" / "generated" / "characters.json").exists():
    SITE_LIB_DIR = ROOT_DIR / "lib"
else:
    SITE_LIB_DIR = ROOT_DIR / "almond-eye-db-site" / "lib"
GENERATED_DATA_DIR = SITE_LIB_DIR / "data" / "generated"
CHARACTERS_JSON = GENERATED_DATA_DIR / "characters.json"

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
    raise RuntimeError("no buildId available — GameTora unreachable?")


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
    # New costumes may reach the public dataset before the sitemap does.
    snapshot = SITE_LIB_DIR / "data" / "source" / "gametora" / "character-cards.json"
    slugs: dict[int, str] = {
        int(c["card_id"]): c["url_name"]
        for c in json.loads(snapshot.read_text(encoding="utf-8"))
        if c.get("url_name")
    } if snapshot.exists() else {}
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
    Existing English names are never clobbered. Japanese-script fallbacks
    count as missing so an available GameTora English name can replace them."""
    entry["urlName"] = item.get("url_name") or entry.get("urlName")
    name_en = (item.get("name_en") or "").strip()
    if name_en and not is_japanese_fallback(name_en) and (
        not entry.get("nameEn") or is_japanese_fallback(entry.get("nameEn"))
    ):
        entry["nameEn"] = name_en
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
    # uniqueSkillId / innate / awakening / aptitude / baseStats are owned by
    # extract-mdb.ts (master.mdb); only eventSkills come from GameTora.
    if item.get("skills_event"):
        entry["eventSkills"] = [int(s) for s in item["skills_event"]]


def main() -> None:
    parser = argparse.ArgumentParser(description="Populate playable-character data (mdb + GameTora)")
    parser.add_argument("--all", action="store_true", help="Re-crawl every character from GameTora")
    parser.add_argument("--card-id", type=int, help="Crawl a single character by card id")
    args = parser.parse_args()

    characters: list[dict] = json.loads(CHARACTERS_JSON.read_text(encoding="utf-8"))
    by_id = {int(c["id"]): c for c in characters}

    to_crawl: list[dict] = []
    if args.card_id:
        card = by_id.get(args.card_id)
        if card is None:
            print(f"Character {args.card_id} not found in lib/data/generated/characters.json.")
            return
        to_crawl = [card]
    elif args.all:
        to_crawl = characters
    else:
        to_crawl = [
            c for c in characters
            if not c.get("nameEn") or is_japanese_fallback(c.get("nameEn"))
        ]

    if to_crawl:
        try:
            slugs = scrape_character_slugs()
            build_id = find_build_id()
        except Exception as e:
            # Keep the mdb skeletons (including their Japanese display names)
            # even when GameTora is unavailable; a later refresh retries them.
            print(f"[warn] GameTora unavailable ({e}); keeping mdb character data and retrying English names next refresh.")
            slugs = {}
            build_id = ""

        if build_id:
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

    # Keep the generate-data ordering: rarity desc, then nameEn, then id.
    characters.sort(key=lambda c: (-int(c.get("rarity") or 0),
                                   str(c.get("nameEn") or ""), int(c["id"])))
    CHARACTERS_JSON.write_text(
        json.dumps(characters, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Wrote {len(characters)} characters -> {CHARACTERS_JSON}")


if __name__ == "__main__":
    main()
