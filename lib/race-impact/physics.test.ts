import { describe, expect, test } from "bun:test";
import { loadRacetracks } from "../data/registry";
import { flattenCourse } from "../api/course-format";
import { defaultRaceImpactProfile } from "./profile";
import {
  NO_EFFECT, baselineMeterAt, baselineTimelineOf, bashinGain, distanceGainMeters, effectValues, getCruisingTargetSpeed,
  resumeIndexFor, resumeStateFor, simulateRun, simulateRunWindows, simulateRunWithStates, simulationInputFor,
  baseAccelAt, downhillTargetBonus, hpAtMeter, hpConsumptionPerSecond, maxHp, nextDownhillProbability, sectionRandomMean, slopeAt, uphillTargetPenalty,
  minimumSpeed, expectedLaneProfile,
} from "./trace";
import { HORSE_LANE_METERS, LANE_MODEL, cornerLossMeters, extraMoveLane, laneGeometryFor } from "./lanes";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const course = { id: 1, trackId: 10006, length: 2400, terrain: 1, turn: 1, distance: 3, inout: 1, corners: [], straights: [], slopes: [], spurtStart: { meters: 1600 } };
const profile = defaultRaceImpactProfile();
const input = simulationInputFor(course, profile, 2);

describe("physics v3: last-spurt target speed (R7.1)", () => {
  // Kyoto 2200 (course 10808): spurt starts at the late-race start, 1467 m.
  const kyoto = { ...course, id: 10808, length: 2200, spurtStart: { meters: 1467 }, statThresholds: [1] };
  test("style 3 spurt target uses the late-race coefficient with the speed term inside the x1.05 bracket (U-tools 25.445)", () => {
    expect(Math.abs(getCruisingTargetSpeed(3, 2200, profile.stats, 3) - 25.445)).toBeLessThan(0.1);
  });
  test("the simulated style-3 run reaches the spurt target of its ADJUSTED stats (speed 2040 on Kyoto: ~25.2 m/s)", () => {
    const sim = simulationInputFor(kyoto, profile, 3);
    expect(sim.stats.speed).toBe(2040); // 1200 + (2200 - 1200) / 2 = 1700, x1.2 course speed bonus
    const run = simulateRun(sim, null, 0, NO_EFFECT);
    const top = Math.max(...run.points.map((p) => p.speed));
    expect(Math.abs(top - getCruisingTargetSpeed(3, 2200, sim.stats, 3))).toBeLessThan(1e-9);
    expect(top).toBeGreaterThan(25.1);
    expect(top).toBeLessThan(25.3);
  });
});

describe("multiple activation windows (R7.3)", () => {
  const accel = effectValues([{ type: 31, value: 4000 }]);
  const target = effectValues([{ type: 27, value: 2500 }]);
  test("a single window equals the single-activation signature", () => {
    const a = simulateRun(input, 1600, 2.4, accel);
    const b = simulateRunWindows(input, [{ meter: 1600, duration: 2.4, values: accel }]);
    expect(b.finishTime).toBe(a.finishTime);
    expect(b.activationTime).toBe(a.activationTime);
  });
  test("two windows activate independently and gain more than either alone", () => {
    const base = simulateRun(input, null, 0, NO_EFFECT).finishTime;
    const one = simulateRun(input, 1100, 7.2, target).finishTime;
    const two = simulateRun(input, 1600, 2.4, accel).finishTime;
    const both = simulateRunWindows(input, [{ meter: 1100, duration: 7.2, values: target }, { meter: 1600, duration: 2.4, values: accel }]);
    expect(base - both.finishTime).toBeGreaterThan(Math.max(base - one, base - two));
    expect(both.activationTimes).toHaveLength(2);
    expect(both.activationTimes[1]!).toBeGreaterThan(both.activationTimes[0]!);
  });
  test("resume from the earliest window's meter is exact", () => {
    const states = simulateRunWithStates(input).states;
    const windows = [{ meter: 1600, duration: 2.4, values: accel }, { meter: 1100, duration: 7.2, values: target }];
    const full = simulateRunWindows(input, windows);
    const idx = resumeIndexFor(states, 1100);
    const resumed = simulateRunWindows(input, windows, { ...states[idx], index: idx });
    expect(Math.abs(resumed.finishTime - full.finishTime)).toBeLessThan(1e-9);
  });
});

