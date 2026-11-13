import { describe, expect, test } from "bun:test";
import type { CardIndexEntry, ScenarioLinkEntry } from "../data/types";
import { candidateCardIds, palCardOptions, resolvePalCard, scenarioLabel } from "./scenario";

function cardEntry(id: number, rarity: 1 | 2 | 3, release: string | null): CardIndexEntry {
  return { id, rarity, release } as CardIndexEntry;
}
const entry = (palCardIds: number[]): ScenarioLinkEntry => ({ scenarioId: 14, nameJp: "トレセン", linkedCharaIds: [], palCardIds, linkedCardIds: [] });
const mapOf = (...cs: CardIndexEntry[]) => new Map(cs.map((c) => [c.id, c]));

const ssrNew = cardEntry(30, 3, "2025-06-01");
const ssrOld = cardEntry(20, 3, "2024-01-01");
const rNew = cardEntry(10, 1, "2025-09-01");
const cards = mapOf(ssrOld, rNew, ssrNew);

describe("scenarioLabel", () => {
  test("known id uses English, unknown falls back to nameJp", () => {
    expect(scenarioLabel({ ...entry([]), scenarioId: 13, nameJp: "夢" })).toEqual({ en: "Beyond Dreams", jp: "夢" });
    expect(scenarioLabel({ ...entry([]), scenarioId: 99, nameJp: "新" })).toEqual({ en: "新", jp: "新" });
  });
});

describe("palCardOptions", () => {
  test("SSR newest, SSR older, then R; missing ids left out", () => {
    expect(palCardOptions(entry([10, 20, 30, 999]), cards).map((c) => c.id)).toEqual([30, 20, 10]);
  });
  test("none in data -> []", () => {
    expect(palCardOptions(entry([999]), cards)).toEqual([]);
    expect(resolvePalCard([], {}, null)).toBeNull();
  });
});

describe("resolvePalCard", () => {
  const options = [ssrNew, ssrOld, rNew];
  test("owned older SSR beats unowned newer SSR", () => {
    expect(resolvePalCard(options, { "20": 2 })?.id).toBe(20);
  });
  test("nothing owned -> newest SSR", () => {
    expect(resolvePalCard(options, {})?.id).toBe(30);
  });
  test("owned R with unowned SSR -> the SSR", () => {
    expect(resolvePalCard(options, { "10": 4 })?.id).toBe(30);
  });
  test("preferredId wins when valid, ignored otherwise", () => {
    expect(resolvePalCard(options, { "20": 0 }, 10)?.id).toBe(10);
    expect(resolvePalCard(options, { "20": 0 }, 777)?.id).toBe(20);
  });
});

describe("candidateCardIds", () => {
  test("drops unknown, Main Deck and locked ids", () => {
    const owned = { "10": 0, "20": 1, "30": 4, "999": 2 };
    expect(candidateCardIds(owned, cards, new Set([10]), 30).sort((a, b) => a - b)).toEqual([20]);
  });
});
