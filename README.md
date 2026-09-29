# AlmondEyeDB site

Client-side Uma Musume deck/parenting database built with **vinext** (Next.js on Vite)
and deployed as a **Cloudflare Worker**. Single-route SPA: Main Deck, Parent Deck,
Parenting, Visualizer, Collection, and Trained Umas tabs — all data ships as
pre-processed JSON in `lib/data/generated/`.

## Scripts

- `bun run dev` starts the vinext dev server.
- `bun run build` builds the Cloudflare Worker output from the committed data in `lib/data/generated/`.
- `bun run start` starts the built Worker locally with Wrangler.
- `bun run deploy` bumps the patch version, stamps the footer date, builds, deploys.
- `bun run test` runs the bun test suite.
- `bun run data:refresh` runs the full data-population pipeline (see below).
- `bun run data:build:pvp-recommendations -- path/to/response.json` normalizes
  a captured race-fit assistance response into `lib/data/generated/pvp-recommendations.json`.
- `bun run build:data` regenerates datasets from raw dumps — legacy, only works
  in the old sibling-workspace layout.

## Data pipeline

Each dataset has exactly one owner — no raw↔processed ping-pong. All pipeline
config lives in a gitignored `.env` at the repo root (`UMAMUSUME_MDB_PATH`,
`PYTHON_EXE`, `ICON_API_KEY`, `ICON_API_BASE`, `PVP_RECOMMENDATIONS_SOURCE`).

```
master.mdb ─── extract-mdb.ts ───────────────▶ lib/data/generated/cards.json (index) + affinity.json + careers.json
master.mdb ─── crawl_gametora_characters.py ─▶ lib/data/generated/characters.json (index) + skills.json backfill
GameTora ───── crawl_gametora_characters.py ─▶ lib/data/generated/characters.json in place (EN names, stats, skills)
GameTora ───── crawl_gametora_cards.py ──────▶ lib/data/generated/cards.json in place + skill-meta.json
master.mdb ─── generate_inherit_skills.py ───▶ lib/data/generated/skills-inherit.json + unique-inherit-map.json
GameTora ───── crawl_card_images.py ─────────▶ data/images/ (local only, gitignored)
GameTora ───── fetch-gametora.ts ────────────▶ lib/data/source/gametora/factors.json (EN factor names)
Game response ─ build-pvp-recommendations.ts ▶ lib/data/generated/pvp-recommendations.json (PvP/Master Challenge suggestions)
```

Processed datasets live in `lib/data/generated/`; raw local captures and the
ignored GameTora page cache live in `lib/data/source/`. The generated datasets
are **committed** — Cloudflare builds
never run the pipeline, they just consume the committed JSON. Populate data
locally, commit the `lib/data/generated` diff, and push to deploy.

### Populating data (the usual flow)

Launch the game client once so `master.mdb` picks up the latest game update,
then:

```bash
bun run data:refresh                  # everything: mdb extraction, GameTora
                                      # crawls, inherit skills, name cleanup,
                                      # image assets
bun run data:refresh -- --no-images   # text data only
```

Then commit the `lib/data/generated` diff and push — the Cloudflare build picks it up.

Step details (each script is also runnable standalone):

