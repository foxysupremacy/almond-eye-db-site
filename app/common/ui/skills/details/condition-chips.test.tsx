import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ConditionChips } from "@/app/common/ui/skills/details/condition-chips";
import { conditionBranches } from "@/lib/skill-engine/describe";

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

  it("shows runtime data needed for Fan Love scaling alongside activation needs", () => {
    const html = renderToStaticMarkup(<ConditionChips
      branches={[["random point in the later half of mid-race"]]}
      selectedUma="Loves Only You"
      scalingNeeds={[{ effectIndex: 0, code: 30, baseValue: 1500, value: 4500, status: "assumed", reason: "Fan Love is unavailable; 3,000,000+ assumed from the scaling table", needs: [
        "Uma’s fan count during training", "Love gained from the Start Dash", "Position changes during the Middle Leg", "Skill activations that grant Love",
      ] }]}
    />);
    expect(html).toContain("Fan Love scaling");
    expect(html).toContain("Using the maximum effect value because Fan Love data is unavailable.");
    expect(html).toContain("Assumed scaling inputs:");
    expect(html).toContain("Loves Only You’s Fan Love: 3.000.000+ (Assumed)");
    expect(html).not.toContain("3×");
    expect(html).not.toContain("Love gained from the Start Dash");
    expect(html).not.toContain("Skill activations that grant Love");
  });

  it("shows the concrete best-case inputs for other verified scaling formulas", () => {
    const html = renderToStaticMarkup(<ConditionChips
      branches={[]}
      scalingNeeds={[
        { effectIndex: 0, code: 11, baseValue: 3500, value: 4375, status: "assumed", reason: "Final Leg corner overtakes is unavailable; highest documented effect value used", needs: ["Number of overtakes during Final Leg corners"] },
        { effectIndex: 1, code: 34, baseValue: 2500, value: 4500, status: "assumed", reason: "Distance behind first place is unavailable; the documented 20 m bonus assumed", needs: ["Distance behind first place"] },
        { effectIndex: 2, code: 35, baseValue: 3500, value: 5500, status: "assumed", reason: "Arima Kinen selected; fan count is unavailable, so the 146,738-fan bonus is assumed", needs: ["Uma fan count"] },
      ]}
    />);
    expect(html).toContain("4+ Final Leg corner overtakes (Assumed)");
    expect(html).toContain("20 m+ behind first place (Assumed)");
    expect(html).toContain("Arima Kinen course and 146,738+ fans (Assumed)");
  });

  it("does not mark the Mile bonus as assumed when the selected course satisfies it", () => {
    const html = renderToStaticMarkup(<ConditionChips
      branches={[]}
      scalingNeeds={[{ effectIndex: 0, code: 35, baseValue: 3500, value: 4500, status: "resolved", reason: "Mile race; +0.1 effect value", needs: [] }]}
    />);
    expect(html).toContain("Mile race; +0.1 effect value");
    expect(html).not.toContain("ASSUMED");
    expect(html).not.toContain("Arima Kinen course and 146,738+ fans");
    expect(html).not.toContain("Inputs needed to calculate");
  });

  it("intersects fully assumed order-rate bounds into one position chip", () => {
    const condition = "distance_rate>=50&corner!=0&order_rate>=20&order_rate<=50&track_id==10005";
    const html = renderToStaticMarkup(<ConditionChips
      branches={conditionBranches(condition, 9).branches}
      condition={condition}
      racerCount={9}
      assumptions={[
        { clause: "order_rate>=20", source: "condition", triggerIndex: 0, kind: "rank", description: "Conditional on occupying an allowed race position" },
        { clause: "order_rate<=50", source: "condition", triggerIndex: 0, kind: "rank", description: "Conditional on occupying an allowed race position" },
      ]}
    />);

    expect(html).toContain("position 2–5");
    expect(html).toContain("Assumed: order_rate&gt;=20&amp;order_rate&lt;=50");
    expect(html).not.toContain("position 2–9");
    expect(html).not.toContain("position 1–5");
    expect(html.match(/uppercase\">assumed/g)).toHaveLength(1);
  });
});
