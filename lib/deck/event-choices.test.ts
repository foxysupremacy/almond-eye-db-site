import { describe, it, expect } from "bun:test";
import { getDefaultChoiceIndex } from "./event-choices";
import { CHAIN_CHOICES_STORAGE_KEY } from "./constants";
import type { CardEventDetail } from "../data-store";

describe("getDefaultChoiceIndex", () => {
  it("defaults to Choice 1 when event has only 1 choice or no choices", () => {
    const singleChoice: CardEventDetail = {
      eventId: 100,
      nameEn: "Single",
      nameJp: "Single",
      choices: [{ index: 1, textEn: "A", textJp: "A", skillIds: [200001] }],
    };
    expect(getDefaultChoiceIndex(singleChoice)).toBe(1);
  });

  it("selects the choice that grants skills over choices that grant none", () => {
    const eventWithSkills: CardEventDetail = {
      eventId: 1310,
      nameEn: "Step 2",
      nameJp: "Step 2",
      choices: [
        { index: 1, textEn: "Stats only", textJp: "Stats only", skillIds: [] },
        { index: 2, textEn: "Skill choice", textJp: "Skill choice", skillIds: [203172] },
      ],
    };
    expect(getDefaultChoiceIndex(eventWithSkills)).toBe(2);
  });

  it("prioritizes choices granting Gold skills (rarity 2) over White skills (rarity 1)", () => {
    const branchingEvent: CardEventDetail = {
      eventId: 1311,
      nameEn: "Step 3",
      nameJp: "Step 3",
      choices: [
        { index: 1, textEn: "White skill", textJp: "White skill", skillIds: [200001] },
        { index: 2, textEn: "Gold skill", textJp: "Gold skill", skillIds: [200024] },
      ],
    };
    // Skill 200024 is gold (rarity 2), 200001 is white (rarity 1)
    const rarityMap: Record<number, number> = {
      200001: 1,
      200024: 2,
    };
    expect(getDefaultChoiceIndex(branchingEvent, (id) => rarityMap[id] ?? 1)).toBe(2);
  });
});

describe("Chain choices serialization", () => {
  it("uses the chain_choices.v1 storage key", () => {
    expect(CHAIN_CHOICES_STORAGE_KEY).toBe("chain_choices.v1");
  });

  it("round-trips chain choices through serialized preset json correctly", () => {
    const samplePreset = {
      id: "preset-1",
      name: "Main",
      mainDeckIds: [30308, null, null, null, null, null],
      parentDeckIds: [30308, null, null, null, null, null],
      trackInfo: { trackId: 10005, courseId: 10005, runningStyle: 2, racerCount: 12 },
      mainChainChoices: { "30308:1001": 2 },
      parentChainChoices: { "30308:1001": 1 },
    };
    const serialized = JSON.stringify([samplePreset]);
    const parsed = JSON.parse(serialized);
    expect(parsed[0].mainChainChoices["30308:1001"]).toBe(2);
    expect(parsed[0].parentChainChoices["30308:1001"]).toBe(1);
  });
});
