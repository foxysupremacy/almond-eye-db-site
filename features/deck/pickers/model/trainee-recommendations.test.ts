import { describe, expect, test } from "bun:test";
import type { CardIndexEntry } from "@/lib/api";
import type { CardRecommendation } from "@/lib/recommendation/engine";
import { dropTraineeRecommendations } from "./card-filter";

function card(id: number, charName: string, nameJp: string): CardIndexEntry {
  return { id, nameEn: charName, nameJp, charName, rarity: 3, type: "intelligence", imgUrl: "", portraitUrl: "", eventSkills: [], hintSkills: [] };
}

const TACT_WIT = card(30248, "Daring Tact", "[無垢の白妙] デアリングタクト");
const EYE_SPEED = card(30242, "Almond Eye", "[世界を変える眼差し] アーモンドアイ");
const cardsById = new Map([TACT_WIT, EYE_SPEED].map((c) => [c.id, c]));
const rec = (cardId: number) => ({ cardId }) as CardRecommendation;
const DARING_TACT = { nameEn: "Daring Tact", nameJp: "デアリングタクト" };

describe("dropTraineeRecommendations", () => {
  test("removes the trainee's own cards from Main Deck recommendations", () => {
    const out = dropTraineeRecommendations([rec(30248), rec(30242)], "main", cardsById, DARING_TACT);
    expect(out.map((r) => r.cardId)).toEqual([30242]);
  });

  test("keeps them for the Parent Deck, which trains a different uma", () => {
    const recs = [rec(30248), rec(30242)];
    expect(dropTraineeRecommendations(recs, "parent", cardsById, DARING_TACT)).toBe(recs);
  });

  test("is a no-op without a target uma", () => {
    const recs = [rec(30248)];
    expect(dropTraineeRecommendations(recs, "main", cardsById, null)).toBe(recs);
  });
});