describe("physics v2", () => {
  test("acceleration below target is constant (linear ramp), not proportional to the gap", () => {
    const run = simulateRun(input, null, 0, NO_EFFECT);
    // pick three consecutive frames in the spurt ramp-up after 1600 m
    const ramp = run.points.filter((p) => p.meter > 1600 && p.speed < p.targetSpeed - 0.2).slice(0, 3);
    expect(ramp).toHaveLength(3);
    const d1 = ramp[1].speed - ramp[0].speed;
    const d2 = ramp[2].speed - ramp[1].speed;
    expect(Math.abs(d1 - d2)).toBeLessThan(1e-9);
    // Adjusted power: 1200 + (1700 - 1200) / 2 = 1450. 0.0006 * sqrt(500*1450) * 0.996 / 15 ≈ 0.03392 per frame
    expect(input.stats.power).toBe(1450);
    expect(d1).toBeCloseTo(0.0006 * Math.sqrt(500 * 1450) * 0.996 / 15, 6);
  });

  test("start dash caps speed at 0.85 x base speed until the dash ends", () => {
    const run = simulateRun(input, null, 0, NO_EFFECT);
    const cap = 0.85 * (20 - (2400 - 2000) / 1000);
    // The dash ends the frame after speed reaches the cap; that frame must land exactly on it (no 24 m/s^2 overshoot).
    const first = run.points.findIndex((p) => p.speed >= cap - 1e-9);
    expect(first).toBeGreaterThan(0);
    for (let i = 0; i <= first; i++) expect(run.points[i].speed).toBeLessThanOrEqual(cap + 1e-9);
    // After the dash the minimum speed (step 4b) lifts speed at once; then only normal acceleration applies.
    expect(run.points[first + 1].speed).toBeCloseTo(minimumSpeed(20 - (2400 - 2000) / 1000, input.stats.guts), 9);
    expect(run.points[first + 2].speed - run.points[first + 1].speed).toBeLessThan(0.1);
  });

  test("type 21 current speed adds distance only while active and leaves current speed unchanged afterwards", () => {
    const base = simulateRun(input, null, 0, NO_EFFECT);
    const eff = effectValues([{ type: 21, value: 3500 }]);
    const run = simulateRun(input, 1000, 2.4, eff);
    expect(run.finishTime).toBeLessThan(base.finishTime);
    const after = run.points.find((p) => p.t > (run.activationTime ?? 0) + 3)!;
    const baseAt = base.points.find((p) => p.t >= after.t)!;
    expect(after.speed).toBeCloseTo(baseAt.speed, 6);
  });

  test("type 22 carries the value into current speed at expiry, then decays", () => {
    const eff = effectValues([{ type: 22, value: 3500 }]);
    expect(eff.carryCurrent).toBeCloseTo(0.35, 10);
    const run = simulateRun(input, 1000, 2.4, eff);
    const end = (run.activationTime ?? 0) + 2.4;
    const justAfter = run.points.find((p) => p.t > end)!;
    expect(justAfter.speed).toBeGreaterThan(justAfter.targetSpeed);
    const later = run.points.find((p) => p.t > end + 2)!;
    expect(later.speed).toBeCloseTo(later.targetSpeed, 2);
  });

  test("speed never drops below target by decelerating past it", () => {
    const eff = effectValues([{ type: 27, value: 3500 }]);
    const run = simulateRun(input, 1000, 2.4, eff);
    // Speed may sit below target while accelerating, but a frame that lost speed must stop at the target.
    for (let i = 1; i < run.points.length; i++) {
      const p = run.points[i];
      if (p.speed < run.points[i - 1].speed) expect(p.speed).toBeGreaterThanOrEqual(p.targetSpeed - 1e-9);
    }
  });

  test("bashin uses the profile reference speed when set (time gain x speed / 2.5)", () => {
    const timeline = { times: [0, 1, 2, 3], meters: [0, 10, 20, 30] };
    expect(bashinGain(timeline, 3, 2.9, 30, { ...profile, bashinReferenceSpeed: 25 })).toBeCloseTo(0.1 * 25 / 2.5, 10);
  });

  test("default bashin is the interpolated position gap when the faster run finishes (not frame-quantised)", () => {
    // Baseline at t=2.5 s is at 25 m (between frames at 20 m and 30 m): gap 5 m = 2 Bashin.
    const timeline = { times: [0, 1, 2, 3], meters: [0, 10, 20, 30] };
    expect(baselineMeterAt(timeline, 2.5)).toBeCloseTo(25, 10);
    expect(distanceGainMeters(timeline, 3, 2.5, 30, profile)).toBeCloseTo(5, 10);
    expect(bashinGain(timeline, 3, 2.5, 30, profile)).toBeCloseTo(2, 10);
    expect(bashinGain(timeline, 3, 3.2, 30, profile)).toBe(0);
  });

  test("position-gap bashin on a real run is about time gain x finishing speed, above the base-speed conversion", () => {
    const base = simulateRunWithStates(input);
    const run = simulateRun(input, 1600, 2.4, effectValues([{ type: 31, value: 4000 }]));
    const timeline = baselineTimelineOf(base.states, base.finishTime, input.courseLength);
    const gain = bashinGain(timeline, base.finishTime, run.finishTime, input.courseLength, profile);
    const timeBased = (base.finishTime - run.finishTime) * 19.6 / 2.5;
    expect(gain / timeBased).toBeGreaterThan(1.2);
  });

  test("effect multiplier scales values but not duration", () => {
    const v = effectValues([{ type: 31, value: 3000 }], 1.1);
    expect(v.accel).toBeCloseTo(0.33, 10);
  });
});

