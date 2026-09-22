import { describe, expect, it } from "bun:test";
import { buildDuplicateSkillIndex, getDuplicateSkillIds } from "./skill-duplicates";

describe("skill duplicate index", () => {
  it("indexes unique providers once per skill and preserves grant metadata", () => {
    const index = buildDuplicateSkillIndex([
      {
        card: { cardId: 1, cardName: "Fine Motion", type: "intelligence" },
        grants: [
          { id: 10, source: "hint" },
          { id: 10, source: "event" },
          { id: 20, source: "event", eventMeta: { choiceIndex: 2, choiceTextEn: "Acceleration" } },
        ],
      },
      {
        card: { cardId: 2, cardName: "Agnes Tachyon" },
        grants: [{ id: 10, source: "event", originalGoldSkill: { id: 100, nameEn: "Gold Skill", nameJp: "金スキル" } }],
      },
      {
        card: { cardId: 2, cardName: "Agnes Tachyon" },
        grants: [{ id: 10, source: "hint" }],
      },
    ]);

    expect(index.get(10)).toHaveLength(2);
    expect(index.get(10)?.[1]?.cardName).toBe("Agnes Tachyon");
    expect(index.get(10)?.[1]?.source).toBe("event");
    expect(index.get(10)?.[1]?.originalGoldSkill?.id).toBe(100);
    expect(index.get(20)?.[0].eventMeta?.choiceTextEn).toBe("Acceleration");
    expect(getDuplicateSkillIds(index)).toEqual(new Set([10]));
  });
});
