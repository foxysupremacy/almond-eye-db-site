import { describe, expect, test } from "bun:test";
import type { CardIndexEntry, RecommendedPvpSkill, SkillDetail } from "@/lib/api";
import { GOLD_TO_WHITE_MAP } from "@/lib/skills/rarity";
import { filterRecommendedSkillsByEffect, findDuplicateRecommendedCardSkillIds, hideDuplicateRecommendedCardSkills, includeCardsWithAdditionalSkills, projectAdditionalCardSkills, projectGameRecommendedCards, projectTrackActiveFallbackSkills } from "./game-recommendation-projections";

function recommendedSkill(skillId: number, supportCardIds: number[]): RecommendedPvpSkill {
  return {
    skillId,
    supportCardIds,
    runningStyleValues: { nige: 1, senko: 1, sashi: 1, oikomi: 1 },
  };
}

function card(id: number, nameEn: string, type: CardIndexEntry["type"] = "speed"): CardIndexEntry {
  return {
    id,
    nameEn,
    nameJp: `${nameEn} JP`,
    rarity: 3,
    type,
    imgUrl: "",
    portraitUrl: "",
    eventSkills: [],
    hintSkills: [],
  };
}

function skillDetail(id: number, effectType: number): SkillDetail {
  return {
    id,
    nameEn: `Skill ${id}`,
    nameJp: `スキル${id}`,
    descEn: "",
    rarity: 1,
    conditionGroups: [{ condition: null, effects: [{ type: effectType }] }],
  };
}

