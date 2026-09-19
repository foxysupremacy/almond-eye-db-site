# AlmondEyeDB site

Client-side Uma Musume deck/parenting database built with **vinext** (Next.js on Vite)
and deployed as a **Cloudflare Worker**. Single-route SPA: Main Deck, Parent Deck,
Parenting, Visualizer, Collection, and Trained Umas tabs — all data ships as
pre-processed JSON in `lib/data/`.

## Scripts

- `bun run dev` starts the vinext dev server.
- `bun run build` builds the Cloudflare Worker output from the committed data in `lib/data/`.
- `bun run start` starts the built Worker locally with Wrangler.
- `bun run deploy` bumps the patch version, stamps the footer date, builds, deploys.
- `bun run test` runs the bun test suite.
- `bun run data:refresh` runs the full data-population pipeline (see below).
- `bun run build:data` regenerates datasets from raw dumps — legacy, only works
  in the old sibling-workspace layout.

## Data pipeline

Each dataset has exactly one owner — no raw↔processed ping-pong. All pipeline
config lives in a gitignored `.env` at the repo root (`UMAMUSUME_MDB_PATH`,
`PYTHON_EXE`, `ICON_API_KEY`, `ICON_API_BASE`).

```
master.mdb ─── extract-mdb.ts ───────────────▶ lib/data/cards.json (index) + affinity.json + careers.json
master.mdb ─── crawl_gametora_characters.py ─▶ lib/data/characters.json (index) + skills.json backfill
GameTora ───── crawl_gametora_characters.py ─▶ lib/data/characters.json in place (EN names, stats, skills)
GameTora ───── crawl_gametora_cards.py ──────▶ lib/data/cards.json in place + skill-meta.json
master.mdb ─── generate_inherit_skills.py ───▶ lib/data/skills-inherit.json + unique-inherit-map.json
GameTora ───── crawl_card_images.py ─────────▶ data/images/ (local only, gitignored)
GameTora ───── fetch-gametora.ts ────────────▶ data-source/gametora/factors.json (EN factor names)
```

The generated datasets in `lib/data/` are **committed** — Cloudflare builds
never run the pipeline, they just consume the committed JSON. Populate data
locally, commit the `lib/data` diff, and push to deploy.

### Populating data (the usual flow)

Launch the game client once so `master.mdb` picks up the latest game update,
then:

```bash
bun run data:refresh                  # everything: mdb extraction, GameTora
                                      # crawls, inherit skills, name cleanup,
                                      # image assets
bun run data:refresh -- --no-images   # text data only
```

Then commit the `lib/data` diff and push — the Cloudflare build picks it up.

Step details (each script is also runnable standalone):

| Script | Inputs | Outputs |
|---|---|---|
| `scripts/extract-mdb.ts` | game `master.mdb` (SQLite, read-only) + `data-source/gametora/factors.json` | card index in `cards.json` (new cards, rarity, release, JP names), `affinity.json`, `careers.json` |
| `scripts/crawl_gametora_characters.py` | `master.mdb`, `lib/data/{characters,skills}.json`, GameTora | new playable characters into `characters.json` (JP skeleton from mdb, EN names/stats/aptitudes/skill ids from GameTora), missing skills backfilled into `skills.json` from mdb |
| `scripts/crawl_gametora_cards.py` | `lib/data/cards.json` + `skills.json` + GameTora | updates `cards.json` **in place** (type/nameEn/urlName/hints/eventSkills/eventDetails), writes `skill-meta.json` |
| `scripts/generate_inherit_skills.py` | `master.mdb` | `skills-inherit.json`, `unique-inherit-map.json` |
| `scripts/crawl_card_images.py` | `lib/data/{characters,cards}.json` + GameTora | PNGs into `data/images/` (character stands 128×128 + icons 256×256, support card full art; incremental, skips existing) |
| `scripts/upload_card_images.py` | `data/images/` | uploads PNGs to the icon API (R2) using `ICON_API_KEY`/`ICON_API_BASE` from `.env`, records CDN URLs in `data/images/manifest.json` |
| `scripts/fetch-gametora.ts` | GameTora | `data-source/gametora/factors.json` (EN factor names) |

### Notes

- **Slug resolution**: GameTora's listing pages are client-rendered; slugs for
  new cards/characters are resolved from GameTora's **sitemap** instead.
- **Incremental by default**: the card and character crawlers only fetch
  entries never crawled; `--crawl-all` / `--all` forces a full refresh,
  `--card-id N` tests a single entry.
- **English for brand-new skills**: a new unique skill is backfilled into
  `skills.json` with JP name/description and full condition groups from mdb.
  EN names/descriptions for those arrive only when the legacy raw dumps
  (`../skills.json`, hachimi) are refreshed via `bun run build:data` in the old
  workspace layout — until then the site falls back to JP.
- **Image uploads**: after crawling new character/card images, run
  `python scripts/upload_card_images.py --source all` (requires `ICON_API_KEY`
  and `ICON_API_BASE` in `.env`). Only images missing from
  `data/images/manifest.json` are uploaded.

### master.mdb

The pipeline queries the game's own SQLite database directly; the path comes
from `UMAMUSUME_MDB_PATH` in `.env`. The file is opened read-only; launch the
game client once to refresh it. Extracted relations:
`succession_relation`(+`_member`), `single_mode_wins_saddle`; careers:
`single_mode_route(_race)` → `single_mode_program` → `race_instance` → `race` →
`race_course_set`; card names: `text_data` cat 75/76/77.

### GameTora card crawl

Cards' training type, English names, URL slugs, hints and event details are
**not in master.mdb** — `crawl_gametora_cards.py` fills exactly those fields,
reading and writing `lib/data/cards.json` directly:

```bash
python scripts/crawl_gametora_cards.py                  # regenerate skill-meta.json only
python scripts/crawl_gametora_cards.py --new-only       # incremental (default in data:refresh)
python scripts/crawl_gametora_cards.py --crawl-all      # full live crawl (all cards)
python scripts/crawl_gametora_cards.py --card-id 30308  # single card
```

## Architecture notes

- `lib/data/registry.ts` is the **only** module allowed to import game JSON; all
  consumers use its typed lookup maps (`lib/data/types.ts` is the pipeline contract).
- Strict layering: `components → lib`, never the reverse.
- All effect-classification magic numbers live in one table,
  `lib/evaluator/effects.ts#classifyEffect`.
- Share links encode with codec V3 (`lib/share-codec.ts`); legacy V1/V2 links keep
  decoding forever.
- See `CLAUDE.md` for the full invariant list.

## Verification

1. `bunx tsc --noEmit` clean.
2. `bun test` green (one known pre-existing failure may exist: the rec-engine test
   expecting event 1311 → skill 200021 for card 30308 — GameTora renamed event IDs,
   the pipeline itself is fine).
3. `bun run build`, then `bun run start` + check the tabs render.
