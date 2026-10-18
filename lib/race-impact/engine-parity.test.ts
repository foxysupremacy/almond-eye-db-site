import { describe, expect, test } from "bun:test";
import { loadRacetracks, skillsById } from "../data/registry";
import { flattenCourse } from "../api/course-format";
import { horseForStrategy } from "../skill-engine/zones";
import { computePvpSkillZones } from "../pvp/skill-zones";
import { evaluateSkillForTrack } from "../evaluator/evaluator";
import { defaultRaceImpactProfile } from "./profile";
import { scoreSkill } from "./score";
import { hasTimedStateTerm } from "./dynamic-placement";

async function course(id: number) {
  for (const t of await loadRacetracks()) { const r = t.courses.find((c) => c.id === id); if (r) return { ...flattenCourse(r), trackId: t.id }; }
  throw new Error(String(id));
}

// R14: the Visualizer headline (evaluateSkillForTrack().raceImpact) and Rankings/modal (scoreSkill) share one engine.
// 120171: deterministic unique, rank-gated for Pace (2 groups); 201651: random zone; 100971: Scarlet Lily, g0 names
// another skill (Impulse 203781), met for any Uma under R32; 101351: Stay Gold, chained second group (R10);
// 10241: Victory Kiss☆, blocked_side_continuetime unique placed by dynamicPlacement (step 5a);
// 110011: Wayakawa ♪ Marine Dive, activate_count_middle group sampled across its zone (R31).
const CASES: Array<{ id: number; style: 1 | 2 | 3 | 4; via?: "dynamic" | "count" }> = [
  { id: 120171, style: 3 },
  { id: 201651, style: 2 },
  { id: 100971, style: 3 },
  { id: 101351, style: 3 },
  { id: 10241, style: 1, via: "dynamic" },
  { id: 110011, style: 1, via: "count" },
];

describe("Visualizer and scoreSkill engine parity on Kyoto 10808 (R14)", () => {
  const profile = defaultRaceImpactProfile();
  for (const { id, style, via } of CASES) {
    test(`skill ${id}, style ${style}${via ? ` (${via})` : ""}`, async () => {
      const kyoto = await course(10808);
      const skill = skillsById.get(id)!;
      if (via === "dynamic") expect(hasTimedStateTerm(skill.conditionGroups![0].condition)).toBe(true);
      const zones = computePvpSkillZones(kyoto as never, skill.conditionGroups!.map((g) => ({ condition: g.condition ?? "", precondition: g.precondition ?? null })), horseForStrategy(style), { groundCondition: 1, skillId: String(id) });
      const viz = evaluateSkillForTrack(skill as never, kyoto as never, style, 9, false, zones, { groundCondition: 1 }, { raceImpactProfile: profile }).raceImpact!;
      const score = scoreSkill({ skill, course: kyoto, raceParams: { groundCondition: 1 }, style, racerCount: 9, profile });
      expect(score.expectedBashin).toBeGreaterThan(0);
      if (via === "count") expect(skill.conditionGroups![score.groupIndex!].condition).toMatch(/activate_count_/);
      expect(Math.abs(viz.expectedBashin! - score.expectedBashin)).toBeLessThan(1e-6);
      expect(Math.abs(viz.activation.activationRate - score.activationRate)).toBeLessThan(1e-6);
      expect(Math.abs(viz.meanBashin! - score.meanBashin)).toBeLessThan(1e-6);
      expect(Math.abs(viz.minBashin! - score.minBashin)).toBeLessThan(1e-6);
      expect(Math.abs(viz.maxBashin! - score.maxBashin)).toBeLessThan(1e-6);
      expect(Math.abs(viz.medianBashin! - score.medianBashin)).toBeLessThan(1e-6);
      expect(Math.abs(viz.usefulRate - score.usefulRate)).toBeLessThan(1e-6);
      // The Visualizer's activation factors describe the same group scoreSkill fired.
      const a = viz.activation;
      expect(Math.abs(a.geometryRate * a.dynamicRate - score.activationRate)).toBeLessThan(1e-6);
    });
  }
});

// R32: popularity is met in any band, so the Visualizer's drawn zones are also the race-impact zones (no favourite band).
describe("Visualizer popularity parity (R32): Gambler 202441 on Kyoto 10808", () => {
  const profile = defaultRaceImpactProfile();
  const style = 2 as const;
  test("both groups draw, and the headline equals scoreSkill (first group wins, activation 1)", async () => {
    const kyoto = await course(10808);
    const skill = skillsById.get(202441)!;
    const groups = skill.conditionGroups!.map((g) => ({ condition: g.condition ?? "", precondition: g.precondition ?? null }));
    const drawn = computePvpSkillZones(kyoto as never, groups, horseForStrategy(style), { groundCondition: 1, skillId: "202441" });
    expect(drawn[0].regions.length).toBeGreaterThan(0);
    expect(drawn[1].regions.length).toBeGreaterThan(0);
    const viz = evaluateSkillForTrack(skill as never, kyoto as never, style, 9, false, drawn, { groundCondition: 1 }, { raceImpactProfile: profile }).raceImpact!;
    const score = scoreSkill({ skill, course: kyoto, raceParams: { groundCondition: 1 }, style, racerCount: 9, profile });
    expect(score.groupIndex).toBe(0);
    expect(score.activationRate).toBe(1);
    expect(Math.abs(viz.activation.activationRate - score.activationRate)).toBeLessThan(1e-6);
    expect(Math.abs(viz.expectedBashin! - score.expectedBashin)).toBeLessThan(1e-6);
    expect(Math.abs(viz.meanBashin! - score.meanBashin)).toBeLessThan(1e-6);
  });
});
