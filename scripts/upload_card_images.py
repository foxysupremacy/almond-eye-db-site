#!/usr/bin/env python3
"""
Upload character + support-card images to the icon API (which stores them in
the R2 "chara_icons" bucket) and record the returned CDN URLs in the local DB.

Sources (pick with --source, default: supports for back-compat):

  supports      support_cards.json
    full art    data/images/support_cards/{id}.png
                -> POST {API_BASE}/{version}/icon/support/{id}/{id}?variant=01

  characters    characters.json
    stand       data/images/character_stands/{card_id}.png  (512x512 full art)
                -> POST {API_BASE}/{version}/icon/{char-category}/{card_id}/{char_id}?variant=NN

Headers: x-api-key (env ICON_API_KEY or .env), Content-Type: image/png
Extra:   Cache-Control: public, max-age=31536000, immutable  (1 year)
Body:    raw PNG bytes

Response JSON: { "key": ..., "url": "https://cdn.almond-eye.tech/..." }

URLs are written two places:
  1. data/images/manifest.json   ({ cardId: { img, portrait } })  — survives re-seed
  2. support_cards.img_url / portrait_url columns in data/app.sqlite (if DB exists)
     (characters have no DB table yet — manifest only)

Usage:
    python3 scripts/upload_card_images.py                        # support cards (default)
    python3 scripts/upload_card_images.py --source characters
    python3 scripts/upload_card_images.py --source all
    python3 scripts/upload_card_images.py --db-only              # apply manifest.json to DB
    python3 scripts/upload_card_images.py --limit 5 --force
"""

import argparse
import json
import os
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if not (ROOT_DIR / "support_cards.json").exists() and (ROOT_DIR.parent / "support_cards.json").exists():
    ROOT_DIR = ROOT_DIR.parent

API_DIR = ROOT_DIR / "almond-eye-db-api" if (ROOT_DIR / "almond-eye-db-api").is_dir() else ROOT_DIR

DEFAULT_IMAGES_DIR = (
    (API_DIR / "data" / "images")
    if (API_DIR / "data" / "images").exists()
    else (ROOT_DIR / "data" / "images")
)
DEFAULT_MANIFEST = DEFAULT_IMAGES_DIR / "manifest.json"
DEFAULT_DB = API_DIR / "data" / "app.sqlite"


@dataclass(frozen=True)
class Task:
    manifest_key: str   # key in manifest.json
    field: str          # manifest field: img | portrait
    category: str       # icon API category segment (support | character)
    upload_id: int      # {id} in the URL path
    base_id: int        # {baseId} in the URL path
    variant: str        # 01 | 02
    png: Path
    folder: str = ""    # R2 folder override (chara_stand -> assets/chara_stand/...); "" = API default


CACHE_CONTROL = "public, max-age=31536000, immutable"  # 1 year

# Browser-like UA — Cloudflare Bot Fight Mode (error 1010) rejects
# default python-urllib TLS/UA signatures.
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)


def _load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_support_tasks(images_dir: Path, cards_json: Path) -> list[Task]:
    data = _load_json(cards_json)
    if isinstance(data, list):
        ids = [item.get("support_id") or item.get("id") for item in data if isinstance(item, dict)]
        ids = sorted(int(cid) for cid in ids if cid is not None)
    else:
        ids = sorted(int(k) for k in data.keys() if str(k).isdigit())
    return [
        Task(str(cid), "img", "support", cid, cid, "01", images_dir / "support_cards" / f"{cid}.png")
        for cid in ids
    ]


