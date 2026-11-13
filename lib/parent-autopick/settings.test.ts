import { describe, expect, test } from "bun:test";
import { DEFAULT_ENABLED_GROUPS } from "./skill-groups";
import { defaultAutoPickSettings, normalizeAutoPickSettings } from "./settings";

const defaults = () => ({ scenarioId: null, palCardByScenario: {}, enabledGroups: [...DEFAULT_ENABLED_GROUPS] });

describe("normalizeAutoPickSettings", () => {
  test("defaults", () => {
    expect(defaultAutoPickSettings()).toEqual(defaults());
  });
  test("non-objects give defaults", () => {
    expect(normalizeAutoPickSettings(null)).toEqual(defaults());
    expect(normalizeAutoPickSettings("x")).toEqual(defaults());
  });
  test("scenarioId only kept when a finite number", () => {
    expect(normalizeAutoPickSettings({ scenarioId: "14" }).scenarioId).toBeNull();
    expect(normalizeAutoPickSettings({ scenarioId: 14 }).scenarioId).toBe(14);
    expect(normalizeAutoPickSettings({ scenarioId: NaN }).scenarioId).toBeNull();
  });
  test("unknown groups dropped, empty -> default", () => {
    expect(normalizeAutoPickSettings({ enabledGroups: ["nope"] }).enabledGroups).toEqual([...DEFAULT_ENABLED_GROUPS]);
  });
  test("groups de-duplicated", () => {
    expect(normalizeAutoPickSettings({ enabledGroups: ["recovery", "recovery"] }).enabledGroups).toEqual(["recovery"]);
  });
  test("palCardByScenario keeps only finite numbers", () => {
    expect(normalizeAutoPickSettings({ palCardByScenario: { "14": "a", "12": 30276 } }).palCardByScenario).toEqual({ "12": 30276 });
  });
});
