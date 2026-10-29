import { expect, test } from "bun:test";
import { createRng } from "./rng";
import { rollSkillEvents } from "./skills";
import { raceContext } from "./stats";
import { defaults, kyoto2200 } from "./test-fixtures";

const ctx = raceContext(defaults, kyoto2200);

test("recoveries pass wit check max(100 - 9000/baseWiz, 20)% (doc §Skill Activation Chance)", () => {
  const input = { ...defaults, recovery: [1, 0, 0, 0, 0, 0, 0] };
  const rng = createRng(7);
  const expected = Math.max(100 - 9000 / ctx.baseWiz, 20) / 100;
  const N = 10_000;
  let landed = 0;
  for (let i = 0; i < N; i++) landed += rollSkillEvents(input, ctx, rng).heals.length;
  expect(Math.abs(landed / N - expected)).toBeLessThan(0.01);
  expect(expected).toBeCloseTo(0.925, 3);
});

test("HP-loss skills always land (spec: worst case)", () => {
  const input = { ...defaults, hpLoss: [2, 0, 0, 0, 0, 1] };
  const rng = createRng(3);
  for (let i = 0; i < 200; i++) {
    const heals = rollSkillEvents(input, ctx, rng).heals;
    expect(heals.length).toBe(3);
    expect(heals.filter((h) => h.pct === -4).length).toBe(2);
    expect(heals.filter((h) => h.pct === -0.25).length).toBe(1);
  }
});

test("every event meter is inside mid-race [phases[0], phases[1])", () => {
  const input = { ...defaults, recovery: [3, 3, 3, 3, 3, 3, 3], hpLoss: [2, 2, 2, 2, 2, 2] };
  const rng = createRng(11);
  for (let i = 0; i < 200; i++) {
    for (const h of rollSkillEvents(input, ctx, rng).heals) {
      expect(h.meter).toBeGreaterThanOrEqual(ctx.phases[0]);
      expect(h.meter).toBeLessThan(ctx.phases[1]);
    }
  }
});

test("counts produce that many events; zero counts produce none", () => {
  const rng = createRng(5);
  expect(rollSkillEvents(defaults, ctx, rng).heals).toEqual([]);
  const lossOnly = rollSkillEvents({ ...defaults, hpLoss: [1, 2, 3, 0, 0, 0] }, ctx, rng).heals;
  expect(lossOnly.length).toBe(6);
  const rec = { ...defaults, recovery: [4, 0, 0, 0, 0, 0, 0] };
  for (let i = 0; i < 100; i++) {
    const h = rollSkillEvents(rec, ctx, rng).heals;
    expect(h.length).toBeLessThanOrEqual(4);
    for (const e of h) expect(e.pct).toBe(9.5);
  }
});