describe("simulateRun resume (exact baseline-state resume)", () => {
  const kinds = [21, 22, 27, 31];
  for (const type of kinds) {
    for (const am of [0, 300, 1467, 1900]) {
      test(`type ${type} @ ${am} m: resumed run equals full run`, () => {
        const baseRun = simulateRunWithStates(input);
        const vals = effectValues([{ type, value: type === 31 ? 3000 : 3500 }]);
        const full = simulateRun(input, am, 2.4, vals);
        const idx = resumeIndexFor(baseRun.states, am);
        const resumed = simulateRun(input, am, 2.4, vals, { ...baseRun.states[idx], index: idx });
        expect(Math.abs(resumed.finishTime - full.finishTime)).toBeLessThan(1e-9);
        expect(resumed.activationTime).toBe(full.activationTime);
        if (am > 0) expect(resumed.points.length).toBeLessThan(full.points.length);
      });
    }
  }
  test("baseline finish time matches simulateRun", () => {
    expect(simulateRunWithStates(input).finishTime).toBe(simulateRun(input, null, 0, NO_EFFECT).finishTime);
  });
});

describe("slopes (engine step 3; mechanics §Slope Modifier, §Base Acceleration; checked against umasim classic results)", () => {
  // Kyoto 10808 slopes as stored (raw/10000 = gradient %): up 2% 1050-1150, up 1% 1150-1375, down 2% 1375-1525.
  const kyotoSlopes = [{ start: 1050, end: 1150, slope: 20000 }, { start: 1150, end: 1375, slope: 10000 }, { start: 1375, end: 1525, slope: -20000 }];

  test("slopeAt reads the gradient % (raw/10000), bounds inclusive, first segment wins, 0 off-slope", () => {
    const per = kyotoSlopes.map((s) => ({ start: s.start, end: s.end, per: s.slope / 10_000 }));
    expect(slopeAt(per, 1100)).toBe(2);
    expect(slopeAt(per, 1150)).toBe(2);
    expect(slopeAt(per, 1200)).toBe(1);
    expect(slopeAt(per, 1400)).toBe(-2);
    expect(slopeAt(per, 1600)).toBe(0);
    expect(slopeAt([], 10)).toBe(0);
  });

  test("uphill target penalty = SlopePer x 200 / adjusted Power (from 1%); none below 1% or downhill", () => {
    expect(uphillTargetPenalty(2, 1450)).toBeCloseTo(400 / 1450, 12); // 0.27586
    expect(uphillTargetPenalty(1, 1350)).toBeCloseTo(200 / 1350, 12); // 0.14815
    expect(uphillTargetPenalty(0.5, 1450)).toBe(0);
    expect(uphillTargetPenalty(-2, 1450)).toBe(0);
  });

  test("BaseAccel is 0.0004 uphill (from 1%), 0.0006 otherwise", () => {
    expect(baseAccelAt(2)).toBe(0.0004);
    expect(baseAccelAt(1)).toBe(0.0004);
    expect(baseAccelAt(0)).toBe(0.0006);
    expect(baseAccelAt(-2)).toBe(0.0006);
  });

  test("downhill accel mode: +0.3 + |SlopePer|/10 m/s; per-second Markov entry WizStat x 0.04%, exit 20%", () => {
    expect(downhillTargetBonus(-2)).toBeCloseTo(0.5, 12);
    expect(downhillTargetBonus(-1)).toBeCloseTo(0.4, 12);
    expect(nextDownhillProbability(0, 1200)).toBeCloseTo(0.48, 12);
    expect(nextDownhillProbability(0.48, 1200)).toBeCloseTo(0.48 * 0.8 + 0.52 * 0.48, 12); // 0.6336
    expect(nextDownhillProbability(1, 1200)).toBeCloseTo(0.8, 12);
    expect(nextDownhillProbability(0, 5000)).toBe(1); // entry chance capped at 100%
  });

  const sloped = { ...course, slopes: [{ start: 700, end: 900, slope: 20000 }, { start: 1000, end: 1300, slope: -20000 }] };

  test("simulateRun: target speed on an uphill is the phase target minus the penalty; accel uses 0.0004", () => {
    const sim = { ...simulationInputFor(sloped, profile, 2), downhillMode: false };
    const flat = simulateRun(input, null, 0, NO_EFFECT);
    const run = simulateRun(sim, null, 0, NO_EFFECT);
    const up = run.points.find((p) => p.meter > 760 && p.meter < 860)!;
    const flatUp = flat.points.find((p) => p.t >= up.t)!;
    expect(up.targetSpeed).toBeCloseTo(flatUp.targetSpeed - 400 / 1450, 9);
    expect(run.finishTime).toBeGreaterThan(flat.finishTime);
    // Accel while below target on the uphill uses BaseAccel 0.0004 (adjusted power 1450, Pace mid-race coef 1.0).
    const sameAsFlat = { ...sim, slopes: [{ start: 700, end: 900, per: 2 }], stats: sim.stats };
    const boosted = simulateRun(sameAsFlat, 700, 6, effectValues([{ type: 27, value: 5000 }]));
    const ramp = boosted.points.filter((p) => p.meter > 700 && p.meter < 880 && p.speed < p.targetSpeed - 0.05).slice(0, 2);
    expect(ramp).toHaveLength(2);
    expect(ramp[1].speed - ramp[0].speed).toBeCloseTo(0.0004 * Math.sqrt(500 * 1450) * 1 / 15, 9);
  });

  test("simulateRun: the downhill expected bonus raises target speed; off when downhillMode is false (as in the umasim fixture runs)", () => {
    const on = simulateRun(simulationInputFor(sloped, profile, 2), null, 0, NO_EFFECT);
    const off = simulateRun({ ...simulationInputFor(sloped, profile, 2), downhillMode: false }, null, 0, NO_EFFECT);
    const late = (r: typeof on) => r.points.find((p) => p.meter > 1250 && p.meter < 1300)!;
    // After several seconds downhill the in-mode probability is near its 0.48/0.68 steady state.
    expect(late(on).targetSpeed - late(off).targetSpeed).toBeGreaterThan(0.3);
    expect(late(on).targetSpeed - late(off).targetSpeed).toBeLessThan(0.5);
    expect(on.finishTime).toBeLessThan(off.finishTime);
  });

  test("resume from a baseline state on a sloped course is exact (downhill state is part of RunState)", () => {
    const sim = simulationInputFor(sloped, profile, 2);
    const states = simulateRunWithStates(sim).states;
    const vals = effectValues([{ type: 27, value: 3500 }]);
    for (const am of [1100, 1250]) {
      const full = simulateRun(sim, am, 2.4, vals);
      const idx = resumeIndexFor(states, am);
      expect(Math.abs(simulateRun(sim, am, 2.4, vals, { ...states[idx], index: idx }).finishTime - full.finishTime)).toBeLessThan(1e-9);
    }
  });
});

