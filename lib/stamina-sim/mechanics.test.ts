import { describe, expect, test } from "bun:test";
import type { Course } from "../skill-engine/types";
import { GENERIC_FIELD, type GenericField } from "./field";
import {
  competeBeforeSpurtEffect, duelingEffect, initMechanics, onHeal, positionKeepWitChance, rushedChance, secureLeadEffect,
  spotStruggleEffect, staminaKeepChance, staminaLimitBreakBase, stepMechanics, zenkaiAccel, type FrameView, type MechanicsState,
} from "./mechanics";
import { createRng } from "./rng";
import { simulateRun, type RunFrame } from "./run";
import { lastSpurtSpeedMax } from "./spurt";
import { raceContext } from "./stats";
import { defaults, kyoto2200 } from "./test-fixtures";
import type { Rng, StaminaInput } from "./types";

const DT = 1 / 15;
const constRng = (v: number): Rng => ({ next: () => v });
/** Returns the scripted values in order, then `rest` forever. */
const scriptRng = (values: number[], rest: number): Rng => { let i = 0; return { next: () => (i < values.length ? values[i++] : rest) }; };
const field = (over: Partial<GenericField>): GenericField => ({
  ...GENERIC_FIELD,
  pChaseNeeded: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, pTooClose: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  pNearbyRival: 0, pSameStyleFrontRunner: 0, ...over,
});
const all = (p: number) => ({ 1: p, 2: p, 3: p, 4: p, 5: p });
const sectionLen = 2200 / 24;

function setup(over: Partial<StaminaInput> = {}, f: GenericField = field({}), rng: Rng = constRng(0.999), course: Course = kyoto2200) {
  const input = { ...defaults, ...over };
  const ctx = raceContext(input, course);
  return { ctx, state: initMechanics(input, ctx, rng, f) };
}

/** Steps `seconds` of frames at a fixed section/meter, returning each frame's mods. */
function drive(state: MechanicsState, rng: Rng, from: number, seconds: number, view: Partial<FrameView>) {
  const out: { t: number; mul: number; add: number; hpMul: number; hpLoss: number }[] = [];
  const frame: FrameView = { t: 0, meter: 0, hp: 1e9, speed: 20, section: 1, phase: 0, spurtPlan: null, ...view };
  for (let i = 0; i <= Math.round(seconds * 15); i++) {
    frame.t = from + i * DT;
    const m = stepMechanics(state, frame, rng);
    out.push({ t: frame.t, mul: m.targetSpeedMul, add: m.targetSpeedAdd, hpMul: m.hpMul, hpLoss: m.hpLoss });
  }
  return out;
}

