import { describe, expect, test } from "bun:test";
import type { RawSkillEffect, SkillConditionGroup, SkillDetail } from "../data/types";
import { skillsById } from "../data/registry";
import type { Course } from "../skill-engine/types";
import { evaluateUniqueSkill } from "./skill-evaluator";
import { getParentInheritedUnique, hasMinimumParentSkillEffect } from "./unique-effect-filter";

const course: Course = {
  id: 1, terrain: 1, distance: 2, turn: 1, inout: 1, length: 1600,
  spurtStart: { meters: 1067 }, slopes: [],
  corners: [{ start: 1000, end: 1300 }],
  straights: [{ start: 0, end: 1000, frontType: 1 }, { start: 1300, end: 1600, frontType: 3 }],
};

function skill(effects: RawSkillEffect[], condition = "phase==1"): SkillDetail {
  return {
    id: 999999, nameEn: "Test inherit", nameJp: "", descEn: "", rarity: 1,
    conditionGroups: [{ condition, base_time: 30000, effects }],
  };
}

describe("parent inherited unique effect filter", () => {
  for (const type of [21, 22, 27, 31, 48, 9]) {
    const floor = type === 9 ? 150 : 1000;
    test(`effect ${type} uses an inclusive raw floor of ${floor}`, () => {
      for (const context of [undefined, course]) {
        expect(hasMinimumParentSkillEffect(skill([{ type, value: floor - 1 }]), context, 1)).toBe(false);
        expect(hasMinimumParentSkillEffect(skill([{ type, value: floor }]), context, 1)).toBe(true);
        expect(hasMinimumParentSkillEffect(skill([{ type, value: floor + 1 }]), context, 1)).toBe(true);
      }
    });
  }

  test("one qualifying effect suffices, but weak effects never add together", () => {
    expect(hasMinimumParentSkillEffect(skill([{ type: 27, value: 500 }, { type: 31, value: 2000 }]), course, 1)).toBe(true);
    expect(hasMinimumParentSkillEffect(skill([{ type: 27, value: 500 }, { type: 31, value: 500 }]), course, 1)).toBe(false);
    expect(hasMinimumParentSkillEffect(skill([{ type: 9, value: 150 }, { type: 27, value: 500 }]), course, 1)).toBe(true);
    expect(hasMinimumParentSkillEffect(skill([{ type: 9, value: 100 }, { type: 9, value: 100 }]), course, 1)).toBe(false);
  });

  test("debuffs, passives, missing and non-finite values cannot qualify", () => {
    for (const effect of [
      { type: 27, value: -3500 }, { type: 1, value: 600000 },
      { type: 27 }, { type: 31, value: NaN }, { type: 9, value: Infinity },
      ...[9, 10, 18].map((target) => ({ type: 27, value: 3500, target })),
    ]) expect(hasMinimumParentSkillEffect(skill([effect]))).toBe(false);
    expect(hasMinimumParentSkillEffect(undefined)).toBe(false);
    expect(hasMinimumParentSkillEffect({ ...skill([]), conditionGroups: [] })).toBe(false);
    for (const id of [undefined, null, 999999999]) expect(getParentInheritedUnique(id)).toBeUndefined();
  });

  test("only active groups can supply the qualifying effect, with best-of-styles when unspecified", () => {
    const multi = skill([{ type: 27, value: 500 }]);
    multi.conditionGroups.push({ condition: "distance_type==3&running_style==3", effects: [{ type: 27, value: 1500 }] });
    expect(hasMinimumParentSkillEffect(multi)).toBe(true);
    expect(hasMinimumParentSkillEffect(multi, course, 3)).toBe(false);
    const medium = { ...course, distance: 3 };
    expect(hasMinimumParentSkillEffect(multi, medium, 1)).toBe(false);
    expect(hasMinimumParentSkillEffect(multi, medium, 3)).toBe(true);
    expect(hasMinimumParentSkillEffect(multi, medium, null)).toBe(true);
    expect(hasMinimumParentSkillEffect(multi, medium, "betweener")).toBe(true);
  });

  test("a strong rank-trapped group does not rescue a weak usable group", () => {
    const multi = skill([{ type: 27, value: 500 }]);
    multi.conditionGroups.push({ condition: "phase==1&order<=1", effects: [{ type: 27, value: 1500 }] });
    expect(hasMinimumParentSkillEffect(multi, course, 4)).toBe(false);
    expect(hasMinimumParentSkillEffect(multi, course, 1)).toBe(true);
  });

  test("chained strong effects require the earlier trigger to be usable", () => {
    const chained = skill([{ type: 27, value: 500 }], "distance_type==3");
    const next: SkillConditionGroup = { condition: "phase==2&is_activate_other_skill_detail==1", effects: [{ type: 27, value: 1500 }] };
    chained.conditionGroups.push(next);
    expect(hasMinimumParentSkillEffect(chained, course, 1)).toBe(false);
    expect(hasMinimumParentSkillEffect(chained, { ...course, distance: 3 }, 1)).toBe(true);
    expect(hasMinimumParentSkillEffect(skill([{ type: 27, value: 1500 }], "invalid_condition==1"), course, 1)).toBe(false);
  });

  test("Ruby's 0.05 inherit is excluded despite its 0.25 original, without altering its tier", () => {
    const inherited = getParentInheritedUnique(100851)!;
    expect(inherited.id).toBe(900851);
    expect(hasMinimumParentSkillEffect(skillsById.get(100851), course, 4)).toBe(true);
    expect(hasMinimumParentSkillEffect(inherited)).toBe(false);
    expect(hasMinimumParentSkillEffect(inherited, course, 4)).toBe(false);
    expect(evaluateUniqueSkill(inherited.id, course, 4).tier).toBe("S+");
    const alt = getParentInheritedUnique(110851)!;
    expect(hasMinimumParentSkillEffect(alt, course, 3)).toBe(true);
    expect(hasMinimumParentSkillEffect(alt, { ...course, distance: 3 }, 3)).toBe(false);
  });

  test("inherited Angling keeps Leader first-place insurance", () => {
    const inherited = getParentInheritedUnique(100201)!;
    expect(evaluateUniqueSkill(inherited.id, course, 2).badge).toBe("1st-Place Insurance");
    expect(hasMinimumParentSkillEffect(inherited, course, 2)).toBe(true);
  });
});
