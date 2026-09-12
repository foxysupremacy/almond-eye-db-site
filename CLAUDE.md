# AlmondEye DB — Deck Builder + Skill Zones (vinext)

Client-side deck builder for Uma Musume support cards: build a 6-card Main
Deck + Parent Deck, list the skills they grant, plan the Parenting Hub
pedigree, and visualize where each skill activates on any race course.
Zero remote API at runtime — all game data ships as pre-processed JSON.

## Stack & commands

- **vinext** (Cloudflare fork of Next.js, Vite-based App Router) + **Tailwind CSS v4**
  (`@import "tailwindcss"` in `app/globals.css`). Package manager is **bun**.
  There is no separate Next or Vite config to maintain — `vite.config.ts` wires
  the vinext + Cloudflare plugins.
- `bun run dev` → http://localhost:3000 · `bun run build` (vinext prod build) ·
  `bun run start` / `bun run deploy` (wrangler).
- Tests: `bun test` (bun:test, 20+ files). Typecheck: `npx tsc --noEmit`.
  Build is the real gate (`vinext build`).

## Architecture

Single-route client app (`app/page.tsx`, a `"use client"` shell) rendering six
tabs — Main Deck, Parent Deck, Parenting, Visualizer, Collection, Trained
Umas — inside one `DeckProvider`.

Dependency direction is strict: **components → lib**, never lib → components.
Deck types/constants live in `lib/deck/*`; components/store.tsx only wires React.

- **State**: `components/store.tsx` — `DeckProvider` + `useDeck()`. A thin
  adapter over the pure reducer in `lib/deck/preset-reducer.ts` (all preset
  mutation semantics live there, testable without React). Derived deck data
  comes from `lib/deck/skill-resolver.ts`; same-uma slot constraints from
  `lib/deck/card-constraints.ts`.
- **Parenting state**: `lib/parenting-state.ts` — its own domain hook
  (`useParentingSetup`) with its own storage key, built on the same
  persistence pattern (see below).
- **Share links**: `lib/share-codec.ts` — bit-packed codec. V3 (current)
  wraps the field payload in a CORE section; future fields ship as extension
  sections that decoders skip. Legacy V1/V2 links must decode forever (pinned
  by tests). `#share` links are user-facing — never break them.

### Data gateway (IMPORTANT)

`lib/data/registry.ts` is the **only** module allowed to import game JSON
(`lib/data/*.json`, `lib/card-data.json`, `lib/gold-to-white.json`). It
hydrates cards/characters/skills(+inherited uniques) with CDN image URLs and
exposes canonical lookup maps. `lib/data/types.ts` is the typed contract with
the data pipeline — update it together with `scripts/generate-data.ts` /
`scripts/extract-affinity.ts`.

- `lib/data-store.ts` — async facade over the registry adding the `DataStore`
  Maps + `getCardSkills` metadata computation. Only `racetracks.json` stays a
  dynamic import (code-splitting).
- `lib/api.ts` — legacy in-memory adapter surface over data-store
  (`api.listCardIndex()` etc.) plus course helpers (`flattenCourse`,
  `distanceLabel`, `terrainLabel`, `turnLabel`).
- Skill evaluation has one classification table: `lib/evaluator/effects.ts`
  (`classifyEffect`). `evaluateSkillForTrack` (`lib/evaluator/evaluator.ts`,
  public entry `lib/evaluator/index.ts`) and `classifySkillEffects`
  (`lib/skill-effects.ts`) both consume it — do not fork the table again.
- Card/character → skill grant indexers: `lib/data/skill-grants.ts`.

### Persistence (localStorage)

Shared helpers in `lib/persistence.ts` (guarded JSON read/write + same-tab &
cross-tab notify via `notifyLocalUpdate` / `subscribeLocalUpdates`). Domains:

| Key | Content |
|---|---|
| `presets.v2` | `DeckPreset[]` — all builds (main/parent decks, track, chain choices) |
| `visualizer.v1` | `{ trackId, courseId, racerCount }` — last visualizer selection |
| `chain_choices.v1` | LEGACY — one-time migrated into the active preset, then retired |
| `almondeye_parenting_setup` | Parenting Hub setup (trainee, parents, GP overrides, deck) |

Validate saved values before trusting them (`loadStoredPresets` is the
reference implementation).

## Skill-zone engine (`lib/skill-engine/`)

Pure TS, no deps. A faithful port of `uma-tools/uma-skill-tools` (Region/RegionList,
Pratt `ConditionParser`, `ActivationConditions` map), adapted to the **flat DB
course shape**: corners/slopes carry `start`+`end` (NOT `length`), phases come
from the course's explicit `phases[]` (fallback formula 1/6·2/3·5/6), stat
conditions evaluate against a fixed max-stat horse (HORSE in `zones.ts`).

- `types.ts` — `Course`, `HorseParameters`, `RaceParameters`, `Condition`, `Operator`.
- `parser.ts` — `getParser(conditions, operators)`; grammar `cond == N`, `&` = AND,
  `@` = OR (no parens, `@` binds loosest). Parse errors are thrown — callers catch.
