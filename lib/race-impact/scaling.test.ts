import { describe, expect, test } from "bun:test";
import {
  additionalActivationFactor, durationScale, hpDurationMultiplier, scaledEffectValue, scalingContextFor, REFERENCE_GREEN_SKILL_COUNT, type ScalingContext,
} from "./scaling";

const ctx: ScalingContext = { distanceType: 3, courseLength: 2200, trackId: 10008, adjustedSpeed: 2040, maxRawStat: 2200, skillCount: 1, passiveCount: 0, uphillsBeforeFinalCorner: 2 };

describe("value scaling, ability_value_usage (engine step 4.3; mechanics §Value Scaling; R34 strongest situational version)", () => {
  test("direct (1) and absent are unchanged", () => {
    expect(scaledEffectValue({ type: 27, value: 3500 }, 3500, ctx)).toBe(3500);
    expect(scaledEffectValue({ type: 27, value: 3500, value_scale: 1 }, 3500, ctx)).toBe(3500);
  });
  test("36 Peerless Heroine: 6500 on middle distance, base value elsewhere", () => {
    expect(scaledEffectValue({ type: 22, value: 4500, value_scale: 36 }, 4500, ctx)).toBe(6500);
    expect(scaledEffectValue({ type: 22, value: 4500, value_scale: 36 }, 4500, { ...ctx, distanceType: 2 })).toBe(4500);
  });
  test("35: +1000 on mile, +2000 on the Arima course (Nakayama 2500), base elsewhere", () => {
    expect(scaledEffectValue({ type: 27, value: 3500, value_scale: 35 }, 3500, { ...ctx, distanceType: 2 })).toBe(4500);
    expect(scaledEffectValue({ type: 27, value: 3500, value_scale: 35 }, 3500, { ...ctx, distanceType: 4, courseLength: 2500, trackId: 10005 })).toBe(5500);
    expect(scaledEffectValue({ type: 27, value: 3500, value_scale: 35 }, 3500, ctx)).toBe(3500);
  });
  test("speed-stat types use the ADJUSTED speed: 22 (1700 -> x1 ... 2000+ -> x4) and 23 (<1400 x1, <1600 x2, else x3)", () => {
    expect(scaledEffectValue({ type: 27, value: 500, value_scale: 22 }, 500, ctx)).toBe(2000);
    expect(scaledEffectValue({ type: 27, value: 500, value_scale: 22 }, 500, { ...ctx, adjustedSpeed: 1700 })).toBe(500);
    expect(scaledEffectValue({ type: 27, value: 500, value_scale: 22 }, 500, { ...ctx, adjustedSpeed: 1699 })).toBe(0);
    expect(scaledEffectValue({ type: 27, value: 500, value_scale: 23 }, 500, ctx)).toBe(1500);
    expect(scaledEffectValue({ type: 27, value: 500, value_scale: 23 }, 500, { ...ctx, adjustedSpeed: 1500 })).toBe(1000);
  });
  test("R34 strongest situational version: far from the lead (19 +1000, 34 +2000), max lead (25 x1.8), 4+ corner passes (11 x1.25), blocked 6 s+ (20 x4), max love (30 x3)", () => {
    expect(scaledEffectValue({ type: 27, value: 1500, value_scale: 19 }, 1500, ctx)).toBe(2500);
    expect(scaledEffectValue({ type: 27, value: 1500, value_scale: 34 }, 1500, ctx)).toBe(3500);
    expect(scaledEffectValue({ type: 27, value: 1000, value_scale: 25 }, 1000, ctx)).toBeCloseTo(1800, 9);
    expect(scaledEffectValue({ type: 27, value: 1000, value_scale: 11 }, 1000, ctx)).toBeCloseTo(1250, 9);
    expect(scaledEffectValue({ type: 31, value: 1000, value_scale: 20 }, 1000, ctx)).toBe(4000);
    expect(scaledEffectValue({ type: 27, value: 1000, value_scale: 30 }, 1000, ctx)).toBe(3000);
  });
  test("career / team maxima (3-7, 10, 12, 24, 26-28, 31, 32, 37) x1.2; max raw stat (13) by band; skill count (2) min(1.2, 1 + 0.01 n)", () => {
    for (const t of [3, 4, 5, 6, 7, 10, 12, 24, 26, 27, 28, 31, 32, 37]) expect(scaledEffectValue({ type: 27, value: 1000, value_scale: t }, 1000, ctx)).toBeCloseTo(1200, 9);
    expect(scaledEffectValue({ type: 27, value: 1000, value_scale: 13 }, 1000, { ...ctx, maxRawStat: 900 })).toBeCloseTo(1000, 9);
    expect(scaledEffectValue({ type: 27, value: 1000, value_scale: 2 }, 1000, ctx)).toBeCloseTo(1010, 9);
  });
  test("green skills activated (14): bands 0-2 x0, 3-4 x1, 5 x2, 6+ x3; random (8, 9) at its expected x0.01", () => {
    expect(scaledEffectValue({ type: 27, value: 1000, value_scale: 14 }, 1000, ctx)).toBe(0);
    expect(scaledEffectValue({ type: 27, value: 1000, value_scale: 14 }, 1000, { ...ctx, passiveCount: 3 })).toBe(1000);
    expect(scaledEffectValue({ type: 27, value: 1000, value_scale: 14 }, 1000, { ...ctx, passiveCount: 5 })).toBe(2000);
    expect(scaledEffectValue({ type: 27, value: 1000, value_scale: 14 }, 1000, { ...ctx, passiveCount: 6 })).toBe(3000);
    expect(scaledEffectValue({ type: 27, value: 1000, value_scale: 8 }, 1000, ctx)).toBeCloseTo(10, 9);
  });
  test("the scaled value is applied to the level-multiplied value (unique level first, then the scaling)", () => {
    expect(scaledEffectValue({ type: 27, value: 1000, value_scale: 30 }, 1100, ctx)).toBeCloseTo(3300, 9);
  });
});