describe("section randomness at its mean (engine step 3b, R21; mechanics §Randomness Per Section)", () => {
  test("mean = Max - 0.325% with Max = Wiz/5500 x log10(Wiz x 0.1) %: +0.1286% of base speed at wisdom 1200", () => {
    expect(sectionRandomMean(1200)).toBeCloseTo((1200 / 5500) * Math.log10(120) * 0.01 - 0.00325, 12);
    expect(sectionRandomMean(1200)).toBeCloseTo(0.0012864, 6);
    // Doc examples: 400 Wiz Max +0.117%, 800 Wiz Max +0.277% (mean = Max - 0.325%).
    expect(sectionRandomMean(400) + 0.00325).toBeCloseTo(0.00117, 5);
    expect(sectionRandomMean(800) + 0.00325).toBeCloseTo(0.00277, 5);
  });

  test("simulateRun: phases 0-2 target = base target + BaseSpeed x mean; the last spurt is unaffected", () => {
    const run = simulateRun(input, null, 0, NO_EFFECT);
    const mean = sectionRandomMean(input.stats.wisdom) * (20 - (2400 - 2000) / 1000);
    const mid = run.points.find((p) => p.phase === 1 && p.meter > 1000)!;
    expect(mid.targetSpeed).toBeCloseTo(getCruisingTargetSpeed(1, 2400, input.stats, 2) + mean, 12);
    const spurt = run.points.find((p) => p.phase === 3)!;
    expect(spurt.targetSpeed).toBeCloseTo(getCruisingTargetSpeed(3, 2400, input.stats, 2), 12);
  });
});

