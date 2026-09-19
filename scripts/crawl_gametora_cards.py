#!/usr/bin/env python3
"""
Crawl / sync support-card skill grants from GameTora, operating directly on
the datasets inside almond-eye-db-site/lib/data/ (no intermediate files):

  reads   lib/data/cards.json   — card index (id + urlName), written by
                                  extract-mdb.ts from master.mdb
  reads   lib/data/skills.json  — processed skills with tactical tags
  updates lib/data/cards.json   — fills type/nameEn/urlName and the GameTora-
                                  only fields (hints, event_skills, event
                                  details) in place
  writes  lib/data/skill-meta.json — skill tactical metadata (styles,
                                  distances, surfaces) for recommendations

Queries GameTora's Next.js data endpoint:
  https://gametora.com/_next/data/{buildId}/umamusume/supports/{url_name}.json?id={url_name}
New cards (urlName = null from mdb) get their slug resolved from GameTora's
sitemap, which covers every support page.

Usage:
    python3 scripts/crawl_gametora_cards.py                  # compile skill-meta.json only
    python3 scripts/crawl_gametora_cards.py --new-only       # incremental: cards not yet crawled
    python3 scripts/crawl_gametora_cards.py --crawl-all      # full live crawl from Gametora
    python3 scripts/crawl_gametora_cards.py --card-id 30308  # test single card crawl
"""

import argparse
import json
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
# In-repo layout (scripts/ lives inside the site repo) or legacy sibling
# workspace layout (scripts/ sits next to almond-eye-db-site/).
if (ROOT_DIR / "lib" / "data" / "cards.json").exists():
    SITE_LIB_DIR = ROOT_DIR / "lib"
else:
    SITE_LIB_DIR = ROOT_DIR / "almond-eye-db-site" / "lib"
CARDS_JSON = SITE_LIB_DIR / "data" / "cards.json"
SKILLS_JSON = SITE_LIB_DIR / "data" / "skills.json"
OUT_JSON = SITE_LIB_DIR / "data" / "skill-meta.json"

SUPPORTS_LIST_URL = "https://gametora.com/umamusume/supports"
SITEMAP_URL = "https://gametora.com/sitemap.xml"
DEFAULT_BUILD_ID = "4ru_4OrTLkIoa0fHPZqTm"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36"
)

HEADERS = {
    "User-Agent": UA,
    "x-nextjs-data": "1",
    "Referer": "https://gametora.com/umamusume/supports",
    "Accept": "*/*",
}


def find_build_id() -> str:
    """Fetch current buildId from the GameTora supports page."""
    try:
        req = urllib.request.Request(SUPPORTS_LIST_URL, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8")
            match = re.search(r'"buildId":"([^"]+)"', html)
            if match:
                return match.group(1)
    except Exception as e:
        print(f"[warn] Could not fetch live buildId ({e}), using default: {DEFAULT_BUILD_ID}")
    return DEFAULT_BUILD_ID


def _fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="replace")


def scrape_support_slugs() -> dict[int, str]:
    """support_id -> url_name slug from GameTora's sitemap, which lists every
    support page. (The supports listing page is client-rendered and only
    embeds a handful of featured links, so it can't resolve most cards.)"""
    body = _fetch_text(SITEMAP_URL)
    locs = re.findall(r"<loc>([^<]+)</loc>", body)
    urls: list[str] = []
    for loc in locs:  # sitemap index -> child sitemaps
        if loc.endswith(".xml"):
            urls += re.findall(r"<loc>([^<]+)</loc>", _fetch_text(loc))
        else:
            urls.append(loc)
    slugs: dict[int, str] = {}
    for url in urls:
        m = re.search(r"/umamusume/supports/(\d+)-([a-z0-9-]+)", url)
        if m:
            slugs[int(m.group(1))] = f"{m.group(1)}-{m.group(2)}"
    print(f"Resolved {len(slugs)} card slugs from the GameTora sitemap.")
    return slugs


def crawl_card_data(url_name: str, build_id: str) -> dict | None:
    """Fetch single card JSON from Gametora."""
    url = f"https://gametora.com/_next/data/{build_id}/umamusume/supports/{url_name}.json?id={url_name}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            props = data.get("pageProps", {})
            item = props.get("itemData")
            if item and "eventData" in props:
                item["eventData"] = props["eventData"]
            return item
    except Exception as e:
        print(f"[error] Failed to fetch {url_name}: {e}")
        return None


def format_stat_summary(rewards: list[dict]) -> str:
    """Format non-skill rewards (energy, mood, stats, pt) into a readable summary."""
    stat_map = {
        "en": "Energy",
        "mo": "Mood",
        "bo": "Bond",
        "sp": "Speed",
        "st": "Stamina",
        "po": "Power",
        "gu": "Guts",
        "in": "Wisdom",
        "pt": "Skill Pt",
    }
    parts = []
    for r in rewards:
        t = r.get("t")
        v = r.get("v", "")
        if t in stat_map and v:
            parts.append(f"{v} {stat_map[t]}")
    return ", ".join(parts)


