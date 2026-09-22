import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CardSourceIcon, SkillIndicator, SkillSourceIcons, SourceBadge } from "./skill-badges";

describe("shared skill indicators", () => {
  it("keeps contextual labels while using the semantic indicator style", () => {
    const html = renderToStaticMarkup(<SkillIndicator kind="no-activation" label="Rank Trap" title="Style rank is invalid" />);
    expect(html).toContain("Rank Trap");
    expect(html).toContain("Style rank is invalid");
    expect(html).toContain("bg-rose-100");
  });

  it("allows contextual source labels at compact density", () => {
    const html = renderToStaticMarkup(<SourceBadge source="event" label="Event / Awakening" density="compact" />);
    expect(html).toContain("Event / Awakening");
    expect(html).toContain("text-[9px]");
  });

  it("keeps support-card portrait sources square", () => {
    const html = renderToStaticMarkup(<CardSourceIcon cardId={30001} cardName="Fine Motion" />);
    expect(html).toContain("rounded-none");
    expect(html).not.toContain("rounded-md");
  });

  it("uses a character stand for inherited Uma sources", () => {
    const html = renderToStaticMarkup(
      <SkillSourceIcons sources={[{ kind: "character", cardId: 100101, charId: 1001, name: "Special Week", label: "Parent 1" }]} />,
    );
    expect(html).toContain("chara_stand/100101/001001/01.png");
    expect(html).toContain("Parent 1: Special Week");
  });
});
