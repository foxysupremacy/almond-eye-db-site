# Handoff: Condition Renderer — Multi-line Chips + Effect

## What to build

Replace the flat "When: A and B and C or D..." text in the Visualizer with a chip-based UI. Each `@` (OR) branch becomes its own line with a color box from the zone tint; each `&` (AND) sub-condition is an inline chip. Show the effect (`+0.35 m/s for 2.4 s`) under the chips, duration scaled by course length.

## Where

- `lib/skill-engine/describe.ts` — pure TS (no React). `conditionBranches()` already exists.
- `components/track-view.tsx` — React. `ConditionChips` + effect line, inline in the file.
- `lib/skill-engine/describe.test.ts` — tests.

## Types note (read this before coding)

- In `lib/api.ts`, `SkillConditionGroup.effects` is typed `unknown[]` (the API shape isn't refined). `formatEffect` expects `Array<{ type: number; value: number }>` — cast at the call sites in `track-view.tsx`:
  ```ts
  const effs = (g.effects as Array<{ type: number; value: number }> | undefined) ?? [];
  ```
  Do NOT widen `formatEffect`'s parameter to `unknown[]`; keep the pure-engine signature typed and cast at the React boundary.
- `conditionBranches`/`formatEffect` are **pure TS** — never import React into `describe.ts`.
- The zone-tint `ZONE_COLORS` array lives in `lib/track-render.ts` (exported). `track-view.tsx` already imports from `./lib/track-render`; add `ZONE_COLORS` to that import rather than importing the file twice.

## Implementation steps

### Step 1: `describe.ts` — add `formatEffect()`

Add these exports near `conditionBranches`:

```ts
// Effect type display (from uma-tools SkillType enum)
export const EFFECT_LABELS: Record<number, { label: string; unit: string; scale: number }> = {
  27: { label: "Target Speed", unit: "m/s", scale: 10000 },
  31: { label: "Accel", unit: "m/s²", scale: 10000 },
  22: { label: "Speed", unit: "m/s", scale: 10000 },
  21: { label: "Speed", unit: "m/s", scale: 10000 },
  9:  { label: "HP", unit: "HP", scale: 1 },
  1:  { label: "Speed", unit: "", scale: 1 },       // stat-up
  2:  { label: "Stamina", unit: "", scale: 1 },
  3:  { label: "Power", unit: "", scale: 1 },
  4:  { label: "Guts", unit: "", scale: 1 },
  5:  { label: "Wisdom", unit: "", scale: 1 },
  8:  { label: "Clairvoyance", unit: "", scale: 1 },
  10: { label: "Start delay", unit: "×", scale: 1 }, // multiplier
  14: { label: "Start delay", unit: "×", scale: 1 },
  28: { label: "Lane", unit: "", scale: 1 },
  37: { label: "Internal", unit: "", scale: 1 },     // hide
  42: { label: "Internal", unit: "", scale: 1 },     // hide
};

/**
 * Format a skill's effects into a human-readable line.
 * @param effects - Array of {type, value} from the API.
 * @param baseTime - base_time from the API (centiseconds, ÷10000→s; null/ -1→no duration).
 * @param courseLength - selected course length in meters.
 * @returns e.g. "+0.35 m/s for 2.4 s" or "+600 Guts" (passive, no duration).
 * Never throws: unknown types fall back to "type:{type} value:{value}".
 */
export function formatEffect(
  effects: Array<{ type: number; value: number }>,
  baseTime: number | undefined,
  courseLength: number,
): string {
  // Duration: baseTime × courseLength / 10_000_000 → seconds
  const hasDuration = baseTime != null && baseTime > 0 && Number.isFinite(baseTime);
  let durationS = 0;
  if (hasDuration) {
    durationS = (baseTime! * courseLength) / 10_000_000;
  }

  // Filter out hidden types (37, 42)
  const visible = effects.filter((e) => {
    const meta = EFFECT_LABELS[e.type];
    return !meta || meta.label !== "Internal";
  });
  if (visible.length === 0) return "";

  const parts = visible.map((e) => {
    const meta = EFFECT_LABELS[e.type];
    if (!meta) return `type:${e.type} value:${e.value}`; // fallback

    const scaled = e.value / meta.scale;
    const sign = scaled >= 0 ? "+" : "−";
    const abs = Math.abs(scaled);
    const num = meta.scale >= 10000 ? abs.toFixed(2) : Math.round(abs).toString();
    const unit = meta.unit ? ` ${meta.unit}` : "";
    const stat = meta.unit === "" && meta.label ? ` ${meta.label}` : "";
    return `${sign}${num}${unit}${stat}`;
  });

  let line = parts.join(", ");
  if (durationS > 0) {
    line += ` for ${durationS.toFixed(1)} s`;
  }
  return line;
}
```

### Step 2: `track-view.tsx` — render chips + effect

**a)** Import `conditionBranches`, `formatEffect`, `ZONE_COLORS`:

