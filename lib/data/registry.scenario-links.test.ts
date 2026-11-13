import { expect, test } from "bun:test";
import { cardsById, latestScenarioLinks, scenarioLinks } from "./registry";

test("latest three scenarios, newest first, each with a pal card", () => {
  const latest = latestScenarioLinks();
  expect(latest.map((s) => s.scenarioId)).toEqual([14, 13, 12]);
  for (const s of latest) expect(s.palCardIds.length).toBeGreaterThan(0);
});
test("pal cards are friend or group cards, linked Uma cards are not", () => {
  const s14 = scenarioLinks.find((s) => s.scenarioId === 14)!;
  for (const id of [30305, 30021, 30052]) expect(s14.palCardIds).toContain(id);
  expect(s14.linkedCardIds).toContain(30283);
  expect(s14.palCardIds).not.toContain(30283);
  for (const id of s14.palCardIds) {
    const card = cardsById.get(id);
    if (card?.type) expect(["friend", "group"]).toContain(card.type);
  }
});
test("Onsen and Beyond Dreams pal cards", () => {
  expect(scenarioLinks.find((s) => s.scenarioId === 12)!.palCardIds).toContain(30276);
  expect(scenarioLinks.find((s) => s.scenarioId === 13)!.palCardIds).toContain(30290);
});
