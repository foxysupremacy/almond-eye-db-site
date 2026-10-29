import { expect, test } from "bun:test";
import { raceContext } from "./stats";
import { defaults, kyoto2200 } from "./test-fixtures";

test("max HP matches saved race: Almond Eye, Pace Chaser, best mood", () => {
  const ctx = raceContext({ ...defaults, style: 2, motivation: "best",
    stats: { speed: 2172, stamina: 1848, power: 1642, guts: 1332, wisdom: 1598 } }, kyoto2200);
  expect(Math.abs(ctx.maxHp - 3328)).toBeLessThanOrEqual(1);
});

test("max HP matches saved race: Twin Turbo, Oonige", () => {
  const ctx = raceContext({ ...defaults, style: 5, motivation: "best", stats: { ...defaults.stats, stamina: 1587 } }, kyoto2200);
  expect(Math.abs(ctx.maxHp - 3197)).toBeLessThanOrEqual(1);
});

test("green Sta 60 adds 60 to adjusted stamina, not halved", () => {
  const base = raceContext({ ...defaults, stats: { ...defaults.stats, stamina: 1800 } }, kyoto2200);
  const green = raceContext({ ...defaults, stats: { ...defaults.stats, stamina: 1800 }, greens: { ...defaults.greens, sta60: 1 } }, kyoto2200);
  expect(green.stats.stamina - base.stats.stamina).toBe(60);
  expect(green.maxHp - base.maxHp).toBeCloseTo(0.8 * 1 * 60, 6);
});

test("stats are clamped to 1..2500", () => {
  const hi = raceContext({ ...defaults, stats: { ...defaults.stats, stamina: 3000 } }, kyoto2200);
  const cap = raceContext({ ...defaults, stats: { ...defaults.stats, stamina: 2500 } }, kyoto2200);
  expect(hi).toEqual(cap);
  const lo = raceContext({ ...defaults, stats: { ...defaults.stats, stamina: 0 } }, kyoto2200);
  const one = raceContext({ ...defaults, stats: { ...defaults.stats, stamina: 1 } }, kyoto2200);
  expect(lo).toEqual(one);
});

test("missing phases fall back to 1/6, 2/3, 5/6", () => {
  const ctx = raceContext(defaults, { ...kyoto2200, length: 2400 });
  expect(ctx.phases).toEqual([400, 1600, 2000]);
});

test("course phases and spurtStart are honoured", () => {
  const ctx = raceContext(defaults, { ...kyoto2200, phases: [{ id: 0, start: 0, end: 380 }, { id: 1, start: 380, end: 1500 }, { id: 2, start: 1500, end: 1900 }, { id: 3, start: 1900, end: 2200 }], spurtStart: { meters: 1520 } });
  expect(ctx.phases).toEqual([380, 1520, 1900]);
});

test("base speed, slopes, ground coefficient and style are derived from the course", () => {
  const ctx = raceContext({ ...defaults, groundCondition: 3, style: 4 }, { ...kyoto2200, slopes: [{ start: 100, end: 200, slope: 150 }] });
  expect(ctx.baseSpeed).toBeCloseTo(19.8, 9);
  expect(ctx.slopes).toEqual([{ start: 100, end: 200, per: 0.015 }]);
  expect(ctx.hpGroundCoef).toBe(1.02);
  expect(ctx.style).toBe(4);
  expect(ctx.surface).toBe(1);
  expect(ctx.minSpeed).toBeGreaterThan(0.85 * 19.8);
});

test("aptitude modifiers", () => {
  const ctx = raceContext({ ...defaults, aptitude: { ground: "B", distance: "E", style: "A" } }, kyoto2200);
  expect(ctx.distanceSpeedMod).toBe(0.4);
  expect(ctx.accelMods).toEqual({ ground: 0.9, distance: 0.6 });
});

test("final straight starts at the course's last straight, else the last-spurt phase start", () => {
  expect(raceContext(defaults, kyoto2200).finalStraightStart).toBeCloseTo((2200 * 5) / 6, 6);
  const withStraights = { ...kyoto2200, straights: [{ start: 0, end: 300, frontType: 1 }, { start: 1800, end: 2200, frontType: 1 }] };
  expect(raceContext(defaults, withStraights).finalStraightStart).toBe(1800);
  expect(raceContext({ ...defaults, aptitude: { ...defaults.aptitude, style: "B" } }, kyoto2200).styleProf).toBe(0.85);
});
