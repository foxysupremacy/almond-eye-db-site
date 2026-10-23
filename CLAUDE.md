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
- `bun run cf-typegen` (generates `worker-configuration.d.ts`). Run `bun run cf-typegen` / `npx wrangler types` after changing bindings in `wrangler.jsonc`.
- Tests: `bun test` (bun:test, 20+ files). Typecheck: `npx tsc --noEmit`.
  Build is the real gate (`vinext build`).

## Cloudflare Workers & Runtime

STOP. Knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

### Docs & Resources
- **Workers Docs**: https://developers.cloudflare.com/workers/
- **MCP**: `https://docs.mcp.cloudflare.com/mcp`
- **Limits & Quotas**: Retrieve from product `/platform/limits/` page (e.g. `/workers/platform/limits`).
- **Node.js Compatibility**: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- **Observability & Errors**: https://developers.cloudflare.com/workers/observability/errors/
  - **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **Product Docs**: Retrieve API references and limits from:
  `/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

### Best Practices (conditional)
If the application uses Durable Objects or Workflows, refer to the relevant best practices:
- **Durable Objects**: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- **Workflows**: https://developers.cloudflare.com/workflows/build/rules-of-workflows/

## Architecture

Single-route client app (`app/page.tsx`, a `"use client"` shell) rendering six
tabs — Main Deck, Parent Deck, Parenting, Visualizer, Collection, Trained
Umas — through feature entry points under `features/`.

UI dependency direction is **app/features/app/common → lib**. Feature screens may
compose shared UI from `app/common/ui/`, but domain modules in `lib/` must never
import UI. Feature-to-feature imports should use that feature's public `index.ts`
when one exists.

- **Feature layout**: `features/deck`, `features/parenting`,
  `features/visualizer`, `features/collection`, and `features/veterans` own the
  screens, feature-specific models, and feature-only components. Cross-feature
  presentation components and metadata live in `app/common/ui/`.
- **Common UI layout**: `app/common/ui/primitives/` owns base display elements,
  `controls/` owns shared filters/sheets/search, `cards/` owns card presentation,
  and `skills/` owns skill display with `details/` and `provenance/` subgroups.
- **Shared hooks**: cross-feature React hooks live in `app/common/hooks/`; do not
  put React hooks or context into `lib/`. Keep pure persistence/data contracts
  in `lib/` and let feature/shared hooks adapt them for React.
- **Picker state**: `app/common/hooks/use-picker-controller.ts` provides only the
  generic reducer/projection lifecycle. Each feature owns its adapter, state,
  actions, and view model; API, localStorage, and UI callbacks stay outside the
  reducer. Do not add shared filter or ranking rules.
- **State**: `features/deck/state/deck-provider.tsx` exports `DeckProvider` and
  `useDeck()`. Hydration and data loading are isolated in adjacent hooks. Preset
  mutation semantics remain in the pure reducer in `lib/deck/preset-reducer.ts`;
  derived deck data comes from `lib/deck/skill-resolver.ts` and same-uma slot
  constraints from `lib/deck/card-constraints.ts`.
- **Parenting state**: pure setup types, normalization, persistence, and URL
  serialization live in `lib/parenting/state.ts`; the React hook
  `useParentingSetup` lives in `features/parenting/hooks/` and keeps the same
  storage key and subscription behavior.
- **Share links**: `lib/share-link/codec.ts` owns the only supported V4 bit-packed
  wire format; `lib/share-link/url.ts` owns URL parsing/building. V4 wraps the payload
  in a CORE section and skips unknown extension sections. V1/V2/V3 payloads are
  rejected; do not add legacy decoding without an explicit compatibility change.

### MVVM Architecture Guidelines (MANDATORY)

The client application strictly follows **MVVM (Model-View-ViewModel)** for feature screens, pickers, and complex interaction components:

1. **Layer Boundaries**:
   - **View (`screens/`, `components/`)**: Pure presentation layer (JSX). Views MUST NOT contain inline asynchronous data-fetching (`api.list*`), direct localStorage side-effects, recommendation scoring loops, or complex business logic. Views consume ViewModel data through `const vm = use<Feature>ViewModel()` or `const { state, commands } = use<Feature>ViewModel()`.
   - **ViewModel (`features/<feature>/view-models/`)**: Dedicated custom hooks (`use*ViewModel.ts`) that orchestrate feature state, derived computations/projections, async loaders, web workers, and event handlers. Each feature owns its `view-models/` directory with a public `index.ts`.
   - **Model (`lib/*`, `features/<feature>/model/`)**: Pure domain logic, reducers, API clients, algorithms (affinity, skill engine, ratings, constraints), and schemas. Models are UI-agnostic and React-free.

2. **ViewModel Contract**:
   Every ViewModel hook MUST expose an object with explicit separation of `state` and `commands`:
   ```typescript
   export interface FeatureViewModel {
     readonly state: {
       readonly [key: string]: any; // Observable / Computed properties
     };
     readonly commands: {
       readonly [action: string]: (...args: any[]) => void; // Event / Command actions
     };
   }
   ```
   - **`state`**: View reads observable state, derived collections, and visibility flags here.
   - **`commands`**: View routes all user interactions (`onClick`, `onPick`, `onSelect`, `toggle`) to these functions.

3. **Established ViewModels**:
   - `useDeckPickerViewModel` (`features/deck/view-models/use-deck-picker-view-model.ts`)
   - `useParentDeckViewModel` (`features/deck/view-models/use-parent-deck-view-model.ts`)
   - `useDeckSkillListViewModel` (`features/deck/view-models/use-deck-skill-list-view-model.ts`)
   - `useCardPickerViewModel` (`features/deck/view-models/use-card-picker-view-model.ts`)
   - `useParentingViewModel` (`features/parenting/view-models/use-parenting-view-model.ts`)

4. **Testing Invariant**:
   - When introducing or refactoring ViewModels, add dedicated unit tests in `features/<feature>/view-models/*.test.ts` to test state transitions and commands independently from DOM rendering.
   - Ensure 100% of existing tests continue to pass with zero regressions.

### Data gateway (IMPORTANT)

`lib/data/generated/` holds normalized runtime JSON committed for deployment;
`lib/data/source/` holds raw local captures and the ignored GameTora page cache.
Keep registry code, schema types, and registry tests at the `lib/data/` root.

`lib/data/registry.ts` is the **only** module allowed to import runtime JSON
(including lazily loaded racetracks and course shapes). It hydrates
cards/characters/skills(+inherited uniques) with CDN image URLs and
exposes canonical lookup maps. `lib/data/types.ts` is the typed contract with
the data pipeline — update it together with `scripts/generate-data.ts` /
`scripts/extract-affinity.ts`.

- `lib/api/data-store.ts` — async facade over the registry adding the `DataStore`
  Maps + `getCardSkills` metadata computation. It never imports JSON itself;
  code-split datasets are loaded through registry functions.
- `lib/api/client.ts` — in-memory adapter surface over data-store; `lib/api/index.ts`
  is the stable import entry point
  (`api.listCardIndex()` etc.) plus course helpers (`flattenCourse`,
  `distanceLabel`, `terrainLabel`, `turnLabel`).
- Skill evaluation has one classification table: `lib/evaluator/effects.ts`
  (`classifyEffect`). `evaluateSkillForTrack` (`lib/evaluator/evaluator.ts`,
  public entry `lib/evaluator/index.ts`) and `classifySkillEffects`
  (`lib/skills/effects.ts`) both consume it — do not fork the table again.
- Card/character → skill grant indexers: `lib/skills/skill-grants.ts`.

### Persistence (localStorage)

Shared helpers in `lib/storage/persistence.ts` (guarded JSON read/write + same-tab &
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

The generic zone engine does not enforce PVP skill bans. Callers that need the
Champions Meeting "No Debuffs" rule use `lib/pvp/skill-zones.ts`; keep the ban
list and event policy out of `lib/skill-engine/`.

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

## Skill rating — session pickup (reviewed 2026-10-09)

- Read [`docs/skill_grading.md`](docs/skill_grading.md) before changing ratings;
  start at [Known issues / next pickup](docs/skill_grading.md#known-issues--next-pickup).
  It describes the current working tree, including unfinished/uncommitted refactor work.
- Versions: `conditional-v2`, `recovery-policy-v1`, `conditional-tier-v1`.
  Pure API: `lib/skill-rating/index.ts`; registry adapter: `application.ts` in that
  directory; compatibility facade: `lib/evaluator/evaluator.ts`.
- Invariants: one canonical scorer, resolve variants before analysis, no
  activation-probability multiplier or category bonus, shared score-derived tiers.
  Recovery reserve points are product policy and do not add physical time/metres.
- Next pickup: **K2** fallback is suppressed before enhanced intrinsic activation
  is confirmed; **K1** unselected branches lose assumed labels in the inspector.
  Both are reproduced and documented, not fixed. Add regressions before changing them.
- Review verification: 69 related tests passed; browser checks belong to the user.
  Mechanics remain provisional; do not claim real-race validation or treat old
  category/rank-penalty documents as the current specification.

## Track renderer (`features/visualizer/rendering/track-render.ts`)

Browser-only SVG builder ported from `track_visualizer.html` (itself a port of
uma-tools `RaceTrack.tsx`). Builds DOM nodes via `createElementNS` (no JSX).

- `renderCourse(host, course, { zones })` — elevation, slope, straight/corner,
  phase bands + ruler (1–24) + meter hover. Appends to `host`, clears it first.
- `renderSkillOverlay(inner, course, zones)` — tinted bands on the ruler
  (82%–100%); random triggers use dashed outlines, deterministic solid.
- `ZONE_COLORS` is the per-trigger tint palette.
- Call it from a `"use client"` effect; SVG classes (.racetrackView,
  .mouseoverText, etc.) have minimal styles in `app/globals.css`.

## Design language & UI Guidelines

Warm ink-on-paper editorial-tool palette (from `track_visualizer.html`):
`--paper: #f5f2ec`, ink `#2b2b2b`, accent `#794016`. Tailwind utilities with
zinc grays + emerald for "triggerable", amber/sky/violet for rarity. No fancy
motion — hierarchy + legibility matter here.

### Component Design System & Agent Mandate (`docs/DESIGN.md`)

**MANDATORY**: For any task touching UI components, styling, cards, skills, pickers, modals, or layout, agents **MUST consult and strictly follow [`docs/DESIGN.md`](docs/DESIGN.md)**. All UI work is expected to meet the craftsmanship standards documented there.

Key contracts defined in `docs/DESIGN.md`:
- **Bilingual Display Hierarchy (Section 1)**: English translated name is always primary on top (`font-semibold text-zinc-900 dark:text-zinc-100`); Japanese original is secondary directly underneath (`mt-0.5`, muted `text-zinc-400 dark:text-zinc-500`, 1-2 sizes smaller). **Never place them side-by-side.**
- **Icon Geometry & Centering (Sections 2 & 11)**: Skill icons must be vertically centered (`items-center`) against the combined 2-line title block, never top-aligned (`items-start`). Always include `flex-none` / `shrink-0` to prevent distortion.
- **Surface Flatness & Anti-Slop (Section 3)**: Nested boxes ("Russian Doll" cards inside cards) are prohibited. Use single flat surfaces with divider lines (`divide-y divide-zinc-100 dark:divide-zinc-800/80`). Unified 6-slot grid across Main and Parent decks.
- **Uniform 2-Row Card Candidate Layout (Section 4)**: Card pickers and candidate sheets follow the exact 2-row layout:
  - Row 1: `[Portrait] [Rarity] [Card Name] [Badges] -> [+X target skills]* [Ownership] [Type Icon] [Skills ↗]`
  - Row 2: `[Japanese Subtitle / Title] -> Release: YYYY-MM-DD`
  - *\*`+X target skills` is rendered in Parent Deck mode only, and strictly counts skills where `firesOnCourse === true`.*
- **Ownership Chip Contract (Section 4.5)**: Fixed-width `w-11` with `inline-flex items-center justify-center`. Labels must be `Unowned` / `0 LB`–`3 LB` / `MLB` (never `N★` star shorthand).
- **Duplicate Skill Indicators (Section 5)**: When a skill is duplicated across cards, dynamically show `duplicate with {Card Name}` (or `duplicate ({count})` in unified view). Tapping/hovering opens a breakdown portal popover (`fixed z-[250]`).
- **Mobile Touch Discipline (Section 6)**: **Never auto-focus search inputs on touch devices.** Always guard `.focus()` with `if (typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches)`.
- **Card Inspection Sheet (Section 8)**: `CardSkillsSheet` operates at `z-[350]` and dynamically fetches skills for unequipped cards via `api.cardSkills(card.id)` with a loading state (no "No skills found" dead ends).
- **Interactive Wrapping (Section 10)**: `SkillHoverCard` wraps both the centered icon and the 2-line title container as a single interactive trigger (`group inline-flex items-center gap-2.5 min-w-0 cursor-pointer`).
- **Motion & Animations (Section 13)**: Powered by `tw-animate-css` (`@theme` easing tokens: `ease-out-expo`, `ease-out-quart`, `ease-in-out-cubic`). Durations ≤ 300ms. Always respect `prefers-reduced-motion`.
- **Code Review Checklist (Section 12)**: Before finalizing UI changes, agents must verify their work against the checklist in `docs/DESIGN.md#12-checklist-for-code-reviews--future-sessions`.
- **Shared Scaffolding**: Cross-feature presentation components live in `app/common/ui/`; skill presentation metadata lives there as well. Pure classification logic stays in `lib/skills/effects.ts` — never duplicate it inside sibling components.

## Data pipeline & external dependencies

- `bun run build:data` (`scripts/generate-data.ts` + `scripts/extract-mdb.ts`,
  auto-run on `prebuild`) generates `lib/data/generated/*.json`. Hachimi translations are
  merged into skills.json names and skill-meta.json at the source. Card name
  EN output strips the `[Title] ` bracket group.
- **Data ownership per dataset (no ping-pong between raw and processed):**
  - `scripts/generate-data.ts` reads `../skills.json`, `../characters.json`,
    `../data/racetracks_raw.json` → `lib/data/generated/{skills,characters,racetracks}.json`
    (skills.json entries carry a `tags` array of raw effect tags for the crawler).
  - `scripts/extract-mdb.ts` reads the game's `master.mdb` (SQLite) directly —
    path from `$UMAMUSUME_MDB_PATH`, defaulting to the local CrossOver/Steam
    install. It MERGES `lib/data/generated/cards.json` (mdb contributes the index: new
    cards, rarity, release, JP names via text_data cat 75/76/77; existing
    entries are preserved verbatim) and owns `lib/data/generated/affinity.json` +
    `lib/data/generated/careers.json` (`succession_relation`, `succession_relation_member`,
    `single_mode_wins_saddle`, `single_mode_route(_race)` → `single_mode_program`
    → `race_instance` → `race` → `race_course_set`).
  - `scripts/crawl_gametora_cards.py` (repo root, manual) operates **directly
    on `lib/data/generated/`**: reads cards.json + skills.json, crawls GameTora, and
    updates cards.json in place (type/nameEn/urlName/hints/eventSkills/
    eventDetails — the fields mdb cannot provide) and writes
    `lib/data/generated/skill-meta.json`.
  - `bun run fetch:gametora` fetches only `factors.json` (EN factor names —
    its URL embeds a content hash refreshed manually per scrape).

## Project memory — collaboration preferences

- Execute the agreed plan and report the completed changes and verification results.
- The user handles all browser-based testing. Do not independently open, control,
  inspect, or test the application in a browser unless the user explicitly asks.
- CLI verification is authorized: run appropriate tests, typecheck, and build.
- Report CLI results and any remaining checks for the user. Do not claim browser
  verification was completed when it has not been performed by the user.

## Verification

1. `npx tsc --noEmit` clean.
2. `bun test` green.
3. `bun run build` passes.
4. User-owned browser checks (agents do not run these unless explicitly asked):
   deck pick/search/sort, deck persists across reload, visualizer
   selection persists, triggerable tint matches zones on the selected course,
   clicking a skill draws its ruler bands, V4 share-link round-trip (V1/V2/V3
   are rejected) and Parenting Hub state persistence.

## Reference material (in `../`, outside this repo)

- `../track_visualizer.html` — the original single-file renderer this app ports.
- `docs/references/Uma Musume Race Mechanics.md` — phase/section/condition vocabulary.
- `../uma-tools/uma-skill-tools/` — the reference engine (Region, ConditionParser,
  ActivationConditions, CourseData, ActivationSamplePolicy).
- `../skills.json` / `../support_cards.json` — upstream source data.
