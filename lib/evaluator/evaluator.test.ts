import { describe, expect, test } from "bun:test";
import { evaluateSkillForTrack } from "./evaluator";
import type { Course } from "../skill-engine/types";

const course: Course = {
  id: 10008, terrain: 1, turn: 1, distance: 3, inout: 1, length: 2400,
  spurtStart: { meters: 1600 },
  corners: [{ start: 1450, end: 1650 }],
  straights: [{ start: 0, end: 1450, frontType: 1 }, { start: 1650, end: 2400, frontType: 3 }],
  slopes: [],
};

describe("evaluateSkillForTrack compatibility facade", () => {
  test("projects canonical eligibility, score, and legacy detail fields from one rating", () => {
    const skill = { id: 991001, rarity: 1, conditionGroups: [{ condition: "distance_type==3&phase>=2&corner!=0", base_time: 24000, effects: [{ type: 31, value: 3000 }] }] };
    const result = evaluateSkillForTrack(skill, course, 2, 9, false);
    expect(result.canonicalRating?.eligibility.state).toBe("eligible");
    expect(result.score).toBe(result.canonicalRating?.score);
    expect(result.tier).toBe(result.canonicalRating?.tier);
    expect(result.stars).toBe(result.canonicalRating?.stars);
    expect(result.triggerEvaluations).toHaveLength(1);
    expect(result.triggerEvaluations?.[0].evaluation?.canonicalRating?.selectedPaths[0].triggerIndex).toBe(0);
  });

  test("strict track and style gates remain hard even when a legacy zone is supplied", () => {
    const skill = { id: 991002, rarity: 1, conditionGroups: [{ condition: "distance_type==1&running_style==1", base_time: 24000, effects: [{ type: 27, value: 3000 }] }] };
    const result = evaluateSkillForTrack(skill, course, 3, 9, false, [{ regions: [{ start: 100, end: 500 }], isRandom: false }]);
    expect(result.canonicalRating?.eligibility.state).toBe("ineligible");
    expect(result.score).toBe(0);
    expect(result.triggerEvaluations?.[0].evaluation).toBeNull();
  });

  test("partial unsupported effects do not receive a complete tier or stars", () => {
    const skill = { id: 991003, rarity: 1, conditionGroups: [{ condition: "phase>=2", base_time: 24000, effects: [{ type: 999, value: 1000 }] }] };
    const result = evaluateSkillForTrack(skill, course, 2, 9, false);
    expect(result.canonicalRating?.status).toBe("partial");
    expect(result.tier).toBeNull();
    expect(result.stars).toBeNull();
  });
});
