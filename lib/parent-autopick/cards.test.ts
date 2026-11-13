import { describe, expect, test } from "bun:test";
import type { CardIndexEntry, CardMeta } from "../data/types";
import { goldToWhiteMap } from "../data/registry";
import { buildAutoPickCard, collectSkillIds, grantedSkillIds, resolveSkillId, type AutoPickCard } from "./cards";

const [goldKey, mapped] = Object.entries(goldToWhiteMap)[0];
const GOLD = Number(goldKey);
const WHITE = mapped.whiteId;
const UNMAPPED_GOLD = 999_999_001;

const rarityOf = (id: number) => (id === GOLD || id === UNMAPPED_GOLD ? 2 : 1);

const card = { id: 30001, nameJp: "名", nameEn: "Some Uma", charName: "Some Uma", rarity: 3, type: "speed", release: "2024-01-01", imgUrl: "" } as CardIndexEntry;
const meta = (over: Partial<CardMeta>): CardMeta => ({ hints: [], events: [], nameEn: "", nameJp: "", rarity: 3, type: "speed", urlName: "", ...over });

describe("resolveSkillId", () => {
  test("gold with a mapping resolves to white", () => expect(resolveSkillId(GOLD, rarityOf)).toBe(WHITE));
  test("gold without a mapping is dropped", () => expect(resolveSkillId(UNMAPPED_GOLD, rarityOf)).toBeNull());
  test("other ids pass through", () => expect(resolveSkillId(100, rarityOf)).toBe(100));
});

describe("buildAutoPickCard", () => {
  test("undefined meta gives empty skills", () => {
    const c = buildAutoPickCard(card, undefined, rarityOf);
    expect(c).toEqual({ cardId: 30001, characterKey: "some uma", rarity: 3, release: "2024-01-01", hintSkillIds: [], events: [], looseEventSkillIds: [] });
  });
  test("hints resolved and de-duplicated, unmapped gold dropped", () => {
    const c = buildAutoPickCard(card, meta({ hints: [GOLD, WHITE, 5, UNMAPPED_GOLD, 5] }), rarityOf);
    expect(c.hintSkillIds).toEqual([WHITE, 5]);
  });
  test("choice skills are not repeated in looseEventSkillIds; skill-less events omitted", () => {
    const c = buildAutoPickCard(card, meta({
      events: [10, 11, GOLD, 12],
      eventDetails: [
        { eventId: 1, nameEn: "", nameJp: "", choices: [{ index: 0, textEn: "", textJp: "", skillIds: [10, 10, GOLD] }, { index: 1, textEn: "", textJp: "", skillIds: [] }] },
        { eventId: 2, nameEn: "", nameJp: "", choices: [{ index: 0, textEn: "", textJp: "", skillIds: [] }] },
      ],
    }), rarityOf);
    expect(c.events).toEqual([{ eventId: 1, choices: [{ index: 0, skillIds: [10, WHITE] }, { index: 1, skillIds: [] }] }]);
    expect(c.looseEventSkillIds).toEqual([11, 12]);
  });
});

describe("grantedSkillIds", () => {
  test("only the chosen option of a branching event; single-choice events always", () => {
    const a: AutoPickCard = {
      cardId: 1, characterKey: "a", rarity: 3, release: null, hintSkillIds: [9], looseEventSkillIds: [7],
      events: [
        { eventId: 1, choices: [{ index: 1, skillIds: [10] }, { index: 2, skillIds: [20] }] },
        { eventId: 2, choices: [{ index: 2, skillIds: [30] }] },
      ],
    };
    expect(grantedSkillIds([a], () => 1)).toEqual([7, 9, 10, 30]);
    expect(grantedSkillIds([a], (_c, e) => (e === 1 ? 2 : 1))).toEqual([7, 9, 20, 30]);
  });
});

describe("collectSkillIds", () => {
  test("sorted and unique across hints, events, loose", () => {
    const a: AutoPickCard = { cardId: 1, characterKey: "a", rarity: 3, release: null, hintSkillIds: [9, 3], events: [{ eventId: 1, choices: [{ index: 0, skillIds: [5, 3] }] }], looseEventSkillIds: [7, 9] };
    const b: AutoPickCard = { ...a, cardId: 2, hintSkillIds: [1], events: [], looseEventSkillIds: [] };
    expect(collectSkillIds([a, b])).toEqual([1, 3, 5, 7, 9]);
  });
});