```ts
import { describeCondition, conditionBranches, formatEffect } from "../lib/skill-engine/describe";
import { renderCourse, ZONE_COLORS } from "../lib/track-render";
```

**b)** Replace the `g!.when.when` / `g!.when.needs` rendering in the sidebar (~line 394–432) and the detail panel (~line 467–497) with a chip layout.

**Sidebar** (inside the `groupTexts` map, where `g.condition` and `g.precondition` strings are available):

```tsx
const { branches } = conditionBranches(g.condition ?? "", racerCount);
const needsBranches = g.precondition ? conditionBranches(g.precondition ?? "", racerCount).branches : null;
const zoneColor = ZONE_COLORS[gi % ZONE_COLORS.length];
const muted = !z || !z.regions.length;
const tint = muted ? "rgba(161,161,170,0.3)" : zoneColor.replace(")", ",0.3)").replace("rgb", "rgba");
// fallback: zoneColor is e.g. "#e03131", convert to rgba manually
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
```

**Chip layout (shared inline JSX)** — renders one branch per line:

```tsx
<ConditionChips
  branches={branches}
  needsBranches={needsBranches}
  tint={tint}
  muted={muted}
/>
```

Where `ConditionChips` is an inline render helper (or a local function inside the component):

```tsx
function ConditionChips({ branches, needsBranches, tint, muted }: {
  branches: string[][];
  needsBranches: string[][] | null;
  tint: string;
  muted: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      {branches.map((chips, bi) => (
        <div key={bi} className="flex flex-wrap items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 flex-none rounded-sm border"
            style={{ background: tint, borderColor: muted ? "#a1a1aa" : "#d4d4d8" }}
          />
          {bi > 0 && (
            <span className="mr-0.5 text-[10px] font-semibold uppercase text-zinc-400">or</span>
          )}
          {chips.map((chip, ci) => (
            <span
              key={ci}
              className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] leading-4 text-zinc-600"
            >
              {chip}
            </span>
          ))}
        </div>
      ))}
      {needsBranches && needsBranches.length > 0 && (
        <div className="mt-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Needs:</span>
          {needsBranches.map((chips, bi) => (
            <div key={bi} className="flex flex-wrap items-center gap-1 mt-0.5">
              <span className="inline-block h-2.5 w-2.5 flex-none rounded-sm border border-zinc-300 bg-zinc-200" />
              {bi > 0 && (
                <span className="mr-0.5 text-[10px] font-semibold uppercase text-zinc-400">or</span>
              )}
              {chips.map((chip, ci) => (
                <span
                  key={ci}
                  className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] leading-4 text-zinc-500"
                >
                  {chip}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**c)** Pass `course.length` + `base_time` + `effects` to `formatEffect()` and render under the chips in both places.

**Sidebar** — inside the `groupTexts` map, where `g` is the condition group object:

```tsx
const effectLine = formatEffect(g.effects ?? [], g.base_time, course?.length ?? 0);
// ...after ConditionChips:
{effectLine && (
  <div className="mt-0.5 text-[11px] leading-4 text-zinc-500">{effectLine}</div>
)}
```

**Detail panel** — same pattern with `skillDetail.conditionGroups[gi]`:

```tsx
const group = skillDetail.conditionGroups[gi];
const effectLine = formatEffect(group.effects ?? [], group.base_time, course?.length ?? 0);
// ...after ConditionChips + the zone tint swatch:
{effectLine && (
  <div className="text-xs leading-5 text-zinc-500">{effectLine}</div>
)}
```

## Step 3: Tests

In `describe.test.ts`:

```ts
import { describeCondition, conditionBranches, formatEffect } from "./describe";

