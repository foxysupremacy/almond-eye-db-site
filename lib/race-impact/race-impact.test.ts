import { describe, expect, test } from "bun:test";
import {
  defaultRaceImpactProfile,
  evaluateTriggerRaceImpact,
  normalizeRaceImpactProfile,
} from ".";
import * as raceImpact from ".";
import * as registry from "../data/registry";

const course = {
  id: 10608,
  trackId: 10006,
  length: 2400,
  terrain: 1,
  turn: 1,
  distance: 3,
  inout: 1,
  corners: [], straights: [], slopes: [], spurtStart: { meters: 1600 },
};

describe("race-impact profile", () => {
  test("uses the requested standard stats and discards invalid stored values", () => {
    expect(defaultRaceImpactProfile().stats).toEqual({ speed: 2200, stamina: 1800, power: 1700, guts: 1500, wisdom: 1200 });
    expect(normalizeRaceImpactProfile({ stats: { speed: 9999, wisdom: 1900 }, dynamicOverrides: { blocked: 1.2, overtake: 0.3 } })).toEqual({
      version: 2,
      stats: { speed: 2200, stamina: 1800, power: 1700, guts: 1500, wisdom: 1900 },
      dynamicOverrides: { overtake: 0.3 },
      bashinReferenceSpeed: null,
    });
  });
});

describe("race-impact evaluation", () => {
  test("scores direct current speed with timing, duration and coverage; R32: no wisdom roll (activation 1)", () => {
    const result = evaluateTriggerRaceImpact({
      id: 1,
      conditionGroups: [{ condition: "phase>=2", base_time: 30000, effects: [{ type: 21, value: 4500 }] }],
    }, [{ regions: [{ start: 1600, end: 1800 }], isRandom: false }], {
      course, runningStyle: 2, racerCount: 9, profile: defaultRaceImpactProfile(),
    });
    expect(result.activation.activationRate).toBe(1);
    expect(result.expectedDistanceGainMeters).not.toBeNull();
    // R14/R7.5: the headline is scoreSkill's single deterministic sample at the region start, scaled by activation.
    expect(result.samples.map((s) => s.activationMeter)).toEqual([1600]);
    expect(result.expectedBashin).toBeCloseTo(result.meanBashin! * result.activation.activationRate, 5);
    expect(result.expectedDistanceGainMeters).toBeCloseTo(result.expectedBashin! * 2.5, 6);
    expect(result.expectedTimeGainSeconds).toBeGreaterThan(0);
    expect(result.usefulRate).toBeGreaterThan(0);
    expect(result.tactical.total).toBeGreaterThan(100);
    expect(result.physicsStatus).toBe("modeled");
    expect(result.distribution!.optimalGainMeters).toBeGreaterThan(0);
    // The per-meter tooltip curve still covers the whole zone; the trace is drawn where the headline fires.
    expect(result.trace!.activationMeter).toBe(1600);
    const atStart = result.distribution!.samples.find((s) => s.meter === 1600)!;
    expect(atStart.activationRate).toBeCloseTo(result.activation.activationRate, 9);
  });

  test("a random zone's trace is drawn at the distribution's optimal meter", () => {
    const result = evaluateTriggerRaceImpact({
      id: 11,
      conditionGroups: [{ condition: "phase_random==2", base_time: 30000, effects: [{ type: 21, value: 4500 }] }],
    }, [{ regions: [{ start: 1600, end: 1800 }], isRandom: true }], {
      course, runningStyle: 2, racerCount: 9, profile: defaultRaceImpactProfile(),
    });
    expect(result.samples.length).toBeGreaterThan(1);
    expect(result.trace!.activationMeter).toBe(result.distribution!.optimalMeter);
  });

  test("keeps Zenkai separate from conventional acceleration physics", () => {
    const result = evaluateTriggerRaceImpact({
      id: 2,
      conditionGroups: [{ condition: "phase==3", base_time: 20000, effects: [{ type: 48, value: 4000 }] }],
    }, [{ regions: [{ start: 1600, end: 2400 }], isRandom: true }], {
      course, runningStyle: 2, racerCount: 9, profile: defaultRaceImpactProfile(),
    });
    expect(result.physicsStatus).toBe("provisional");
    expect(result.expectedBashin).toBeNull();
    expect(result.physicsNote).toContain("Power-scaled");
  });

  test("treats a previous-detail marker as a chain dependency, not two neutral rolls", () => {
    const result = evaluateTriggerRaceImpact({
      id: 3,
      conditionGroups: [{
        condition: "is_activate_other_skill_detail==1&order<=3&phase==3",
        base_time: 20_000,
        effects: [{ type: 48, value: 4_000 }],
      }],
    }, [{ regions: [{ start: 1600, end: 2400 }], isRandom: true }], {
      course, runningStyle: 2, racerCount: 9, profile: defaultRaceImpactProfile(),
    });
    expect(result.activation.dependsOnPreviousTrigger).toBe(true);
    expect(result.activation.dynamicKeys).toEqual(["other_skill"]);
    expect(result.activation.dynamicRate).toBe(1);
    // R28: the position condition (order<=3) counts as met; R32: no wisdom roll either, so activation is 1.
    expect(result.activation.activationRate).toBe(1);
  });

  test("telemetry priors are not part of the engine (R14/R32): no prior lookup, no priors JSON in the registry", () => {
    expect("lookupDynamicPrior" in raceImpact).toBe(false);
    expect("raceImpactPriors" in registry).toBe(false);
  });

});

