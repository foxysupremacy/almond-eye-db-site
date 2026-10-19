import { describe, expect, test } from "bun:test";
import { loadRacetracks, skillsById } from "../data/registry";
import { flattenCourse } from "../api/course-format";
import { computeZones } from "../skill-engine/zones";
import { resolveConditionGroup } from "./condition-group";
import { dynamicConditionKeys } from "./prior";
import { defaultRaceImpactProfile } from "./profile";
import { activationFactors, scoreSkill } from "./score";

// Skills whose conditions used corner!=3, activate_count_param_skill, popularity or random_lot_shared.
const IDS = [110991, 910991, 101703211, 104901211, 202441, 202442];
const tracks = await loadRacetracks();
const courses = tracks.flatMap((t) => t.courses.map((r) => ({ ...flattenCourse(r), trackId: t.id })));
const course = (id: number) => courses.find((c) => c.id === id)!;
const profile = defaultRaceImpactProfile();

describe("condition rules: corner!=N, activate_count_param_skill, popularity, random_lot_shared", () => {
  test("the six skills resolve on every course without throwing", () => {
    expect(courses.length).toBe(138);
    for (const id of IDS) {
      const skill = skillsById.get(id);
      expect({ id, found: !!skill }).toEqual({ id, found: true });
      for (const c of courses) {
        for (const style of [1, 2, 3, 4] as const) {
          expect(() => resolveConditionGroup(skill!, c, {}, style)).not.toThrow();
        }
      }
    }
    expect(() => scoreSkill({ skill: skillsById.get(101703211)!, course: course(10808), raceParams: {}, style: 2, racerCount: 9, profile })).not.toThrow();
  });

  test("Popping☆Clams uses its dirt group only on dirt courses whose 50-51% window is not inside corner 3", () => {
    const clams = skillsById.get(110991)!;
    let dirtHits = 0;
    for (const c of courses) {
      const window = { start: c.length * 0.5, end: c.length * 0.51 };
      const corner3 = computeZones(c, "corner==3").regions;
      const insideCorner3 = corner3.some((r) => r.start <= window.start && r.end >= window.end);
      const expectedGroup = c.terrain === 2 && !insideCorner3 ? 0 : 1;
      const resolved = resolveConditionGroup(clams, c, {}, 2);
      expect({ course: c.id, group: resolved?.index }).toEqual({ course: c.id, group: expectedGroup });
      if (expectedGroup === 0) dirtHits++;
    }
    expect(dirtHits).toBeGreaterThan(0);
  });

  test("activate_count_param_skill maps to the activate_count dynamic key", () => {
    expect(dynamicConditionKeys("course_distance>=2000&activate_count_param_skill>=7")).toEqual(["activate_count"]);
  });

  test("熱烈峻厳 (101703211) scores on Kyoto turf 2200 m and scales with the activate_count override", () => {
    const skill = skillsById.get(101703211)!;
    const kyoto = course(10808);
    expect(kyoto.terrain).toBe(1);
    expect(kyoto.length).toBeGreaterThanOrEqual(2000);
    const unset = scoreSkill({ skill, course: kyoto, raceParams: {}, style: 2, racerCount: 9, profile });
    expect(unset.groupIndex).toBe(0);
    expect(unset.expectedBashin).toBeGreaterThan(0);
    const half = scoreSkill({ skill, course: kyoto, raceParams: {}, style: 2, racerCount: 9, profile: { ...profile, dynamicOverrides: { activate_count: 0.5 } } });
    expect(half.expectedBashin).toBeCloseTo(unset.expectedBashin * 0.5, 5);
  });

  test("random_lot_shared is not a dynamic key (R32: the lottery counts as won, see r32-principle.test.ts)", () => {
    expect(dynamicConditionKeys("popularity<=3&random_lot_shared==30")).toEqual([]);
    expect(activationFactors({ condition: "random_lot_shared==30@random_lot_shared==50", precondition: null }, profile).dynamicRate).toBe(1);
  });
});

describe("R28: position conditions (order, order_rate, order_rate_in/outXX_continue) count as met", () => {
  const kyoto = () => course(10808);

  test("Let's Anabolic! (100271, order_rate 65-70) as a Betweener is no longer x0.25: activation 1, expected = mean", () => {
    const s = scoreSkill({ skill: skillsById.get(100271)!, course: kyoto(), raceParams: { groundCondition: 1 }, style: 3, racerCount: 9, profile });
    expect(s.activationRate).toBe(1);
    expect(s.expectedBashin).toBeGreaterThan(0);
    expect(s.expectedBashin).toBeCloseTo(s.meanBashin, 6);
    // Every style: the style envelope no longer gates it (it was 0 for Runner/Leader).
    for (const style of [1, 2, 4] as const) {
      expect(scoreSkill({ skill: skillsById.get(100271)!, course: kyoto(), raceParams: { groundCondition: 1 }, style, racerCount: 9, profile }).activationRate).toBe(1);
    }
  });

  test("an order==1 unique (Billions of Stars 101071) as a Runner is no longer x0.5", () => {
    const skill = skillsById.get(101071)!;
    expect(skill.conditionGroups![0].condition).toContain("order==1");
    const s = scoreSkill({ skill, course: kyoto(), raceParams: { groundCondition: 1 }, style: 1, racerCount: 9, profile });
    expect(s.activationRate).toBe(1);
    expect(s.expectedBashin).toBeCloseTo(s.meanBashin, 6);
  });

  test("activation factors carry no position (style-envelope) rate", () => {
    const f = activationFactors({ condition: "phase>=2&order_rate>=65&order_rate<=70", precondition: null }, profile);
    expect("rankRate" in f).toBe(false);
    expect(f.dynamicRate).toBe(1);
  });
});
