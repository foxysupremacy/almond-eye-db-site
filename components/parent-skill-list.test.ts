import { describe, it, expect } from "bun:test";

describe("ParentSkillList SSR", () => {
  it("renders without throwing", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const React = await import("react");
    const { DeckProvider } = await import("./store");
    const ParentSkillList = (await import("./parent-skill-list")).default;

    const html = renderToStaticMarkup(
      React.createElement(
        DeckProvider,
        null,
        React.createElement(ParentSkillList),
      ),
    );
    expect(html).toContain("All Possible Skills");
    expect(html).toContain("Unique Targets");
    expect(html).toContain("In Main Deck");
  });
});
