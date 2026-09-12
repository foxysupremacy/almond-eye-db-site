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
  });
});