describe("additional activation (engine step 4.4; mechanics §Additional Activate; R34 maximum count from activation)", () => {
  test("1 (on pass, up to 3): x3; 2 (on other skills, up to 3): x3; 3 (up to 2): x2; 0 / absent: x1", () => {
    expect(additionalActivationFactor(1)).toBe(3);
    expect(additionalActivationFactor(2)).toBe(3);
    expect(additionalActivationFactor(3)).toBe(2);
    expect(additionalActivationFactor(0)).toBe(1);
    expect(additionalActivationFactor(undefined)).toBe(1);
  });
});

describe("duration scaling, ability_time_usage (engine step 4.2; mechanics §Duration Scaling; R34 strongest situational version)", () => {
  test("HP bands: type 3 (McQueen / Bright) and type 7 (Tannhauser)", () => {
    expect(hpDurationMultiplier(3, 1999)).toBe(1);
    expect(hpDurationMultiplier(3, 2000)).toBe(1.5);
    expect(hpDurationMultiplier(3, 2400)).toBe(2);
    expect(hpDurationMultiplier(3, 2600)).toBe(2.2);
    expect(hpDurationMultiplier(3, 2800)).toBe(2.5);
    expect(hpDurationMultiplier(3, 3000)).toBe(3);
    expect(hpDurationMultiplier(3, 3200)).toBe(3.5);
    expect(hpDurationMultiplier(3, 3500)).toBe(4);
    expect(hpDurationMultiplier(7, 1499)).toBe(1);
    expect(hpDurationMultiplier(7, 1500)).toBe(1.5);
    expect(hpDurationMultiplier(7, 1800)).toBe(2);
    expect(hpDurationMultiplier(7, 2000)).toBe(2.5);
    expect(hpDurationMultiplier(7, 2100)).toBe(3);
  });
  test("base seconds per type: 2 x1.6 (max distance from the front), 4 +3 s (three passes, the maximum), 5 x4 (blocked 6 s+), 8 +0.5 s per uphill before the final corner (max 4)", () => {
    expect(durationScale(2, 5, ctx)).toEqual({ seconds: 8, hp: false });
    expect(durationScale(4, 2, ctx)).toEqual({ seconds: 5, hp: false });
    expect(durationScale(5, 1, ctx)).toEqual({ seconds: 4, hp: false });
    expect(durationScale(8, 3, ctx)).toEqual({ seconds: 4, hp: false });
    expect(durationScale(8, 3, { ...ctx, uphillsBeforeFinalCorner: 9 })).toEqual({ seconds: 5, hp: false });
    expect(durationScale(1, 3, ctx)).toEqual({ seconds: 3, hp: false });
    expect(durationScale(undefined, 3, ctx)).toEqual({ seconds: 3, hp: false });
    expect(durationScale(3, 5, ctx)).toEqual({ seconds: 5, hp: true });
  });
  test("scalingContextFor reads the course and the adjusted / raw stats", () => {
    const course = { id: 10808, trackId: 10008, terrain: 1, turn: 1, distance: 3, inout: 1, length: 2200, straights: [],
      corners: [{ start: 400, end: 600 }, { start: 1300, end: 1550 }, { start: 1550, end: 1797 }],
      slopes: [{ start: 1050, end: 1150, slope: 20000 }, { start: 1150, end: 1375, slope: 10000 }, { start: 1375, end: 1525, slope: -20000 }, { start: 1600, end: 1700, slope: 10000 }] };
    const c = scalingContextFor(course, { speed: 2200, stamina: 1800, power: 1700, guts: 1500, wisdom: 1200 }, 2040);
    expect(c).toEqual({ distanceType: 3, courseLength: 2200, trackId: 10008, adjustedSpeed: 2040, maxRawStat: 2200, skillCount: 1, passiveCount: 6, uphillsBeforeFinalCorner: 2 });
    // R26: the green-skill count is a named reference value (6, typical after scrims), overridable.
    expect(REFERENCE_GREEN_SKILL_COUNT).toBe(6);
    expect(scalingContextFor(course, { speed: 2200, stamina: 1800, power: 1700, guts: 1500, wisdom: 1200 }, 2040, { greenSkillCount: 3 }).passiveCount).toBe(3);
    // Without a trackId the location is the course id's track (105xx -> 10005).
    expect(scalingContextFor({ ...course, id: 10506, trackId: undefined }, { speed: 1, stamina: 1, power: 1, guts: 1, wisdom: 1 }, 1).trackId).toBe(10005);
  });
});