| Script | Inputs | Outputs |
|---|---|---|
| `scripts/extract-mdb.ts` | game `master.mdb` (SQLite, read-only) + `lib/data/source/gametora/factors.json` | `lib/data/generated/{cards,affinity,careers}.json` |
| `scripts/crawl_gametora_characters.py` | `master.mdb`, `lib/data/generated/{characters,skills}.json`, GameTora | updates `lib/data/generated/{characters,skills}.json` |
| `scripts/crawl_gametora_cards.py` | `lib/data/generated/{cards,skills}.json` + GameTora | updates `cards.json` **in place** (type/nameEn/urlName/hints/eventSkills/eventDetails), writes `skill-meta.json` |
| `scripts/generate_inherit_skills.py` | `master.mdb` | `lib/data/generated/{skills-inherit,unique-inherit-map}.json` |
| `scripts/crawl_card_images.py` | `lib/data/generated/{characters,cards}.json` + GameTora | PNGs into `data/images/` (character stands 512×512 full art + icons 256×256, support card full art; incremental, skips existing) |
| `scripts/upload_card_images.py` | `data/images/` | uploads PNGs to the icon API (R2) using `ICON_API_KEY`/`ICON_API_BASE` from `.env`, records CDN URLs in `data/images/manifest.json` |
| `scripts/fetch-gametora.ts` | GameTora | `lib/data/source/gametora/factors.json` (EN factor names) |
| `scripts/build-pvp-recommendations.ts` | Captured game response JSON | Header-free normalized PvP and Master Challenge suggestions in `lib/data/generated/pvp-recommendations.json` |

For recurring updates, put the response in the gitignored
`lib/data/source/game/pvp-recommendations.json`, or set
`PVP_RECOMMENDATIONS_SOURCE` in the local `.env`. `bun run data:refresh` runs
the converter when the source exists; otherwise it skips the optional step.
The converter also accepts any source path directly. It preserves unknown event
types (including type 2) and raw running-style values, while discarding response
headers such as viewer/session metadata.

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
  `data/images/manifest.json` are uploaded. Character stands upload at
  512×512 under `--char-variant 02` (bump again if cached images must be
  invalidated; uploads are idempotent per key).

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
reading and writing `lib/data/generated/cards.json` directly:

```bash
python scripts/crawl_gametora_cards.py                  # regenerate skill-meta.json only
python scripts/crawl_gametora_cards.py --new-only       # incremental (default in data:refresh)
python scripts/crawl_gametora_cards.py --crawl-all      # full live crawl (all cards)
python scripts/crawl_gametora_cards.py --card-id 30308  # single card
```

## Architecture

```text
app/                         Route, application shell, and app-wide components
  common/ui/                 Cross-feature presentation, grouped by function
    primitives/               Base badges, icons, status indicators, colors
    controls/                  Shared filters, sheets, and search controls
    cards/                     Card type presentation
    skills/                    Skill display, rarity, effects, interactions
      details/                 Condition and skill detail panels
      provenance/              Skill sources, duplicates, event chains
  common/hooks/              Cross-feature React hooks
  components/                Global shell components and providers
features/                    Product workflows, screens, state, and feature UI
  deck/ parenting/ collection/ visualizer/ veterans/ importer/
lib/                         Framework-free domain and data-access modules
  api/                       In-memory data API and store
  data/                      Registry/types plus generated/ and source/ datasets
  IndexDB/                   IndexedDB persistence for veteran records
  deck/ parenting/ skills/ evaluator/ ... domain logic by responsibility
scripts/                     Dataset extraction, normalization, and refresh tools
```

- `app/page.tsx` composes feature entry points. Feature-only UI stays within its
  feature; cross-feature UI and hooks live under `app/common/`.
- `app/common/ui/` is grouped by presentation role: base primitives, controls,
  card presentation, and skill display with separate detail and provenance
  subfolders. Keep tests beside the module they cover.
- Keep pure domain calculations in `lib/` and feature-specific projections in
  the owning feature. UI may depend on `lib/`; `lib/` must not import React or UI.
- `lib/data/generated/` contains processed runtime JSON; `lib/data/source/`
  contains raw captures. `lib/data/registry.ts` is the only runtime JSON importer.
- Large picker state uses `app/common/hooks/use-picker-controller.ts`; each
  feature owns its reducer, selectors, and view model.
- Effect classification lives in `lib/evaluator/effects.ts`; share links use
  the V4 codec in `lib/share-link/`.
- See `CLAUDE.md` for detailed architecture and data-pipeline invariants.

## Verification

1. `npx tsc --noEmit` clean.
2. `bun test` green.
3. `bun run build`, then `bun run start` + check the tabs render.
