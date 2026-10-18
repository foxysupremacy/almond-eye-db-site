import { describe, expect, test } from "bun:test";
import { loadRacetracks, skillsById } from "../data/registry";
import { flattenCourse } from "../api/course-format";
import { defaultRaceImpactProfile } from "./profile";
import { scoreSkill } from "./score";
import { resolveConditionGroup } from "./condition-group";
import { cachedBaselineRun, simulationInputFor } from "./trace";
import { atLeast, episodeStart, fieldShare, PROXIMITY_AREAS, RACE_STATE_MODEL } from "./dynamic-placement";

/**
 * Task 2 (step 5a), R33 model: dynamic triggers sample their activation along the zone with our race-state model
 * (field position, overtake attempts, place changes, proximity boxes from the mechanics doc), conditional on firing
 * (R7.4 keeps the activation rate at 1). Its free parameters are fitted to umasim's numeric results: classic harness,
 * 400 races, mean Bashin when fired, downhill off.
 */
const tracks = await loadRacetracks();
const course = (id: number) => {
  for (const t of tracks) { const r = t.courses.find((c) => c.id === id); if (r) return { ...flattenCourse(r), trackId: t.id }; }
  throw new Error(String(id));
};
const profile = defaultRaceImpactProfile();
function classic(skillId: number, courseId: number, style: 1 | 2 | 3 | 4) {
  const c = course(courseId);
  const baseline = cachedBaselineRun({ ...simulationInputFor(c, profile, style, 1), downhillMode: false });
  return scoreSkill({ skill: skillsById.get(skillId)!, course: c, raceParams: { groundCondition: 1 }, style, racerCount: 9, profile, baseline, withSamples: true });
}

describe("dynamic trigger placement (step 5a, task 2)", () => {
  test("Gold City 120401: the group chained through its PRECONDITION (is_activate_other_skill_detail) is placed in the same race", () => {
    const r = resolveConditionGroup(skillsById.get(120401)!, course(10808), { groundCondition: 1 }, 3)!;
    expect(r.triggers.map((t) => t.index)).toEqual([0, 1]);
  });

  // R30 (user decision 2026-10-17): keep the precondition-chain fix. umasim's classic results never fire a
  // precondition-chained detail (Gold City 0.854, 111191 1.46); U-tools and the skill text fire it.
  test("R30: Gold City 120401 scores both details (Kyoto 10808, style 3): 1.98, not the single-detail 0.83", () => {
    const s = classic(120401, 10808, 3);
    expect(Math.abs(s.meanBashin / 1.98 - 1)).toBeLessThanOrEqual(0.03);
  });

  test("R30: 111191 scores both details (Nakayama 3600, style 4): 2.94 like U-tools, not the single-detail 1.45", () => {
    const s = classic(111191, 10507, 4);
    expect(Math.abs(s.meanBashin / 2.94 - 1)).toBeLessThanOrEqual(0.03);
  });

  test("Durandal 112101211 (is_overtake, Tokyo 1600, End Closer): the 8 m final-corner window rarely sees an overtake start, so the later group mostly fires; within 10% of umasim classic 3.66", () => {
    const s = classic(112101211, 10602, 4);
    const groups = new Set(s.samples.map((x) => Math.round(x.meter)));
    expect(groups.size).toBeGreaterThan(5);
    expect(Math.abs(s.meanBashin / 3.66 - 1)).toBeLessThanOrEqual(0.10);
  });

  test("Rudolf 100171 (change_order_up_end_after>=3 on the last straight): part of the mass fires at the straight's start, the rest along it; within 10% of umasim classic 1.68", () => {
    const s = classic(100171, 10808, 2);
    const first = s.samples.reduce((a, b) => (b.meter < a.meter ? b : a));
    const total = s.samples.reduce((t, x) => t + x.weight, 0);
    // Passes accumulate from the late-race start, so 3 of them are often reached by the time the straight opens.
    expect(first.weight / total).toBeGreaterThan(0.25);
    expect(first.weight / total).toBeLessThan(0.6);
    expect(Math.abs(s.meanBashin / 1.68 - 1)).toBeLessThanOrEqual(0.10);
  });

  test("activation rate stays 1 for dynamic conditions (R7.4): placement only moves where it fires", () => {
    const s = classic(100171, 10808, 2);
    expect(s.activationRate).toBe(1);
  });

  // The 14 umasim classic rows with a timed race-state term (harness outputs real-skills-*.json): the fit set.
  const FIT_ROWS: ReadonlyArray<readonly [number, number, 1 | 2 | 3 | 4, number]> = [
    [201651, 10808, 2, 0.517], [100102211, 10808, 2, 1.548], [100011, 10811, 3, 4.844], [100171, 10811, 2, 2.712],
    [100241, 10805, 1, 3.187], [100211, 10701, 3, 3.274], [100581, 10602, 2, 3.733], [110141, 10602, 3, 0.884],
    [108501211, 10611, 3, 4.198], [105501211, 10808, 3, 1.888], [110561, 10811, 3, 2.618], [112101211, 10602, 4, 3.66],
    [100171, 10808, 2, 1.684], [113301211, 10808, 2, 2.456],
  ];
  test("R33 fit: the 14 race-state rows are within 10% of umasim classic each, RMS under 4%", () => {
    const errors = FIT_ROWS.map(([id, courseId, style, umasim]) => classic(id, courseId, style).meanBashin / umasim - 1);
    for (const e of errors) expect(Math.abs(e)).toBeLessThanOrEqual(0.10);
    expect(Math.sqrt(errors.reduce((t, e) => t + e * e, 0) / errors.length)).toBeLessThan(0.04);
  });
});

describe("R33 race-state model (own structure, fitted parameters)", () => {
  test("every free parameter names what it was fitted to (or why it is not fitted)", () => {
    for (const [name, p] of Object.entries(RACE_STATE_MODEL)) {
      expect(Number.isFinite(p.value)).toBe(true);
      expect(/umasim|U-tools|not fitted/.test(p.fittedOn)).toBe(true);
      expect(name.length).toBeGreaterThan(0);
    }
  });

  test("proximity boxes come from the mechanics doc's definitions (metres x horse lanes)", () => {
    expect(PROXIMITY_AREAS.side).toBeCloseTo(8.4, 9); // |gap| < 1.05 m, |lane| < 2
    expect(PROXIMITY_AREAS.near).toBe(36); // |gap| < 3 m, |lane| < 3
    expect(PROXIMITY_AREAS.nearLane).toBe(5); // 2.5 m one side, |lane| < 1
    expect(PROXIMITY_AREAS.surroundBox).toBe(9);
  });

  test("Poisson box occupancy and episode starts keep the stationary on-share", () => {
    expect(atLeast(0, 1)).toBe(0);
    expect(atLeast(1, 1)).toBeCloseTo(1 - Math.exp(-1), 12);
    expect(atLeast(2, 2)).toBeCloseTo(1 - 3 * Math.exp(-2), 12);
    // On/off process with on-share 0.2 and mean length 3 s: start hazard = 0.2 / (0.8 x 3) per second.
    expect(episodeStart(0.2, 3)).toBeCloseTo(1 - Math.exp(-0.2 / 2.4), 12);
    expect(episodeStart(0, 3)).toBe(0);
  });

  test("field share grows from the front runner to the later styles", () => {
    expect(fieldShare(1)).toBeLessThan(fieldShare(2));
    expect(fieldShare(2)).toBeLessThan(fieldShare(3));
    expect(fieldShare(5)).toBeLessThan(fieldShare(1));
  });
});
