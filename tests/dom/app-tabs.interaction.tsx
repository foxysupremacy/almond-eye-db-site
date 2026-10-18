import { expect, test } from "bun:test";
import { MOBILE_TABS, TABS } from "@/app/tabs";

test("Rankings sits between Parenting and Visualizer with a BY TRACK badge", () => {
  expect(TABS.map((t) => t.id)).toEqual(["main", "parent-deck", "parenting", "rankings", "visualizer", "collection", "veterans"]);
  const rankings = TABS.find((t) => t.id === "rankings");
  expect(rankings?.label).toBe("Rankings");
  expect(rankings?.badge).toBe("By track");
});

test("mobile nav has six items with Ranks before Race", () => {
  expect(MOBILE_TABS.map((t) => t.label)).toEqual(["Deck", "Parents", "Lineage", "Ranks", "Race", "Collection"]);
});
