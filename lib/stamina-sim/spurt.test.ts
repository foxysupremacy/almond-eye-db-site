import { expect, test } from "bun:test";
import { raceContext } from "./stats";
import { lateRaceTargetSpeed, lastSpurtSpeedMax, planSpurt, spurtHpNeed } from "./spurt";
import { defaults, kyoto2200 } from "./test-fixtures";

const ctx = raceContext(defaults, kyoto2200);
const late = ctx.phases[1];

test("planSpurt returns isMax when HP is exactly enough, not max when 1 HP short", () => {
  const need = spurtHpNeed(ctx, late, lastSpurtSpeedMax(ctx));
  const exact = planSpurt(ctx, late, need);
  expect(exact.isMax).toBe(true);
  expect(exact.speed).toBe(lastSpurtSpeedMax(ctx));
  expect(exact.startMeter).toBe(late);
  const short = planSpurt(ctx, late, need - 1);
  expect(short.isMax).toBe(false);
  expect(short.speed).toBeLessThan(lastSpurtSpeedMax(ctx));
  expect(short.startMeter).toBeGreaterThanOrEqual(late);
});

test("candidates never go below the late-race base target speed", () => {
  const plan = planSpurt(ctx, late, 0);
  expect(plan.isMax).toBe(false);
  expect(plan.speed).toBeGreaterThanOrEqual(lateRaceTargetSpeed(ctx) - 1e-9);
  expect(plan.startMeter).toBeLessThanOrEqual(ctx.courseLength);
});

test("a reduced plan with more HP is never slower to the line", () => {
  const need = spurtHpNeed(ctx, late, lastSpurtSpeedMax(ctx));
  const finish = (p: { speed: number; startMeter: number }) =>
    (p.startMeter - late) / lateRaceTargetSpeed(ctx) + (ctx.courseLength - p.startMeter) / p.speed;
  let prev = Number.POSITIVE_INFINITY;
  for (const f of [0.5, 0.7, 0.85, 0.95, 0.99]) {
    const t = finish(planSpurt(ctx, late, need * f));
    expect(t).toBeLessThanOrEqual(prev + 1e-9);
    prev = t;
  }
});

test("distance aptitude scales the speed-stat terms of the max spurt speed", () => {
  const a = raceContext(defaults, kyoto2200);
  const b = raceContext({ ...defaults, aptitude: { ...defaults.aptitude, distance: "B" } }, kyoto2200);
  const speedTerm = Math.sqrt(500 * a.stats.speed) * 0.002;
  // doc §Last Spurt: the speed term appears once directly and once inside BaseTargetSpeedPhase2 (x1.05).
  expect(lastSpurtSpeedMax(a) - lastSpurtSpeedMax(b)).toBeCloseTo(speedTerm * 0.1 * 2.05, 9);
  expect(lateRaceTargetSpeed(a) - lateRaceTargetSpeed(b)).toBeCloseTo(speedTerm * 0.1, 9);
});
