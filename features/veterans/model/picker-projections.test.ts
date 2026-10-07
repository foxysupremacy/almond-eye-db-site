import { describe, expect, test } from "bun:test";
import type { CharacterIndexEntry } from "@/lib/api";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";
import type { LegacyUniqueEval } from "@/lib/parenting/types";
import {
  projectCharacterTemplates,
  projectOwnedUmaEntries,
  projectVeteranGroups,
  type PickerProjectionDependencies,
} from "./picker-projections";

function character(id: number, charId: number, nameEn: string): CharacterIndexEntry {
  return {
    id,
    charId,
    variant: "01",
    nameEn,
    nameJp: `JP ${nameEn}`,
    titleEn: "",
    titleJp: "",
    rarity: 3,
    aptitude: [],
    baseStats: [],
    imgUrl: "",
  };
}

function veteran(cardId: number, rankScore: number, wins: number[] = []): KyumaruVeteranItem {
  return {
    card_id: cardId,
    speed: 0,
    stamina: 0,
    power: 0,
    guts: 0,
    wiz: 0,
    rank_score: rankScore,
    rank: 1,
    win_saddle_id_array: wins,
  };
}

const dependencies: PickerProjectionDependencies = {
  getCharaIdFromCardId: (cardId) => Math.floor(cardId / 100),
  getCareerG1Saddles: (charId) => [charId, 999],
  calculateAffinity: (v, targetId) => ({ base: v.card_id % 10, total: (v.card_id % 10) + targetId }),
  countSharedG1Wins: (a = [], b = []) => a.filter((id) => b.includes(id)).length,
  calculateBlueStars: (vet) => vet.win_saddle_id_array?.length ?? 0,
  getCharacterImageUrl: (_charId, cardId) => `image:${cardId}`,
  resolveWhiteUnique: () => null,
};

describe("veteran picker projections", () => {
  const characters = [character(100101, 1001, "Alpha"), character(100102, 1001, "Alpha Alt"), character(100201, 1002, "Beta"), character(100301, 1003, "Gamma")];
  const byCardId = new Map(characters.map((entry) => [entry.id, entry]));
  const eligibleCardIds = new Set(characters.map((entry) => entry.id));

  test("owned Uma projection filters duplicate parents and search, scores and sorts entries", () => {
    const entries = projectOwnedUmaEntries({
      ownedUmas: { "100101": [4, 6], "100201": [3, 5], "100301": [5, 7] },
      charactersByCardId: byCardId,
      veterans: [veteran(100201, 100)],
      targetCharaId: 1003,
      excludedCharId: 1002,
      contextParent: veteran(100301, 20, [1003]),
      search: "alp",
      sortBy: "affinity",
      uniqueEvalByCardId: new Map(),
      eligibleCardIds,
      dependencies,
    });

    expect(entries).toHaveLength(1);
    expect({
      chara: entries[0].chara,
      ownedRarity: entries[0].ownedRarity,
      ownedTalent: entries[0].ownedTalent,
      hasHofRuns: entries[0].hasHofRuns,
      affBase: entries[0].affBase,
      affTotal: entries[0].affTotal,
      sharedG1WithParent: entries[0].sharedG1WithParent,
      sharedG1WithTrainee: entries[0].sharedG1WithTrainee,
      careerG1Count: entries[0].careerG1Count,
    }).toEqual({
      chara: characters[0], ownedRarity: 4, ownedTalent: 6, hasHofRuns: false,
      affBase: 1, affTotal: 1004, sharedG1WithParent: 0, sharedG1WithTrainee: 1,
      careerG1Count: 2,
    });
  });

  test("veteran projection groups runs, picks the blue-star best run, and preserves source order", () => {
    const first = veteran(100101, 900, [1]);
    const second = veteran(100102, 800, [1, 2]);
    const other = veteran(100201, 700, []);
    const source = [first, second, other];
    const groups = projectVeteranGroups({
      veterans: source,
      charactersByCardId: byCardId,
      targetCharaId: null,
      search: "alpha",
      sortBy: "rank_score",
      uniqueEvalByCardId: new Map(),
      eligibleCardIds,
      dependencies,
    });

    expect(groups).toHaveLength(1);
    expect({
      charId: 1001,
      cardId: 100102,
      runCount: 2,
      maxBlueStars: 2,
      bestRankScore: 900,
      avatarUrl: "image:100102",
    }).toEqual({
      charId: 1001, cardId: 100102, runCount: 2, maxBlueStars: 2,
      bestRankScore: 900, avatarUrl: "image:100102",
    });
    expect(groups[0].runs).toEqual([second, first]);
    expect(source).toEqual([first, second, other]);
  });

  test("template projection excludes duplicate parents and orders fireable uniques before affinity", () => {
    const evals = new Map<number, LegacyUniqueEval>([
      [100101, { tier: "F", score: 10 } as LegacyUniqueEval],
      [100201, { tier: "A", score: 1 } as LegacyUniqueEval],
    ]);
    const templates = projectCharacterTemplates({
      characters,
      targetCharaId: 1003,
      excludedCharId: null,
      search: "",
      sortBy: "affinity",
      uniqueEvalByCardId: evals,
      eligibleCardIds,
      calculateAffinity: (cardId) => cardId,
    });

    expect(templates.map((item) => item.id)).toEqual([100201, 100102, 100101]);
    expect(characters.map((item) => item.id)).toEqual([100101, 100102, 100201, 100301]);
  });

  test("all manual tabs exclude weak variants before grouping, searching and sorting", () => {
    const eligibleCardIds = new Set([100102, 100201]);
    const weakRun = veteran(100101, 9999, [1, 2, 3]);
    const strongRun = veteran(100102, 1, [1]);
    const common = { targetCharaId: 1003, search: "alpha", sortBy: "affinity" as const,
      uniqueEvalByCardId: new Map<number, LegacyUniqueEval>(), eligibleCardIds };
    const templates = projectCharacterTemplates({ ...common, characters, calculateAffinity: (id) => id });
    expect(templates.map((entry) => entry.id)).toEqual([100102]);
    const owned = projectOwnedUmaEntries({ ...common, ownedUmas: { "100101": [3, 0], "100102": [3, 0] },
      charactersByCardId: byCardId, veterans: [weakRun, strongRun], dependencies });
    expect(owned.map((entry) => entry.chara.id)).toEqual([100102]);
    const groups = projectVeteranGroups({ ...common, charactersByCardId: byCardId,
      veterans: [weakRun, strongRun], dependencies });
    expect(groups).toHaveLength(1);
    expect(groups[0].bestVet).toBe(strongRun);
    expect(groups[0].runs).toEqual([strongRun]);
    expect(weakRun.rank_score).toBe(9999);
  });
});
