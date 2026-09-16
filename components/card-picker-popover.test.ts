import { describe, it, expect } from "bun:test";

describe("CardPickerPopover SSR", () => {
  it("renders without throwing", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const React = await import("react");
    const { DeckProvider } = await import("./store");
    const CardPickerPopover = (await import("./card-picker-popover")).default;

    const html = renderToStaticMarkup(
      React.createElement(
        DeckProvider,
        null,
        React.createElement(CardPickerPopover, {
          onPick: () => {},
          onClose: () => {},
        }),
      ),
    );
    expect(html).toContain("Search cards by English or Japanese name");
    expect(html).toContain("Sort: Release Date");
    expect(html).not.toContain("Filter by Skills");
  });

  it("renders parent mode with effect selector chips and target skills sort", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const React = await import("react");
    const { DeckProvider } = await import("./store");
    const CardPickerPopover = (await import("./card-picker-popover")).default;

    const html = renderToStaticMarkup(
      React.createElement(
        DeckProvider,
        null,
        React.createElement(CardPickerPopover, {
          onPick: () => {},
          onClose: () => {},
          mode: "parent",
        }),
      ),
    );
    expect(html).toContain("Parent Deck Mode");
    expect(html).toContain("Sort: Recommended");
    expect(html).toContain("Sort: Target Skills");
    expect(html).toContain("All Effects");
    expect(html).toContain("Target Speed");
    expect(html).toContain("Current Speed");
    expect(html).toContain("Acceleration");
    expect(html).toContain("Filter by Skills");
    expect(html).toContain("Search skill to filter");
  });

  it("handles gold <-> white skill equivalence mapping correctly", async () => {
    const { GOLD_TO_WHITE_MAP } = await import("../lib/skill-rarity");
    // Clockwise Demon (Gold 200014) -> Right Turns ◎ (White 200011)
    const entry = GOLD_TO_WHITE_MAP["200014"];
    expect(entry).toBeDefined();
    expect(entry.whiteId).toBe(200011);

    // Reverse mapping check
    const whiteToGoldsMap = new Map<number, number[]>();
    for (const [goldIdStr, mapped] of Object.entries(GOLD_TO_WHITE_MAP)) {
      const gId = Number(goldIdStr);
      const existing = whiteToGoldsMap.get(mapped.whiteId);
      if (existing) existing.push(gId);
      else whiteToGoldsMap.set(mapped.whiteId, [gId]);
    }
    expect(whiteToGoldsMap.get(200011)).toContain(200014);
  });
});
