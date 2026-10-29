import { expect, test } from "bun:test";
import type { Course } from "../skill-engine/types";
import { runStaminaSim } from "./simulate";
import { defaults, kyoto2200 } from "./test-fixtures";

const turf1000: Course = { ...kyoto2200, id: 99_010, length: 1000, distance: 1 };
const dirt3600: Course = { ...kyoto2200, id: 99_011, length: 3600, distance: 4, terrain: 2 };
const allOn = { dueling: true, spotStruggle: true, kakari: true };

function finite(r: ReturnType<typeof runStaminaSim>) {
  for (const v of Object.values(r)) expect(Number.isFinite(v)).toBe(true);
}

test("same input + seed → identical result", () => {
  const input = { ...defaults, recovery: [1, 0, 1, 0, 0, 0, 0], toggles: allOn };
  expect(runStaminaSim(input, kyoto2200, { runs: 200, seed: 7 })).toEqual(runStaminaSim(input, kyoto2200, { runs: 200, seed: 7 }));
});

test("percentages in [0,100]; maxSpurtPct ≤ goalReachPct", () => {
  const r = runStaminaSim({ ...defaults, stats: { ...defaults.stats, stamina: 700 }, toggles: allOn }, kyoto2200, { runs: 300 });
  for (const p of [r.goalReachPct, r.maxSpurtPct, r.staminaKeepPct]) { expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(100); }
  expect(r.maxSpurtPct).toBeLessThanOrEqual(r.goalReachPct);
  expect(r.runs).toBe(300);
});

test("1000 m turf and 3600 m heavy dirt: finite numbers, no NaN", () => {
  finite(runStaminaSim(defaults, turf1000, { runs: 100 }));
  finite(runStaminaSim({ ...defaults, groundCondition: 4, toggles: allOn }, dirt3600, { runs: 100 }));
});

test("20× 9.5% on 1 stamina: no NaN, HP capped", () => {
  const input = { ...defaults, stats: { ...defaults.stats, stamina: 1 }, recovery: [20, 0, 0, 0, 0, 0, 0] };
  const r = runStaminaSim(input, kyoto2200, { runs: 100 });
  finite(r);
  expect(r.avgSurplusHp).toBeLessThan(1e6);
});

test("R14: goalReachPct >= maxSpurtPct on a borderline build (default seed)", () => {
  const r = runStaminaSim({ ...defaults, stats: { ...defaults.stats, stamina: 700 }, toggles: allOn }, kyoto2200, { runs: 500 });
  expect(r.goalReachPct).toBeGreaterThanOrEqual(r.maxSpurtPct);
});

test("1000 runs on 2200 m finish under 1000 ms in bun", () => {
  const input = { ...defaults, recovery: [1, 1, 1, 0, 0, 0, 0], hpLoss: [1, 0, 0, 0, 0, 0], toggles: allOn };
  const t0 = performance.now();
  runStaminaSim(input, kyoto2200, { runs: 1000 });
  expect(performance.now() - t0).toBeLessThan(1000);
});
