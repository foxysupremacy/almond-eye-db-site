import { describe, expect, test } from "bun:test";
import { filterCollectionCards, filterCollectionCharacters } from "./filters";

describe("collection filters", () => {
  const cards = [
    { id: 1, nameEn: "Fine Motion", nameJp: "ファインモーション", charName: "Fine Motion", type: "wit", rarity: 3 },
    { id: 2, nameEn: "Agnes Tachyon", nameJp: "アグネスタキオン", charName: "Agnes Tachyon", type: "speed", rarity: 2 },
  ];

  test("matches bilingual names and aliases intelligence to wit", () => {
    expect(filterCollectionCards(cards, "ファイン", "intelligence", "all").map((card) => card.id)).toEqual([1]);
  });

  test("combines query, type and rarity filters", () => {
    expect(filterCollectionCards(cards, "agnes", "speed", 2).map((card) => card.id)).toEqual([2]);
    expect(filterCollectionCards(cards, "agnes", "stamina", "all")).toEqual([]);
  });

  test("filters playable characters by localized names and rarity", () => {
    const characters = [
      { id: 1, nameEn: "Special Week", nameJp: "スペシャルウィーク", titleEn: "Special Dreamer", titleJp: "", rarity: 3 },
      { id: 2, nameEn: "Silence Suzuka", nameJp: "サイレンススズカ", titleEn: "", titleJp: "", rarity: 2 },
    ];
    expect(filterCollectionCharacters(characters, "dreamer", "all").map((character) => character.id)).toEqual([1]);
    expect(filterCollectionCharacters(characters, "suzuka", 2).map((character) => character.id)).toEqual([2]);
  });
});
