# AlmondEyeDB site

Client-side Uma Musume deck/parenting database built with **vinext** (Next.js on Vite)
and deployed as a **Cloudflare Worker**. Single-route SPA: Main Deck, Parent Deck,
Parenting, Visualizer, Collection, and Trained Umas tabs — all data ships as
pre-processed JSON in `lib/data/`.

## Scripts

- `bun run dev` starts the vinext dev server.
- `bun run build` builds the Cloudflare Worker output (`prebuild` regenerates the data).
- `bun run start` starts the built Worker locally with Wrangler.
- `bun run deploy` bumps the patch version, stamps the footer date, builds, deploys.
- `bun run test` runs the bun test suite.
- `bun run build:data` regenerates the datasets without building (see below).

## Data pipeline

Each dataset has exactly one owner — no raw↔processed ping-pong:

```
master.mdb ─── extract-mdb.ts ──▶ lib/data/cards.json (index)   + affinity.json + careers.json
raw JSONs ─── generate-data.ts ─▶ lib/data/{skills,characters,racetracks}.json
GameTora ──── crawl_gametora_cards.py ── reads/updates lib/data/cards.json in place
                                     └──▶ lib/data/skill-meta.json
hachimi ───── merged into names at the source; factors.json (EN) via fetch:gametora
```

| Owner | Inputs | Outputs |
|---|---|---|
| `scripts/extract-mdb.ts` | game `master.mdb` (SQLite, read-only) + hachimi | card index in `cards.json` (new cards, rarity, release, JP names), `affinity.json`, `careers.json` |
| `scripts/generate-data.ts` | `../skills.json`, `../characters.json`, `../data/racetracks_raw.json` | `skills.json` (with `tags`), `characters.json`, `racetracks.json`, Hachimi skill-name patch |
| `scripts/crawl_gametora_cards.py` (repo root) | `lib/data/cards.json` + `skills.json` + GameTora | updates `cards.json` **in place** (type/nameEn/urlName/hints/eventSkills/eventDetails), writes `skill-meta.json` |
| `scripts/fetch-gametora.ts` | GameTora | `data-source/gametora/factors.json` (EN factor names — the only crawl input extract-mdb overlays) |

### master.mdb

`extract-mdb.ts` queries the game's own SQLite database directly. Path resolution:
`$UMAMUSUME_MDB_PATH`, else the local CrossOver/Steam install
(`~/Library/Application Support/CrossOver/Bottles/Steam/drive_c/.../Persistent/master/master.mdb`).
The file is opened read-only; launch the game client once to refresh it. Extracted
relations: `succession_relation`(+`_member`), `single_mode_wins_saddle`;
careers: `single_mode_route(_race)` → `single_mode_program` → `race_instance` →
`race` → `race_course_set`; card names: `text_data` cat 75/76/77.

### GameTora card crawl

Cards' training type, English names, URL slugs, hints and event details are **not
in master.mdb** — `crawl_gametora_cards.py` fills exactly those fields, reading and
writing `lib/data/cards.json` directly (new cards get their slug resolved from the
supports listing page):

```bash
python3 scripts/crawl_gametora_cards.py                  # regenerate skill-meta.json only
python3 scripts/crawl_gametora_cards.py --crawl-all      # full live crawl (all cards)
python3 scripts/crawl_gametora_cards.py --card-id 30308  # single card
```

Run `bun run build:data` afterwards only if you want a clean rebuild of the other
datasets — the crawl result is already saved in place.

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
3. `bun run build` (runs the data pipeline via `prebuild`), then
   `bun run start` + check the tabs render.
