import { describe, expect, it } from "bun:test";
import type { ParentDeckSkill } from "@/lib/deck/types";
import type { DisplayParentSkill } from "../../hooks/use-lineage-skills";
import { filterParentSkills, mergeParentSkills, type ParentSkillFilterOptions } from "./parent-skill-projections";

const cardSkill = (overrides: Partial<ParentDeckSkill> = {}): ParentDeckSkill => ({
  id: 1,
  nameEn: "Card Skill",
  nameJp: "カードスキル",
  rarity: 2,
  source: "hint",
  cardId: 12,
  cardName: "Example Card",
  isDuplicateInMain: false,
  parentDuplicateCount: 1,
  isUniqueToParent: true,
  ...overrides,
});

const displayCardSkill = (overrides: Partial<ParentDeckSkill> = {}): DisplayParentSkill => {
  const skill = cardSkill(overrides);
  return {
    ...skill,
    source: skill.source === "event" ? "event" : "hint",
    sourceLabel: `Card (${skill.cardName})`,
  };
};

const lineageSkill = (overrides: Partial<DisplayParentSkill> = {}): DisplayParentSkill => ({
  id: 2,
  nameEn: "Lineage Skill",
  nameJp: "継承スキル",
  rarity: 3,
  source: "unique",
  sourceLabel: "Parent: Example Uma",
  isUniqueToParent: true,
  isInheritOnly: true,
  grants: [{ cardName: "Example Uma", source: "Unique", slotLabel: "Parent 1" }],
  ...overrides,
});

const options = (overrides: Partial<ParentSkillFilterOptions> = {}): ParentSkillFilterOptions => ({
  filter: "all",
  sourceFilter: "all",
  rarityFilter: "all",
  hideParentDuplicates: false,
  search: "",
  uniqueTargetIds: new Set(),
  duplicateInParentIds: new Set(),
  ...overrides,
});

describe("parent skill projections", () => {
  it("merges card skills before lineage skills and combines unique grants by card and source", () => {
    const merged = mergeParentSkills(
      [cardSkill({ id: 3, nameEn: "Shared", grants: [{ cardId: 12, cardName: "Card A", source: "hint" }] })],
      [
        lineageSkill({ id: 3, nameEn: "Lineage Name", isInheritOnly: true, grants: [
          { cardName: "Card A", source: "hint" },
          { cardName: "Uma B", source: "unique" },
        ] }),
        lineageSkill({ id: 4 }),
      ],
    );

    expect(merged.map((skill) => skill.id)).toEqual([3, 4]);
    expect(merged[0]?.nameEn).toBe("Shared");
    expect(merged[0]?.isInheritOnly).toBe(false);
    expect(merged[0]?.grants?.map((grant) => grant.cardName)).toEqual(["Card A", "Uma B"]);
    expect(merged[0]?.parentDuplicateCount).toBe(2);
  });

  it("keeps unique lineage skills and preserves original unique metadata on merge", () => {
    const merged = mergeParentSkills([], [lineageSkill({ id: 9, originalUniqueSkill: { id: 90, nameEn: "Original" } })]);
    expect(merged[0]?.originalUniqueSkill?.id).toBe(90);
  });

  it("applies source, category, rarity, duplicate, and case-insensitive text filters", () => {
    const pool: DisplayParentSkill[] = [
      displayCardSkill({ id: 1, nameEn: "Speed Hint", descEn: "Raises speed", rarity: 2 }),
      displayCardSkill({ id: 2, nameEn: "Speed Event", source: "event", rarity: 1, isDuplicateInMain: true }),
      lineageSkill({ id: 3, nameEn: "Speed Unique", source: "unique", rarity: 3, isInheritOnly: true }),
      lineageSkill({ id: 4, nameEn: "Factor", source: "factor", rarity: 1, isInheritOnly: false }),
    ];

    expect(filterParentSkills(pool, options({ sourceFilter: "cards" })).map((skill) => skill.id)).toEqual([1, 2]);
    expect(filterParentSkills(pool, options({ sourceFilter: "lineage" })).map((skill) => skill.id)).toEqual([3, 4]);
    expect(filterParentSkills(pool, options({ filter: "unique", uniqueTargetIds: new Set([3]) })).map((skill) => skill.id)).toEqual([3]);
    expect(filterParentSkills(pool, options({ filter: "duplicate" })).map((skill) => skill.id)).toEqual([2]);
    expect(filterParentSkills(pool, options({ filter: "parent_duplicate", duplicateInParentIds: new Set([4]) })).map((skill) => skill.id)).toEqual([4]);
    expect(filterParentSkills(pool, options({ filter: "inherit_only" })).map((skill) => skill.id)).toEqual([3]);
    expect(filterParentSkills(pool, options({ filter: "event" })).map((skill) => skill.id)).toEqual([2]);
    expect(filterParentSkills(pool, options({ filter: "parent_unique" })).map((skill) => skill.id)).toEqual([3]);
    expect(filterParentSkills(pool, options({ filter: "factor" })).map((skill) => skill.id)).toEqual([4]);
    expect(filterParentSkills(pool, options({ rarityFilter: "gold" })).map((skill) => skill.id)).toEqual([1]);
    expect(filterParentSkills(pool, options({ search: "  RAISES SPEED  " })).map((skill) => skill.id)).toEqual([1]);
  });

  it("hides parent duplicates regardless of the active category", () => {
    const pool: DisplayParentSkill[] = [
      displayCardSkill({ id: 10 }),
      lineageSkill({ id: 11 }),
    ];
    expect(filterParentSkills(pool, options({
      filter: "all",
      hideParentDuplicates: true,
      duplicateInParentIds: new Set([10]),
    })).map((skill) => skill.id)).toEqual([11]);
  });
});
