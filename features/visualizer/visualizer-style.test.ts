import { expect, test } from "bun:test";
import { horseForStrategy } from "@/lib/skill-engine/zones";
import { visualizerRunningStyle, visualizerZoneHorse } from "./visualizer-style";

test("the inspector's race impact and the effect modal share one running-style fallback", () => {
  expect(visualizerRunningStyle(null)).toBe(2);
  expect(visualizerRunningStyle(undefined)).toBe(2);
  expect(visualizerRunningStyle(4)).toBe(4);
});

test("zones and tints keep the engine's default horse when no running style is set (R17)", () => {
  expect(visualizerZoneHorse(null)).toBeUndefined();
  expect(visualizerZoneHorse(undefined)).toBeUndefined();
  expect(visualizerZoneHorse(3)).toEqual(horseForStrategy(3));
});
