import { describe, expect, test } from "bun:test";
import type { CardIndexEntry, CardSkills, SkillSummary } from "../api";
import type { DeckSkill, DeckSkillGrant } from "./types";
import {
  deriveMainGrantsBySkillId,
  deriveMainSkillIdSet,
  deriveParentSkills,
  deriveSkillsForDeck,
} from "./skill-resolver";

// Gold skill 200014 ("Clockwise Demon") maps to white 200011 ("Right Turns ◎")
// in lib/data/generated/gold-to-white.json — see that file for the authoritative table.
const GOLD_ID = 200014;
const GOLD_WHITE_COUNTERPART = 200011;

function skill(overrides: Partial<SkillSummary> & { id: number }): SkillSummary {
  return {
    nameJp: `jp-${overrides.id}`,
    nameEn: `en-${overrides.id}`,
    descEn: "desc",
    rarity: 1,
    iconId: 20000,
    ...overrides,
  } as SkillSummary;
}

function card(overrides: Partial<CardIndexEntry> & { id: number }): CardIndexEntry {
  return {
    nameEn: `card-${overrides.id}`,
    nameJp: `カード-${overrides.id}`,
    ...overrides,
  } as CardIndexEntry;
}

function cardSkills(overrides: Partial<CardSkills> & { id: number }): CardSkills {
  return { ...overrides } as unknown as CardSkills;
}

