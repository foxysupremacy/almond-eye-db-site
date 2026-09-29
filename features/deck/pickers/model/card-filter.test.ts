import { describe, expect, test } from "bun:test";
import { filterAndSortCards, type PickerCard } from "./card-filter";
import type { SkillEffectCategory } from "@/lib/skills/effects";

const cards: PickerCard[] = [
  { id: 1, nameEn: "Fine Motion", nameJp: "ファインモーション", type: "wit", release: "2024-01-01", rarity: 3 },
  { id: 2, nameEn: "Agnes Tachyon", nameJp: "アグネスタキオン", type: "speed", release: "2025-01-01", rarity: 2 },
  { id: 3, nameEn: "Special Week", nameJp: "スペシャルウィーク", type: "speed", release: "2023-01-01", rarity: 3 },
];

function options(overrides: Partial<Parameters<typeof filterAndSortCards>[0]> = {}) {
  return {
    cards,
    query: "",
    type: "all" as const,
    selectedEffects: [],
    cardEffectMap: new Map(),
    cardSkillNamesMap: new Map(),
    parentCardTargetSkillsMap: new Map(),
    sort: "rarity" as const,
    mode: "main" as const,
    recommendationsMap: new Map(),
    onlyOwned: false,
    isOwned: () => false,
    selectedSkillCount: 0,
    skillMatchMode: "OR" as const,
    cardMatchedSelectedSkillsMap: new Map(),
    ...overrides,
  };
}

describe("card picker filter model", () => {
  test("searches card and granted skill names and filters by type", () => {
    const result = filterAndSortCards(options({
      query: "corner",
      type: "speed",
      cardSkillNamesMap: new Map([[2, "corner acceleration"]]),
    }));
    expect(result.map((card) => card.id)).toEqual([2]);
  });

  test("applies ownership and effect filters together", () => {
    const result = filterAndSortCards(options({
      onlyOwned: true,
      isOwned: (cardId) => cardId === 2 || cardId === 3,
      selectedEffects: ["target_speed"],
      cardEffectMap: new Map<number, Set<SkillEffectCategory>>([
        [2, new Set<SkillEffectCategory>(["target_speed"])],
        [3, new Set<SkillEffectCategory>(["acceleration"])],
      ]),
    }));
    expect(result.map((card) => card.id)).toEqual([2]);
  });

  test("ranks parent candidates by selected-skill matches before the active sort", () => {
    const result = filterAndSortCards(options({
      mode: "parent",
      selectedSkillCount: 2,
      skillMatchMode: "AND",
      cardMatchedSelectedSkillsMap: new Map([[1, { count: 1 }], [2, { count: 2 }], [3, { count: 2 }]]),
      recommendationsMap: new Map([[2, { score: 1 }], [3, { score: 9 }]]),
      sort: "recommended",
    }));
    expect(result.map((card) => card.id)).toEqual([3, 2]);
  });
});
