import { describe, it, expect } from "bun:test";

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
