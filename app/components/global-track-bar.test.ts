import { describe, it, expect } from "bun:test";

describe("GlobalTrackBar SSR", () => {
  it("renders four race modes and custom conditions by default", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const React = await import("react");
    const { DeckProvider } = await import("@/features/deck/state");
    const GlobalTrackBar = (await import("./global-track-bar")).default;

    const html = renderToStaticMarkup(
      React.createElement(DeckProvider, null, React.createElement(GlobalTrackBar)),
    );
    expect(html).toContain('aria-label="Race mode"');
    for (const mode of ["CM", "LoH", "Master Challenge", "Custom"]) expect(html).toContain(`>${mode}</button>`);
    expect(html).toContain('aria-pressed="true"');
    for (const field of ["season", "weather", "groundCondition", "time"]) expect(html).toContain(`aria-label="Custom ${field}"`);
    expect(html).not.toContain('aria-label="Master Challenge race"');
    expect(html).not.toContain('aria-label="CM event"');
    expect(html).not.toContain('aria-label="LoH event"');
  });

  it("renders the shared race controls directly inside the mobile Build sheet", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const React = await import("react");
    const { DeckProvider } = await import("@/features/deck/state");
    const { MobileBuildToolsContent } = await import("./mobile-build-tools-sheet");

    const html = renderToStaticMarkup(
      React.createElement(DeckProvider, null, React.createElement(MobileBuildToolsContent, {
        onOpenImport: () => {},
        onOpenSkillScanner: () => {},
      })),
    );

    expect(html).toContain("Target race");
    expect(html).toContain('aria-label="Race mode"');
    for (const field of ["Venue", "Ground", "Distance", "Running style"]) {
      expect(html).toContain(`aria-label="${field}"`);
    }
    expect(html).toContain("Import game data");
    expect(html).toContain("Scan skill");
    expect(html.match(/aria-label="Race mode"/g)).toHaveLength(1);
  });
});
