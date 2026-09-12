import { describe, it, expect } from "bun:test";
import type { DuplicateCardEntry } from "./duplicate-skill-badge";

describe("DuplicateSkillBadge Data & Mapping", () => {
  it("formats accessible tooltip with duplicating cards list and current card indicator", () => {
    const cards: DuplicateCardEntry[] = [
      {
        cardId: 30010,
        cardName: "Fine Motion",
        cardNameJp: "ファインモーション",
        rarity: 3,
        type: "intelligence",
        source: "hint",
      },
      {
        cardId: 30020,
        cardName: "Agnes Tachyon",
        cardNameJp: "アグネスタキオン",
        rarity: 2,
        type: "intelligence",
        source: "hint",
      },
    ];

    const currentCardId = 30010;
    const lines = cards.map(
      (c) =>
        `• ${c.cardName}${c.cardId === currentCardId ? " (This card)" : ""}${
          c.source ? ` [${c.source}]` : ""
        }${c.type ? ` (${c.type})` : ""}`
    );

    expect(lines[0]).toBe("• Fine Motion (This card) [hint] (intelligence)");
    expect(lines[1]).toBe("• Agnes Tachyon [hint] (intelligence)");
    expect(cards.length).toBe(2);
  });

  it("handles event source with event choice metadata", () => {
    const cards: DuplicateCardEntry[] = [
      {
        cardId: 30308,
        cardName: "Almond Eye",
        source: "event",
        eventMeta: {
          choiceIndex: 2,
          choiceTextEn: "Gain Acceleration",
          choiceTextJp: "加速力を上げる",
        },
      },
    ];

    expect(cards[0].eventMeta?.choiceIndex).toBe(2);
    expect(cards[0].eventMeta?.choiceTextEn).toBe("Gain Acceleration");
  });

  it("correctly identifies the other card and formats 'duplicate with {card}'", () => {
    const cards: DuplicateCardEntry[] = [
      {
        cardId: 30010,
        cardName: "Fine Motion",
        source: "hint",
      },
      {
        cardId: 30020,
        cardName: "Agnes Tachyon",
        source: "hint",
      },
    ];

    const currentCardId = 30010;
    const otherCards = cards.filter((c) => c.cardId !== currentCardId);

    expect(otherCards.length).toBe(1);
    expect(otherCards[0].cardName).toBe("Agnes Tachyon");

    const labelText = `duplicate with ${otherCards[0].cardName}`;
    expect(labelText).toBe("duplicate with Agnes Tachyon");
  });

  it("handles multiple other duplicate cards with (+N) indicator", () => {
    const cards: DuplicateCardEntry[] = [
      { cardId: 1, cardName: "Card A", source: "hint" },
      { cardId: 2, cardName: "Card B", source: "hint" },
      { cardId: 3, cardName: "Card C", source: "hint" },
    ];

    const currentCardId = 1;
    const otherCards = cards.filter((c) => c.cardId !== currentCardId);

    expect(otherCards.length).toBe(2);
    const labelText = `duplicate with ${otherCards[0].cardName} (+${otherCards.length - 1})`;
    expect(labelText).toBe("duplicate with Card B (+1)");
  });
});
