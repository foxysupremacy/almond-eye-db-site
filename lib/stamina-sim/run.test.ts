import { expect, test } from "bun:test";
import type { Course } from "../skill-engine/types";
import { createRng } from "./rng";
import { sectionAt, simulateRun, type RunEvents } from "./run";
import { lastSpurtSpeedMax } from "./spurt";
import { raceContext } from "./stats";
import { defaults, kyoto2200 } from "./test-fixtures";

const NO_EVENTS: RunEvents = { heals: [] };
const long3200: Course = { ...kyoto2200, id: 99_001, length: 3200, distance: 4 };

interface Frame { t: number; meter: number; speed: number; hp: number }
function framesOf(ctx: ReturnType<typeof raceContext>, events: RunEvents = NO_EVENTS, seed = 1) {
  const frames: Frame[] = [];
  const out = simulateRun(ctx, createRng(seed), events, undefined, (f) => frames.push({ ...f }));
  return { out, frames };
}

test("2500 stamina, no skills: max spurt, reaches goal, positive HP", () => {
  const ctx = raceContext({ ...defaults, stats: { ...defaults.stats, stamina: 2500 } }, kyoto2200);
  const out = simulateRun(ctx, createRng(1), NO_EVENTS);
  expect(out.reachedGoal).toBe(true);
  expect(out.maxSpurt).toBe(true);
  expect(out.finalHp).toBeGreaterThan(0);
  expect(out.enteredStaminaKeep).toBe(false);
});

test("100 stamina on 3200 m: no max spurt; reaches goal false or reduced spurt", () => {
  const ctx = raceContext({ ...defaults, stats: { ...defaults.stats, stamina: 100 } }, long3200);
  const { out, frames } = framesOf(ctx);
  expect(out.maxSpurt).toBe(false);
  const topLate = Math.max(...frames.filter((f) => f.meter >= ctx.phases[1]).map((f) => f.speed));
  expect(!out.reachedGoal || topLate < lastSpurtSpeedMax(ctx) - 1e-6).toBe(true);
});

test("HP never exceeds maxHp and never goes below 0", () => {
  for (const stamina of [100, 1200, 2500]) {
    const ctx = raceContext({ ...defaults, stats: { ...defaults.stats, stamina } }, long3200);
    const events: RunEvents = { heals: [{ meter: 300, pct: 9.5 }, { meter: 2500, pct: 5.5 }, { meter: 2600, pct: -4 }] };
    const { frames } = framesOf(ctx, events);
    expect(frames.length).toBeGreaterThan(0);
    for (const f of frames) {
      expect(f.hp).toBeLessThanOrEqual(ctx.maxHp);
      expect(f.hp).toBeGreaterThanOrEqual(0);
    }
  }
});

test("out of HP → speed set to minimum speed (doc §Out of HP)", () => {
  const ctx = raceContext({ ...defaults, stats: { ...defaults.stats, stamina: 1 } }, long3200);
  const { out, frames } = framesOf(ctx);
  expect(out.reachedGoal).toBe(false);
  expect(out.maxSpurt).toBe(false);
  expect(out.finalHp).toBe(0);
  const firstEmpty = frames.findIndex((f) => f.hp === 0);
  expect(firstEmpty).toBeGreaterThan(0);
  const after = frames.slice(firstEmpty);
  for (const f of after) expect(f.speed).toBeGreaterThanOrEqual(ctx.minSpeed - 1e-9);
  // Decelerating at -1.2 m/s^2 toward minimum speed: speed never rises once HP is gone and ends at minimum speed.
  for (let i = 1; i < after.length; i++) expect(after[i].speed).toBeLessThanOrEqual(after[i - 1].speed + 1e-9);
  expect(after[after.length - 1].speed).toBeCloseTo(ctx.minSpeed, 9);
});

test("planSpurt-driven max spurt: heal after late-race start does not make a short plan count as max", () => {
  const short = raceContext({ ...defaults, stats: { ...defaults.stats, stamina: 400 } }, kyoto2200);
  const base = simulateRun(short, createRng(1), NO_EVENTS);
  expect(base.maxSpurt).toBe(false);
  const healed = simulateRun(short, createRng(1), { heals: [{ meter: short.phases[1] + 20, pct: 50 }] });
  expect(healed.maxSpurt).toBe(false);
  expect(healed.reachedGoal).toBe(true);
  const early = simulateRun(short, createRng(1), { heals: [{ meter: 600, pct: 50 }] });
  expect(early.finalHp).toBeGreaterThanOrEqual(0);
});

test("course without slopes/phases runs to completion", () => {
  const bare: Course = { id: 99_002, length: 1600, terrain: 2, turn: 1, distance: 2, inout: 1, corners: [], straights: [], slopes: [] };
  const ctx = raceContext(defaults, bare);
  const { out, frames } = framesOf(ctx);
  expect(out.reachedGoal).toBe(true);
  expect(frames[frames.length - 1].meter).toBe(1600);
  for (let i = 1; i < frames.length; i++) expect(frames[i].meter).toBeGreaterThan(frames[i - 1].meter);
});

test("downhill accel mode is deterministic for a fixed seed and saves HP", () => {
  const hilly: Course = { ...kyoto2200, id: 99_003, slopes: [{ start: 400, end: 1200, slope: -20_000 }] };
  const ctx = raceContext({ ...defaults, stats: { ...defaults.stats, wisdom: 2500 } }, hilly);
  const flat = raceContext({ ...defaults, stats: { ...defaults.stats, wisdom: 2500 } }, kyoto2200);
  const a = simulateRun(ctx, createRng(7), NO_EVENTS);
  const b = simulateRun(ctx, createRng(7), NO_EVENTS);
  expect(a).toEqual(b);
  expect(a.finalHp).toBeGreaterThan(simulateRun(flat, createRng(7), NO_EVENTS).finalHp);
});

test("section index is 1..24 by equal distance (doc §Section)", () => {
  const ctx = raceContext(defaults, kyoto2200);
  expect(sectionAt(ctx, 0)).toBe(1);
  expect(sectionAt(ctx, 2200 / 24 - 0.01)).toBe(1);
  expect(sectionAt(ctx, 2200 / 24)).toBe(2);
  expect(sectionAt(ctx, 2200)).toBe(24);
});

test("1000 runs stay within the per-calculation budget", () => {
  const ctx = raceContext(defaults, long3200);
  const rng = createRng(3);
  const t0 = performance.now();
  for (let i = 0; i < 1000; i++) simulateRun(ctx, rng, NO_EVENTS);
  expect(performance.now() - t0).toBeLessThan(1000);
});

test("3x 9.5% mid-race heals flip maxSpurt false -> true on a borderline uma at the same seed", () => {
  const ctx = raceContext({ ...defaults, stats: { ...defaults.stats, stamina: 600 } }, kyoto2200);
  const heals = [700, 800, 900].map((meter) => ({ meter, pct: 9.5 }));
  expect(simulateRun(ctx, createRng(1), NO_EVENTS).maxSpurt).toBe(false);
  expect(simulateRun(ctx, createRng(1), { heals }).maxSpurt).toBe(true);
});
