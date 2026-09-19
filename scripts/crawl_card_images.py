#!/usr/bin/env python3
"""
Crawl character and support-card images from Gametora.

Sources (pick with --source, default: all):

  characters      characters.json -> chara_stand_{char_id}_{card_id}.png
                  https://gametora.com/images/umamusume/characters/chara_stand_{char_id}_{card_id}.png
                  (full resolution, 512x512)
                  -> data/images/character_stands/{card_id}.png

  icons           characters.json -> chr_icon_{char_id}.png (rounded face icons)
                  https://gametora.com/images/umamusume/characters/icons/chr_icon_{char_id}.png
                  -> data/images/character_icons/{char_id}.png
                  (only one resolution exists: 256x256)

  supports        support_cards.json -> full art (full resolution):
    full            https://media.gametora.com/umamusume/supports/full/{card_id}.png
                    -> data/images/support_cards/{card_id}.png

- Skips files already downloaded (safe to re-run; use --force to overwrite)
- Concurrent downloads (default 8 workers) + small delay to stay polite
- Retries on transient errors; logs ids that 404 to images_missing.txt per dir

Usage:
    python3 scripts/crawl_card_images.py                       # everything
    python3 scripts/crawl_card_images.py --source supports     # support cards only
    python3 scripts/crawl_card_images.py --source characters
    python3 scripts/crawl_card_images.py --limit 20 --workers 4 --force
"""
import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

ROOT_DIR = Path(__file__).resolve().parent.parent
if not (ROOT_DIR / "characters.json").exists() and (ROOT_DIR.parent / "characters.json").exists():
    ROOT_DIR = ROOT_DIR.parent

DEFAULT_IMAGES_DIR = (
    (ROOT_DIR / "almond-eye-db-api" / "data" / "images")
    if (ROOT_DIR / "almond-eye-db-api" / "data" / "images").exists()
    else (ROOT_DIR / "data" / "images")
)


@dataclass(frozen=True)
class Job:
    url: str
    dest: Path
    label: str          # id used in logs / images_missing.txt


def _load_ids(path: Path) -> list[int]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        ids = [item.get("support_id") or item.get("id") or item.get("card_id")
               for item in data if isinstance(item, dict)]
        return sorted(int(cid) for cid in ids if cid is not None)
    if isinstance(data, dict):
        return sorted(int(k) for k in data.keys() if str(k).isdigit())
    return []


def _default_json(raw_name: str, lib_name: str) -> Path:
    """Raw sibling-workspace dump if present, else the committed lib/data file."""
    raw = ROOT_DIR / raw_name
    if raw.exists():
        return raw
    return ROOT_DIR / "lib" / "data" / lib_name


