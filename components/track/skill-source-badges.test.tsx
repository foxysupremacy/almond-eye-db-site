import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { VisualizerSkillOrigin } from "../../lib/visualizer-skills";
import { dedupeSkillOrigins, SkillSourceBadges } from "./skill-source-badges";

const deckOrigin: VisualizerSkillOrigin = {
  kind: "support-hint",
  label: "Meisho Doto",
  availability: "deck",
  cardId: 30001,
};

describe("SkillSourceBadges", () => {
  it("dedupes one card across event and hint origins while preserving lineage slots", () => {
    const origins: VisualizerSkillOrigin[] = [
      deckOrigin,
      { ...deckOrigin, kind: "support-event" },
      {
        kind: "parent-unique",
        label: "Mejiro McQueen",
        availability: "guaranteed",
        slotLabel: "Parent 1",
        cardId: 100101,
      },
      {
        kind: "parent-unique",
        label: "Mejiro McQueen",
        availability: "guaranteed",
        slotLabel: "Parent 2",
        cardId: 100101,
      },
    ];

    expect(dedupeSkillOrigins(origins)).toHaveLength(3);
    const html = renderToStaticMarkup(<SkillSourceBadges origins={origins} compact />);
    expect(html).not.toContain(">Meisho Doto<");
    expect(html).toContain("rounded-none");
    expect(html).toContain("Parent 1");
    expect(html).toContain("Parent 2");
    expect(html.match(/<img/g)).toHaveLength(3);
  });
});