describe("HP model (engine step 4.1; mechanics §Stamina, §HP Consumption)", () => {
  test("MaxHP = CourseDistance + 0.8 x StrategyCoef x adjusted Stamina (Kyoto 2200, Pace Chaser, stamina 1500: 3268)", () => {
    expect(maxHp(2200, 1500, 2)).toBeCloseTo(3268, 9);
    expect(maxHp(3200, 1500, 2)).toBeCloseTo(4268, 9);
    expect(maxHp(2000, 1000, 1)).toBeCloseTo(2000 + 0.8 * 0.95 * 1000, 9);
    expect(maxHp(2000, 1000, 3)).toBeCloseTo(2800, 9);
  });

  test("HP per second = 20 (v - BaseSpeed + 12)^2 / 144 x ground, x guts modifier 1 + 200 / sqrt(600 Guts) from the late race", () => {
    expect(hpConsumptionPerSecond(20, 20, 1, false, 1350)).toBeCloseTo(20, 12);
    expect(hpConsumptionPerSecond(24, 20, 1, false, 1350)).toBeCloseTo(20 * 256 / 144, 12);
    expect(hpConsumptionPerSecond(24, 20, 1.02, true, 600)).toBeCloseTo(20 * 256 / 144 * 1.02 * (1 + 200 / Math.sqrt(360000)), 12);
  });

  test("baseline states carry HP from MaxHP down; HP never changes the motion (assumed sufficient)", () => {
    const { states, finishTime } = simulateRunWithStates(input);
    expect(states[0].hp).toBeCloseTo(maxHp(2400, input.stats.stamina, 2), 9);
    for (let i = 1; i < states.length; i++) expect(states[i].hp!).toBeLessThan(states[i - 1].hp!);
    expect(finishTime).toBe(simulateRun(input, null, 0, NO_EFFECT).finishTime);
  });

  test("hpAtMeter reads the HP of the frame a trigger at that meter fires on", () => {
    const { states } = simulateRunWithStates(input);
    const idx = resumeIndexFor(states, 1000);
    expect(hpAtMeter(states, 1000)).toBe(states[idx + 1].hp!);
    expect(hpAtMeter(states, 0)).toBe(states[0].hp!);
  });
});

describe("minimum speed (engine step 4b; mechanics §Minimum Speed)", () => {
  test("MinSpeed = 0.85 x BaseSpeed + 0.001 x sqrt(200 x adjusted Guts)", () => {
    expect(minimumSpeed(19.8, 1500)).toBeCloseTo(0.85 * 19.8 + 0.001 * Math.sqrt(300_000), 12);
  });

  test("after the start dash speed never drops below the minimum; the first post-dash frame jumps to it", () => {
    const { states } = simulateRunWithStates(input);
    const minSpeed = minimumSpeed(20 - (2400 - 2000) / 1000, input.stats.guts);
    const firstAfter = states.findIndex((s) => !s.startDash);
    expect(firstAfter).toBeGreaterThan(0);
    // states record the frame start: the dash ends during frame firstAfter - 1, which already lands on the minimum.
    for (const s of states.slice(firstAfter)) expect(s.speed).toBeGreaterThanOrEqual(minSpeed - 1e-12);
    expect(states[firstAfter].speed).toBeCloseTo(minSpeed, 12);
    expect(states[firstAfter - 1].speed).toBeLessThan(minSpeed);
  });
});

