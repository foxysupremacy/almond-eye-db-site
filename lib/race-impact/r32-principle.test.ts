import { describe, expect, test } from "bun:test";
import { loadRacetracks, skillsById } from "../data/registry";
import { flattenCourse } from "../api/course-format";
import { horseForStrategy } from "../skill-engine/zones";
import { computePvpSkillZones } from "../pvp/skill-zones";
import { evaluateSkillForTrack } from "../evaluator/evaluator";
import { resolveConditionGroup } from "./condition-group";
import { defaultRaceImpactProfile } from "./profile";
import { activationFactors, scoreSkill } from "./score";

/**
 * R32 (user principle, 2026-10-18): a score answers "if this skill activates, what is it worth on this map?".
 * Every race-situation condition counts as met (prerequisite skills for every Uma, popularity in any band), and there is
 * no wisdom check or `random_lot_shared` lottery. Map facts (track, distance, surface, geometry, style) stay real.
 */
const tracks = await loadRacetracks();
const courses = tracks.flatMap((t) => t.courses.map((r) => ({ ...flattenCourse(r), trackId: t.id })));
const course = (id: number) => courses.find((c) => c.id === id)!;
const profile = defaultRaceImpactProfile();
const KYOTO = 10808;
const KYOTO_3000 = 10810;

describe("R32: no activation-chance discounts", () => {
  test("an evolution that rolls the wisdom check scores at rate 1: expected Bashin equals its mean", () => {
    const evo = skillsById.get(101703111)!;
    expect(evo.activation).toBe(1); // the data still says "wisdom check"; R32 ignores it
    const s = scoreSkill({ skill: { ...evo, activation: 1 }, course: course(KYOTO), raceParams: { groundCondition: 1 }, style: 2, racerCount: 9, profile });
    expect(s.meanBashin).toBeGreaterThan(0);
    expect(s.activationRate).toBe(1);
    expect(s.expectedBashin).toBeCloseTo(s.meanBashin, 6);
  });

  test("activation factors carry only the situational (dynamic) rate: no wisdom or lottery factor", () => {
    const gambler = skillsById.get(202441)!;
    const f = activationFactors(gambler.conditionGroups![1], profile);
    expect(Object.keys(f)).toEqual(["dynamicRate"]);
    expect(f.dynamicRate).toBe(1);
  });

  test("a dynamic override still lowers the rate (the only remaining discount)", () => {
    const single = { id: 990002, activation: 1, conditionGroups: [{ condition: "is_overtake==1&phase>=2", precondition: null, base_time: 30000, effects: [{ type: 27, value: 3500 }] }] };
    const s = scoreSkill({ skill: single, course: course(KYOTO), raceParams: {}, style: 2, racerCount: 9, profile: { ...profile, dynamicOverrides: { overtake: 0.4 } } });
    expect(s.activationRate).toBeCloseTo(0.4, 6);
    expect(s.expectedBashin).toBeCloseTo(0.4 * s.meanBashin, 6);
  });
});

describe("R32: situational conditions are met for any Uma", () => {
  test("Scarlet Lily 100971 fires its Impulse group (g0) in every style, with no held skills", () => {
    for (const style of [1, 2, 3, 4] as const) {
      expect({ style, group: resolveConditionGroup(skillsById.get(100971)!, course(KYOTO), { groundCondition: 1 }, style)?.index }).toEqual({ style, group: 0 });
      const s = scoreSkill({ skill: skillsById.get(100971)!, course: course(KYOTO), raceParams: { groundCondition: 1 }, style, racerCount: 9, profile });
      expect({ style, group: s.groupIndex, rate: s.activationRate }).toEqual({ style, group: 0, rate: 1 });
    }
  });

  test("Gambler 202441: popularity is met in any band, so the first group (popularity>=4) wins; lottery and activation are 1", () => {
    const gambler = skillsById.get(202441)!;
    const resolved = resolveConditionGroup(gambler, course(KYOTO), {}, 2)!;
    expect(resolved.allZones[0].regions.length).toBeGreaterThan(0);
    expect(resolved.index).toBe(0);
    const s = scoreSkill({ skill: gambler, course: course(KYOTO), raceParams: {}, style: 2, racerCount: 9, profile });
    expect(s.groupIndex).toBe(0);
    expect(s.activationRate).toBe(1);
  });

  test("Bang☆Miracle Maker 101061: g0 (long, popularity>=4) fires on Kyoto 3000; on Kyoto 2200 (medium) the map keeps g1", () => {
    const bang = skillsById.get(101061)!;
    expect(scoreSkill({ skill: bang, course: course(KYOTO_3000), raceParams: { groundCondition: 1 }, style: 3, racerCount: 9, profile }).groupIndex).toBe(0);
    expect(scoreSkill({ skill: bang, course: course(KYOTO), raceParams: { groundCondition: 1 }, style: 3, racerCount: 9, profile }).groupIndex).toBe(1);
  });

  test("Visualizer parity with only the drawn zones (no favourite band): Gambler and Scarlet Lily equal scoreSkill", () => {
    for (const [id, style] of [[202441, 2], [100971, 2]] as const) {
      const skill = skillsById.get(id)!;
      const groups = skill.conditionGroups!.map((g) => ({ condition: g.condition ?? "", precondition: g.precondition ?? null }));
      const drawn = computePvpSkillZones(course(KYOTO) as never, groups, horseForStrategy(style), { groundCondition: 1, skillId: String(id) });
      const viz = evaluateSkillForTrack(skill as never, course(KYOTO) as never, style, 9, false, drawn, { groundCondition: 1 }, { raceImpactProfile: profile }).raceImpact!;
      const s = scoreSkill({ skill, course: course(KYOTO), raceParams: { groundCondition: 1 }, style, racerCount: 9, profile });
      expect(Math.abs(viz.activation.activationRate - s.activationRate)).toBeLessThan(1e-6);
      expect(Math.abs(viz.expectedBashin! - s.expectedBashin)).toBeLessThan(1e-6);
      expect(viz.activation.activationRate).toBe(1);
    }
  });
});
