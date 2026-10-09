import { describe, expect, test } from "bun:test";
import { describeEffect, classifyEffect } from "./effects";
import { evaluateSkillForTrack } from "./evaluator";
import { applicationRatingEnvironment } from "../skill-rating/application";
import type { SkillRating, SkillRatingSession, RatingRequest } from "../skill-rating/types";

describe("canonical evaluator facade", () => {
  test("projects an unbounded canonical score without scoring zones again", () => {
    const rating: SkillRating = {
      originalSkillId: 42, evaluatedSkillId: 42, variant: "original", contextFingerprint: "test", modelVersion: "test",
      eligibility: { state: "eligible", reasons: [] }, scenarios: [], assumptions: [], warnings: [], partialReasons: [],
      score: 145, tier: "S", stars: 5, status: "provisional", contributions: [], selectedScenarioId: "one", selectedPaths: [],
      simulatedBenefit: 5, timeGainSeconds: .25, benchmarkVersion: "test", breakdown: [], provenance: [],
    };
    const requests: RatingRequest[] = [];
    const session: SkillRatingSession = { analyze: () => rating, evaluate: (request) => { requests.push(request); return rating; }, evaluateMany: () => [], metrics: () => ({ simulations: 0, evaluations: 1, cacheHits: 0 }) };
    const result = evaluateSkillForTrack({ id: 42 }, null, 2, 9, false, [{ regions: [], isRandom: false }], undefined, { session });
    expect(requests).toHaveLength(1);
    expect(result.canonicalRating).toBe(rating);
    expect(result.score).toBe(145);
    expect(result.tier).toBe("S");
    expect(result.raceImpact?.expectedDistanceGainMeters).toBe(5);
    expect(result.raceImpact?.expectedBashin).toBe(2);
    expect(result.category).not.toBe("invalid");
  });

  test("a missing inherited variant never reuses stronger original effects", () => {
    const gold = { id: -42, rarity: 2, conditionGroups: [{ effects: [{ type: 27, value: 4500 }] }] };
    expect(applicationRatingEnvironment.resolveVariant?.(gold, "parent-factor")).toBeNull();
    expect(applicationRatingEnvironment.resolveVariant?.({ ...gold, rarity: 5 }, "inherited-unique")).toBeNull();
    const white = { ...gold, rarity: 1 };
    expect(applicationRatingEnvironment.resolveVariant?.(white, "parent-factor")).toBe(white);
  });

  test("self costs and start-delay modifiers are distinct from opponent debuffs", () => {
    expect(classifyEffect({ type: 21, value: -2500 })).toBe("current_speed");
    expect(describeEffect({ type: 21, value: -2500 }).sign).toBe("cost");
    expect(classifyEffect({ type: 10, value: 9000 })).toBeNull();
    expect(describeEffect({ type: 10, value: 9000 }).family).toBe("start_delay");
    expect(classifyEffect({ type: 27, value: -1000, target: 9 })).toBe("debuff");
  });
});