def build_jobs(args) -> list[Job]:
    jobs: list[Job] = []
    images_dir: Path = args.images_dir

    if args.source in ("characters", "all"):
        src = args.characters_json
        if not src.exists():
            print(f"characters.json not found: {src}", file=sys.stderr)
            sys.exit(1)
        with src.open("r", encoding="utf-8") as f:
            data = json.load(f)
        out = images_dir / "character_stands"
        for item in data if isinstance(data, list) else []:
            if not isinstance(item, dict):
                continue
            raw_card = item.get("card_id") or item.get("id")  # raw dump: card_id, lib/data: id
            if raw_card is None:
                continue
            card_id = int(raw_card)
            char_id = int(item.get("char_id") or item.get("charId") or card_id // 100)  # card_id encodes char_id as prefix
            jobs.append(Job(
                url=(f"https://gametora.com/images/umamusume/characters/"
                     f"chara_stand_{char_id}_{card_id}.png"),
                dest=out / f"{card_id}.png",
                label=str(card_id),
            ))

    if args.source in ("icons", "all"):
        src = args.characters_json
        if not src.exists():
            print(f"characters.json not found: {src}", file=sys.stderr)
            sys.exit(1)
        with src.open("r", encoding="utf-8") as f:
            data = json.load(f)
        out = images_dir / "character_icons"
        char_ids = sorted({int(cid) for item in data
                           if isinstance(item, dict)
                           for cid in (item.get("char_id") or item.get("charId"),)
                           if cid is not None})
        for char_id in char_ids:  # icons are per character, not per card
            jobs.append(Job(
                url=f"https://gametora.com/images/umamusume/characters/icons/chr_icon_{char_id}.png",
                dest=out / f"{char_id}.png",
                label=str(char_id),
            ))

    if args.source in ("supports", "all"):
        src = args.support_cards_json
        if not src.exists():
            print(f"support_cards.json not found: {src}", file=sys.stderr)
            sys.exit(1)
        ids = _load_ids(src)
        out = images_dir / "support_cards"
        for cid in ids:
            jobs.append(Job(
                url=f"https://media.gametora.com/umamusume/supports/full/{cid}.png",
                dest=out / f"{cid}.png",
                label=str(cid),
            ))

    if args.limit:
        jobs = jobs[: args.limit]
    return jobs


def download_one(job: Job, force: bool, retries: int) -> tuple[str, str]:
    """Returns (label, status) where status is one of: ok | skipped | missing | error:<msg>"""
    if job.dest.exists() and job.dest.stat().st_size > 0 and not force:
        return job.label, "skipped"

    last_err = None
    for attempt in range(retries):
        try:
            req = Request(job.url, headers={"User-Agent": UA, "Referer": "https://gametora.com/"})
            with urlopen(req, timeout=30) as resp:
                if resp.status != 200:
                    raise URLError(f"HTTP {resp.status}")
                data = resp.read()
            if len(data) < 100:
                return job.label, "error:suspiciously-small-response"
            tmp = job.dest.with_suffix(".part")
            tmp.write_bytes(data)
            tmp.replace(job.dest)
            return job.label, "ok"
        except HTTPError as e:
            if e.code == 404:
                return job.label, "missing"
            last_err = f"HTTP {e.code}"
        except (URLError, TimeoutError, OSError) as e:
            last_err = str(e)
        time.sleep(1.5 * (attempt + 1))  # backoff before retry
    return job.label, f"error:{last_err}"


def main() -> int:
    ap = argparse.ArgumentParser(description="Crawl Gametora character + support card images")
    ap.add_argument(
        "--source",
        choices=["all", "characters", "icons", "supports"],
        default="all",
        help="which dataset to crawl (default: all)",
    )
    ap.add_argument("--characters-json", type=Path,
                    default=_default_json("characters.json", "characters.json"))
    ap.add_argument("--support-cards-json", type=Path,
                    default=_default_json("support_cards.json", "cards.json"))
    ap.add_argument("--images-dir", type=Path, default=DEFAULT_IMAGES_DIR,
                    help="base directory for downloaded images")
    ap.add_argument("--workers", type=int, default=8, help="parallel downloads")
    ap.add_argument("--retries", type=int, default=3, help="retries per image")
    ap.add_argument("--delay", type=float, default=0.15, help="delay between starts (seconds)")
    ap.add_argument("--limit", type=int, default=0, help="only crawl first N jobs (0 = all)")
    ap.add_argument("--force", action="store_true", help="re-download even if file exists")
    args = ap.parse_args()

    jobs = build_jobs(args)
    if not jobs:
        print("nothing to crawl", file=sys.stderr)
        return 1
    for job in jobs:
        job.dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"{len(jobs)} downloads")

    counts = {"ok": 0, "skipped": 0, "missing": 0}
    errors: list[tuple[str, str]] = []

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = []
        for job in jobs:
            futures.append(pool.submit(download_one, job, args.force, args.retries))
            if args.delay:
                time.sleep(args.delay)
        for fut in as_completed(futures):
            label, status = fut.result()
            if status == "ok":
                counts["ok"] += 1
            elif status == "skipped":
                counts["skipped"] += 1
            elif status == "missing":
                counts["missing"] += 1
                print(f"  404: {label}")
            else:
                errors.append((label, status))
                print(f"  FAIL: {label} ({status})")

    # log ids with no image per output dir for follow-up
    for out_dir in sorted({job.dest.parent for job in jobs}):
        bad = sorted(job.label for job in jobs
                     if job.dest.parent == out_dir and not job.dest.exists())
        missing_log = out_dir / "images_missing.txt"
        missing_log.write_text("\n".join(bad) + ("\n" if bad else ""))
        if bad:
            print(f"ids without an image written to {missing_log}")

    print(
        f"done: {counts['ok']} downloaded, {counts['skipped']} skipped, "
        f"{counts['missing']} missing, {len(errors)} failed"
    )
    return 0 if not errors else 2


if __name__ == "__main__":
    sys.exit(main())