describe("deriveSkillsForDeck", () => {
  test("aggregates hint + event skills across cards, merging grants for shared skill ids", () => {
    const shared = skill({ id: 100, nameEn: "Shared" });
    const cardA = card({ id: 1 });
    const cardB = card({ id: 2 });
    const byCard: Record<number, CardSkills | null> = {
      1: cardSkills({ id: 1, hintSkills: [shared], eventSkills: [] }),
      2: cardSkills({ id: 2, hintSkills: [], eventSkills: [shared] }),
    };

    const out = deriveSkillsForDeck([cardA, cardB], false, byCard);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(100);
    expect(out[0].grants?.map((g) => g.cardId).sort()).toEqual([1, 2]);
    expect(out[0].grants?.map((g) => g.source).sort()).toEqual(["event", "hint"]);
  });

  test("filters event skills by the chosen branch (choice mismatch excluded)", () => {
    const ev = skill({
      id: 200,
      eventMeta: { eventId: 5, choiceIndex: 1 } as SkillSummary["eventMeta"],
    });
    const byCard: Record<number, CardSkills | null> = {
      1: cardSkills({ id: 1, hintSkills: [], eventSkills: [ev] }),
    };
    const slots = [card({ id: 1, eventDetails: [{ eventId: 5, nameEn: "Ev", nameJp: "Ev", choices: [{ index: 1, textEn: "a", textJp: "a", skillIds: [200] }, { index: 2, textEn: "b", textJp: "b", skillIds: [] }] }] })];

    const chosen = deriveSkillsForDeck(slots, false, byCard, { "1:5": 1 });
    expect(chosen.map((s) => s.id)).toContain(200);

    const other = deriveSkillsForDeck(slots, false, byCard, { "1:5": 2 });
    expect(other.map((s) => s.id)).not.toContain(200);
  });

  test("card-level choice key (\"{cardId}\") overrides per-event key", () => {
    const ev = skill({ id: 200, eventMeta: { eventId: 5, choiceIndex: 1 } as SkillSummary["eventMeta"] });
    const byCard: Record<number, CardSkills | null> = {
      1: cardSkills({ id: 1, hintSkills: [], eventSkills: [ev] }),
    };
    const slots = [card({ id: 1, eventDetails: [{ eventId: 5, nameEn: "Ev", nameJp: "Ev", choices: [{ index: 1, textEn: "a", textJp: "a", skillIds: [200] }, { index: 2, textEn: "b", textJp: "b", skillIds: [] }] }] })];

    const out = deriveSkillsForDeck(slots, false, byCard, { "1": 2 });
    expect(out.map((s) => s.id)).not.toContain(200);
  });

  test("a skill offered by several choices of one event survives whichever of them is picked", () => {
    // Satono Diamond Step 3: opt1 = [300 shared, 301], opt2 = [300 shared, 302]
    const sources = [
      { eventId: 7, choiceIndex: 1 },
      { eventId: 7, choiceIndex: 2 },
    ] as NonNullable<SkillSummary["eventSources"]>;
    const shared = skill({ id: 300, rarity: 2, eventMeta: sources[0], eventSources: sources });
    const opt1Only = skill({ id: 301, rarity: 2, eventMeta: { eventId: 7, choiceIndex: 1 } as SkillSummary["eventMeta"] });
    const opt2Only = skill({ id: 302, rarity: 2, eventMeta: { eventId: 7, choiceIndex: 2 } as SkillSummary["eventMeta"] });
    const byCard: Record<number, CardSkills | null> = {
      1: cardSkills({ id: 1, hintSkills: [], eventSkills: [shared, opt1Only, opt2Only] }),
    };
    const slots = [card({ id: 1, eventDetails: [{ eventId: 7, nameEn: "C3", nameJp: "C3", eventType: "chain", chainStep: 3, choices: [{ index: 1, textEn: "a", textJp: "a", skillIds: [300, 301] }, { index: 2, textEn: "b", textJp: "b", skillIds: [300, 302] }] }] })];

    const opt2 = deriveSkillsForDeck(slots, false, byCard, { "1:7": 2 });
    expect(opt2.map((s) => s.id).sort()).toEqual([300, 302]);
    // Attribution follows the picked option, not the first listed one.
    expect(opt2.find((s) => s.id === 300)?.grants?.[0].eventMeta?.choiceIndex).toBe(2);

    const opt1 = deriveSkillsForDeck(slots, false, byCard, { "1:7": 1 });
    expect(opt1.map((s) => s.id).sort()).toEqual([300, 301]);
  });

  test("a skill also granted by an unconditional later step survives an earlier branch choice", () => {
    // Seiun Sky: C2 opt2/2 hints the gold, C3 (single option) always grants it.
    const sources = [
      { eventId: 8, choiceIndex: 2 },
      { eventId: 9, choiceIndex: 1 },
    ] as NonNullable<SkillSummary["eventSources"]>;
    const gold = skill({ id: 400, rarity: 2, eventMeta: sources[0], eventSources: sources });
    const byCard: Record<number, CardSkills | null> = {
      1: cardSkills({ id: 1, hintSkills: [], eventSkills: [gold] }),
    };
    const slots = [card({ id: 1, eventDetails: [
      { eventId: 8, nameEn: "C2", nameJp: "C2", eventType: "chain", chainStep: 2, choices: [{ index: 1, textEn: "a", textJp: "a", skillIds: [] }, { index: 2, textEn: "b", textJp: "b", skillIds: [400] }] },
      { eventId: 9, nameEn: "C3", nameJp: "C3", eventType: "chain", chainStep: 3, choices: [{ index: 1, textEn: "c", textJp: "c", skillIds: [400] }] },
    ] })];

    const out = deriveSkillsForDeck(slots, false, byCard, { "1:8": 1 });
    expect(out.map((s) => s.id)).toEqual([400]);
    expect(out[0].grants?.[0].eventMeta?.eventId).toBe(9);
  });

  test("without chainChoicesMap, picks the default optimal branch (gold skills weigh 10x)", () => {
    const whiteEv = skill({ id: 201, eventMeta: { eventId: 6, choiceIndex: 1 } as SkillSummary["eventMeta"] });
    const goldEv = skill({ id: GOLD_ID, rarity: 2, eventMeta: { eventId: 6, choiceIndex: 2 } as SkillSummary["eventMeta"] });
    const byCard: Record<number, CardSkills | null> = {
      1: cardSkills({ id: 1, hintSkills: [], eventSkills: [whiteEv, goldEv] }),
    };
    const slots = [card({ id: 1, eventDetails: [{ eventId: 6, nameEn: "Ev", nameJp: "Ev", choices: [{ index: 1, textEn: "a", textJp: "a", skillIds: [201] }, { index: 2, textEn: "b", textJp: "b", skillIds: [GOLD_ID] }] }] })];

    const out = deriveSkillsForDeck(slots, false, byCard);
    expect(out.map((s) => s.id)).toContain(GOLD_ID);
    expect(out.map((s) => s.id)).not.toContain(201);
  });

  test("parent deck: gold skills map to their white inherit; unmapped golds are dropped", () => {
    const mappedGold = skill({ id: GOLD_ID, rarity: 2 });
    const unmappedGold = skill({ id: 999999, rarity: 2 });
    const white = skill({ id: 300 });
    const byCard: Record<number, CardSkills | null> = {
      1: cardSkills({ id: 1, hintSkills: [], eventSkills: [mappedGold, unmappedGold, white] }),
    };

    const out = deriveSkillsForDeck([card({ id: 1 })], true, byCard);
    const byId = new Map(out.map((s) => [s.id, s]));
    expect(byId.has(GOLD_ID)).toBe(false); // gold itself replaced by white counterpart
    expect(byId.get(GOLD_WHITE_COUNTERPART)?.rarity).toBe(1);
    expect(byId.get(GOLD_WHITE_COUNTERPART)?.grants?.[0].originalGoldSkill?.id).toBe(GOLD_ID);
    expect(byId.has(999999)).toBe(false); // uninheritable gold with no white counterpart
    expect(byId.has(300)).toBe(true); // white skills pass through untouched
  });

  test("main deck does not downgrade gold skills", () => {
    const mappedGold = skill({ id: GOLD_ID, rarity: 2 });
    const byCard: Record<number, CardSkills | null> = {
      1: cardSkills({ id: 1, hintSkills: [], eventSkills: [mappedGold] }),
    };

    const out = deriveSkillsForDeck([card({ id: 1 })], false, byCard);
    expect(out.map((s) => s.id)).toEqual([GOLD_ID]);
  });

  test("skips cards missing from skillsByCard and empty slots", () => {
    const out = deriveSkillsForDeck([null, card({ id: 42 })], false, {});
    expect(out).toEqual([]);
  });

  test("sorts output by nameEn", () => {
    const b = skill({ id: 2, nameEn: "Bravo" });
    const a = skill({ id: 1, nameEn: "Alpha" });
    const byCard: Record<number, CardSkills | null> = {
      1: cardSkills({ id: 1, hintSkills: [b, a], eventSkills: [] }),
    };
    expect(deriveSkillsForDeck([card({ id: 1 })], false, byCard).map((s) => s.nameEn)).toEqual([
      "Alpha",
      "Bravo",
    ]);
  });
});

