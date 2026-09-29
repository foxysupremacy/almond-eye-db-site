import { describe, expect, test } from "bun:test";
import { matchSkillFilter } from "./skill-filter";
import type { SkillMeta } from "../data/types";

const genericMeta: SkillMeta = {
  nameEn: "Test Skill",
  nameJp: "テスト",
  rarity: 1,
  styles: [1],
  distances: [2],
  surfaces: [1],
  isGeneric: false,
};

describe("matchSkillFilter", () => {
  test("matches curated metadata and marks matched dimensions as specialized", () => {
    expect(
      matchSkillFilter({ meta: genericMeta, style: 5, distance: 2, surface: 1 })
    ).toEqual({ matches: true, isSpecialized: true });
    expect(
      matchSkillFilter({ meta: genericMeta, style: 2, distance: 2, surface: 1 })
    ).toEqual({ matches: false, isSpecialized: false });
  });

  test("falls back to tags and condition expressions when metadata is absent", () => {
    const result = matchSkillFilter({
      rawSkill: {
        tags: ["run", "mil", "tur"],
        conditionGroups: [{ condition: "running_style==1&distance_type==2&ground_type==1", effects: [] }],
      },
      style: 5,
      distance: 2,
      surface: 1,
    });
    expect(result).toEqual({ matches: true, isSpecialized: true });
    expect(
      matchSkillFilter({
        rawSkill: { tags: ["run"], conditionGroups: [] },
        style: 2,
        distance: null,
        surface: null,
      })
    ).toEqual({ matches: false, isSpecialized: false });
  });

  test("treats missing constraints as generic and missing skill data as unmatched", () => {
    expect(matchSkillFilter({ meta: { ...genericMeta, styles: [], distances: [], surfaces: [] }, style: 3, distance: 4, surface: 2 }))
      .toEqual({ matches: true, isSpecialized: false });
    expect(matchSkillFilter({ style: null, distance: null, surface: null }))
      .toEqual({ matches: false, isSpecialized: false });
  });
});
