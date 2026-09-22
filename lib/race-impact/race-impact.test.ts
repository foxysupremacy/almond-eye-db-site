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

describe("race-impact evaluation", () => {
  test("scores direct current speed with wisdom, timing, duration and coverage", () => {
    const result = evaluateTriggerRaceImpact({
      id: 1,
      conditionGroups: [{ condition: "phase>=2", base_time: 30000, effects: [{ type: 21, value: 4500 }] }],
    }, [{ regions: [{ start: 1600, end: 1800 }], isRandom: false }], {
      course, runningStyle: 2, racerCount: 9, profile: defaultRaceImpactProfile(),
    });
    expect(result.activation.wisdomRate).toBeCloseTo(0.95);
    expect(result.expectedDistanceGainMeters).not.toBeNull();
    expect(result.tactical.total).toBeGreaterThan(100);
    expect(result.physicsStatus).toBe("modeled");
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
    // Leader's expected ranks 2–5 overlap order 1–3 at ranks 2–3: 50%.
    expect(result.activation.activationRate).toBeCloseTo(0.475);
  });

  test("uses track prior before global, then neutral fallback", () => {
    const priors = { version: 1 as const, generatedAt: "test", priors: [
      { key: "blocked" as const, courseId: 10608, runningStyle: 2, opportunities: 40, activations: 30 },
      { key: "blocked" as const, runningStyle: 2, opportunities: 50, activations: 20 },
    ] };
    expect(lookupDynamicPrior(priors, "blocked", { courseId: 10608, runningStyle: 2 }).source).toBe("track");
    expect(lookupDynamicPrior(priors, "blocked", { courseId: 1, runningStyle: 2 }).source).toBe("global");
    expect(lookupDynamicPrior(priors, "nearby", { courseId: 1, runningStyle: 2 })).toEqual({ probability: 0.5, source: "manual", samples: 0 });
  });

  test("adds chained impact but mixes alternative paths", () => {
    const one = { activation: { activationRate: 0.5 }, expectedBashin: 1, expectedDistanceGainMeters: 2.5, expectedTimeGainSeconds: 0.1, samples: [], tactical: { activation: 20, effect: 30, timing: 20, duration: 10, coverage: 10, total: 90 }, usefulRate: 0.5, minBashin: 1, meanBashin: 1, medianBashin: 1, maxBashin: 1, physicsStatus: "modeled" } as unknown as RaceImpactResult;
    const two = { ...one, expectedBashin: 2, expectedDistanceGainMeters: 5, expectedTimeGainSeconds: 0.2, activation: { activationRate: 0.5 }, tactical: { ...one.tactical, total: 90 } } as RaceImpactResult;
    expect(aggregateRaceImpact([one, two], "chain")?.expectedBashin).toBeCloseTo(1.5);
    expect(aggregateRaceImpact([one, two], "alternative")?.expectedBashin).toBeCloseTo(3);
  });
});
