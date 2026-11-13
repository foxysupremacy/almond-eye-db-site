import { describe, expect, test } from "bun:test";
import type { CardIndexEntry, EventSkillMetadata } from "../api";
import { applyParentDeckToPreset } from "./apply-parent-deck";
import { resolveActiveEventSource } from "./event-choices";
import type { DeckPreset } from "./types";

const preset = {
  id: "p1",
  name: "P",
  mainDeckIds: [1, 2, 3, 4, 5, 6],
  parentDeckIds: [null, null, null, null, null, null],
  mainChainChoices: { "1:a": 1 },
  parentChainChoices: { "9:x": 2, "8:y": 3 },
  trackInfo: { racerCount: 9 },
} as unknown as DeckPreset;

describe("applyParentDeckToPreset", () => {
  test("pads to six with null", () => {
    const r = applyParentDeckToPreset(preset, [10, 11, 12], {});
    expect(r.parentDeckIds).toEqual([10, 11, 12, null, null, null]);
  });
  test("truncates to six", () => {
    const r = applyParentDeckToPreset(preset, [1, 2, 3, 4, 5, 6, 7, 8], {});
    expect(r.parentDeckIds).toEqual([1, 2, 3, 4, 5, 6]);
  });
  test("merges chain choices over existing", () => {
    const r = applyParentDeckToPreset(preset, [10], { "8:y": 7, "10:z": 1 });
    expect(r.parentChainChoices).toEqual({ "9:x": 2, "8:y": 7, "10:z": 1 });
  });
  test("a legacy per-card key cannot override an applied `${cardId}:${eventId}` choice", () => {
    const legacy = { ...preset, parentChainChoices: { "10": 1, "10:5": 1 } } as DeckPreset;
    const r = applyParentDeckToPreset(legacy, [10], { "10:5": 2 });
    const card = {
      id: 10,
      eventDetails: [{ eventId: 5, nameEn: "", nameJp: "", choices: [{ index: 1, skillIds: [100] }, { index: 2, skillIds: [200] }] }],
    } as unknown as CardIndexEntry;
    const granted = (choiceIndex: number) =>
      resolveActiveEventSource(card, { eventMeta: { eventId: 5, choiceIndex } as EventSkillMetadata }, r.parentChainChoices).active;
    expect(granted(2)).toBe(true);
    expect(granted(1)).toBe(false);
  });
  test("leaves main and track untouched, no mutation", () => {
    const snap = JSON.stringify(preset);
    const r = applyParentDeckToPreset(preset, [10], { a: 1 });
    expect(r.mainDeckIds).toBe(preset.mainDeckIds);
    expect(r.mainChainChoices).toBe(preset.mainChainChoices);
    expect(r.trackInfo).toBe(preset.trackInfo);
    expect(JSON.stringify(preset)).toBe(snap);
  });
});