- `conditions.ts` — the `Conditions` map. **Simulation-only conditions (order,
  near_count, hp_per, is_badstart, …) are pass-through noops so they never zero a
  zone.** `_random` conditions handle `==N` (specific band) and boolean-exists
  forms (`>0`, `>=0`, `<1`, `!=0`) via the union of candidate regions.
- `zones.ts` — `computeZones(course, condition, precondition)` →
  `{ regions, isRandom, earliestFire }`; `computeAllZones` for all groups.
- `describe.ts` — `describeCondition(cond, precond, racerCount?)` renders a
  condition string into a human-readable English phrase (keyword dictionary,
  `&`→"and", `@`→"or", raw-text fallback, never throws). Used by the
  visualizer's per-skill lines. `order_rate` conditions render as exact position
  phrases computed from a racer count (`racerCount?` arg, default 12, clamped to
  [9,18]): `order_rate<=50` @ 12 → "Position 6 or better".

**Important gotchas for editing the engine:**
- Course geometry fields use `{start, end}`; do NOT "fix" them to `{start, length}`
  — that's the uma-tools shape and will break everything downstream.
- `CourseHelpers.assertIsPhase` is intentionally a plain `(phase: number) => void`
  validator (not an `asserts` function) — call sites pass parser numbers.
- `_random` boolean comparators have custom `filterGt/Gte/Lt/Lte/Neq` beyond the
  default `notSupported` — don't replace them with the shared defaults.

## Track renderer (`lib/track-render.ts`)

Browser-only SVG builder ported from `track_visualizer.html` (itself a port of
uma-tools `RaceTrack.tsx`). Builds DOM nodes via `createElementNS` (no JSX).

- `renderCourse(host, course, { zones })` — elevation, slope, straight/corner,
  phase bands + ruler (1–24) + meter hover. Appends to `host`, clears it first.
- `renderSkillOverlay(inner, course, zones)` — tinted bands on the ruler
  (82%–100%); random triggers use dashed outlines, deterministic solid.
- `ZONE_COLORS` is the per-trigger tint palette.
- Call it from a `"use client"` effect; SVG classes (.racetrackView,
  .mouseoverText, etc.) have minimal styles in `app/globals.css`.

## Design language

Warm ink-on-paper editorial-tool palette (from `track_visualizer.html`):
`--paper: #f5f2ec`, ink `#2b2b2b`, accent `#794016`. Tailwind utilities with
zinc grays + emerald for "triggerable", amber/sky/violet for rarity. No fancy
motion — hierarchy + legibility matter here.

### Component Design System (`DESIGN.md`)
Refer to `DESIGN.md` for UI/UX specifications on skill presentations:
- **Bilingual Display Hierarchy**: English translated name is always primary on top; original Japanese name is secondary directly underneath (`mt-0.5`, muted `text-zinc-400 dark:text-zinc-500`, smaller font size). Never place them side-by-side.
- **Icon Centering**: The skill icon must be vertically centered (`items-center`) against the combined 2-line title block, never aligned to the top line (`items-start`).
- **Interactive Wrapping**: `SkillHoverCard` wraps both the centered icon and the 2-line title container as a single interactive trigger.
- Shared picker scaffolding lives in `components/shared/` (e.g.
  `picker-search-bar.tsx`); display metadata shared across pickers lives in
  lib (`RARITY_META` in `lib/skill-rarity.ts`, `EFFECT_CATEGORIES` in
  `lib/skill-effects.ts`) — never inside a sibling component.

## Data pipeline & external dependencies

- `bun run build:data` (`scripts/generate-data.ts` + `scripts/extract-affinity.ts`,
  auto-run on `prebuild`) generates `lib/data/*.json` and patches
  `lib/card-data.json` with Hachimi translations. Card name EN output strips
  the `[Title] ` bracket group at the source.
- **Hidden build preconditions (outside this repo)**: `scripts/extract-affinity.ts`
  reads `../../hakuraku/public/data/umdb.json`; `scripts/generate-data.ts` reads
  `../support_cards.json`, `../skills.json`, `../data/racetracks_raw.json`.
  GameTora source URLs in `scripts/fetch-gametora.ts` embed content hashes that
  must be refreshed manually per scrape.

## Verification

1. `npx tsc --noEmit` clean.
2. `bun test` green (one known pre-existing failure may exist: rec-engine
   "attaches event metadata … card 30308" — upstream data drift, tracked
   separately).
3. `bun run build` passes.
4. Manual: deck pick/search/sort, deck persists across reload, visualizer
   selection persists, triggerable tint matches zones on the selected course,
   clicking a skill draws its ruler bands, share-link round-trip (old links
   included) and Parenting Hub state persistence.

## Reference material (in `../`, outside this repo)

- `../track_visualizer.html` — the original single-file renderer this app ports.
- `../docs/references/Uma Musume Race Mechanics.md` — phase/section/condition vocabulary.
- `../uma-tools/uma-skill-tools/` — the reference engine (Region, ConditionParser,
  ActivationConditions, CourseData, ActivationSamplePolicy).
- `../skills.json` / `../support_cards.json` — upstream source data.
