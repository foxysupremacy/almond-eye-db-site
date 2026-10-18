import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { RaceConditionChips, TurnBadge } from "./race-condition-chips";

const anyConditions = { season: null, weather: null, groundCondition: null, time: null };

describe("RaceConditionChips turn", () => {
  it("omits the turn chip when no course turn is known", () => {
    const html = renderToStaticMarkup(<RaceConditionChips conditions={anyConditions} turn={{ value: null }} />);
    expect(html).not.toContain("Turn:");
  });

  it("renders a read-only badge from the course turn", () => {
    const html = renderToStaticMarkup(<RaceConditionChips conditions={anyConditions} turn={{ value: 2 }} />);
    expect(html).toContain("Turn: Left");
    expect(html).not.toContain('aria-label="Custom turn"');
  });

  it("renders a selectable chip when options and a handler are given", () => {
    const html = renderToStaticMarkup(
      <RaceConditionChips conditions={anyConditions} onChange={() => {}} turn={{ value: 1, options: [1, 2, 4], onChange: () => {} }} />,
    );
    expect(html).toContain('aria-label="Custom turn"');
    expect(html).toContain("Turn: Right");
  });

  it("labels a straight course", () => {
    expect(renderToStaticMarkup(<TurnBadge turn={4} />)).toContain("Turn: Straight");
  });
});