describe("corner lane loss (engine step 4b; R33 lane model from the mechanics doc, fitted to umasim lanestat)", () => {
  const cornered = {
    ...course, corners: [{ start: 400, end: 700 }, { start: 700, end: 950 }, { start: 1450, end: 1700 }, { start: 1700, end: 1950 }],
    straights: [{ start: 0, end: 400, frontType: 2 }, { start: 950, end: 1450, frontType: 2 }, { start: 1950, end: 2400, frontType: 1 }],
  };
  const lanesInput = simulationInputFor(cornered, profile, 2);

  test("extra move lane: min(5 x lane, 5.625 m) plus the fitted mean of the random term (mechanics §Extra Move Lane)", () => {
    expect(extraMoveLane(0.3)).toBeCloseTo(1.5 + LANE_MODEL.extraLaneNoise, 12);
    expect(extraMoveLane(2)).toBeCloseTo(5.625 + LANE_MODEL.extraLaneNoise, 12);
  });

  test("R33 fit: the expected lane follows umasim lanestat (style 2, 21 courses): lane RMS under 0.14 m, per-corner loss RMS under 0.1 m", async () => {
    const stats = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/lanestat/lanestat-classic.json"), "utf8"));
    const tracks = await loadRacetracks();
    let lane2 = 0, laneN = 0, corner2 = 0, cornerN = 0;
    for (const s of stats) {
      if (!s.corners.length) continue;
      let c: ReturnType<typeof flattenCourse> | undefined;
      for (const t of tracks) { const r = t.courses.find((x) => x.id === s.courseId); if (r) c = flattenCourse(r); }
      const lp = expectedLaneProfile({ ...simulationInputFor(c!, profile, 2, 1), downhillMode: false })!;
      s.lane25.forEach((v: number, i: number) => { lane2 += (lp.laneAt(i * 25) - v) ** 2; laneN++; });
      s.corners.forEach(([a, b]: number[], ci: number) => {
        let loss = 0;
        for (let m = Math.ceil(a); m < b; m++) loss += lp.lossRate[m + lp.offset];
        corner2 += (loss - s.perCorner[ci]) ** 2; cornerN++;
      });
    }
    expect(Math.sqrt(lane2 / laneN)).toBeLessThan(0.14);
    expect(Math.sqrt(corner2 / cornerN)).toBeLessThan(0.1);
  });

  test("geometry: start lane 1 horse lane (0.625 m), loss = step x (pi/2) x lane / corner length (quarter-turn corner)", () => {
    expect(HORSE_LANE_METERS).toBeCloseTo(0.625, 12);
    expect(cornerLossMeters(20, 2, 250)).toBeCloseTo((20 * Math.PI / 2 * 2) / 250, 12);
    expect(laneGeometryFor(cornered)).toEqual({ corners: cornered.corners.map(({ start, end }) => ({ start, end })), extraLaneAt: 1700 });
    expect(laneGeometryFor(course)).toBeNull();
  });

  test("a straight-only course has no loss; corners slow the run down (0.1-0.3 s here)", () => {
    expect(lanesInput.lanes).toBeTruthy();
    const withLoss = simulateRun(lanesInput, null, 0, NO_EFFECT).finishTime;
    const without = simulateRun({ ...lanesInput, lanes: null }, null, 0, NO_EFFECT).finishTime;
    expect(withLoss - without).toBeGreaterThan(0.1);
    expect(withLoss - without).toBeLessThan(0.3);
    expect(simulationInputFor(course, profile, 2).lanes).toBeNull();
  });

  test("the expected lane profile is deterministic, starts at 0.625 m and widens to the extra move lane after the final corner", () => {
    const a = expectedLaneProfile(lanesInput)!, b = expectedLaneProfile({ ...lanesInput })!;
    expect(Array.from(a.lane)).toEqual(Array.from(b.lane));
    expect(a.laneAt(0)).toBeCloseTo(0.625, 6);
    const mid = a.laneAt(1200), last = a.laneAt(2300);
    expect(mid).toBeGreaterThan(0.05);
    expect(mid).toBeLessThan(0.625);
    expect(last).toBeGreaterThan(1);
  });

  test("loss only in corners: positions match the no-loss run until the first corner", () => {
    const { states } = simulateRunWithStates(lanesInput);
    const plain = simulateRunWithStates({ ...lanesInput, lanes: null }).states;
    const before = states.findIndex((s) => s.meter > 400);
    for (let i = 0; i < before; i++) expect(states[i].meter).toBe(plain[i].meter);
    expect(states[before + 40].meter).toBeLessThan(plain[before + 40].meter);
  });

  test("resume from a baseline state on a cornered course is exact", () => {
    const { states } = simulateRunWithStates(lanesInput);
    const v = effectValues([{ type: 27, value: 3500 }]);
    for (const am of [500, 1500, 1800]) {
      const idx = resumeIndexFor(states, am);
      const full = simulateRun(lanesInput, am, 3, v).finishTime;
      expect(simulateRun(lanesInput, am, 3, v, { ...states[idx], index: idx }).finishTime).toBe(full);
    }
  });
});

