import { describe, expect, test } from "bun:test";
import {
  aggregateRaceImpact,
  defaultRaceImpactProfile,
  evaluateTriggerRaceImpact,
  lookupDynamicPrior,
  normalizeRaceImpactProfile,
  type RaceImpactResult,
} from ".";

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
    expect(defaultRaceImpactProfile().stats).toEqual({ speed: 2200, stamina: 1800, power: 1700, guts: 1500, wisdom: 1800 });
    expect(normalizeRaceImpactProfile({ stats: { speed: 9999, wisdom: 1900 }, dynamicOverrides: { blocked: 1.2, overtake: 0.3 } })).toEqual({
      version: 1,
      stats: { speed: 2200, stamina: 1800, power: 1700, guts: 1500, wisdom: 1900 },
      dynamicOverrides: { overtake: 0.3 },
    });
  });
});

describe("race-impact compatibility facade", () => {
  test("reports canonical conditional effect value without multiplying activation estimates", () => {
    const skill = { id: 1, rarity: 1, conditionGroups: [{ condition: "phase>=2&order<=5&blocked_front==1", base_time: 30000, effects: [{ type: 22, value: 4500, target: 1 }] }] };
    const a = evaluateTriggerRaceImpact(skill, [{ regions: [{ start: 1600, end: 1800 }], isRandom: false }], { course, runningStyle: 2, racerCount: 9, profile: defaultRaceImpactProfile() });
    const profile = { ...defaultRaceImpactProfile(), dynamicOverrides: { blocked: 0 } };
    const b = evaluateTriggerRaceImpact(skill, [{ regions: [{ start: 1600, end: 1800 }], isRandom: false }], { course, runningStyle: 2, racerCount: 9, profile });
    expect(a.activation.activationRate).toBe(1);
    expect(a.expectedDistanceGainMeters).toBeGreaterThan(0);
    expect(a.expectedDistanceGainMeters).toBe(b.expectedDistanceGainMeters);
    expect(a.physicsNote).toContain("not a measured activation probability");
    expect(a.physicsStatus).toBe("provisional");
  });

  test("keeps zenkai threshold and provisional model status explicit", () => {
    const skill = { id: 2, rarity: 1, conditionGroups: [{ condition: "run_at_full_speed_random==1", base_time: 20000, effects: [{ type: 48, value: 4000, target: 1 }] }] };
    const profile = { ...defaultRaceImpactProfile(), stats: { ...defaultRaceImpactProfile().stats, speed: 2001, stamina: 3000 } };
    const result = evaluateTriggerRaceImpact(skill, [], { course, runningStyle: 2, racerCount: 9, profile });
    expect(result.physicsStatus).toBe("provisional");
    expect(result.expectedDistanceGainMeters).not.toBeNull();
    expect(result.physicsNote).toContain("Conditional");
    const capped = { ...profile, stats: { ...profile.stats, speed: 2000 } };
    const noZenkai = evaluateTriggerRaceImpact(skill, [], { course, runningStyle: 2, racerCount: 9, profile: capped });
    expect(noZenkai.expectedDistanceGainMeters).toBe(0);
  });

  test("preserves a chain prerequisite and refuses to aggregate independent impacts", () => {
    const result = evaluateTriggerRaceImpact({ id: 3, rarity: 1, conditionGroups: [
      { condition: "phase==2", base_time: 20000, effects: [{ type: 27, value: 1000, target: 1 }] },
      { condition: "is_activate_other_skill_detail==1&phase==3&order<=3", base_time: 20000, effects: [{ type: 48, value: 4000, target: 1 }] },
    ] }, [], { course, runningStyle: 2, racerCount: 9, profile: defaultRaceImpactProfile() });
    expect(result.activation.dependsOnPreviousTrigger).toBe(true);
    expect(result.activation.activationRate).toBe(1);
    expect(result.physicsStatus).toBe("provisional");
    const one = { ...result, expectedBashin: 1, expectedDistanceGainMeters: 2.5 };
    const two = { ...result, expectedBashin: 2, expectedDistanceGainMeters: 5 };
    const aggregate = aggregateRaceImpact([one, two], "chain")!;
    expect(aggregate.physicsStatus).toBe("partial");
    expect(aggregate.physicsNote).toContain("cannot be added");
  });
});
