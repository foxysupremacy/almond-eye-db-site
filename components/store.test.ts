import { describe, it, expect } from "bun:test";
import { getDefaultChoiceIndex } from "./store";
import type { CardEventDetail } from "../lib/data-store";

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

describe("ChainArrowIcon", () => {
  it("renders 1 chevron for step 1", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const React = await import("react");
    const { ChainArrowIcon } = await import("./chain-arrow-icon");
    const html = renderToStaticMarkup(React.createElement(ChainArrowIcon, { step: 1 }));
    expect(html).toContain("<svg");
    const pathMatches = html.match(/<path/g);
    expect(pathMatches?.length).toBe(1);
  });

  it("renders 3 chevrons for step 3", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const React = await import("react");
    const { ChainArrowIcon } = await import("./chain-arrow-icon");
    const html = renderToStaticMarkup(React.createElement(ChainArrowIcon, { step: 3 }));
    const pathMatches = html.match(/<path/g);
    expect(pathMatches?.length).toBe(3);
  });

  it("clamps step count between 1 and 4", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const React = await import("react");
    const { ChainArrowIcon } = await import("./chain-arrow-icon");
    const html0 = renderToStaticMarkup(React.createElement(ChainArrowIcon, { step: 0 }));
    expect(html0.match(/<path/g)?.length).toBe(1);

    const html5 = renderToStaticMarkup(React.createElement(ChainArrowIcon, { step: 5 }));
    expect(html5.match(/<path/g)?.length).toBe(4);
  });
});

describe("ChainStepBadge", () => {
  it("renders step 1 with neutral styling", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const React = await import("react");
    const { ChainStepBadge } = await import("./chain-arrow-icon");
    const html = renderToStaticMarkup(React.createElement(ChainStepBadge, { step: 1 }));
    expect(html).toContain("Step 1");
    expect(html).toContain("text-zinc-700");
  });

  it("renders step 3 with climax gold highlight and star", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const React = await import("react");
    const { ChainStepBadge } = await import("./chain-arrow-icon");
    const html = renderToStaticMarkup(React.createElement(ChainStepBadge, { step: 3 }));
    expect(html).toContain("Step 3");
    expect(html).toContain("★");
    expect(html).toContain("text-amber-950");
  });
});

describe("SkillHoverCard effect calculation", () => {
  it("computes exact target speed and duration for Ascendance on 1800m course", async () => {
    const { formatEffect, conditionBranches } = await import("../lib/skill-engine/describe");
    const effect = formatEffect([{ type: 27, value: 3500 }], 24000, 1800);
    expect(effect).toBe("+0.35 m/s Target Speed for 4.3 s");

    const branches = conditionBranches("distance_type==2&phase_random==1@distance_type==3&phase_random==1");
    expect(branches.branches.length).toBe(2);
    expect(branches.branches[0]).toEqual(["a mile", "random point in mid-race"]);
    expect(branches.branches[1]).toEqual(["a medium-distance race", "random point in mid-race"]);
  });
});

describe("Chain choices storage persistence", () => {
  it("exports CHAIN_CHOICES_STORAGE_KEY with expected constant", async () => {
    const { CHAIN_CHOICES_STORAGE_KEY } = await import("./store");
    expect(CHAIN_CHOICES_STORAGE_KEY).toBe("chain_choices.v1");
  });

  it("round-trips chain choices through serialized preset json correctly", async () => {
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