describe("start run-up (engine step 4b; mdb race_course_set.run_up: the horse starts runUp metres behind 0)", () => {
  const runUpInput = { ...input, runUp: 50 };
  test("the horse crosses 0 m already moving and the clock starts there: ~0.45 s faster than a standing start", () => {
    const plain = simulateRun(input, null, 0, NO_EFFECT).finishTime;
    const run = simulateRunWithStates(runUpInput);
    expect(plain - run.finishTime).toBeGreaterThan(0.4);
    expect(plain - run.finishTime).toBeLessThan(0.55);
    expect(run.states[0].meter).toBeGreaterThanOrEqual(0);
    expect(run.states[0].time).toBeGreaterThanOrEqual(0);
    expect(run.states[0].speed).toBeGreaterThan(10);
    expect(run.finishTime).toBe(simulateRun(runUpInput, null, 0, NO_EFFECT).finishTime);
  });

  test("resume from a run-up baseline state is exact", () => {
    const { states } = simulateRunWithStates(runUpInput);
    const v = effectValues([{ type: 31, value: 4000 }]);
    for (const am of [0, 300, 1700]) {
      // Step 4c: a skill at 0 m activates inside the frame crossing the start line, which is not recorded: no resume.
      expect(simulateRun(runUpInput, am, 3, v, resumeStateFor(states, am)).finishTime).toBe(simulateRun(runUpInput, am, 3, v).finishTime);
    }
  });

  test("simulationInputFor carries the course run-up", () => {
    expect(simulationInputFor({ ...course, runUp: 60 } as never, profile, 2).runUp).toBe(60);
    expect(simulationInputFor(course, profile, 2).runUp ?? 0).toBe(0);
  });
});