def load_character_tasks(images_dir: Path, characters_json: Path, category: str, variant: str) -> list[Task]:
    data = _load_json(characters_json)
    out = images_dir / "character_stands"
    tasks = []
    for item in data if isinstance(data, list) else []:
        if not isinstance(item, dict):
            continue
        raw_card = item.get("card_id") or item.get("id")
        if raw_card is None:
            continue
        card_id = int(raw_card)
        char_id = int(item.get("char_id") or item.get("charId") or card_id // 100)  # card_id encodes char_id as prefix
        tasks.append(Task(str(card_id), "img", category, card_id, char_id, variant, out / f"{card_id}.png",
                          folder="chara_stand"))
    return tasks


def load_dotenv(path: Path) -> dict[str, str]:
    out = {}
    if not path.exists():
        return out
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip().strip("'\"")
    return out


def describe_http_error(e: urllib.error.HTTPError) -> str:
    """Extract as much diagnostic info as possible from an HTTPError."""
    body = ""
    try:
        body = e.read().decode(errors="replace")
    except Exception:
        pass
    # Cloudflare blocks return an HTML page containing "error code: NNNN"
    cf_code = None
    m = re.search(r"error code:\s*(\d+)", body, re.IGNORECASE)
    if m:
        cf_code = m.group(1)
    cf_ray = e.headers.get("cf-ray", "") if e.headers else ""
    server = e.headers.get("server", "") if e.headers else ""
    parts = [f"HTTP {e.code}"]
    if cf_code:
        parts.append(f"cloudflare error {cf_code} ({CF_ERROR_CODES.get(cf_code, 'unknown')})")
    if cf_ray:
        parts.append(f"cf-ray={cf_ray}")
    if server:
        parts.append(f"server={server}")
    snippet = " ".join(body.split())[:200]
    if snippet:
        parts.append(f"body: {snippet}")
    return "; ".join(parts)


CF_ERROR_CODES = {
    "1000": "DNS points to prohibited IP",
    "1001": "DNS resolution error",
    "1010": "Access denied — browser signature/TLS fingerprint banned (Bot Fight Mode or a Browser Integrity Check rule is rejecting the client; urllib's TLS fingerprint is a common trigger)",
    "1012": "Access denied — DNS points to a banned IP",
    "1015": "Rate limited",
    "1020": "Access denied — firewall rule",
    "1101": "Worker threw a JavaScript exception",
    "1102": "Worker exceeded resource limits",
}


def post_image(url: str, api_key: str, png: bytes, retries: int) -> dict:
    """POST raw PNG, return parsed JSON response."""
    last_err = None
    for attempt in range(1, retries + 1):
        req = urllib.request.Request(
            url,
            data=png,
            method="POST",
            headers={
                "x-api-key": api_key,
                "Content-Type": "image/png",
                "Cache-Control": CACHE_CONTROL,
                "User-Agent": UA,
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            desc = describe_http_error(e)
            if e.code < 500:  # 4xx won't get better on retry
                raise RuntimeError(f"attempt {attempt}/{retries} {desc}") from e
            last_err = f"attempt {attempt}/{retries} {desc}"
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_err = f"attempt {attempt}/{retries} {type(e).__name__}: {e}"
        time.sleep(1.5 * attempt)
    raise RuntimeError(f"retries exhausted [{url}]: {last_err}")


def update_db(db_path: Path, card_id: int, column: str, url: str) -> None:
    if not db_path or not db_path.exists():
        return
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            f"UPDATE support_cards SET {column} = ? WHERE id = ?", (url, card_id)
        )
        conn.commit()
    finally:
        conn.close()


def apply_manifest_to_db(db_path: Path, manifest_path: Path) -> int:
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    if not db_path or not db_path.exists():
        return 0
    conn = sqlite3.connect(db_path)
    try:
        n = 0
        for card_id, urls in manifest.items():
            img = urls.get("img")
            portrait = urls.get("portrait")
            if not img and not portrait:
                continue
            conn.execute(
                "UPDATE support_cards SET img_url = COALESCE(?, img_url), portrait_url = COALESCE(?, portrait_url) WHERE id = ?",
                (img, portrait, int(card_id)),
            )
            n += 1
        conn.commit()
    finally:
        conn.close()
    return n


def _default_json(raw_name: str, lib_name: str) -> Path:
    """Site lib/data file if present, else raw sibling-workspace dump."""
    site_file = Path(__file__).resolve().parent.parent / "lib" / "data" / lib_name
    if site_file.exists():
        return site_file
    raw = ROOT_DIR / raw_name
    if raw.exists():
        return raw
    return ROOT_DIR / "lib" / "data" / lib_name


def main() -> int:
    ap = argparse.ArgumentParser(description="Upload card images to icon API, save CDN URLs to manifest and DB")
    ap.add_argument(
        "--source",
        choices=["supports", "characters", "all"],
        default="supports",
        help="which dataset to upload (default: supports)",
    )
    ap.add_argument("--characters-json", type=Path,
                    default=_default_json("characters.json", "characters.json"))
    ap.add_argument("--support-cards-json", "--cards", dest="support_cards_json", type=Path,
                    default=_default_json("support_cards.json", "cards.json"))
    ap.add_argument(
        "--images-dir",
        type=Path,
        default=DEFAULT_IMAGES_DIR,
        help="base directory for images",
    )
    ap.add_argument(
        "--char-category",
        default=os.environ.get("ICON_CHAR_CATEGORY", "chara"),
        help="icon API category for character stands",
    )
    ap.add_argument(
        "--char-variant",
        default="02",
        help="variant for character stands; bumped to 02 when switching from "
             "the 128x128 thumbs to 512x512 full art so old cached images are "
             "not served (upload is idempotent per key)",
    )
    ap.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB,
        help="path to app.sqlite (optional; syncs URLs if DB exists)",
    )
    ap.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    ap.add_argument("--base", default=os.environ.get("ICON_API_BASE", ""), help="e.g. https://api.almond-eye.tech")
    ap.add_argument("--version", default=os.environ.get("ICON_API_VERSION", "jp"))
    ap.add_argument("--limit", type=int, default=0, help="only first N uploads (0 = all)")
    ap.add_argument("--force", action="store_true", help="re-upload even if manifest already has URLs")
    ap.add_argument("--db-only", action="store_true", help="skip uploads; apply manifest.json to DB and exit")
    ap.add_argument("--retries", type=int, default=3)
    args = ap.parse_args()

    if args.db_only:
        if not args.db.exists():
            print(f"DB not found: {args.db}\nRun `bun run seed` first.", file=sys.stderr)
            return 1
        if not args.manifest.exists():
            print(f"manifest not found: {args.manifest}", file=sys.stderr)
            return 1
        n = apply_manifest_to_db(args.db, args.manifest)
        print(f"applied {n} entries from {args.manifest} to {args.db}")
        return 0

    tasks: list[Task] = []
    if args.source in ("supports", "all"):
        if not args.support_cards_json.exists():
            print(f"support_cards.json not found: {args.support_cards_json}", file=sys.stderr)
            return 1
        tasks += load_support_tasks(args.images_dir, args.support_cards_json)
    if args.source in ("characters", "all"):
        if not args.characters_json.exists():
            print(f"characters.json not found: {args.characters_json}", file=sys.stderr)
            return 1
        tasks += load_character_tasks(args.images_dir, args.characters_json, args.char_category, args.char_variant)

    env = {
        **load_dotenv(ROOT_DIR / ".env"),
        **load_dotenv(API_DIR / ".env"),
        **{k: v for k, v in os.environ.items() if k.startswith("ICON_")},
    }
    api_key = env.get("ICON_API_KEY", "")
    base = args.base or env.get("ICON_API_BASE", "")
    if not api_key:
        print("ICON_API_KEY missing — put it in almond-eye-db-api/.env or .env", file=sys.stderr)
        return 1
    if not base:
        print("ICON_API_BASE missing — e.g. https://api.almond-eye.tech in .env", file=sys.stderr)
        return 1
    base = base.rstrip("/")

    manifest: dict[str, dict[str, str]] = (
        json.loads(args.manifest.read_text()) if args.manifest.exists() else {}
    )

    # filter: file must exist, URL must be missing (unless --force)
    todo = [
        t for t in tasks
        if t.png.exists() and (args.force or not manifest.get(t.manifest_key, {}).get(t.field))
    ]
    if args.limit:
        todo = todo[: args.limit]

    total = len(todo)
    print(f"{len(tasks)} candidate uploads, {total} to do (rest already in manifest)")
    if total == 0:
        if args.db and args.db.exists():
            n = apply_manifest_to_db(args.db, args.manifest)
            print(f"applied manifest to DB ({n} entries)")
        else:
            print("all uploads already in manifest")
        return 0

    failures: list[str] = []
    ok = 0
    # small thread pool speeds up over-the-wire time; manifest writes stay serial here
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {}
        for t in todo:
            url = f"{base}/{args.version}/icon/{t.category}/{t.upload_id}/{t.base_id}?variant={t.variant}"
            if t.folder:
                url += f"&folder={t.folder}"
            futures[pool.submit(post_image, url, api_key, t.png.read_bytes(), args.retries)] = t
        for fut in as_completed(futures):
            t = futures[fut]
            try:
                resp = fut.result()
                cdn_url = resp.get("url")
                if not cdn_url:
                    raise RuntimeError(f"response missing url: {resp}")
                manifest.setdefault(t.manifest_key, {})[t.field] = cdn_url
                args.manifest.write_text(json.dumps(manifest, indent=2, sort_keys=True))
                if args.db and args.db.exists() and t.category == "support":
                    update_db(args.db, t.upload_id, "img_url", cdn_url)
                ok += 1
                if ok % 25 == 0 or ok == total:
                    print(f"  {ok}/{total} uploaded")
            except Exception as e:
                failures.append(f"{t.category}/{t.png.name}: {e}")
                print(f"  FAIL {t.png.name}: {e}")

    print(f"done: {ok} uploaded, {len(failures)} failed")
    if failures:
        print("\n".join(failures[:20]))
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
