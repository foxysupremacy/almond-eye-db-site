import { describe, expect, test } from "bun:test";
import { characters, getCharacterEvolutions, loadRacetracks, skillsById } from "../data/registry";
import { flattenCourse } from "../api/course-format";
import { buildRankingCandidates, rankCharacters, skillIdsReferenced, type RankingRequest } from "../rankings";
import { dynamicConditionKeys } from "./prior";
import { defaultRaceImpactProfile } from "./profile";
import { scoreSkill } from "./score";

/**
 * R31 (reverses R29): own-activation count conditions (activate_count_heal / _all / _start / _middle / _end_after /
 * _later_half) are dynamic conditions like the others (R7.4): assumed met (rate 1) unless the `activate_count` override
 * is set, and the activation is sampled uniformly across the eligible zone (10 m steps), as U-tools does.
 * `activate_count_all_team` stays a pass-through; `activate_count_param_skill` keeps the activate_count key.
 */
const tracks = await loadRacetracks();
const course = (id: number) => {
  for (const t of tracks) { const r = t.courses.find((c) => c.id === id); if (r) return { ...flattenCourse(r), trackId: t.id }; }
  throw new Error(String(id));
};
const profile = defaultRaceImpactProfile();
const candidates = buildRankingCandidates(characters, (i) => getCharacterEvolutions(i));
function rank(courseId: number, costumeId: number) {
  const cands = candidates.filter((c) => c.costumeId === costumeId);
  const skills: RankingRequest["skills"] = {};
  for (const i of skillIdsReferenced(cands)) { const s = skillsById.get(i); if (s) skills[i] = { id: s.id, rarity: s.rarity, conditionGroups: s.conditionGroups }; }
  return rankCharacters({ key: "t", course: course(courseId), raceParams: { groundCondition: 1 }, racerCount: 9, profile, candidates: cands, skills });
}
const standalone = (skillId: number, courseId: number, style: 1 | 2 | 3 | 4, p = profile) =>
  scoreSkill({ skill: skillsById.get(skillId)!, course: course(courseId), raceParams: { groundCondition: 1 }, style, racerCount: 9, profile: p, withSamples: true });

describe("R31: own-activation counts map to the activate_count dynamic key", () => {
  test("every own-activation variant is keyed; the team count is not", () => {
    for (const v of ["heal", "all", "start", "middle", "end_after", "later_half", "param_skill"]) {
      expect(dynamicConditionKeys(`activate_count_${v}>=3&distance_rate>=50`)).toEqual(["activate_count"]);
    }
    expect(dynamicConditionKeys("phase>=2&activate_count_all_team>=6")).toEqual([]);
  });
});

describe("R31 on real skills", () => {
  test("Narita Top Road 120771 (activate_count_heal>=3) on Kyoto 10810: rate 1, sampled across its zone (not pinned)", () => {
    const row = rank(10810, 107703).rows.find((r) => r.style === 2)!;
    expect(row.unique.skillId).toBe(120771);
    expect(row.unique.activationRate).toBe(1);
    const s = standalone(120771, 10810, 2);
    expect(s.expectedBashin).toBe(row.unique.expectedBashin);
    const L = course(10810).length;
    const meters = new Set(s.samples.map((x) => x.meter));
    expect(meters.size).toBeGreaterThan(5);
    for (const m of meters) { expect(m).toBeGreaterThanOrEqual(0.6 * L); expect(m).toBeLessThanOrEqual((2 / 3) * L + 1); }
    // uniform: equal weights per 10 m step
    const w = s.samples.map((x) => x.weight);
    expect(Math.max(...w) - Math.min(...w)).toBeLessThan(0.05);
  });

  test("Oguri Cap [Ashen Miracle] 110061 (activate_count_heal>=3) on Kyoto 10808 fires (rate 1), sampled across its zone", () => {
    const row = rank(10808, 100602).rows.find((r) => r.style === 2)!;
    expect(row.unique.skillId).toBe(110061);
    expect(row.unique.activationRate).toBe(1);
    expect(row.unique.expectedBashin).toBeGreaterThan(1);
    expect(new Set(standalone(110061, 10808, 2).samples.map((x) => x.meter)).size).toBeGreaterThan(5);
  });

  test("dynamicOverrides.activate_count = 0.5 halves the activation rate and the expected Bashin", () => {
    const full = standalone(120771, 10810, 2);
    const half = standalone(120771, 10810, 2, { ...profile, dynamicOverrides: { activate_count: 0.5 } });
    expect(half.activationRate).toBeCloseTo(full.activationRate / 2, 9);
    expect(half.expectedBashin).toBeCloseTo(full.expectedBashin / 2, 5);
    expect(half.meanBashin).toBe(full.meanBashin);
  });
});
