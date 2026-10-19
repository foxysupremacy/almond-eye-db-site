import { describe, expect, test } from "bun:test";
import { SKILL_LEVEL_COEF } from "./generated/skill-level-coef";
import { isUniqueSkill, MAX_UNIQUE_LEVEL, uniqueLevelMultiplier } from "./unique-level";

// Ability types: 27 target speed, 31 acceleration, 21/22 current speed, 9 recovery, 1 speed stat.
describe("unique level scaling (master.mdb skill_level_value)", () => {
  test("Lv6 multipliers per ability type", () => {
    expect(uniqueLevelMultiplier(6, 27)).toBeCloseTo(1.13, 10);
    expect(uniqueLevelMultiplier(6, 31)).toBeCloseTo(1.1, 10);
    expect(uniqueLevelMultiplier(6, 21)).toBeCloseTo(1.1, 10);
    expect(uniqueLevelMultiplier(6, 22)).toBeCloseTo(1.1, 10);
    expect(uniqueLevelMultiplier(6, 9)).toBeCloseTo(1.1, 10);
    expect(uniqueLevelMultiplier(6, 1)).toBeCloseTo(1.05, 10);
    expect(MAX_UNIQUE_LEVEL).toBe(6);
  });
  test("Lv1 is 1.0 for every generated ability type", () => {
    const types = Object.keys(SKILL_LEVEL_COEF).map(Number);
    expect(types.length).toBeGreaterThan(5);
    for (const type of types) {
      expect(SKILL_LEVEL_COEF[type]).toHaveLength(MAX_UNIQUE_LEVEL);
      expect(uniqueLevelMultiplier(1, type)).toBe(1);
    }
  });
  test("unknown ability types fall back to 1.0", () => {
    expect(uniqueLevelMultiplier(6, 999_999)).toBe(1);
  });
  test("reproduces captured fixtures, including Still in Love's non-linear target speed", () => {
    expect(0.4 * uniqueLevelMultiplier(2, 31)).toBeCloseTo(0.408, 6);   // Still in Love accel
    expect(0.4 * uniqueLevelMultiplier(5, 31)).toBeCloseTo(0.432, 6);
    expect(0.45 * uniqueLevelMultiplier(2, 27)).toBeCloseTo(0.4545, 6); // Still in Love target speed (capture shows 0.455, rounded)
    expect(0.45 * uniqueLevelMultiplier(6, 22)).toBeCloseTo(0.495, 6);  // Cascading Might current speed
    expect(0.3 * uniqueLevelMultiplier(6, 31)).toBeCloseTo(0.33, 6);    // Cascading Might accel
  });
  test("clamps out-of-range levels", () => {
    expect(uniqueLevelMultiplier(0, 27)).toBe(1);
    expect(uniqueLevelMultiplier(99, 27)).toBeCloseTo(1.13, 10);
    expect(uniqueLevelMultiplier(Number.NaN, 27)).toBe(1);
  });
  test("unique detection", () => {
    expect(isUniqueSkill({ rarity: 5 })).toBe(true);
    expect(isUniqueSkill({ rarity: 6 })).toBe(false); // evolved
  });
});