describe("rushed", () => {
  test("rushed chance (6.5/log10(0.1·wiz+1))², rounded up to whole %; section 2..9", () => {
    expect(rushedChance(300)).toBeCloseTo(0.19, 9);
    expect(rushedChance(600)).toBeCloseTo(0.14, 9);
    expect(rushedChance(900)).toBeCloseTo(0.12, 9);
    expect(rushedChance(1200)).toBeCloseTo(0.1, 9);
    const input = { ...defaults, toggles: { ...defaults.toggles, kakari: true } };
    const ctx = raceContext(input, kyoto2200);
    const sections = new Set<number>();
    let rushed = 0;
    const rng = createRng(11);
    for (let i = 0; i < 4000; i++) {
      const s = initMechanics(input, ctx, rng);
      if (s.rushSection > 0) { rushed++; sections.add(s.rushSection); }
    }
    expect([...sections].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(rushed / 4000).toBeCloseTo(rushedChance(ctx.stats.wisdom), 1);
    // The kakari toggle gates the roll.
    const off = raceContext(defaults, kyoto2200);
    for (let i = 0; i < 200; i++) expect(initMechanics(defaults, off, rng).rushSection).toBe(0);
  });

  test("rushed: HP ×1.6, snaps out 55% per 3 s, max 12 s", () => {
    const kakari = { toggles: { ...defaults.toggles, kakari: true } };
    // Never snaps out (0.999 >= 55%): rushed from entering section 3 for exactly 12 s.
    const { state } = setup(kakari);
    state.rushSection = 3;
    const before = drive(state, constRng(0.999), 0, 1, { section: 2, meter: sectionLen * 1.5 });
    expect(before.every((m) => m.hpMul === 1)).toBe(true);
    const during = drive(state, constRng(0.999), 10, 14, { section: 3, meter: sectionLen * 2.5 });
    const rushedFrames = during.filter((m) => m.hpMul === 1.6);
    expect(rushedFrames[0].t).toBeCloseTo(10, 9);
    const last = rushedFrames[rushedFrames.length - 1].t;
    expect(last).toBeGreaterThan(10 + 12 - 2 * DT);
    expect(last).toBeLessThan(10 + 12);
    expect(during[during.length - 1].hpMul).toBe(1);
    // Always snaps out (0 < 55%): ends at the first 3 s check.
    const quick = setup(kakari).state;
    quick.rushSection = 3;
    const q = drive(quick, constRng(0), 10, 5, { section: 3, meter: sectionLen * 2.5 }).filter((m) => m.hpMul === 1.6);
    expect(q[q.length - 1].t).toBeLessThan(13);
    expect(q[q.length - 1].t).toBeGreaterThan(13 - 2 * DT);
    // Rushed forces a position-keep speed-up (wisdom roll auto-passes) even when the field never needs one.
    expect(during.some((m) => m.mul > 1)).toBe(true);
  });
});

describe("position keeping", () => {
  test("pace-down: HP ×0.6; pace-up 1.04× target; entry wit chance 15·log10(wiz·0.1)%", () => {
    expect(positionKeepWitChance(3, 1000)).toBeCloseTo(0.15 * Math.log10(100), 9);
    expect(positionKeepWitChance(1, 1000)).toBeCloseTo(0.2 * Math.log10(100), 9); // doc: front runners 20·log10
    expect(positionKeepWitChance(3, 5)).toBe(0);
    // Pace up: target x1.04, HP unchanged.
    const up = setup({ style: 3 }, field({ pChaseNeeded: all(1) })).state;
    const u = drive(up, constRng(0), 0, 1, { section: 6, meter: sectionLen * 5.5, phase: 1 });
    expect(u[0].mul).toBeCloseTo(1.04, 12);
    expect(u[0].hpMul).toBe(1);
    // Failed wit check: no pace up.
    const failed = setup({ style: 3 }, field({ pChaseNeeded: all(1) })).state;
    expect(drive(failed, scriptRng([0, 0.999], 0.999), 0, 1, { section: 6, phase: 1 }).every((m) => m.mul === 1)).toBe(true);
    // Pace down: HP x0.6, target 0.945 in mid-race, 0.915 in the early race; no wit check.
    const down = setup({ style: 3 }, field({ pTooClose: all(1) })).state;
    const d = drive(down, constRng(0.999), 0, 0, { section: 6, meter: sectionLen * 5.5, phase: 1 });
    expect(d[0].mul).toBeCloseTo(0.945, 12);
    expect(d[0].hpMul).toBeCloseTo(0.6, 12);
    const early = setup({ style: 3 }, field({ pTooClose: all(1) })).state;
    expect(drive(early, constRng(0.999), 0, 0, { section: 2, phase: 0 })[0].mul).toBeCloseTo(0.915, 12);
    // Front runner speed up 1.04 / overtake 1.05.
    const speedUp = setup({ style: 1 }, field({ pTooClose: all(1) })).state;
    expect(drive(speedUp, constRng(0), 0, 0, { section: 6, phase: 1 })[0].mul).toBeCloseTo(1.04, 12);
    const overtake = setup({ style: 1 }, field({ pChaseNeeded: all(1) })).state;
    expect(drive(overtake, constRng(0), 0, 0, { section: 6, phase: 1 })[0].mul).toBeCloseTo(1.05, 12);
  });

  test("position keeping: sections 1–10 only, mode capped at one section, 1 s cooldown + 2 s interval", () => {
    const s = setup({ style: 2 }, field({ pChaseNeeded: all(1) })).state;
    expect(drive(s, constRng(0), 0, 4, { section: 11, phase: 1 }).every((m) => m.mul === 1)).toBe(true);
    // A huge gap (rng 0.999 draws the full band) can only end via the one-section cap.
    const capped = setup({ style: 2 }, field({ pChaseNeeded: all(1) })).state;
    const frame: FrameView = { t: 0, meter: 0, hp: 1e9, speed: 20, section: 5, phase: 1, spurtPlan: null };
    const rng = scriptRng([0, 0, 0], 0);
    let firstExit = -1;
    let reEntry = -1;
    for (let i = 0; i < 15 * 20; i++) {
      frame.t = i * DT; frame.meter = 400 + i * 20 * DT;
      const m = stepMechanics(capped, frame, rng);
      if (firstExit < 0 && m.targetSpeedMul === 1) firstExit = frame.t;
      if (firstExit >= 0 && reEntry < 0 && m.targetSpeedMul > 1) reEntry = frame.t;
    }
    expect(firstExit).toBeGreaterThan(0);
    // Gap 0 (rng 0) exits at once; then 1 s cooldown + 2 s interval.
    expect(reEntry - firstExit).toBeGreaterThan(3 - 2 * DT);
    expect(reEntry - firstExit).toBeLessThan(3 + 2 * DT);
    const long = setup({ style: 2 }, field({ pChaseNeeded: all(1) })).state;
    const f2: FrameView = { ...frame, t: 0, meter: 400 };
    const r2 = scriptRng([0, 0, 0.999], 0.999);
    let end = -1;
    for (let i = 0; i < 15 * 20 && end < 0; i++) {
      f2.t = i * DT; f2.meter = 400 + i * 20 * DT;
      if (stepMechanics(long, f2, r2).targetSpeedMul === 1) end = f2.meter;
    }
    expect(end - 400).toBeGreaterThanOrEqual(Math.floor(sectionLen) - 20 * DT);
    expect(end - 400).toBeLessThan(Math.floor(sectionLen) + 20 * DT);
  });
});

describe("competitions", () => {
  test("compete before spurt: sections 11–15, 2 s on / 1 s cooldown, stamina 20×(strat×dist + near) once per activation (R8)", () => {
    const { ctx } = setup({ style: 4 });
    // 2200 m: distance coefficient 0.8 (< 2201 m); Oikomi strategy coefficient 1.0; near factor 0.5.
    const near = competeBeforeSpurtEffect(ctx, false, false);
    expect(near.hpPerActivation).toBeCloseTo(20 * (1 * 0.8 + 0.5), 9);
    expect(competeBeforeSpurtEffect(ctx, true, false).hpPerActivation).toBeCloseTo(20 * 0.8, 9);
    const { power, guts } = ctx.stats;
    expect(near.targetSpeedAdd).toBeCloseTo((Math.sqrt(power / 1500) * 2 + (guts / 3000) ** 0.2) * 0.1 * 1, 9);
    // Front runner without a same-strategy rival within 10 m: bonus x1.1 (nige) / x2.0 (oonige).
    const nige = setup({ style: 1 }).ctx;
    expect(competeBeforeSpurtEffect(nige, false, true).targetSpeedAdd).toBeCloseTo(competeBeforeSpurtEffect(nige, false, false).targetSpeedAdd * 1.1, 9);
    expect(competeBeforeSpurtEffect(nige, false, false).hpPerActivation).toBeCloseTo(20 * (1.2 * 0.8 + 0.5), 9);

    const state = setup({ style: 4 }, field({ pNearbyRival: 1 })).state;
    expect(drive(state, constRng(0), 0, 3, { section: 10, phase: 1 }).every((m) => m.hpLoss === 0)).toBe(true);
    const frames = drive(state, constRng(0), 10, 6, { section: 12, phase: 1 });
    const on = frames.filter((m) => m.add > 0).map((m) => m.t);
    // Ruling R8: the stamina consumption is one deduction per activation, on the activation frame only.
    expect(frames[0].hpLoss).toBeCloseTo(near.hpPerActivation, 9);
    expect(frames[0].add).toBeCloseTo(near.targetSpeedAdd, 9);
    const charged = frames.filter((m) => m.hpLoss > 0).map((m) => m.t);
    expect(charged.length).toBe(2);
    expect(charged[0]).toBeCloseTo(10, 9);
    expect(charged[1]).toBeCloseTo(14, 9);
    // On [10, 12), cooldown [12, 13), next 2 s check at 14 -> on [14, 16).
    expect(on.filter((t) => t < 13).length).toBe(30);
    expect(on.some((t) => t >= 12 && t < 14 - 1e-9)).toBe(false);
    expect(on.some((t) => Math.abs(t - 14) < 1e-9)).toBe(true);
    expect(drive(state, constRng(0), 30, 3, { section: 16, phase: 1 }).every((m) => m.hpLoss === 0)).toBe(true);
  });

  test("secure lead: sections 11–15, stamina 20×strat×dist once per activation (R8)", () => {
    const { ctx } = setup({ style: 2 });
    // Senkou: speed coefficient 1.0, stamina coefficient 0.8; 2200 m distance coefficient 0.8.
    const lead = secureLeadEffect(ctx, false);
    expect(lead.hpPerActivation).toBeCloseTo(20 * 0.8 * 0.8, 9);
    expect(lead.targetSpeedAdd).toBeCloseTo(Math.sqrt(ctx.stats.guts / 2000) * 0.3 * 1, 9);
    const nige = setup({ style: 1 }).ctx;
    expect(secureLeadEffect(nige, false).hpPerActivation).toBeCloseTo(20 * 1 * 0.8, 9);
    expect(secureLeadEffect(nige, true).targetSpeedAdd).toBeCloseTo(secureLeadEffect(nige, false).targetSpeedAdd * 4, 9);
    // Oikomi has no one behind it: never secures a lead.
    const oikomi = setup({ style: 4 }).ctx;
    expect(secureLeadEffect(oikomi, false).hpPerActivation).toBe(0);

    // Senkou with a near rival every check: compete + secure lead both run 2 s on / 1 s off.
    const compete = competeBeforeSpurtEffect(ctx, false, false);
    const state = setup({ style: 2 }, field({ pNearbyRival: 1 })).state;
    const frames = drive(state, constRng(0), 0, 1, { section: 13, phase: 1 });
    expect(frames[0].hpLoss).toBeCloseTo(compete.hpPerActivation + lead.hpPerActivation, 9);
    expect(frames.slice(1).every((m) => m.hpLoss === 0)).toBe(true);
    expect(frames[0].add).toBeCloseTo(compete.targetSpeedAdd + lead.targetSpeedAdd, 9);
    // The 20% chance (rng 0.5 fails it) keeps secure lead off; compete still fires.
    const miss = setup({ style: 2 }, field({ pNearbyRival: 1 })).state;
    expect(drive(miss, scriptRng([0, 0, 0.5], 0.999), 0, 0, { section: 13, phase: 1 })[0].hpLoss).toBeCloseTo(compete.hpPerActivation, 9);
  });
});

describe("stamina keep", () => {
  test("stamina keep: target 1.035–1.04× needed HP; checks every 2 s; chance 30%×(wiz/1000 + wiz^0.03); blocks competitions; reset by a heal", () => {
    expect(staminaKeepChance(1000)).toBeCloseTo(0.3 * (1 + 1000 ** 0.03), 9);
    expect(staminaKeepChance(2500)).toBe(1);
    const rng = createRng(5);
    for (let i = 0; i < 200; i++) {
      const s = setup({}, field({}), rng).state;
      expect(s.keepRatio).toBeGreaterThanOrEqual(1.035);
      expect(s.keepRatio).toBeLessThanOrEqual(1.04);
    }
    // Plenty of HP: never enters keep, competitions fire.
    const rich = setup({ style: 4 }, field({ pNearbyRival: 1 })).state;
    expect(drive(rich, constRng(0), 0, 4, { section: 12, phase: 1, hp: 1e6 }).some((m) => m.hpLoss > 0)).toBe(true);
    expect(rich.enteredStaminaKeep).toBe(false);
    // Low HP: first check fails the chance roll (0.999), the next check 2 s later passes.
    const poor = setup({ style: 4 }, field({ pNearbyRival: 1 })).state;
    const frames = drive(poor, scriptRng([0.999], 0), 0, 6, { section: 12, phase: 1, hp: 10 });
    expect(poor.enteredStaminaKeep).toBe(true);
    expect(poor.staminaKeep).toBe(true);
    // The competition fired at t=0 (keep not yet active), then never again once keep starts at t=2.
    expect(frames.filter((m) => m.hpLoss > 0).every((m) => m.t < 2)).toBe(true);
    // A heal resets it; with HP now sufficient the competition can fire again.
    onHeal(poor);
    expect(poor.staminaKeep).toBe(false);
    expect(drive(poor, constRng(0), 20, 2, { section: 12, phase: 1, hp: 1e6 }).some((m) => m.hpLoss > 0)).toBe(true);
    // Outside sections 11-15 no check happens.
    const outside = setup({ style: 4 }).state;
    drive(outside, constRng(0), 0, 6, { section: 17, phase: 2, hp: 10 });
    expect(outside.enteredStaminaKeep).toBe(false);
  });

  test("simulateRun reports enteredStaminaKeep for a stamina-starved uma", () => {
    const input = { ...defaults, stats: { ...defaults.stats, stamina: 300 } };
    const ctx = raceContext(input, kyoto2200);
    const rng = createRng(2);
    let entered = 0;
    for (let i = 0; i < 20; i++) if (simulateRun(ctx, rng, { heals: [] }, initMechanics(input, ctx, rng)).enteredStaminaKeep) entered++;
    expect(entered).toBeGreaterThan(0);
  });
});

describe("spurt buffs", () => {
  test("stamina limit break: only if stamina > 1200, buff sqrt(sta−1200)×0.0085×distFactor×random; 2200 m factor 0.5", () => {
    // Raw 1600 -> base 1400 (halved over 1200), + green 60 -> 1460.
    expect(staminaLimitBreakBase(1460, 2200)).toBeCloseTo(Math.sqrt(260) * 0.0085 * 0.5, 12);
    expect(staminaLimitBreakBase(1460, 2100)).toBe(0);
    expect(staminaLimitBreakBase(1460, 2400)).toBeCloseTo(Math.sqrt(260) * 0.0085 * 1.0, 12);
    expect(staminaLimitBreakBase(1460, 2600)).toBeCloseTo(Math.sqrt(260) * 0.0085 * 1.5, 12);
    expect(staminaLimitBreakBase(1460, 3200)).toBeCloseTo(Math.sqrt(260) * 0.0085 * 1.8, 12);
    expect(staminaLimitBreakBase(1200, 3200)).toBe(0);
    const over = { stats: { ...defaults.stats, stamina: 1600 }, greens: { ...defaults.greens, sta60: 1 } };
    const rng = createRng(9);
    const base = staminaLimitBreakBase(1460, 2200);
    for (let i = 0; i < 200; i++) {
      const s = setup(over, field({}), rng).state;
      expect(s.slbBuff).toBeGreaterThanOrEqual(base * 0.95 - 1e-12);
      expect(s.slbBuff).toBeLessThanOrEqual(base * 1.02 + 1e-12);
    }
    expect(setup({ stats: { ...defaults.stats, stamina: 1600 } }).state.slbBuff).toBeCloseTo(Math.sqrt(200) * 0.0085 * 0.5 * 0.99, 2);
    expect(setup().state.slbBuff).toBe(0); // raw 1200 -> base 1200: no buff
    // Applied only after reaching max spurt speed, then held to the line.
    const { ctx, state } = setup(over);
    const plan = { speed: lastSpurtSpeedMax(ctx), startMeter: 1500, isMax: true };
    const view = { section: 18, phase: 2, meter: 1600, spurtPlan: plan };
    expect(drive(state, constRng(0.5), 100, 0, { ...view, speed: plan.speed - 0.5 })[0].add).toBe(0);
    expect(drive(state, constRng(0.5), 101, 0, { ...view, speed: plan.speed })[0].add).toBeCloseTo(state.slbBuff, 12);
    expect(drive(state, constRng(0.5), 102, 0, { ...view, speed: plan.speed - 0.5 })[0].add).toBeCloseTo(state.slbBuff, 12);
    // Not on a non-max plan.
    const { state: s2 } = setup(over);
    expect(drive(s2, constRng(0.5), 100, 0, { ...view, spurtPlan: { ...plan, isMax: false }, speed: plan.speed })[0].add).toBe(0);
  });

  test("zenkai: only Speed > 2000 (2000 → off), after reaching max spurt speed; accel 0.068×0.0006×sqrt(500·power)/(L/1000)^1.5; no cap; HP 0 → minimum speed immediately", () => {
    const fast = { stats: { ...defaults.stats, speed: 2001 } };
    const { ctx, state } = setup(fast);
    const accel = 0.068 * 0.0006 * Math.sqrt(500 * ctx.stats.power) / (2.2 ** 1.5);
    expect(zenkaiAccel(ctx.stats.power, 2200)).toBeCloseTo(accel, 15);
    expect(state.zenkaiEnabled).toBe(true);
    expect(setup({ stats: { ...defaults.stats, speed: 2000 } }).state.zenkaiEnabled).toBe(false);
    const plan = { speed: lastSpurtSpeedMax(ctx), startMeter: 1500, isMax: true };
    const view = { section: 18, phase: 2, meter: 1600, spurtPlan: plan };
    expect(drive(state, constRng(0.5), 100, 1, { ...view, speed: plan.speed - 1 }).every((m) => m.add === 0)).toBe(true);
    // Reached: the bonus grows by accel x dt every frame with no cap (100 s of frames).
    const frames = drive(state, constRng(0.5), 102, 100, { ...view, speed: plan.speed });
    expect(state.zenkaiActive).toBe(true);
    const growth = frames[frames.length - 1].add - frames[0].add;
    expect(growth).toBeCloseTo(accel * 100, 6);
    // Not on a non-max plan.
    const { state: off } = setup(fast);
    expect(drive(off, constRng(0.5), 0, 1, { ...view, spurtPlan: { ...plan, isMax: false }, speed: plan.speed }).every((m) => m.add === 0)).toBe(true);

    // In a run: out of HP during Zenkai drops speed to minimum speed at once; without Zenkai it decelerates.
    const runFrames = (speed: number) => {
      const input = { ...defaults, stats: { ...defaults.stats, speed, stamina: 2500 } };
      const c = raceContext(input, kyoto2200);
      const out: RunFrame[] = [];
      simulateRun(c, createRng(1), { heals: [{ meter: 2150, pct: -100 }] }, initMechanics(input, c, createRng(1), field({})), (f) => out.push({ ...f }));
      const empty = out.findIndex((f) => f.hp === 0);
      return { c, before: out[empty - 1], at: out[empty] ?? out[out.length - 1], next: out[empty + 1] };
    };
    const z = runFrames(2500);
    expect(z.before.speed).toBeGreaterThan(lastSpurtSpeedMax(z.c));
    expect(Math.min(z.at.speed, z.next?.speed ?? Infinity)).toBeCloseTo(z.c.minSpeed, 9);
    const plain = runFrames(2000);
    expect(plain.next.speed).toBeGreaterThan(plain.c.minSpeed + 0.5);
  });
});

test("mechanics are allocation-light: 1000 runs with mechanics stay within the budget", () => {
  const input = { ...defaults, toggles: { ...defaults.toggles, kakari: true } };
  const ctx = raceContext(input, { ...kyoto2200, length: 3200 });
  const rng = createRng(3);
  const t0 = performance.now();
  for (let i = 0; i < 1000; i++) simulateRun(ctx, rng, { heals: [] }, initMechanics(input, ctx, rng));
  expect(performance.now() - t0).toBeLessThan(1000);
});

describe("toggled mechanics", () => {
  const on = (over: Partial<StaminaInput["toggles"]>, extra: Partial<StaminaInput> = {}): Partial<StaminaInput> =>
    ({ ...extra, toggles: { dueling: false, spotStruggle: false, kakari: false, ...over } });
  const partners = field({ pSameStyleFrontRunner: 1, pDuelPartner: 1 });

  test("kakari toggle off → never rushed, even at wiz 1", () => {
    const input = { ...defaults, stats: { ...defaults.stats, wisdom: 1 } };
    const ctx = raceContext(input, kyoto2200);
    const rng = createRng(3);
    for (let i = 0; i < 300; i++) expect(initMechanics(input, ctx, rng).rushSection).toBe(0);
    const enabled = { ...input, toggles: { ...input.toggles, kakari: true } };
    expect(initMechanics(enabled, raceContext(enabled, kyoto2200), rng).rushSection).toBeGreaterThan(0);
  });

  test("spot struggle only for Front Runner / Oonige; HP ×1.4 / ×3.5, ×3.6 / ×7.7 while rushed; ends at section 9", () => {
    const hpAt = (style: 1 | 2 | 3 | 4 | 5, rushed = false, view: Partial<FrameView> = { section: 3, meter: 400 }) => {
      const { state } = setup(on({ spotStruggle: true }, { style }), partners);
      if (rushed) { state.rushed = true; state.rushNextSnap = 1e9; }
      return drive(state, constRng(0.999), 5, 1, view).map((m) => m.hpMul);
    };
    expect(hpAt(1).every((v) => v === 1.4)).toBe(true);
    expect(hpAt(5).every((v) => v === 3.5)).toBe(true);
    expect(hpAt(1, true).every((v) => v === 3.6)).toBe(true);
    expect(hpAt(5, true).every((v) => v === 7.7)).toBe(true);
    for (const style of [2, 3, 4] as const) expect(hpAt(style).every((v) => v === 1)).toBe(true);
    // Toggle off, no partner, before 150 m, and from section 6 on: no struggle.
    expect(setup(on({}, { style: 1 }), partners).state.ssEnabled).toBe(false);
    const lone = setup(on({ spotStruggle: true }, { style: 1 }), field({ pSameStyleFrontRunner: 0 })).state;
    expect(drive(lone, constRng(0.999), 5, 1, { section: 3, meter: 400 }).every((m) => m.hpMul === 1)).toBe(true);
    expect(hpAt(1, false, { section: 3, meter: 100 }).every((v) => v === 1)).toBe(true);
    expect(hpAt(1, false, { section: 6, meter: 700 }).every((v) => v === 1)).toBe(true);
    // Ends at section 9 even though the duration has not expired, and is once per race.
    const { state } = setup(on({ spotStruggle: true }, { style: 1 }), partners);
    expect(drive(state, constRng(0.999), 5, 0.5, { section: 5, meter: 500 })[0].hpMul).toBe(1.4);
    expect(drive(state, constRng(0.999), 5.6, 0.2, { section: 9, meter: 900 }).every((m) => m.hpMul === 1)).toBe(true);
    expect(drive(state, constRng(0.999), 6, 1, { section: 4, meter: 450 }).every((m) => m.hpMul === 1)).toBe(true);
  });

  test("spot struggle duration (700·guts)^0.5×0.012×styleProf s; target +(500·guts)^0.6×0.0001", () => {
    const { state, ctx } = setup(on({ spotStruggle: true }, { style: 1, aptitude: { ground: "A", distance: "A", style: "B" } }), partners);
    const fx = spotStruggleEffect(ctx.stats.guts, 0.85);
    expect(fx.duration).toBeCloseTo(Math.sqrt(700 * ctx.stats.guts) * 0.012 * 0.85, 9);
    expect(fx.targetSpeedAdd).toBeCloseTo((500 * ctx.stats.guts) ** 0.6 * 0.0001, 9);
    expect(state.pre.ssDuration).toBeCloseTo(fx.duration, 9);
    const frames = drive(state, constRng(0.999), 5, fx.duration + 2, { section: 3, meter: 400 });
    const active = frames.filter((m) => m.hpMul === 1.4);
    expect(active.every((m) => m.add === fx.targetSpeedAdd)).toBe(true);
    expect(active[0].t).toBeCloseTo(5, 9);
    expect(active[active.length - 1].t).toBeGreaterThan(5 + fx.duration - 2 * DT);
    expect(active[active.length - 1].t).toBeLessThan(5 + fx.duration);
    expect(frames[frames.length - 1].add).toBe(0);
  });

  test("dueling: final straight only, needs HP ≥ 15%, ends below 5%; +(200·guts)^0.708×0.0001 target", () => {
    const { state, ctx } = setup(on({ dueling: true }), partners);
    const fx = duelingEffect(ctx.stats.guts);
    expect(fx.targetSpeedAdd).toBeCloseTo((200 * ctx.stats.guts) ** 0.708 * 0.0001, 9);
    expect(fx.accelAdd).toBeCloseTo((160 * ctx.stats.guts) ** 0.59 * 0.0001, 9);
    const fs = ctx.finalStraightStart;
    const view = (meter: number, pct: number) => ({ meter, hp: (pct / 100) * ctx.maxHp, section: 20, phase: 3 });
    // Before the final straight: nothing.
    expect(drive(state, constRng(0.999), 0, 3, view(fs - 50, 80)).every((m) => m.add === 0)).toBe(true);
    // On it: HP 14% blocks the start (even after the 2 s clock), 80% starts it.
    expect(drive(state, constRng(0.999), 3, 3, view(fs + 10, 14)).every((m) => m.add === 0)).toBe(true);
    expect(drive(state, constRng(0.999), 6, 1, view(fs + 20, 80)).every((m) => m.add === fx.targetSpeedAdd)).toBe(true);
    // Below 5% ends it, and it cannot restart under 15%.
    expect(drive(state, constRng(0.999), 7, 1, view(fs + 40, 4.9)).every((m) => m.add === 0)).toBe(true);
    expect(drive(state, constRng(0.999), 8, 1, view(fs + 60, 10)).every((m) => m.add === 0)).toBe(true);
    // Proximity clock: exactly 2 s after entering with healthy HP.
    const fresh = setup(on({ dueling: true }), partners).state;
    expect(drive(fresh, constRng(0.999), 20, 3, view(fs + 1, 80)).find((m) => m.add > 0)!.t).toBeCloseTo(22, 9);
    // No partner, or toggle off: never.
    const none = setup(on({ dueling: true }), field({ pDuelPartner: 0 })).state;
    expect(drive(none, constRng(0.999), 20, 4, view(fs + 1, 80)).every((m) => m.add === 0)).toBe(true);
    const off = setup(on({}), partners).state;
    expect(drive(off, constRng(0.999), 20, 4, view(fs + 1, 80)).every((m) => m.add === 0)).toBe(true);
  });

  test("toggles off → result identical to a run where triggers are impossible", () => {
    const trace = (input: StaminaInput, f: GenericField) => {
      const ctx = raceContext(input, kyoto2200);
      const rng = createRng(7);
      const mech = initMechanics(input, ctx, rng, f);
      const hps: number[] = [];
      const out = simulateRun(ctx, rng, { heals: [] }, mech, (fr) => hps.push(fr.hp));
      return { out, hps };
    };
    const base = { ...defaults, style: 1 as const };
    const bothOn = { ...base, toggles: { ...base.toggles, spotStruggle: true, dueling: true } };
    const off = trace(base, partners);
    const impossible = trace(bothOn, field({ pSameStyleFrontRunner: 0, pDuelPartner: 0 }));
    expect(impossible.out).toEqual(off.out);
    expect(impossible.hps).toEqual(off.hps);
    // Sanity: with the toggles on and partners present the run really changes.
    expect(trace(bothOn, partners).out.finalHp).toBeLessThan(off.out.finalHp);
  });
});
