import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ConditionChips } from "./condition-chips";

describe("ConditionChips", () => {
  it("uses one row per OR branch without the legacy color squares", () => {
    const html = renderToStaticMarkup(
      <ConditionChips
        needsBranches={[["a medium-distance race"], ["a long-distance race"]]}
        branches={[["random corner in mid-race"], ["final corner"]]}
      />,
    );

    expect(html).not.toContain("h-2.5 w-2.5");
    expect(html.match(/condition-branch/g)).toHaveLength(4);
    expect(html).toContain(">OR<");
  });
});
