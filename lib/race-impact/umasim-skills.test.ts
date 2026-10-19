import { describe, expect, test } from "bun:test";
import { loadRacetracks, skillsById } from "../data/registry";
import { flattenCourse } from "../api/course-format";
import { defaultRaceImpactProfile } from "./profile";
import { scoreSkill } from "./score";
import { cachedBaselineRun, simulationInputFor } from "./trace";

/**
 * Real-skill checks against umasim (umasim-report.md, Kyoto 2200 10808, reference horse, unique Lv1). The number
 * compared is the conditional mean Bashin (ours: meanBashin; umasim: mean over the races in which the skill fired).
 * umasim commit ca692ed7. "stock" includes full spurt / stamina limit break / conserve power, which we do not model;
 * "classic" switches them off and is the like-for-like number for our physics (adjusted stats, slopes).
 * umasim ran with its randomness fixed and downhill accel mode off, so these
 * like-for-like checks run our engine with `downhillMode: false` (production keeps the expected downhill bonus).
 */
async function course(id: number) {
  for (const t of await loadRacetracks()) { const r = t.courses.find((c) => c.id === id); if (r) return { ...flattenCourse(r), trackId: t.id }; }
  throw new Error(String(id));
}
const profile = defaultRaceImpactProfile();

function classicScore(skillId: number, style: 1 | 2 | 3 | 4, kyoto: Awaited<ReturnType<typeof course>>) {
  const baseline = cachedBaselineRun({ ...simulationInputFor(kyoto, profile, style, 1), downhillMode: false });
  return scoreSkill({ skill: skillsById.get(skillId)!, course: kyoto, raceParams: { groundCondition: 1 }, style, racerCount: 9, profile, baseline });
}

describe("umasim real-skill parity on Kyoto 10808", () => {
  // umasim's isolated horse holds no Impulse 203781, so umasim fires Scarlet Lily's plain group g1 (1.95). R32 treats the
  // prerequisite as met, so the full skill now fires g0 (r32-principle.test.ts). The physics comparison is unchanged: it
  // scores g1 on its own, which is the group umasim measured.
  const lilyPlainGroup = () => { const s = skillsById.get(100971)!; return { ...s, conditionGroups: [s.conditionGroups![1]] }; };

  test("Scarlet Lily 100971 (style 2): the plain group umasim fires (g1) is within 5% of 1.95; R32 fires g0 for the full skill", async () => {
    const kyoto = await course(10808);
    const baseline = cachedBaselineRun({ ...simulationInputFor(kyoto, profile, 2, 1), downhillMode: false });
    const g1 = scoreSkill({ skill: lilyPlainGroup(), course: kyoto, raceParams: { groundCondition: 1 }, style: 2, racerCount: 9, profile, baseline });
    expect(Math.abs(g1.meanBashin / 1.95 - 1)).toBeLessThanOrEqual(0.05);
    expect(classicScore(100971, 2, kyoto).groupIndex).toBe(0);
  });

  test("Scarlet Lily plain group g1 for style 3 (production downhill mode) stays within 2% of 1.95", async () => {
    const kyoto = await course(10808);
    const s = scoreSkill({ skill: lilyPlainGroup(), course: kyoto, raceParams: { groundCondition: 1 }, style: 3, racerCount: 9, profile });
    expect(Math.abs(s.meanBashin / 1.95 - 1)).toBeLessThanOrEqual(0.02);
  });

  test("Stay Gold 101351 (style 3): chained is_activate_other_skill_detail group still fires (within 2% of classic 5.59)", async () => {
    // Stock is 5.33: before adjusted stats our 5.32 matched it only because raw stats offset the missing newer mechanics.
    const kyoto = await course(10808);
    expect(Math.abs(classicScore(101351, 3, kyoto).meanBashin / 5.59 - 1)).toBeLessThanOrEqual(0.02);
  });
});