describe("race-impact caller-aligned condition groups", () => {
  const ctx = { course, runningStyle: 2 as const, racerCount: 9, profile: defaultRaceImpactProfile() };
  const twoGroups = {
    id: 7,
    conditionGroups: [
      { condition: "phase>=2", base_time: 10000, effects: [{ type: 21, value: 1000 }] },
      { condition: "phase>=2", base_time: 30000, effects: [{ type: 21, value: 4500 }] },
    ],
  };

  test("uses the first group whose caller zone is non-empty, and only that zone's meters", () => {
    const result = evaluateTriggerRaceImpact(twoGroups, [
      { regions: [], isRandom: false },
      { regions: [{ start: 1600, end: 1800 }], isRandom: false },
    ], ctx);
    expect(result.trace!.effectEndTimeSeconds - result.trace!.activationTimeSeconds).toBeCloseTo(7.2, 1);
    expect(result.activation.geometryRate).toBe(1);
    const eligible = result.distribution!.samples.filter((s) => s.eligible).map((s) => s.meter);
    expect(eligible.length).toBeGreaterThan(0);
    for (const meter of eligible) { expect(meter).toBeGreaterThanOrEqual(1599); expect(meter).toBeLessThanOrEqual(1801); }
  });

  test("aligned zones where group 0 fires use group 0 effects and ignore later group zones", () => {
    const result = evaluateTriggerRaceImpact(twoGroups, [
      { regions: [{ start: 1600, end: 1800 }], isRandom: false },
      { regions: [{ start: 400, end: 500 }], isRandom: false },
    ], ctx);
    expect(result.trace!.effectEndTimeSeconds - result.trace!.activationTimeSeconds).toBeCloseTo(2.4, 1);
    const eligible = result.distribution!.samples.filter((s) => s.eligible).map((s) => s.meter);
    for (const meter of eligible) expect(meter).toBeGreaterThanOrEqual(1599);
  });

  test("aligned zones place a later is_activate_other_skill_detail group in the same run (R7.3)", () => {
    const chained = {
      id: 8,
      conditionGroups: [
        { condition: "phase>=1", base_time: 30000, effects: [{ type: 27, value: 2500 }] },
        { condition: "is_activate_other_skill_detail==1&is_lastspurt==1", base_time: 20000, effects: [{ type: 31, value: 4000 }] },
      ],
    };
    const zones = [{ regions: [{ start: 1100, end: 2400 }], isRandom: false }, { regions: [{ start: 1600, end: 2400 }], isRandom: false }];
    const both = evaluateTriggerRaceImpact(chained, zones, ctx);
    const first = evaluateTriggerRaceImpact({ ...chained, conditionGroups: [chained.conditionGroups[0]] }, [zones[0]], ctx);
    expect(both.meanBashin!).toBeGreaterThan(first.meanBashin! + 0.3);
    expect(both.trace!.bashinGain).toBeGreaterThan(first.trace!.bashinGain);
  });

  test("dynamic overrides are evaluated per @ branch; telemetry priors are not multiplied in (R7.4, R14)", () => {
    const withOverride = { ...ctx, profile: { ...ctx.profile, dynamicOverrides: { overtake: 0.3 } } };
    const skill = { id: 9, conditionGroups: [{ condition: "is_overtake==1&phase==2@phase_random==2", base_time: 30000, effects: [{ type: 21, value: 1000 }] }] };
    const result = evaluateTriggerRaceImpact(skill, [{ regions: [{ start: 1600, end: 1800 }], isRandom: true }], withOverride);
    expect(result.activation.dynamicRate).toBe(1);
    const plainSkill = { id: 10, conditionGroups: [{ condition: "is_overtake==1&phase==2", base_time: 30000, effects: [{ type: 21, value: 1000 }] }] };
    const plainZones = [{ regions: [{ start: 1600, end: 1800 }], isRandom: false }];
    const plain = evaluateTriggerRaceImpact(plainSkill, plainZones, withOverride);
    expect(plain.activation.dynamicRate).toBeCloseTo(0.3, 6);
    expect(plain.activation.activationRate).toBeCloseTo(0.3, 6); // R32: the override is the only factor
    const noOverride = evaluateTriggerRaceImpact(plainSkill, plainZones, ctx);
    expect(noOverride.activation.dynamicRate).toBe(1);
    expect(noOverride.activation.priorSource).toBe("manual");
  });

  test("aligned zones with no firing group cannot activate", () => {
    const result = evaluateTriggerRaceImpact(twoGroups, [
      { regions: [], isRandom: false }, { regions: [], isRandom: false },
    ], ctx);
    expect(result.activation.geometryRate).toBe(0);
    expect(result.usefulRate).toBe(0);
  });
});
