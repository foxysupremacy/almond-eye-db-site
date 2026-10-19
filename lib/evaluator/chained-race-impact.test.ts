import { describe, expect, test } from "bun:test";
import { loadRacetracks, skillsById } from "../data/registry";
import { flattenCourse } from "../api/course-format";
import { horseForStrategy } from "../skill-engine/zones";
import { computePvpSkillZones } from "../pvp/skill-zones";
import { defaultRaceImpactProfile, evaluateTriggerRaceImpact, hasChainedTriggers } from "../race-impact";
import { evaluateSkillForTrack } from "./evaluator";

async function course(id: number) {
  for (const t of await loadRacetracks()) { const r = t.courses.find((c) => c.id === id); if (r) return { ...flattenCourse(r), trackId: t.id }; }
  throw new Error(String(id));
}

describe("visualizer raceImpact for chained multi-group skills (R10)", () => {
  test("Stay Gold 101351 on Kyoto 2200: visualizer result is the single full-skill chained run", async () => {
    const kyoto = await course(10808);
    const skill = skillsById.get(101351)!;
    const zones = computePvpSkillZones(kyoto as never, skill.conditionGroups!.map((g) => ({ condition: g.condition ?? "", precondition: g.precondition ?? null })), horseForStrategy(3 as never), { groundCondition: 1, skillId: String(skill.id) });
    expect(hasChainedTriggers(skill.conditionGroups!, zones)).toBe(true);
    const profile = defaultRaceImpactProfile();
    const ctx = { course: kyoto as never, runningStyle: 3 as never, racerCount: 9, raceParams: { groundCondition: 1 }, profile };
    const full = evaluateTriggerRaceImpact(skill as never, zones, ctx);
    const firstOnly = evaluateTriggerRaceImpact({ ...skill, conditionGroups: [skill.conditionGroups![0]] } as never, [zones[0]], ctx);
    const viz = evaluateSkillForTrack(skill as never, kyoto as never, 3 as never, 9, false, zones, { groundCondition: 1 }, { raceImpactProfile: profile }).raceImpact!;
    expect(viz.expectedBashin!).toBeCloseTo(full.expectedBashin!, 6);
    expect(viz.expectedBashin!).toBeGreaterThan(firstOnly.expectedBashin!);
  });

  test("non-chained alternatives are not reported as chained", () => {
    const g = [{ condition: "a==1" }, { condition: "b==1" }];
    expect(hasChainedTriggers(g, [{ regions: [{ length: 1 }] }, { regions: [{ length: 1 }] }])).toBe(false);
  });
});