def parse_event_data(event_data: dict | None) -> list[dict]:
    """Parse GameTora eventData and extract chain & random events and choices."""
    if not event_data or not isinstance(event_data, dict):
        return []

    def load_lang(raw):
        if not raw:
            return {}
        if isinstance(raw, str):
            try:
                return json.loads(raw)
            except Exception:
                return {}
        if isinstance(raw, dict):
            return raw
        return {}

    ja_data = load_lang(event_data.get("ja"))
    en_data = load_lang(event_data.get("en"))

    # Map EN events by event ID
    en_events = {}
    for cat, evts in en_data.items():
        if isinstance(evts, list):
            for ev in evts:
                if isinstance(ev, dict) and "i" in ev:
                    en_events[ev["i"]] = ev

    parsed_events = []
    seen_event_ids = set()

    for cat, evts in ja_data.items():
        if not isinstance(evts, list):
            continue
        is_chain = (cat == "arrows")
        for idx_ev, ev in enumerate(evts, start=1):
            if not isinstance(ev, dict) or "i" not in ev:
                continue
            eid = ev["i"]
            if eid in seen_event_ids:
                continue

            name_jp = ev.get("n") or ""
            en_ev = en_events.get(eid, {})
            name_en = en_ev.get("n") or name_jp

            choices_raw = ev.get("c") or []
            en_choices_raw = en_ev.get("c") or []

            parsed_choices = []
            for idx_ch, ch in enumerate(choices_raw, start=1):
                if not isinstance(ch, dict):
                    continue
                rewards = ch.get("r") or []
                skill_ids = []
                for r in rewards:
                    if isinstance(r, dict) and r.get("t") == "sk" and "d" in r:
                        try:
                            skill_ids.append(int(r["d"]))
                        except (ValueError, TypeError):
                            pass

                stat_summary = format_stat_summary(rewards)

                # Keep choices if they grant skills OR if this is a chain event with choices
                if skill_ids or is_chain:
                    text_jp = ch.get("o") or f"Option {idx_ch}"
                    en_ch = (
                        en_choices_raw[idx_ch - 1]
                        if idx_ch - 1 < len(en_choices_raw) and isinstance(en_choices_raw[idx_ch - 1], dict)
                        else {}
                    )
                    text_en = en_ch.get("o") or text_jp

                    parsed_choices.append({
                        "index": idx_ch,
                        "textEn": text_en,
                        "textJp": text_jp,
                        "skillIds": skill_ids,
                        "statSummary": stat_summary,
                    })

            if parsed_choices:
                seen_event_ids.add(eid)
                event_entry = {
                    "eventId": eid,
                    "nameEn": name_en,
                    "nameJp": name_jp,
                    "eventType": "chain" if is_chain else "random",
                    "choices": parsed_choices,
                }
                if is_chain:
                    event_entry["chainStep"] = idx_ev
                parsed_events.append(event_entry)

    return parsed_events


def extract_skill_meta(skills: list[dict]) -> dict[int, dict]:
    """Extract style, distance, surface tags for each skill from the site's
    processed skills.json (entries carry a `tags` array of raw effect tags)."""
    style_tags = {"run": 1, "ldr": 2, "btw": 3, "cha": 4}
    dist_tags = {"sho": 1, "mil": 2, "med": 3, "lng": 4}
    surf_tags = {"tur": 1, "dir": 2}

    meta = {}
    for s in skills:
        sid = s["id"]
        types = set(s.get("tags") or [])

        styles = [style_tags[t] for t in types if t in style_tags]
        distances = [dist_tags[t] for t in types if t in dist_tags]
        surfaces = [surf_tags[t] for t in types if t in surf_tags]

        # Check condition strings if tags are missing
        cond_groups = s.get("conditionGroups") or []
        cond_str = " ".join([cg.get("condition") or "" for cg in cond_groups])

        if not styles:
            for m in re.finditer(r"running_style==([1-4])", cond_str):
                val = int(m.group(1))
                if val not in styles:
                    styles.append(val)
        if not distances:
            for m in re.finditer(r"distance_type==([1-4])", cond_str):
                val = int(m.group(1))
                if val not in distances:
                    distances.append(val)
        if not surfaces:
            for m in re.finditer(r"ground_type==([1-2])", cond_str):
                val = int(m.group(1))
                if val not in surfaces:
                    surfaces.append(val)

        is_generic = (len(styles) == 0 and len(distances) == 0 and len(surfaces) == 0)

        cleaned_conditions = [
            {"condition": cg.get("condition") or "", "precondition": cg.get("precondition")}
            for cg in cond_groups
            if cg.get("condition") or cg.get("precondition")
        ]

        meta[sid] = {
            "nameEn": s.get("nameEn") or s.get("nameJp") or f"Skill #{sid}",
            "nameJp": s.get("nameJp") or "",
            "descEn": s.get("descEn") or "",
            "rarity": s.get("rarity") or 1,
            "styles": sorted(styles),
            "distances": sorted(distances),
            "surfaces": sorted(surfaces),
            "isGeneric": is_generic,
            "conditions": cleaned_conditions,
        }
    return meta