test("conditionBranches splits @ into rows, & into chips", () => {
  const { branches } = conditionBranches("phase==1&is_overtake==1@phase==2");
  expect(branches).toHaveLength(2);
  expect(branches[0]).toEqual(["Mid-race", "Has an overtake target"]);
  expect(branches[1]).toEqual(["Late race"]);
});

test("conditionBranches preserves backward compat .when", () => {
  const { when } = conditionBranches("phase==1&is_overtake==1");
  expect(when).toBe("Mid-race and has an overtake target");
});

test("formatEffect target speed type 27", () => {
  // 3500 / 10000 = 0.35 m/s, base_time=24000, courseLength=1000 → 2.4 s
  const line = formatEffect([{ type: 27, value: 3500 }], 24000, 1000);
  expect(line).toBe("+0.35 m/s for 2.4 s");
});

test("formatEffect recovery type 9", () => {
  const line = formatEffect([{ type: 9, value: 350 }], null, 1200);
  expect(line).toBe("+350 HP");
});

test("formatEffect passive no duration", () => {
  const line = formatEffect([{ type: 1, value: 600000 }], -1, 1200);
  expect(line).toBe("+600000 Speed");
});

test("formatEffect negative value", () => {
  const line = formatEffect([{ type: 21, value: -2000 }], 24000, 1000);
  expect(line).toBe("−0.20 m/s for 2.4 s");
});

test("formatEffect never throws on garbage", () => {
  expect(() => formatEffect([{ type: 999, value: NaN }], null, 0)).not.toThrow();
  expect(() => formatEffect([], null, 0)).not.toThrow();
});
```

## Edge cases to handle

- `formatEffect` with empty `effects` → `""` (no effect line shown).
- `base_time` null → no duration.
- `base_time` -1 → passive, no duration.
- `course.length` 0 or missing → duration treats as 0 (no duration).
- `racerCount` 0/999/NaN → clamped to [9,18] by `normalizeRacerCount` (already exists).
- `conditionBranches` with empty/null string → `{ branches: [], when: "" }`.
- `conditionBranches` with malformed condition → each fragment hits `renderFragment` raw-text fallback.
- Multiple effects of same type → join with `, `: `"+0.35 m/s, +0.15 m/s for 2.4 s"`.

## Verification

```bash
bun test lib/skill-engine/describe.test.ts
npx tsc --noEmit
bun run build
```

Manual: select a skill with `@`-branches (e.g. ID 110031 "It's Going to Be Me" → condition `is_last_straight==1` precondition `is_finalcorner==1&is_overtake==1&order<=5&order_rate<=50&overtake_target_no_order_up_time>=2`) → chips + effect line in sidebar and detail panel. Change Racers count → position chips update. Change course → effect duration updates. Passive skills (Right Turns ◎) show no duration. Reload → Racers value persists.

## Don't touch

- `zones.ts`
- `parser.ts`
- `conditions.ts`
- `lib/track-render.ts` (only import `ZONE_COLORS`)
- `lib/api.ts`
- `components/store.tsx`
- `app/globals.css`