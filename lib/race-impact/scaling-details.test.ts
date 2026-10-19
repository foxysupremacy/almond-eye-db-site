import { describe, expect, test } from "bun:test";
import type { SkillEffectScalingResolution } from "../skill-scaling";
import type { Course } from "../skill-engine/types";
import { defaultRaceImpactProfile } from "./profile";
import { resolveRaceSkillEffects } from "./scaling-details";
import { effectValues, scalingFor, simulationInputFor } from "./trace";
import { uniqueLevelMultiplier } from "./unique-level";

const course: Course = { id: 10808, length: 2200, distance: 3, terrain: 1, turn: 1, inout: 1,
  corners: [], straights: [], slopes: [] };
const profile = defaultRaceImpactProfile();
const resolve = (code: number, base = 3500, overrides = {}) => resolveRaceSkillEffects(
  [{ type: 27, value: base, value_scale: code }], { course, profile, ...overrides },
).resolutions[0];

function expectResolution(actual: SkillEffectScalingResolution, expected: Partial<SkillEffectScalingResolution>) {
  for (const key of Object.keys(expected) as (keyof SkillEffectScalingResolution)[]) expect(actual[key]).toEqual(expected[key]);
}

describe("new-engine special-value presentation", () => {
  test("matches physical effect values for all current codes, unique levels and additional activation", () => {
    const codes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31, 32, 34, 35, 36, 37, 40, 99];
    const scaling = scalingFor(course, profile, simulationInputFor(course, profile, 2))!;
    for (const level of [1, 6]) for (const code of codes) for (const additional_activation of [0, 1, 3]) {
      const effects = [{ type: 27, value: 3500, value_scale: code, additional_activation }];
      const result = resolveRaceSkillEffects(effects, { course, profile, style: 2, isUnique: true, level });
      const physical = effectValues(effects, type => uniqueLevelMultiplier(level, type), scaling);
      expect(result.effects[0].value! / 10000).toBeCloseTo(physical.target, 10);
      expect(result.resolutions[0].value).toBe(result.effects[0].value);
      expect(effects[0].value).toBe(3500);
    }
  });

  test("Peerless Heroine uses the engine's fixed Medium value even at Lv6", () => {
    expect(resolve(36, 4500, { isUnique: true, level: 6 }).value).toBe(6500);
    expect(resolveRaceSkillEffects([{ type: 22, value: 4500, value_scale: 36 }], {
      course: { ...course, distance: 4 }, profile, isUnique: true, level: 6,
    }).effects[0].value).toBeCloseTo(4950, 8);
    expect(resolve(36).status).toBe("resolved");
  });

  test("preserves confirmed Fan Love, overtake and distance thresholds as explicit assumptions", () => {
    expectResolution(resolve(30, 1500), { value: 4500, status: "assumed" });
    expectResolution(resolve(11), { value: 4375, status: "assumed", assumedInputs: ["4+ Final Leg corner overtakes (Assumed)"] });
    expectResolution(resolve(34, 2500), { value: 4500, status: "assumed", assumedInputs: ["20 m+ behind first place (Assumed)"] });
  });

  test("uses real course facts for Mile and Arima and never assumes the bonus elsewhere", () => {
    expectResolution(resolve(35, 3500, { course: { ...course, distance: 2 } }), { value: 4500, status: "resolved" });
    expectResolution(resolve(35, 3500, { course: { ...course, id: 10506, length: 2500, distance: 4 } }), { value: 5500, status: "assumed" });
    expectResolution(resolve(35), { value: 3500, status: "resolved" });
    expectResolution(resolve(35, 3500, { course: null }), { value: 3500, status: "resolved" });
  });

  test("stat bands read the same adjusted Speed, ground and raw stats as physics", () => {
    const firm = resolve(22, 500, { profile: { ...profile, stats: { ...profile.stats, speed: 2200 } } });
    const heavy = resolve(22, 500, { profile: { ...profile, stats: { ...profile.stats, speed: 2200 } }, groundCondition: 4 });
    expectResolution(firm, { value: 500, status: "resolved" });
    expect(firm.reason).toContain("1700");
    expectResolution(heavy, { value: 0, status: "resolved" });
    expect(heavy.reason).toContain("1650");
    expect(resolve(13).status).toBe("resolved");
  });

  test("reference counts and random averages follow the new engine rather than legacy maxima", () => {
    expect(resolve(2).value).toBe(3535);
    expect(resolve(2).assumedInputs).toEqual(["Skills held: 1 (Assumed)"]);
    expectResolution(resolve(14), { value: 10500, status: "assumed" });
    expectResolution(resolve(14, 3500, { profile: { ...profile, greenSkillCount: 0 } }), { value: 0, status: "resolved" });
    expectResolution(resolve(8), { value: 35, status: "resolved" });
    expect(resolve(8).reason).toContain("average, not the maximum");
    expectResolution(resolve(27), { value: 4200, status: "assumed" });
  });

  test("unsupported formulas remain explicit and a plain inherited payload receives no original scaling", () => {
    expectResolution(resolve(40), { value: 3500, status: "unsupported" });
    expectResolution(resolve(99), { value: 3500, status: "unsupported" });
    const inherited = [{ type: 27, value: 500 }];
    const result = resolveRaceSkillEffects(inherited, { course, profile });
    expect(result.effects).toEqual(inherited);
    expect(result.resolutions[0].status).toBe("unchanged");
    const extra = resolveRaceSkillEffects([{ type: 27, value: 500, additional_activation: 2 }], { course });
    expect(extra.effects[0].value).toBe(1500);
    expectResolution(extra.resolutions[0], { status: "assumed", label: "Additional activation value", assumedInputs: ["3 total effect applications (Assumed)"] });
  });
});
