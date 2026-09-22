import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EventChainAttribution } from "./event-chain-attribution";

const base = {
  eventId: 1,
  eventNameEn: "A long continuous event title",
  eventNameJp: "長い連続イベント",
  choiceIndex: 2,
  choiceTextEn: "The selected branch",
  choiceTextJp: "選択肢",
  totalChoices: 2,
} as const;

describe("EventChainAttribution", () => {
  it("renders one progressive chevron per continuous-event step", () => {
    const html = renderToStaticMarkup(
      <EventChainAttribution eventMeta={{ ...base, eventType: "chain", chainStep: 3 }} />,
    );
    expect((html.match(/<path/g) ?? []).length).toBe(3);
    expect(html).toContain("C2");
    expect(html).toContain('class="sr-only">A long continuous event title</span>');
  });

  it("does not render a chain marker for random events", () => {
    const html = renderToStaticMarkup(
      <EventChainAttribution eventMeta={{ ...base, eventType: "random", chainStep: 3 }} />,
    );
    expect(html).not.toContain("<svg");
    expect(html).toContain("C2");
  });
});
