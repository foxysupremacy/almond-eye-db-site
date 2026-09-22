// Golden test pinning the shared effect-classification table. Both
// evaluateSkillForTrack (lib/evaluator/evaluator.ts) and classifySkillEffects
// (lib/skill-effects.ts) must agree on these cases — if this table ever
// drifts, one of the two vocabularies breaks.
import { describe, expect, test } from "bun:test";
import { classifyEffect } from "./effects";
import { classifySkillEffects } from "../skill-effects";

describe("classifyEffect — single effect table", () => {
  test("speed family", () => {
    expect(classifyEffect({ type: 27, value: 3500 })).toBe("target_speed");
    expect(classifyEffect({ type: 21, value: 500 })).toBe("current_speed");
    expect(classifyEffect({ type: 22, value: 500 })).toBe("current_speed");
    expect(classifyEffect({ type: 31, value: 2000 })).toBe("acceleration");
    expect(classifyEffect({ type: 48, value: 4000 })).toBe("zenkai_acceleration");
  });

  test("heal / passive", () => {
    expect(classifyEffect({ type: 9, value: 10 })).toBe("heal");
    for (const t of [1, 2, 3, 4, 5]) {
      expect(classifyEffect({ type: t, value: 1 })).toBe("passive");
    }
  });

  test("debuffs: opponent targets, negative values, dedicated types", () => {
    for (const target of [9, 10, 18]) {
      expect(classifyEffect({ type: 9, value: 10, target })).toBe("debuff");
    }
    expect(classifyEffect({ type: 21, value: -300 })).toBe("debuff");
    expect(classifyEffect({ type: 10 })).toBe("debuff");
    expect(classifyEffect({ type: 14 })).toBe("debuff");
  });

  test("unknown types return null (evaluator ignores, UI buckets as other)", () => {
    expect(classifyEffect({ type: 999 })).toBeNull();
    expect(classifyEffect({})).toBeNull();
  });
});

describe("classifySkillEffects — agrees with the shared table", () => {
  test("multi-effect skill yields multiple categories", () => {
    const cats = classifySkillEffects({
      conditionGroups: [
        { condition: null, effects: [{ type: 27, value: 3500 }, { type: 31, value: 2000 }] },
      ],
    } as never);
    expect(cats.sort()).toEqual(["acceleration", "target_speed"]);
  });

  test("Zenkai acceleration remains a distinct category", () => {
    expect(
      classifySkillEffects({
        conditionGroups: [{ condition: null, effects: [{ type: 48, value: 4000 }] }],
      } as never),
    ).toEqual(["zenkai_acceleration"]);
  });

  test("unknown effects bucket as other; empty groups yield other", () => {
    expect(
      classifySkillEffects({ conditionGroups: [{ condition: null, effects: [{ type: 999 }] }] } as never)
    ).toEqual(["other"]);
    expect(classifySkillEffects({ conditionGroups: [] } as never)).toEqual(["other"]);
    expect(classifySkillEffects({} as never)).toEqual(["other"]);
  });

  test("negative-value speed effect classifies as debuff (not current_speed)", () => {
    expect(
      classifySkillEffects({
        conditionGroups: [{ condition: null, effects: [{ type: 21, value: -300 }] }],
      } as never)
    ).toEqual(["debuff"]);
  });
});