def apply_crawl_result(entry: dict, item: dict, event_details: list[dict]) -> None:
    """Merge one GameTora card payload into its cards.json entry. Curated
    English names are never clobbered — only filled in when missing."""
    entry["urlName"] = item.get("url_name") or entry.get("urlName")
    if item.get("type"):
        entry["type"] = item["type"]
    if item.get("release"):
        entry["release"] = item["release"]
    if item.get("rarity"):
        entry["rarity"] = int(item["rarity"])
    char_en = (item.get("char_name") or "").strip()
    if char_en and (not entry.get("nameEn") or entry["nameEn"] == entry.get("nameJp")):
        entry["nameEn"] = char_en
    entry["charName"] = char_en or entry.get("charName")
    if item.get("name_jp"):
        title_ja = item.get("title_ja") or ""
        entry["nameJp"] = f"{title_ja} {item['name_jp']}".strip()
        entry["titleJa"] = title_ja
    entry["hintSkills"] = [int(h) for h in item.get("hints", {}).get("hint_skills", [])]
    entry["eventSkills"] = [int(e) for e in item.get("event_skills", [])]
    entry["eventDetails"] = event_details


def save_cards(cards: list[dict]) -> None:
    CARDS_JSON.write_text(json.dumps(cards, separators=(",", ":"), ensure_ascii=False))


def build_card_data(crawl_all: bool = False, specific_id: int | None = None, new_only: bool = False):
    print("Loading site datasets...")
    cards: list[dict] = json.loads(CARDS_JSON.read_text(encoding="utf-8"))
    skills: list[dict] = json.loads(SKILLS_JSON.read_text(encoding="utf-8"))
    cards_by_id = {int(c["id"]): c for c in cards}

    skill_meta = extract_skill_meta(skills)
    print(f"Parsed metadata for {len(skill_meta)} skills.")

    cards_to_crawl: list[dict] = []
    if specific_id:
        card = cards_by_id.get(specific_id)
        if card is None:
            print(f"Card {specific_id} not found in lib/data/cards.json.")
            return
        cards_to_crawl.append(card)
    elif crawl_all:
        cards_to_crawl = cards
    elif new_only:
        # Cards never crawled: no event data merged yet and no slug resolved.
        # (Cards with legitimately zero events get a urlName once crawled, so
        # they are not re-selected; nameEn can only come from a crawl.)
        cards_to_crawl = [
            c for c in cards
            if (not c.get("eventDetails") and not c.get("urlName")) or not c.get("nameEn")
        ]
        print(f"Incremental mode: {len(cards_to_crawl)} of {len(cards)} cards need a crawl.")
    else:
        print("Compile mode: regenerating skill-meta.json only.")

    if cards_to_crawl:
        # Resolve slugs for cards the crawler has never seen.
        missing_slug = [c for c in cards_to_crawl if not c.get("urlName")]
        if missing_slug:
            try:
                slugs = scrape_support_slugs()
                for c in missing_slug:
                    slug = slugs.get(int(c["id"]))
                    if slug:
                        c["urlName"] = slug
            except Exception as e:
                print(f"[warn] Could not scrape support slugs ({e}); new cards will be skipped.")

        build_id = find_build_id()
        print(f"Using Gametora buildId: {build_id}")
        print(f"Crawling {len(cards_to_crawl)} cards live from Gametora...")

        def fetch_worker(card: dict):
            url_name = card.get("urlName")
            if not url_name:
                return int(card["id"]), None
            return int(card["id"]), crawl_card_data(url_name, build_id)

        completed = 0
        updated = 0
        total = len(cards_to_crawl)
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(fetch_worker, c) for c in cards_to_crawl]
            for fut in as_completed(futures):
                completed += 1
                cid, item = fut.result()
                if item:
                    event_details = parse_event_data(item.get("eventData"))
                    apply_crawl_result(cards_by_id[cid], item, event_details)
                    updated += 1
                    print(f"  [{completed}/{total}] Card {cid} ({item.get('char_name')}): "
                          f"{len(item.get('hints', {}).get('hint_skills', []))} hints, "
                          f"{len(event_details)} events")
                else:
                    print(f"  [{completed}/{total}] Card {cid}: failed to fetch")
                if completed % 50 == 0:
                    save_cards(cards)
                    print(f"  [checkpoint] Saved {completed}/{total} cards")

        save_cards(cards)
        print(f"Updated {CARDS_JSON} ({updated} cards refreshed).")

    SITE_LIB_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(skill_meta, separators=(",", ":"), ensure_ascii=False))
    size_kb = OUT_JSON.stat().st_size / 1024
    print(f"Successfully wrote {OUT_JSON} ({size_kb:.1f} KB, {len(skill_meta)} skills).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Crawl/compile Gametora support card skills")
    parser.add_argument("--crawl-all", action="store_true", help="Perform full live crawl from Gametora")
    parser.add_argument("--new-only", action="store_true", help="Incremental: crawl only cards not yet crawled")
    parser.add_argument("--card-id", type=int, help="Crawl a single card by ID")
    args = parser.parse_args()
    build_card_data(crawl_all=args.crawl_all, specific_id=args.card_id, new_only=args.new_only)
