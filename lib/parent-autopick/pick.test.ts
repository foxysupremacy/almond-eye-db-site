import { describe, expect, test } from "bun:test";
import type { AutoPickCard, AutoPickEvent } from "./cards";
import { pickParentDeck } from "./pick";
import type { SkillValue } from "./values";

function vals(entries: Record<number, number>): Map<number, SkillValue> {
  const m = new Map<number, SkillValue>();
  for (const [id, value] of Object.entries(entries)) {
    m.set(Number(id), { skillId: Number(id), bashin: value, activates: true, groups: ["target_speed"], value, flat: false });
  }
  return m;
}

function card(cardId: number, hints: number[], extra: Partial<AutoPickCard> = {}): AutoPickCard {
  return { cardId, characterKey: `c${cardId}`, rarity: 3, release: "2024-01-01", hintSkillIds: hints, events: [], looseEventSkillIds: [], ...extra };
}

// Skill ids: a=1 b=2 c=3 d=4 e=5 f=6
const A = 1, B = 2, C = 3, D = 4, E = 5, F = 6;
const none = new Set<number>();

describe("pickParentDeck", () => {
  test("a skill on two cards is counted once", () => {
    const r = pickParentDeck({
      cards: [card(1, [A, B]), card(2, [B, C])],
      values: vals({ [A]: 1, [B]: 2, [C]: 3 }),
      coveredSkillIds: none, locked: null,
    });
    expect(r.total).toBeCloseTo(6);
    expect(r.picks.length).toBe(2);
  });

  test("covered skills add nothing and a fully covered card is not picked", () => {
    const r = pickParentDeck({
      cards: [card(1, [A]), card(2, [B])],
      values: vals({ [A]: 1, [B]: 2 }),
      coveredSkillIds: new Set([A]), locked: null,
    });
    expect(r.picks.map((p) => p.cardId)).toEqual([2]);
    expect(r.total).toBeCloseTo(2);
  });

  test("one 2.0 skill beats five 0.1 skills for a single slot", () => {
    const r = pickParentDeck({
      cards: [card(1, [A]), card(2, [B, C, D, E, F])],
      values: vals({ [A]: 2, [B]: 0.1, [C]: 0.1, [D]: 0.1, [E]: 0.1, [F]: 0.1 }),
      coveredSkillIds: none, locked: null, deckSize: 1,
    });
    expect(r.picks.map((p) => p.cardId)).toEqual([1]);
  });

  test("same characterKey is never picked twice; candidate sharing the locked key is skipped", () => {
    const r = pickParentDeck({
      cards: [card(1, [A], { characterKey: "x" }), card(2, [B], { characterKey: "x" }), card(3, [C], { characterKey: "lk" })],
      values: vals({ [A]: 1, [B]: 2, [C]: 5 }),
      coveredSkillIds: none, locked: card(9, [D], { characterKey: "lk" }),
    });
    const ids = r.picks.map((p) => p.cardId);
    expect(ids).toEqual([9, 2]);
  });

  test("event choice: picks the best choice, falls back when covered, records chainChoices", () => {
    const events: AutoPickEvent[] = [{ eventId: 7, choices: [{ index: 1, skillIds: [A] }, { index: 2, skillIds: [B, C] }] }];
    const values = vals({ [A]: 1.0, [B]: 0.6, [C]: 0.6 });
    const r1 = pickParentDeck({ cards: [card(1, [], { events })], values, coveredSkillIds: none, locked: null });
    expect(r1.total).toBeCloseTo(1.2);
    expect(r1.picks[0].chainChoices).toEqual({ "1:7": 2 });
    expect(r1.picks[0].skills.every((s) => s.source === "event" && s.eventId === 7 && s.choiceIndex === 2)).toBe(true);
    const r2 = pickParentDeck({ cards: [card(1, [], { events })], values, coveredSkillIds: new Set([B, C]), locked: null });
    expect(r2.total).toBeCloseTo(1.0);
    expect(r2.picks[0].chainChoices).toEqual({ "1:7": 1 });
  });

  test("chainChoices: a credited choice is recorded even when the other choice has no resolved skills (gold without white)", () => {
    // Raw event has 2 choices; choice 1's gold resolved away, choice 2 is a white.
    const events: AutoPickEvent[] = [{ eventId: 7, choices: [{ index: 1, skillIds: [] }, { index: 2, skillIds: [B] }] }];
    const r = pickParentDeck({ cards: [card(1, [], { events })], values: vals({ [B]: 1 }), coveredSkillIds: none, locked: null });
    expect(r.picks[0].skills.map((s) => s.skillId)).toEqual([B]);
    expect(r.picks[0].chainChoices).toEqual({ "1:7": 2 });
  });

  test("chainChoices: an event whose choices all credit nothing records no key", () => {
    const events: AutoPickEvent[] = [{ eventId: 7, choices: [{ index: 1, skillIds: [A] }, { index: 2, skillIds: [B] }] }];
    const r = pickParentDeck({ cards: [card(1, [C], { events })], values: vals({ [A]: 1, [B]: 1, [C]: 1 }), coveredSkillIds: new Set([A, B]), locked: null });
    expect(r.picks[0].skills.map((s) => s.skillId)).toEqual([C]);
    expect(r.picks[0].chainChoices).toEqual({});
  });

  test("chainChoices: a single-choice event records no key", () => {
    const events: AutoPickEvent[] = [{ eventId: 7, choices: [{ index: 2, skillIds: [B] }] }];
    const r = pickParentDeck({ cards: [card(1, [], { events })], values: vals({ [B]: 1 }), coveredSkillIds: none, locked: null });
    expect(r.picks[0].skills.map((s) => s.skillId)).toEqual([B]);
    expect(r.picks[0].chainChoices).toEqual({});
  });

  test("final gain sort never lowers the optimized total", () => {
    // x=1 y=2 z=3 q=4 h=5. X = hints {x, z}; D = event {x | y} + hint h; P2 = event {x | z} + hint q.
    // Greedy [X, P2] = 10.5; swap X -> D gives [D, P2] = 10.8 with gains 5.3 < 5.5.
    // Re-sorting to [P2, D] would re-allocate D's event and drop the total to 6.5.
    const x = 1, y = 2, z = 3, q = 4, h = 5;
    const X = card(1, [x, z]);
    const Dc = card(2, [h], { events: [{ eventId: 1, choices: [{ index: 1, skillIds: [x] }, { index: 2, skillIds: [y] }] }] });
    const P2 = card(3, [q], { events: [{ eventId: 1, choices: [{ index: 1, skillIds: [x] }, { index: 2, skillIds: [z] }] }] });
    const r = pickParentDeck({
      cards: [X, Dc, P2],
      values: vals({ [x]: 5, [y]: 0.2, [z]: 4.5, [q]: 1, [h]: 0.3 }),
      coveredSkillIds: none, locked: null, deckSize: 2,
    });
    expect(r.total).toBeCloseTo(10.8);
    expect(r.picks.map((p) => p.cardId)).toEqual([2, 3]);
    expect(r.picks.every((p) => p.gain > 0)).toBe(true);
  });

  test("greedy trap: swap pass finds Y + Z", () => {
    const r = pickParentDeck({
      cards: [card(1, [A, B]), card(2, [A, C]), card(3, [B, E])],
      values: vals({ [A]: 3, [B]: 3, [C]: 2.9, [E]: 2.9 }),
      coveredSkillIds: none, locked: null, deckSize: 2,
    });
    expect(r.picks.map((p) => p.cardId).sort()).toEqual([2, 3]);
    expect(r.total).toBeCloseTo(11.8);
  });

  test("stops early when no card adds value", () => {
    const r = pickParentDeck({
      cards: [card(1, [A]), card(2, [B]), card(3, [C]), card(4, [A])],
      values: vals({ [A]: 1, [B]: 1, [C]: 1 }),
      coveredSkillIds: none, locked: null,
    });
    expect(r.picks.length).toBe(3);
  });

  test("a card with no skills is never picked", () => {
    const r = pickParentDeck({ cards: [card(1, [])], values: vals({}), coveredSkillIds: none, locked: null });
    expect(r.picks).toEqual([]);
    expect(r.total).toBe(0);
  });

  test("locked card is picks[0] even with zero gain, and counts toward deckSize", () => {
    const r = pickParentDeck({
      cards: [card(1, [A]), card(2, [B])],
      values: vals({ [A]: 1, [B]: 2 }),
      coveredSkillIds: new Set([D]), locked: card(9, [D]), deckSize: 2,
    });
    expect([r.picks[0].cardId, r.picks[0].locked, r.picks[0].gain]).toEqual([9, true, 0]);
    expect(r.picks.map((p) => p.cardId)).toEqual([9, 2]);
  });

  test("ties resolve by rarity, release, id, independent of input order", () => {
    const cs = [
      card(5, [A], { rarity: 1 }),
      card(4, [B], { rarity: 3, release: "2023-01-01" }),
      card(3, [C], { rarity: 3, release: "2024-06-01" }),
      card(2, [D], { rarity: 3, release: "2024-06-01" }),
      card(6, [E], { rarity: 3, release: null }),
    ];
    const values = vals({ [A]: 1, [B]: 1, [C]: 1, [D]: 1, [E]: 1 });
    const run = (list: AutoPickCard[]) => pickParentDeck({ cards: list, values, coveredSkillIds: none, locked: null, deckSize: 1 });
    const first = run(cs);
    expect(first.picks[0].cardId).toBe(2);
    const shuffled = run([cs[3], cs[0], cs[4], cs[2], cs[1]]);
    expect(shuffled).toEqual(first);
    const full1 = pickParentDeck({ cards: cs, values, coveredSkillIds: none, locked: null });
    const full2 = pickParentDeck({ cards: [...cs].reverse(), values, coveredSkillIds: none, locked: null });
    expect(full2).toEqual(full1);
    expect(full1.picks.map((p) => p.cardId)).toEqual([2, 3, 4, 6, 5]);
  });
});
