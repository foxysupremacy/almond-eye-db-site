# Parenting System Handoff & Architecture Guide (`parenting_handoff.md`)

> **Last Updated:** September 2026  
> **Target Audience:** Future AI Agents & Developers working on `almond-eye-db-site`  
> **Status:** Production-ready, 131/131 tests passing, 0 TypeScript errors  
> **Reference Documentation:** [`docs/parent.md`](file:///Users/fubuki/Documents/AlmondEyeDB/docs/parent.md)

---

## 1. Executive Summary & Core Mission

The **Parenting Tab (`/parenting`)** in AlmondEyeDB serves as the competitive breeding roadmap and pedigree optimization engine for *Umamusume: Pretty Derby*.

Competitive success in PvP events (Champions Meeting / チャンピオンズミーティング and League of Heroes / リーグオブヒーローズ) is determined by parent selection (因子周回). Players must prepare:
1. **Target Ace Trainee (育成ウマ娘)**
2. **Parent 1 (Your Lineage / 自前親)**: An Uma trained by the player, inheriting from two grandparents (GP 1-1 and GP 1-2).
3. **Parent 2 (Friend Borrow / レンタル親)**: An Uma borrowed from a friend or Hall of Fame veteran, inheriting from two grandparents (GP 2-1 and GP 2-2).

This session completed a ground-up overhaul of the parenting engine and UI, addressing all community recommendations from [`docs/parent.md`](file:///Users/fubuki/Documents/AlmondEyeDB/docs/parent.md), enforcing strict in-game breeding constraints, integrating user inventory (`ownedUmas`), generating full 6-slot bloodlines, and adding the **Grandparent Borrowing Breeding Roadmap** for un-trained parents.

---

## 2. File & Component Architecture

```
almond-eye-db-site/
├── lib/
│   ├── parenting-state.ts          # Core state types & default state for the 6-slot tree
│   ├── parent-recommender.ts        # Algorithm engine (scoring, role classification, 6-slot synthesis)
│   ├── parent-recommender.test.ts   # 12 unit tests covering constraints, roles, borrowing, costumes
│   ├── affinity-engine.ts          # Base relations, G1 race overlap, and 6-slot lineage affinity
│   ├── evaluator/evaluator.ts       # Track geometry simulation and skill timing evaluation
│   ├── use-owned-umas.ts           # Hook managing user's owned characters inventory
│   └── data-store.ts               # Character assets, stands (assets/chara_stand 512x512), and metadata
└── components/
    ├── parenting-view.tsx           # Main hub coordinating tree, modals, auto-select, and state
    ├── parenting/
    │   ├── pedigree-tree.tsx        # Interactive 6-slot pedigree tree (Trainee -> P1/P2 -> 4 GPs)
    │   ├── pedigree-slot-card.tsx   # Visual card for each slot (avatars, badges, stats, community role)
    │   └── best-combination-modal.tsx # Recommender modal with 6-slot branch cards and atomic apply
    └── veteran-picker-modal.tsx     # Selector for choosing owned veterans or ideal character templates
```

---

## 3. Major Features & Mechanics Implemented

### A. Strict Game Rule Constraints
1. **No Duplicate Umas Across Lineage**:
   - $Trainee \notin \{P1, GP1\text{-}1, GP1\text{-}2, P2, GP2\text{-}1, GP2\text{-}2\}$
   - $P1 \neq P2$
   - Lineage 1 distinct ancestors: $P1 \neq GP1\text{-}1 \neq GP1\text{-}2$
   - Lineage 2 distinct ancestors: $P2 \neq GP2\text{-}1 \neq GP2\text{-}2$
2. **Support Card Restriction**:
   - An Uma cannot use support cards depicting herself during training (e.g. training Almond Eye cannot equip Almond Eye SSR cards).
3. **Max 1 Friend Rental Per Training Run**:
   - In Umamusume, a training run allows at most **1 friend borrow**.
   - When training the final Ace: **Parent 2** is the friend rental (or Parent 1).
   - When training Parent 1 (e.g. Chrono Genesis): One grandparent (e.g. GP 1-2 Taiki Shuttle) can be borrowed from a friend, while the other (GP 1-1 Fine Motion) comes from owned veterans.
   - **Both GP 1-1 and GP 1-2 CANNOT be borrowed simultaneously.** The engine and UI enforce strict mutual exclusion.

---

### B. Grandparent Borrowing & Breeding Roadmap
- **Use Case**: The user owns a high-potential character (e.g. Chrono Genesis) but has not yet trained her as a veteran parent.
- **Per-Grandparent Toggle**: Segmented toggle `[Owned] / [Borrow]` rendered on GP 1-1 and GP 1-2 in:
  - [`components/parenting/best-combination-modal.tsx`](file:///Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site/components/parenting/best-combination-modal.tsx)
  - [`components/parenting/pedigree-tree.tsx`](file:///Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site/components/parenting/pedigree-tree.tsx)
- **Mutual Exclusion Logic**:
  - Setting both to `[Owned]` is allowed (100% self-sufficient farming).
  - Toggling one GP to `[Borrow]` automatically flips the other to `[Owned]`.
- **Compact Friend Rental Criteria Box**:
  - When a grandparent is marked `[Borrow]`, an in-card search guideline is displayed:
    - `🎯 Friend Rental Target`
    - Blue & Pink factor goals: `3★ Speed / Power (9★ Lineage)` and `3★ Surface / Distance Aptitude`.
    - Shared G1 race target schedule matching the track's geometry (e.g. Takarazuka Kinen, Queen Elizabeth II Cup for Kyoto 2200m).
- **Smart Modal Tab Routing**:
  - Clicking an `[Owned]` grandparent opens [`VeteranPickerModal`](file:///Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site/components/veteran-picker-modal.tsx) on the `"veterans"` tab.
  - Clicking a `[Borrow]` grandparent opens the modal on the `"templates"` tab.

---

### C. Automated 5-Tier Community Tactical Role Engine
Mapped directly from the `docs/parent.md` case study (Kyoto 2200m Turf example):

| Tier | Category ID | Community Label (JP) | Community Label (EN) | Description & Examples |
| :--- | :--- | :--- | :--- | :--- |
| **★5** | `hybrid_accel_mid` | 終盤加速＆中盤速度 | Hybrid Accel & Mid Speed | Valid acceleration at the 2/3 spurt line + mid-race velocity. Examples: Epiphaneia (`101411`), Stay Gold (`101351`). |
| **★4** | `fastest_accel` | 終盤加速 (最速有効) | Valid Fastest Accel | Precise corner/straight acceleration firing at $S_{\text{late}} \pm 30\text{m}$. Examples: Seiun Sky (`102001`), Mejiro Ryan (`102701`), NY Kitasan Black (`106802`). |
| **★3** | `carry_over` | 終盤接続 | Spurt Carry-Over | Downhill or late-corner speed transitions connecting across the late spurt threshold. Examples: Valentine Mejiro Ryan (`102702`), Alt Dober, Christmas Oguri. |
| **★3** | `mid_speed` | 中盤速度 | Mid-Race Speed | Position Keep & pace advantage before the spurt line. Examples: Valentine Mihono Bourbon (`102602`), Mecha Biwa Hayahide (`101802`), Almond Eye (`103001`), Summer Agnes Tachyon. |
| **★3** | `end_speed` | 終盤速度 / 現在速度 | Late-Race Speed / Instant Burst | Maximum terminal velocity or zero-delay instant speed bursts. Examples: New Year TM Opera O (`101502`), Fuji Kiseki (`100301`). |
| **★2** | `synergy` | 相性重視 | Affinity Anchor | High base relation points and wide G1 trophy overlap. Examples: Symboli Rudolf (`101301`), Oguri Cap (`100501`). |

---

### D. Owned Umas Inventory Integration & Costume Selection
- **Inventory Integration (`useOwnedUmas`)**:
  - Reads `ownedUmas: Record<string, [number, number]>` from user local storage.
  - Supports 4-digit character IDs (`"1068"`) and 6-digit card IDs (`"106802"`).
  - Merged cleanly with uploaded veterans (`KyumaruVeteranItem`). Characters with uploaded veterans are marked `"veteran"` (emerald badge); un-trained characters are marked `"owned"` (amber badge).
- **Tactical Costume Variant Selection**:
  - If a player owns multiple costumes of the same character (e.g. Kitasan Black original `106801` vs New Year `106802`), the engine evaluates each costume's unique skill against track geometry.
  - On Kyoto 2200m Runner, NY Kitasan (`106802`) is automatically selected because its unique activates as a valid fastest accel, outscoring standard Kitasan.

---

### E. Unified Deduplicated Veterans
- Recommender groups multiple Hall of Fame runs of the same character into a single parent card.
- Displays `allRuns` and `runCount` (e.g. "3 Runs Available").
- Primary run is picked by best lineage blue stars ($\text{self} + \text{parents}$) followed by rank score.

---

### F. Multi-Group Acceleration Timing Fix
- **Bug**: In skills with multiple condition groups (e.g. Epiphaneia `101411` with Group 0 mid-speed at 50% distance and Group 1 late-race spurt acceleration), the evaluator previously used `Math.min(...activeRegions.map(r => r.start))`, picking Group 0 (1100m) and wrongly classifying the acceleration as `dead_accel` (-367m early).
- **Fix**: Isolated acceleration delay calculation in `lib/evaluator/evaluator.ts` specifically to condition groups containing effect `type: 31` (acceleration).

---

## 4. Key Design Decisions & Rationale

1. **Why Max 1 Borrow on Parent 1's Lineage?**
   - In Umamusume, a training session allows borrowing only 1 friend card. When training Parent 1, you can borrow 1 parent and use 1 of your own veterans. You cannot borrow both.
   - Enforcing mutual exclusion prevents users from creating invalid breeding roadmaps.

2. **Why Separate History Combinations vs. Ideal Blueprints?**
   - **History Combinations**: Built exclusively from the user's uploaded veterans.
   - **Ideal Blueprint Combinations**: Synthesizes the optimal combination using owned un-trained characters + friend rentals, providing a step-by-step goal for the user.

3. **Why Dynamic Costume Simulation instead of Static Tables?**
   - Skills behave differently depending on distance, surface, straight positions, and corner angles. Running every costume through `evaluateUniqueSkill` against the track's real geometry ensures future tracks and balance patches automatically yield correct recommendations without hardcoded mappings.

4. **Why Unified Modal with `initialTab`?**
   - Instead of maintaining two separate modals for picking veterans vs templates, [`VeteranPickerModal`](file:///Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site/components/veteran-picker-modal.tsx) supports an `initialTab` prop (`"veterans" | "templates"`). This keeps the UI DRY and ensures consistent filtering and search mechanics.

5. **512x512 Assets Standard**:
   - Character portraits use the official high-resolution route: `https://cdn.almond-eye.tech/assets/chara_stand/{cardId}/{charaId6}/01.png`.

---

## 5. State & Data Schema Reference

### `GrandparentSlot` ([`lib/parenting-state.ts`](file:///Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site/lib/parenting-state.ts))
```typescript
export interface GrandparentSlot {
  id: string; // e.g. "p1-gp1", "p1-gp2", "p2-gp1", "p2-gp2"
  label: string;
  sublabel: string;
  charId?: number;
  cardId?: number;
  veteran?: KyumaruVeteranItem;
  isBorrow?: boolean; // True if borrowed from friend rental
  affinityScore?: number;
  tacticalCategory?: TacticalCategory;
  tacticalRole?: CommunityTacticalRole;
}
```

### `GrandparentBorrowCriteria` ([`lib/parent-recommender.ts`](file:///Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site/lib/parent-recommender.ts))
```typescript
export interface GrandparentBorrowCriteria {
  targetG1Races: { id: number; nameEn: string; nameJp: string; month: number; half: number }[];
  targetBlueFactor: string; // e.g. "3★ Speed / Power (9★ Lineage)"
  targetPinkFactor: string; // e.g. "3★ Turf or Medium Aptitude"
}
```

### `CombinationParticipant` ([`lib/parent-recommender.ts`](file:///Users/fubuki/Documents/AlmondEyeDB/almond-eye-db-site/lib/parent-recommender.ts))
```typescript
export interface CombinationParticipant {
  charId: number;
  cardId: number;
  veteran?: KyumaruVeteranItem;
  ownershipStatus: "veteran" | "owned" | "borrow";
  isBorrow: boolean;
  communityRole: CommunityTacticalRole;
  uniqueSkillEval: SkillEvaluationResult;
  borrowCriteria?: GrandparentBorrowCriteria;
  gp1?: CombinationParticipant;
  gp2?: CombinationParticipant;
  // ... factors, allRuns, blueStars
}
```

---

## 6. Verification & Test Suite

All tests can be executed via `bun test` in `almond-eye-db-site/`.
Current status: **131 passed, 0 failed, 7,294 assertions**.

```bash
cd almond-eye-db-site
bun test lib/parent-recommender.test.ts
```

Test coverage includes:
- `Kyoto 2200m Runner recommends Seiun Sky as Valid Fastest Accel`
- `Kyoto 2200m Betweener recommends Mejiro Ryan as Valid Fastest Accel`
- `Duplicate character protection prevents recommending trainee or parent 1`
- `Character image URLs use assets/chara_stand 512x512 route`
- `Deduplicates multiple veterans of same Uma into 1 recommendation`
- `extractHistoricalParents extracts parents from positions 10 and 20`
- `calculateBestParentCombinations strictly enforces constraints`
- `ownedUmas integration: includes inventory umas and badges them as owned`
- `costume variant selection: selects highest bonus tactical costume for track`
- `6-slot bloodline generation populates GP1 & GP2 with distinct ancestors`
- `community role classification assigns ★5 hybrid_accel_mid to Epiphaneia on Kyoto 2200m Runner`
- `grandparent borrowing enforces max 1 borrow rental for Parent 1 lineage and attaches borrow criteria`

Typecheck:
```bash
./node_modules/.bin/tsc --noEmit
# 0 errors
```

---

## 7. Future Roadmap & Recommended Next Steps

For future agents extending this module:
1. **Local Storage Preset Persistence**:
   - Allow users to name and save custom 6-slot bloodline blueprints to `localStorage` alongside existing card deck presets.
2. **Export Pedigree Image / Share Code**:
   - Utilize `@vercel/og` or HTML Canvas / SVG export to generate a shareable image card of the 6-slot pedigree tree with QR code/link.
3. **Inheritance Roll Simulation**:
   - Provide a simulated probability calculator for factor inheritance (e.g. odds of getting 3★ Blue factor or White skill hints based on affinity score ◎ vs ◯).
4. **Card Deck Cross-Validation**:
   - In the parent training view, validate that the user's active support deck does not contain cards depicting the character being trained as Parent 1.
