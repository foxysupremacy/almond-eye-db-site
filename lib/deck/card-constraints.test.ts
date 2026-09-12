import { describe, it, expect } from "bun:test";
import { cardCharacterKey, canPlaceCard, findCharConflict } from "./card-constraints";
import type { CardIndexEntry } from "../data-store";

function card(id: number, charName: string, type: CardIndexEntry["type"] = "speed"): CardIndexEntry {
  return {
    id,
    nameJp: `[タイトル] ${charName}`,
    nameEn: charName,
    charName,
    rarity: 3,
    type,
    imgUrl: "",
    portraitUrl: "",
    eventSkills: [],
    hintSkills: [],
  };
}

const EYE_SPEED = card(30242, "Almond Eye", "speed");
const EYE_GUTS = card(30308, "Almond Eye", "guts");
const TAJO = card(30101, "Super Creek");

const empty: (CardIndexEntry | null)[] = [null, null, null, null, null, null];

describe("cardCharacterKey", () => {
  it("uses charName (case/whitespace insensitive)", () => {
    expect(cardCharacterKey(EYE_SPEED)).toBe("almond eye");
    expect(cardCharacterKey({ ...EYE_SPEED, charName: "  Almond Eye " })).toBe("almond eye");
  });

  it("falls back to nameEn when charName is missing", () => {
    expect(cardCharacterKey({ ...EYE_SPEED, charName: undefined })).toBe("almond eye");
  });
});

describe("same-uma constraint (canPlaceCard / findCharConflict)", () => {
  it("rejects a second, different card of the same uma within one deck", () => {
    const main: (CardIndexEntry | null)[] = [EYE_SPEED, null, null, null, null, null];
    expect(canPlaceCard(main, 2, EYE_GUTS)).toBe(false);
    expect(findCharConflict(main, 2, EYE_GUTS)).toBe(EYE_SPEED);
  });

  it("allows the same uma on a different card in the OTHER deck — decks are independent", () => {
    const main: (CardIndexEntry | null)[] = [EYE_SPEED, null, null, null, null, null];
    expect(canPlaceCard(empty, 0, EYE_GUTS)).toBe(true);
    // The Parent Deck trains P1/P2; a Main Deck card must never block it.
    expect(canPlaceCard(main, 0, EYE_GUTS)).toBe(true);
    expect(canPlaceCard(main, 0, EYE_SPEED)).toBe(true);
  });

  it("allows the exact same card in both decks", () => {
    const main: (CardIndexEntry | null)[] = [EYE_SPEED, null, null, null, null, null];
    expect(canPlaceCard(empty, 0, EYE_SPEED)).toBe(true);
  });

  it("allows replacing the occupant of the slot being written", () => {
    const parent: (CardIndexEntry | null)[] = [EYE_GUTS, null, null, null, null, null];
    expect(canPlaceCard(parent, 0, EYE_SPEED)).toBe(true);
  });

  it("allows different umas freely", () => {
    const main: (CardIndexEntry | null)[] = [EYE_SPEED, null, null, null, null, null];
    expect(canPlaceCard(main, 0, TAJO)).toBe(true);
  });
});