describe("sub-frame phase entry (engine step 4c; continuous in position)", () => {
  // A one-frame jump in the spurt entry is ~0.34 m (~0.135 Bashin, ~0.015 s); a 0.01 m shift must move the gain by far less.
  const skill = { current: 0.15, carryCurrent: 0, target: 0, accel: 0 };
  const gainFor = (sim: ReturnType<typeof simulationInputFor>) =>
    simulateRun(sim, null, 0, NO_EFFECT).finishTime - simulateRun(sim, 1200, 3, skill).finishTime;
  const maxAdjacentJump = (gains: number[]) => Math.max(...gains.slice(1).map((g, i) => Math.abs(g - gains[i])));
  const steps = Array.from({ length: 160 }, (_, i) => i * 0.01);

  test("shifting the spurt point by 0.01 m (over 1.6 m, more than a frame) changes the gain by far less than a frame", () => {
    for (const base of [1600, 1700.3]) {
      const gains = steps.map((d) => gainFor({ ...input, spurt: base + d }));
      expect(maxAdjacentJump(gains)).toBeLessThan(0.0005);
    }
  });

  test("shifting the starting position by 0.01 m (via the run-up) changes the gain by far less than a frame", () => {
    const gains = steps.map((d) => gainFor({ ...input, runUp: 1 + d }));
    expect(maxAdjacentJump(gains)).toBeLessThan(0.0005);
  });

  test("shifting a slope boundary by 0.01 m changes the gain by far less than a frame (slope entry is sub-frame too)", () => {
    // An uphill inside the spurt: the horse is still accelerating, so a one-frame slope entry used to persist as a speed gap.
    for (const start of [1700, 1750.5]) {
      const gains = steps.map((d) => gainFor({ ...input, slopes: [{ start: start + d, end: 1950, per: 1.5 }] }));
      expect(maxAdjacentJump(gains)).toBeLessThan(0.0005);
      const ends = steps.map((d) => gainFor({ ...input, slopes: [{ start: 1500, end: start + d, per: -1.5 }] }));
      expect(maxAdjacentJump(ends)).toBeLessThan(0.0005);
    }
  });

  test("the spurt target is still reached and the spurt still starts at the spurt point", () => {
    const run = simulateRun(input, null, 0, NO_EFFECT);
    const before = run.points.filter((p) => p.meter < 1600 - 2);
    expect(Math.max(...before.map((p) => p.speed))).toBeLessThan(getCruisingTargetSpeed(3, 2400, input.stats, 2) - 0.5);
    expect(Math.abs(Math.max(...run.points.map((p) => p.speed)) - getCruisingTargetSpeed(3, 2400, input.stats, 2))).toBeLessThan(1e-9);
  });
});

describe("sub-frame entry with two boundaries in one frame (step 4c)", () => {
  test("an uphill starting 0.01 m past the spurt point runs like one starting at it (each part of the step keeps its own state)", () => {
    for (const runUp of [0, 0.4, 0.8]) {
      const at = simulateRun({ ...input, runUp, slopes: [{ start: 1600, end: 1900, per: 2 }] }, null, 0, NO_EFFECT).finishTime;
      const past = simulateRun({ ...input, runUp, slopes: [{ start: 1600.01, end: 1900, per: 2 }] }, null, 0, NO_EFFECT).finishTime;
      expect(Math.abs(past - at)).toBeLessThan(0.00005);
    }
  });
});

describe("sub-frame skill activation and window end (step 4c)", () => {
  // A long target-speed window ending just before the spurt (Nakayama Festa's chained trigger on Kyoto 2200): where it
  // ends sets the speed the horse carries into the spurt, so a one-frame shift of its activation moved the gain ~0.2 Bashin.
  const festaLike = { current: 0, carryCurrent: 0, target: 0.45, accel: 0 };
  const steps = Array.from({ length: 160 }, (_, i) => i * 0.01);
  const gainAt = (sim: ReturnType<typeof simulationInputFor>, meter: number, duration: number) =>
    simulateRun(sim, null, 0, NO_EFFECT).finishTime - simulateRun(sim, meter, duration, festaLike).finishTime;
  const maxAdjacentJump = (gains: number[]) => Math.max(...gains.slice(1).map((g, i) => Math.abs(g - gains[i])));

  test("shifting the activation meter by 0.01 m changes the gain by far less than a frame", () => {
    for (const duration of [14.4, 14.5, 14.6, 3]) {
      expect(maxAdjacentJump(steps.map((d) => gainAt(input, 1300 + d, duration)))).toBeLessThan(0.0005);
    }
  });

  test("shifting the starting position by 0.01 m changes a window-end-sensitive gain by far less than a frame", () => {
    expect(maxAdjacentJump(steps.map((d) => gainAt({ ...input, runUp: 1 + d }, 1300, 14.5)))).toBeLessThan(0.0005);
  });

  test("the activation time is the crossing time plus the mean half-frame wait, not a frame start", () => {
    for (const meter of [1300.2, 1300.5, 1300.9]) {
      const run = simulateRun(input, meter, 3, festaLike);
      const base = simulateRunWithStates(input);
      const i = resumeIndexFor(base.states, meter);
      const a = base.states[i], b = base.states[i + 1];
      expect(run.activationTime!).toBeCloseTo(a.time + (b.time - a.time) * (meter - a.meter) / (b.meter - a.meter) + 1 / 30, 3);
    }
  });
});
