import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GoldOriginLabel } from "@/app/common/ui/skills/provenance/gold-origin-label";

describe("GoldOriginLabel", () => {
  it("names the gold a parent white was inherited from", () => {
    const html = renderToStaticMarkup(
      <GoldOriginLabel gold={{ id: 900, nameEn: "Tail of Victory", nameJp: "勝利の尻尾" }} />,
    );
    expect(html).toContain("Gold");
    expect(html).toContain("Tail of Victory");
    expect(html).toContain('title="Inherited white of the gold skill Tail of Victory (勝利の尻尾)"');
  });

  it("falls back to the Japanese name when the English one is missing", () => {
    const html = renderToStaticMarkup(<GoldOriginLabel gold={{ nameEn: "", nameJp: "勝利の尻尾" }} />);
    expect(html).toContain("勝利の尻尾");
  });
});