describe("deriveMainSkillIdSet", () => {
  test("covers white counterpart of owned gold skills", () => {
    const gold = skill({ id: GOLD_ID, rarity: 2 });
    const set = deriveMainSkillIdSet([gold as unknown as DeckSkill]);
    expect(set.has(GOLD_ID)).toBe(true);
    expect(set.has(GOLD_WHITE_COUNTERPART)).toBe(true);
  });
});

describe("deriveMainGrantsBySkillId", () => {
  test("maps gold grants onto the white id when the main deck owns the gold", () => {
    const gold = { ...skill({ id: GOLD_ID, rarity: 2 }), grants: [] } as unknown as DeckSkill;
    const map = deriveMainGrantsBySkillId([gold]);
    expect(map.get(GOLD_ID)).toEqual([]);
    expect(map.get(GOLD_WHITE_COUNTERPART)).toEqual([]);
  });

  test("does not overwrite explicit white grants with gold grants", () => {
    const gold = {
      ...skill({ id: GOLD_ID, rarity: 2 }),
      grants: [{ cardId: 1, cardName: "g", source: "event" }],
    } as unknown as DeckSkill;
    const white = {
      ...skill({ id: GOLD_WHITE_COUNTERPART }),
      grants: [{ cardId: 2, cardName: "w", source: "hint" }],
    } as unknown as DeckSkill;
    const map = deriveMainGrantsBySkillId([gold, white]);
    expect(map.get(GOLD_WHITE_COUNTERPART)?.[0].cardId).toBe(2);
  });
});

describe("deriveParentSkills", () => {
  test("flags duplicates against the main deck and passes through original gold lineage", () => {
    const shared = {
      ...skill({ id: 100 }),
      grants: [
        {
          cardId: 9,
          cardName: "parent-card",
          source: "hint",
          originalGoldSkill: { id: GOLD_ID, nameEn: "g", nameJp: "g" },
        },
      ],
    } as unknown as DeckSkill;
    const uniqueToParent = {
      ...skill({ id: 500 }),
      grants: [{ cardId: 9, cardName: "parent-card", source: "hint" }],
    } as unknown as DeckSkill;
    const mainSet = new Set([100]);
    const mainGrants = new Map<number, DeckSkillGrant[]>([
      [100, [{ cardId: 1, cardName: "main-card", source: "hint" }]],
    ]);

    const out = deriveParentSkills([shared, uniqueToParent], mainSet, mainGrants);
    expect(out[0].isDuplicateInMain).toBe(true);
    expect(out[0].isUniqueToParent).toBe(false);
    expect(out[0].mainCardGrants?.[0].cardName).toBe("main-card");
    expect(out[0].parentDuplicateCount).toBe(1);
    expect(out[0].originalGoldSkill?.id).toBe(GOLD_ID);
    expect(out[1].isDuplicateInMain).toBe(false);
    expect(out[1].isUniqueToParent).toBe(true);
  });
});