describe("game recommendation projections", () => {
  test("groups support cards, dedupes skills, excludes Ace skills and selected Parent cards, then sorts by skill count and name", () => {
    const skills = [
      recommendedSkill(1, [10, 10, 11, 12]),
      recommendedSkill(2, [10, 11]),
      recommendedSkill(3, [10, 13]),
      recommendedSkill(4, [14, 13]),
    ];
    const rows = projectGameRecommendedCards({
      skills,
      excludedSkillIds: new Set([3]),
      excludedCardIds: new Set([12]),
      effectFilter: [],
      skillDetailMap: new Map(),
      allCards: [card(10, "Beta"), card(11, "Alpha"), card(13, "Gamma")],
    });

    expect(rows.map((row) => [row.cardId, row.skills.map((entry) => entry.skillId)])).toEqual([
      [11, [1, 2]],
      [10, [1, 2]],
      [14, [4]],
      [13, [4]],
    ]);
    expect(rows[1].card?.nameEn).toBe("Beta");
    expect(rows[2].card).toBeNull();
  });

  test("applies shared effect filters to skills and grouped cards; missing metadata is Other", () => {
    const skills = [recommendedSkill(1, [10]), recommendedSkill(2, [10, 11]), recommendedSkill(3, [12])];
    const details = new Map([
      [1, skillDetail(1, 27)],
      [2, skillDetail(2, 31)],
    ]);

    expect(filterRecommendedSkillsByEffect(skills, ["target_speed"], details).map((entry) => entry.skillId)).toEqual([1]);
    expect(projectGameRecommendedCards({
      skills,
      excludedSkillIds: new Set(),
      excludedCardIds: new Set(),
      effectFilter: ["acceleration"],
      skillDetailMap: details,
      allCards: [card(10, "A"), card(11, "B"), card(12, "C")],
    }).map((row) => [row.cardId, row.skills.map((entry) => entry.skillId)])).toEqual([
      [10, [2]],
      [11, [2]],
    ]);
    expect(filterRecommendedSkillsByEffect(skills, ["other"], details).map((entry) => entry.skillId)).toEqual([3]);
  });

  test("hides skills shared by multiple eligible cards and reranks on unique skill count", () => {
    const rows = projectGameRecommendedCards({
      skills: [
        recommendedSkill(1, [10, 11]),
        recommendedSkill(2, [10]),
        recommendedSkill(3, [10]),
        recommendedSkill(4, [11]),
        recommendedSkill(5, [12]),
      ],
      excludedSkillIds: new Set(),
      excludedCardIds: new Set(),
      effectFilter: [],
      skillDetailMap: new Map(),
      allCards: [card(10, "A"), card(11, "B"), card(12, "C")],
    });

    expect(hideDuplicateRecommendedCardSkills(rows).map((row) => [row.cardId, row.skills.map((skill) => skill.skillId)])).toEqual([
      [10, [2, 3]],
      [11, [4]],
      [12, [5]],
    ]);
  });

  test("projects other card-granted skills once, excluding recommendations and Ace skills", () => {
    const candidate = { ...card(10, "A"), eventSkills: [1, 2], hintSkills: [2, 3, 4] };
    const details = new Map([1, 2, 3, 4].map((id) => [id, skillDetail(id, 27)]));

    expect(projectAdditionalCardSkills(candidate, new Set([1]), new Set([3]), details).map((skill) => skill.id)).toEqual([2, 4]);
  });

  test("includes eligible cards without game recommendations so track-active grants can surface", () => {
    const rows = projectGameRecommendedCards({
      skills: [recommendedSkill(1, [10])],
      excludedSkillIds: new Set(),
      excludedCardIds: new Set([12]),
      effectFilter: [],
      skillDetailMap: new Map(),
      allCards: [card(10, "Recommended"), card(11, "Track active only"), card(12, "Already in Parent")],
    });

    expect(includeCardsWithAdditionalSkills(rows, [card(10, "Recommended"), card(11, "Track active only"), card(12, "Already in Parent")], new Set([12])).map((row) => [row.cardId, row.skills.length])).toEqual([
      [10, 1],
      [11, 0],
    ]);
  });

  test("keeps a card supported only by a unique track-active skill when duplicates are hidden", () => {
    const rows = [
      { cardId: 10, card: card(10, "Recommended"), skills: [recommendedSkill(1, [10])] },
      { cardId: 11, card: card(11, "Track active only"), skills: [] },
    ];
    const extras = new Map([[10, [skillDetail(2, 27)]], [11, [skillDetail(3, 27)]]]);

    expect(hideDuplicateRecommendedCardSkills(rows, extras).map((row) => row.cardId)).toEqual([10, 11]);
  });

  test("hide-duplicates shares one duplicate set across recommended and track-active skill groups", () => {
    const rows = projectGameRecommendedCards({
      skills: [recommendedSkill(1, [10]), recommendedSkill(2, [11])],
      excludedSkillIds: new Set(),
      excludedCardIds: new Set(),
      effectFilter: [],
      skillDetailMap: new Map(),
      allCards: [card(10, "A"), card(11, "B")],
    });
    const activeExtraSkills = new Map([[11, [skillDetail(1, 27)]]]);

    expect(Array.from(findDuplicateRecommendedCardSkillIds(rows, activeExtraSkills))).toEqual([1]);
    expect(hideDuplicateRecommendedCardSkills(rows, activeExtraSkills).map((row) => row.cardId)).toEqual([11]);
  });

  test("projects gold recommendations and card grants as their white inheritable skill", () => {
    const [goldIdRaw, mapping] = Object.entries(GOLD_TO_WHITE_MAP)[0] ?? [];
    if (!goldIdRaw || !mapping) throw new Error("Expected at least one Gold-to-White inheritance mapping");
    const goldId = Number(goldIdRaw);
    const whiteId = mapping.whiteId;
    const gold = { ...skillDetail(goldId, 27), rarity: 2 };
    const white = skillDetail(whiteId, 27);
    const details = new Map([[goldId, gold], [whiteId, white]]);
    const candidate = { ...card(10, "A"), eventSkills: [goldId] };

    expect(projectGameRecommendedCards({
      skills: [recommendedSkill(goldId, [10])],
      excludedSkillIds: new Set([whiteId]),
      excludedCardIds: new Set(),
      effectFilter: [],
      skillDetailMap: details,
      allCards: [candidate],
    })).toEqual([]);
    expect(projectAdditionalCardSkills(candidate, new Set(), new Set(), details).map((skill) => skill.id)).toEqual([whiteId]);
  });

  test("builds track-active fallback skills from unselected cards and excludes Ace and Parent skills", () => {
    const course = {
      id: 90001,
      terrain: 1,
      turn: 1,
      distance: 3,
      inout: 0,
      length: 2200,
      corners: [],
      slopes: [],
      straights: [],
    };
    const cards = [
      { ...card(10, "First"), hintSkills: [204721, 204722] },
      { ...card(11, "Second"), eventSkills: [204721] },
      { ...card(12, "Selected Parent"), eventSkills: [204722] },
    ];
    const details = new Map([
      [204721, skillDetail(204721, 27)],
      [204722, skillDetail(204722, 27)],
    ]);

    expect(projectTrackActiveFallbackSkills({
      allCards: cards,
      course,
      runningStyle: null,
      excludedSkillIds: new Set(),
      parentSlots: [cards[2]],
      skillDetailMap: details,
    })).toEqual([{
      skillId: 204721,
      supportCardIds: [10, 11],
      runningStyleValues: { nige: 1, senko: 1, sashi: 1, oikomi: 1 },
    }]);

    expect(projectTrackActiveFallbackSkills({
      allCards: cards,
      course,
      runningStyle: null,
      excludedSkillIds: new Set([204721]),
      parentSlots: [cards[2]],
      skillDetailMap: details,
    })).toEqual([]);
  });
});
