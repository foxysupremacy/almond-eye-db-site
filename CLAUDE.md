# AlmondEye DB — Deck Builder + Skill Zones (vinext)

Frontend for the AlmondEye DB API. Build a 6-card support deck, list the skills it
grants, and visualize where each skill activates on any race course.

## Stack & commands

- **vinext** (Cloudflare fork of Next.js, Vite-based App Router) + **Tailwind CSS v4**
  (`@import "tailwindcss"` in `app/globals.css`). Package manager is **bun**.
- `bun run dev` → http://localhost:3000 · `bun run build` (vinext prod build) ·
  `bun run start` / `bun run deploy` (wrangler).
- Typecheck: `npx tsc --noEmit`. Build is the real gate (`vinext build`).

## Architecture

Two-tab client app on one route (`app/page.tsx`, a `"use client"` component).

- **Tab "Deck"**: `components/deck-picker.tsx` (6-slot grid) +
  `components/card-picker-popover.tsx` (searchable, sortable list of all cards) +
  `components/skill-list.tsx` (union of granted skills).
- **Tab "Visualizer"**: `components/track-view.tsx` — venue/course selects, a
  clickable deck-skill list (triggerable ones tinted green), and the track SVG
  with the selected skill's activation zones overlaid.
- **State**: `components/store.tsx` — `DeckProvider` + `useDeck()`. Holds the 6
  card slots, caches each card's skills, and derives the union skill list.

### Persistence (localStorage)

| Key | Content |
|---|---|
| `deck.v1` | array of 6 card ids (or null) — the deck |
| `visualizer.v1` | `{ trackId, courseId, skillId }` — last visualizer selection |
| `runningStyle.v1` | `1|2|3|4|5` — global running-style filter (shared by both tabs) |

Both restore on load. The visualizer validates saved ids against live data
(course must belong to venue, skill must be in the deck) and falls back to a
sensible default otherwise. Add new persisted state with this pattern: read via a
`readPrefs()` that guards `typeof window === "undefined"`, save in a `useEffect`,
validate saved values against fetched data before trusting them.

### Data Store (`lib/data-store.ts`, `lib/api.ts`)

Self-contained in-memory dataset loaded via Vite dynamic imports (`lib/data/`). Zero remote API backend dependencies.
- **Support Cards**: all 553 cards (id, names, rarity, type, eventSkills, hintSkills).
- **Skills**: all 1,886 skills (id, names, rarity, descriptions, conditionGroups).
- **Racetracks**: 17 venues + 138 courses with full geometric data.
- **Images**: On-demand lazy fetching from CDN (`https://cdn.almond-eye.tech`, override via `NEXT_PUBLIC_CDN_URL`) using `getCardImageUrl(id, 'art' | 'portrait')`.
- Data is pre-processed and generated via `bun run build:data` (`scripts/generate-data.ts`), which automatically runs on `prebuild`.
- `lib/api.ts` provides backward-compatible in-memory adapters and course helpers (`flattenCourse`, `distanceLabel`, `terrainLabel`, `turnLabel`).

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

## Verification

1. `npx tsc --noEmit` clean.
2. `bun run build` passes.
3. Manual: deck pick/search/sort, deck persists across reload, visualizer
   selection persists, triggerable tint matches zones on the selected course,
   clicking a skill draws its ruler bands.

## Reference material (in `../`, outside this repo)

- `../track_visualizer.html` — the original single-file renderer this app ports.
- `../docs/references/Uma Musume Race Mechanics.md` — phase/section/condition vocabulary.
- `../uma-tools/uma-skill-tools/` — the reference engine (Region, ConditionParser,
  ActivationConditions, CourseData, ActivationSamplePolicy).
- `../almond-eye-db-api/README.md` — the API surface + seed pipeline.
- `../skills.json` / `../support_cards.json` — upstream source data.
