import { describe, expect, test } from "bun:test";
import { loadRacetracks, skillsById } from "../data/registry";
import { flattenCourse } from "../api/course-format";
import { defaultRaceImpactProfile } from "./profile";
import { scoreSkill } from "./score";
import { cachedBaselineRun, generateRaceTrace, passiveStatBonus, simulationInputFor, withStatBonus } from "./trace";
import { evaluateTriggerRaceImpact } from "./evaluate";

/**
 * Task 3 (step 5a): passive stat skills (duration -1, ability types 1-5) re-run the race with the stat added to the
 * FINAL stat (mechanics doc §Stats: FinalStat = AdjustedStat + SkillModifier, so the bonus is not halved past 1200 and
 * not multiplied by the course modifier; the umasim classic result agrees, below).
 */
const tracks = await loadRacetracks();
const course = (id: number) => {
  for (const t of tracks) { const r = t.courses.find((c) => c.id === id); if (r) return { ...flattenCourse(r), trackId: t.id }; }
  throw new Error(String(id));
};
const profile = defaultRaceImpactProfile();
const LAPLACE = 103202111; // Laplace's Demon (Agnes Tachyon [Lunatic Lab] evolution): Speed +100 (base Wisdom >= 1200)

describe("passive stat skills (step 5a, task 3)", () => {
  test("the passive bonus is read from duration -1 stat effects and added to the final (adjusted) stat", () => {
    const laplace = skillsById.get(LAPLACE)!;
    expect(passiveStatBonus(laplace.conditionGroups![0])).toEqual({ speed: 100, stamina: 0, power: 0, guts: 0, wisdom: 0 });
    // A timed effect is not passive.
    expect(passiveStatBonus({ base_time: 30000, effects: [{ type: 1, value: 400000 }] })).toBeNull();
    const input = simulationInputFor(course(10808), profile, 2, 1);
    expect(withStatBonus(input, { speed: 100, stamina: 0, power: 0, guts: 0, wisdom: 0 }).stats.speed).toBe(input.stats.speed + 100);
  });

  test("Laplace's Demon on Kyoto 10808 (Leader) scores in U-tools' 0.7-1.1 range and within 5% of umasim classic 0.808", () => {
    const kyoto = course(10808);
    const skill = skillsById.get(LAPLACE)!;
    const prod = scoreSkill({ skill, course: kyoto, raceParams: { groundCondition: 1 }, style: 2, racerCount: 9, profile });
    expect(prod.groupIndex).toBe(0);
    expect(prod.physicsStatus).toBe("modeled");
    expect(prod.expectedBashin).toBeGreaterThanOrEqual(0.7);
    expect(prod.expectedBashin).toBeLessThanOrEqual(1.1);
    const baseline = cachedBaselineRun({ ...simulationInputFor(kyoto, profile, 2, 1), downhillMode: false });
    const classic = scoreSkill({ skill, course: kyoto, raceParams: { groundCondition: 1 }, style: 2, racerCount: 9, profile, baseline });
    expect(Math.abs(classic.meanBashin / 0.808 - 1)).toBeLessThanOrEqual(0.05);
  });

  test("a condition-gated passive whose condition is unmet scores 0 (Mud Play ◎ on firm turf; Laplace on a long course)", () => {
    const firm = scoreSkill({ skill: skillsById.get(202342)!, course: course(10808), raceParams: { groundCondition: 1 }, style: 2, racerCount: 9, profile });
    expect(firm.expectedBashin).toBe(0);
    expect(firm.groupIndex).toBeNull();
    const long = scoreSkill({ skill: skillsById.get(LAPLACE)!, course: course(10810), raceParams: { groundCondition: 1 }, style: 2, racerCount: 9, profile });
    expect(long.expectedBashin).toBe(0);
  });

  test("a met passive on its course (Right Turns ◎ on right-handed Kyoto) gains; a stamina-only passive gains 0 (HP assumed sufficient)", () => {
    const right = scoreSkill({ skill: skillsById.get(200011)!, course: course(10808), raceParams: { groundCondition: 1 }, style: 2, racerCount: 9, profile });
    expect(right.expectedBashin).toBeGreaterThan(0.1);
    const kyotoStamina = skillsById.get(200031)!; // Tokyo Racecourse ◎ is stamina-only on Tokyo
    const tokyo = scoreSkill({ skill: kyotoStamina, course: course(10606), raceParams: { groundCondition: 1 }, style: 2, racerCount: 9, profile });
    expect(tokyo.expectedBashin).toBe(0);
  });

  test("the modal / Visualizer trace shows the speed difference and the Visualizer headline equals scoreSkill", () => {
    const kyoto = course(10808);
    const skill = skillsById.get(LAPLACE)!;
    const trace = generateRaceTrace(skill, { course: kyoto, profile, runningStyle: 2, racerCount: 9, groundCondition: 1 }, 0, [{ regions: [{ start: 0, end: kyoto.length }], isRandom: false }], { groupIndex: 0 });
    expect(trace.bashinGain).toBeGreaterThan(0.5);
    expect(trace.spatialPoints.some((p) => p.skillTargetSpeed > p.baselineTargetSpeed + 0.01)).toBe(true);
    const score = scoreSkill({ skill, course: kyoto, raceParams: { groundCondition: 1 }, style: 2, racerCount: 9, profile });
    const viz = evaluateTriggerRaceImpact(skill, [{ regions: [{ start: 0, end: kyoto.length }], isRandom: false }, { regions: [], isRandom: false }], {
      course: kyoto, runningStyle: 2, racerCount: 9, raceParams: { groundCondition: 1 }, profile,
    });
    expect(viz.expectedBashin).not.toBeNull();
    expect(Math.abs(viz.expectedBashin! - score.expectedBashin)).toBeLessThan(1e-6);
    expect(viz.physicsStatus).toBe("modeled");
  });
});