describe("umasim real-skill parity, engine step 4 (scaling)", () => {
  test("McQueen 120131 (time_scale 3): duration scales with HP at activation; within 5% of classic 1.27", async () => {
    const kyoto = await course(10808);
    expect(skillsById.get(120131)!.conditionGroups[0].time_scale).toBe(3);
    const s = classicScore(120131, 2, kyoto);
    expect(Math.abs(s.meanBashin / 1.27 - 1)).toBeLessThanOrEqual(0.05);
  });

  test("Almond Eye 101291 (value_scale 36): 6500 on middle distance; within 5% of classic 2.34 (Kyoto)", async () => {
    const s = classicScore(101291, 2, await course(10808));
    expect(Math.abs(s.meanBashin / 2.34 - 1)).toBeLessThanOrEqual(0.05);
  });

  // R34: production applies the maximum additional-activation count (3, or 2 for the up-to-twice type). The umasim
  // results correspond to 2 additional activations (1 for the up-to-twice type), so the physics comparison rescales the
  // additional value to that count.
  function atHarnessCount(id: number) {
    const skill = skillsById.get(id)!;
    return { ...skill, conditionGroups: skill.conditionGroups.map((g) => ({ ...g, effects: g.effects.map((e) => (
      e.additional_activation ? { ...e, value: (e.value ?? 0) * (e.additional_activation === 3 ? 1 / 2 : 2 / 3) } : e)) })) };
  }
  function classicSkillScore(skill: ReturnType<typeof atHarnessCount>, style: 1 | 2 | 3 | 4, c: Awaited<ReturnType<typeof course>>) {
    const baseline = cachedBaselineRun({ ...simulationInputFor(c, profile, style, 1), downhillMode: false });
    return scoreSkill({ skill, course: c, raceParams: { groundCondition: 1 }, style, racerCount: 9, profile, baseline });
  }

  test("Tokai Teio 100031 on Tokyo 2400 (additional_activation 1): at 2 additional activations within 5% of classic 2.58; R34 counts 3 and scores higher", async () => {
    const tokyo = await course(10606);
    const like = classicSkillScore(atHarnessCount(100031), 2, tokyo);
    expect(like.groupIndex).toBe(0);
    expect(Math.abs(like.meanBashin / 2.58 - 1)).toBeLessThanOrEqual(0.05);
    expect(classicScore(100031, 2, tokyo).meanBashin).toBeGreaterThan(like.meanBashin * 1.05);
  });

  // Regression guards added after green (umasim classic, harness run 2026-10-14, 400 races).
  const guards: ReadonlyArray<readonly [number, number, 1 | 2 | 3 | 4, number, string]> = [
    [120061, 10506, 2, 3.45, "value_scale 35: +2000 on the Arima course"],
    [101321, 10808, 3, 2.73, "value_scale 30: x3 (max love)"],
    [110351, 10808, 2, 1.83, "additional_activation 2: +500 x2 (at the harness count)"],
    [120481, 10808, 2, 1.88, "additional_activation 2 on an accel effect"],
    [102503111, 10810, 3, 2.14, "time_scale 8: +0.5 s per uphill before the final corner"],
    [110521, 10808, 2, 1.13, "time_scale 2: x1.6 (max distance from the front)"],
  ];
  for (const [id, courseId, style, classic, what] of guards) {
    test(`${id} on ${courseId} (style ${style}) within 5% of classic ${classic}: ${what}`, async () => {
      const s = classicSkillScore(atHarnessCount(id), style, await course(courseId));
      expect(Math.abs(s.meanBashin / classic - 1)).toBeLessThanOrEqual(0.05);
    });
  }
});

describe("umasim classic baselines, engine step 4b (run-up, minimum speed, corner loss; harness diag-classic, 40 seeds)", () => {
  const umasimClassic: [number, number, string][] = [
    [11619, 75.044, "Santa Anita dirt 1600, 50 m run-up"],
    [11707, 75.027, "Del Mar dirt 1600, 60 m run-up"],
    [10301, 46.584, "Niigata 1000 straight (no corner, so no loss)"],
  ];
  for (const [id, classic, label] of umasimClassic) {
    test(`${label}: within 0.05 s of umasim classic ${classic}`, async () => {
      const finish = cachedBaselineRun({ ...simulationInputFor(await course(id), profile, 2, 1), downhillMode: false }).finishTime;
      expect(Math.abs(finish - classic)).toBeLessThanOrEqual(0.05);
    });
  }
});

describe("umasim real-skill parity, step 5b (phase boundary frame)", () => {
  test("Mejiro Dober 100591 on Hanshin 2400 (style 3): fires in the boundary frame where phase 1 ends and the final corner starts; within 5% of classic 5.21", async () => {
    const s = classicScore(100591, 3, await course(10907));
    expect(s.groupIndex).toBe(0);
    expect(Math.abs(s.meanBashin / 5.207 - 1)).toBeLessThanOrEqual(0.05);
  });
});
