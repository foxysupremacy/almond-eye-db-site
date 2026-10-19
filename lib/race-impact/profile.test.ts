import { describe, expect, test } from "bun:test";
import { defaultRaceImpactProfile, normalizeRaceImpactProfile } from "./profile";

describe("race impact profile v2", () => {
  test("defaults match the U-tools-calibrated reference horse", () => {
    const p = defaultRaceImpactProfile();
    expect(p.version).toBe(2);
    expect(p.stats).toEqual({ speed: 2200, stamina: 1800, power: 1700, guts: 1500, wisdom: 1200 });
    expect(p.bashinReferenceSpeed).toBeNull();
  });
  test("v1 profile with the old default wisdom migrates to 1200", () => {
    const p = normalizeRaceImpactProfile({ version: 1, stats: { speed: 2200, stamina: 1800, power: 1700, guts: 1500, wisdom: 1800 }, dynamicOverrides: { blocked: 0.3 } });
    expect(p.version).toBe(2);
    expect(p.stats.wisdom).toBe(1200);
    expect(p.dynamicOverrides.blocked).toBe(0.3);
  });
  test("v1 profile with a user-edited wisdom keeps it", () => {
    const p = normalizeRaceImpactProfile({ version: 1, stats: { wisdom: 1500 }, dynamicOverrides: {} });
    expect(p.stats.wisdom).toBe(1500);
  });
  test("garbage input falls back to defaults", () => {
    expect(normalizeRaceImpactProfile("nope")).toEqual(defaultRaceImpactProfile());
    expect(normalizeRaceImpactProfile({ bashinReferenceSpeed: -3 }).bashinReferenceSpeed).toBeNull();
    expect(normalizeRaceImpactProfile({ version: 2, bashinReferenceSpeed: 20.5 }).bashinReferenceSpeed).toBe(20.5);
  });
});
