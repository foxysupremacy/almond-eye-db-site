import { describe, expect, it } from "bun:test";
import type { ParentDeckSkill } from "@/lib/deck/types";
import type { CharacterIndexEntry, SkillDetail } from "@/lib/api";
import { getInheritableSkillForUnique } from "@/lib/skills/rarity";
import type { DisplayParentSkill } from "../../hooks/use-lineage-skills";
import { buildHardToGetSkills, filterParentSkills, mergeParentSkills, goldOriginOf, sortParentSkillsForFarming, type ParentSkillFilterOptions } from "./parent-skill-projections";

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

  it("omits Uma unique skills and white inherit forms unless another non-unique source grants them", () => {
    const whiteUniqueId = getInheritableSkillForUnique(100011)!;
    const skills = [100011, whiteUniqueId].map((id) => ({
      id,
      nameEn: `Skill ${id}`,
      nameJp: "",
      rarity: 1,
      descEn: "",
      iconId: null,
      conditionGroups: [],
    }) as SkillDetail);
    const uniqueUma = {
      id: 100101,
      charId: 1001,
      nameEn: "Uma with Unique",
      nameJp: "",
      variant: "01",
      titleEn: "",
      titleJp: "",
      rarity: 3,
      aptitude: [],
      baseStats: [],
      imgUrl: "",
      uniqueSkillId: 100011,
    } as CharacterIndexEntry;
    const innateUma = {
      ...uniqueUma,
      id: 100201,
      charId: 1002,
      nameEn: "Uma with Innate Skill",
      uniqueSkillId: null,
      innateSkills: [whiteUniqueId],
    } as CharacterIndexEntry;

    const uniqueOnly = buildHardToGetSkills(skills, [], [uniqueUma], () => true);
    expect(uniqueOnly).toEqual([]);

    const alternateSource = buildHardToGetSkills(skills, [], [uniqueUma, innateUma], () => true);
    expect(alternateSource.map((skill) => skill.id)).toEqual([whiteUniqueId]);
    expect(alternateSource[0]?.grants?.map((grant) => grant.cardName)).toEqual(["Uma with Innate Skill"]);
  });

  it("excludes Twinkling Star because it cannot be inherited", () => {
    const twinklingStar = {
      id: 204262,
      nameEn: "Twinkling Star",
      nameJp: "星の煌き",
      rarity: 1,
      descEn: "",
      iconId: 2010011,
      conditionGroups: [],
    } as SkillDetail;
    const uma = {
      id: 100101,
      charId: 1001,
      nameEn: "Uma with Twinkling Star",
      nameJp: "",
      variant: "01",
      titleEn: "",
      titleJp: "",
      rarity: 3,
      aptitude: [],
      baseStats: [],
      imgUrl: "",
      awakeningSkills: [204262],
    } as CharacterIndexEntry;

    expect(buildHardToGetSkills([twinklingStar], [], [uma], () => true)).toEqual([]);
  });

  it("orders farming tiers: gold, unique white targets, main-deck dupes, rest, then no activation", () => {
    const skills = [
      { id: 1, rarity: 1 }, // rest (activates, not target, not in main)
      { id: 2, rarity: 2 }, // dead gold -> last tier wins over gold
      { id: 3, rarity: 1 }, // in main deck
      { id: 4, rarity: 1 }, // unique target
      { id: 5, rarity: 2 }, // gold
      { id: 6, rarity: 1 }, // dead white (Rank Trap)
      { id: 7, rarity: 1 }, // unique target
      { id: 8, rarity: 2 }, // gold, also in main deck -> gold tier first
    ];
    const dead = new Set([2, 6]);
    const targets = new Set([4, 7]);
    const inMain = new Set([3, 8]);
    const out = sortParentSkillsForFarming(skills, {
      activates: (id) => !dead.has(id),
      isUniqueTarget: (s) => targets.has(s.id),
      isInMainDeck: (s) => inMain.has(s.id),
    });
    expect(out.map((s) => s.id)).toEqual([5, 8, 4, 7, 3, 1, 2, 6]);
  });

  it("ranks parent whites inherited from a gold in the gold tier", () => {
    const tailOfVictory = { id: 900, nameEn: "Tail of Victory" };
    const skills = [
      { id: 10, rarity: 1 }, // unique white target
      { id: 11, rarity: 1, originalGoldSkill: tailOfVictory }, // unified-list / lineage row
      { id: 12, rarity: 1, grants: [{ originalGoldSkill: { id: 901, nameEn: "Uncharted Heights" } }] }, // card-view row
    ];
    const out = sortParentSkillsForFarming(skills, {
      activates: () => true,
      isUniqueTarget: () => true,
      isInMainDeck: () => false,
    });
    expect(out.map((s) => s.id)).toEqual([11, 12, 10]);
    expect(goldOriginOf(skills[1])?.nameEn).toBe("Tail of Victory");
    expect(goldOriginOf(skills[2])?.nameEn).toBe("Uncharted Heights");
    expect(goldOriginOf(skills[0])).toBeUndefined();
  });

});
