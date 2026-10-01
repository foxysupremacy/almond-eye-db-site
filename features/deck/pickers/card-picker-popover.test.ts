import { describe, it, expect } from "bun:test";

describe("CardPickerPopover SSR", () => {
  it("does not render a focus-managed modal into server HTML", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const React = await import("react");
    const { DeckProvider } = await import("@/features/deck/state");
    const CardPickerPopover = (await import("@/features/deck/pickers/card-picker-popover")).default;
    for (const mode of ["main", "parent"] as const) {
      const html = renderToStaticMarkup(React.createElement(DeckProvider, null,
        React.createElement(CardPickerPopover, { mode, onPick: () => {}, onClose: () => {} })));
      expect(html).not.toContain('role="dialog"');
      expect(html).not.toContain('aria-modal="true"');
    }
  });

  it("handles gold <-> white skill equivalence mapping correctly", async () => {
    const { GOLD_TO_WHITE_MAP } = await import("@/lib/skills/rarity");
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
