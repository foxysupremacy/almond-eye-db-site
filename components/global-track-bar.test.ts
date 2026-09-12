import { describe, it, expect } from "bun:test";

describe("GlobalTrackBar SSR", () => {
  it("renders with PvP preset pills", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const React = await import("react");
    const { DeckProvider } = await import("./store");
    const GlobalTrackBar = (await import("./global-track-bar")).default;

    const html = renderToStaticMarkup(
      React.createElement(DeckProvider, null, React.createElement(GlobalTrackBar)),
    );
    expect(html).toContain("Sep CM (Longchamp)");
    expect(html).toContain("Sep CM (Mile)");
    expect(html).toContain("Oct CM (Classic)");
    expect(html).toContain("Nov LoH");
    expect(html).toContain("PvP:");
  });
});
