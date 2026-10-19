import { describe, expect, test } from "bun:test";
import { loadRacetracks, skillsById } from "../data/registry";
import { flattenCourse } from "../api/course-format";
import { defaultRaceImpactProfile } from "./profile";
import { scoreSkill, simulateBaseline } from "./score";
import { baselineCacheStats, cachedBaselineRun, clearBaselineCache, computeGainDistribution, generateRaceTrace, simulationInputFor, triggerValues } from "./trace";

async function course(id: number) {
  for (const t of await loadRacetracks()) { const r = t.courses.find((c) => c.id === id); if (r) return { ...flattenCourse(r), trackId: t.id }; }
  throw new Error(String(id));
}
const profile = defaultRaceImpactProfile();

describe("scoreSkill", () => {
  test("unique: guaranteed (no wisdom check), deterministic single sample", async () => {
    const kyoto = await course(10808);
    const s = scoreSkill({ skill: skillsById.get(120171)!, course: kyoto, raceParams: { groundCondition: 1 }, style: 2, racerCount: 9, profile, withSamples: true });
    expect(s.groupIndex).toBe(0);
    expect(s.expectedBashin).toBeGreaterThan(0);
    expect(s.samples.length).toBeGreaterThanOrEqual(1);
  });

  test("evolution: R32, the wisdom-check flag no longer changes the score (equal to the guaranteed version)", async () => {
    const kyoto = await course(10808);
    const evo = { ...skillsById.get(101703111)!, activation: 1 };
    const a = scoreSkill({ skill: evo, course: kyoto, raceParams: {}, style: 2, racerCount: 9, profile });
    const b = scoreSkill({ skill: { ...evo, activation: 0 }, course: kyoto, raceParams: {}, style: 2, racerCount: 9, profile });
    expect(b.expectedBashin).toBeGreaterThan(0);
    expect(a.expectedBashin).toBeCloseTo(b.expectedBashin, 6);
  });

  test("random zones are sampled every 10 m with weights summing to 1", async () => {
    const kyoto = await course(10808);
    const random = [...skillsById.values()].find((s) => s.rarity === 6 && /_random/.test(s.conditionGroups?.[0]?.condition ?? ""))!;
    expect(random).toBeDefined();
    const s = scoreSkill({ skill: random, course: kyoto, raceParams: {}, style: 2, racerCount: 9, profile, withSamples: true });
    expect(s.samples.length).toBeGreaterThan(1);
    expect(s.samples[1].meter - s.samples[0].meter).toBe(10);
    expect(s.samples.reduce((t, x) => t + x.weight, 0)).toBeCloseTo(1, 6);
  });

  test("banned under No Debuffs scores zero and is flagged", async () => {
    const s = scoreSkill({ skill: skillsById.get(201151)!, course: await course(10808), raceParams: { noDebuffs: true }, style: 2, racerCount: 9, profile });
    expect(s.banned).toBe(true);
    expect(s.expectedBashin).toBe(0);
  });

  test("baseline is reusable and does not change results", async () => {
    const kyoto = await course(10808);
    const baseline = simulateBaseline(kyoto, 2, profile);
    const a = scoreSkill({ skill: skillsById.get(120171)!, course: kyoto, raceParams: {}, style: 2, racerCount: 9, profile });
    const b = scoreSkill({ skill: skillsById.get(120171)!, course: kyoto, raceParams: {}, style: 2, racerCount: 9, profile, baseline });
    expect(b.expectedBashin).toBe(a.expectedBashin);
  });

  test("memoized baseline gives results identical to an explicit fresh baseline (120171, Kyoto 10808)", async () => {
    const kyoto = await course(10808);
    for (const style of [1, 2, 3, 4] as const) {
      clearBaselineCache();
      const fresh = simulateBaseline(kyoto, style, profile);
      const explicit = scoreSkill({ skill: skillsById.get(120171)!, course: kyoto, raceParams: { groundCondition: 1 }, style, racerCount: 9, profile, baseline: fresh, withSamples: true });
      const memo1 = scoreSkill({ skill: skillsById.get(120171)!, course: kyoto, raceParams: { groundCondition: 1 }, style, racerCount: 9, profile, withSamples: true });
      const memo2 = scoreSkill({ skill: skillsById.get(120171)!, course: kyoto, raceParams: { groundCondition: 1 }, style, racerCount: 9, profile, withSamples: true });
      expect(memo1).toEqual(explicit);
      expect(memo2).toEqual(explicit);
    }
  });

  test("scoreSkill simulates the baseline once per (course geometry, style, profile stats)", async () => {
    const kyoto = await course(10808);
    clearBaselineCache();
    const base = { skill: skillsById.get(120171)!, course: kyoto, raceParams: {}, style: 2 as const, racerCount: 9, profile };
    scoreSkill(base);
    scoreSkill({ ...base, skill: skillsById.get(101351)! });
    expect(baselineCacheStats().simulations).toBe(1);
    // Same geometry in a fresh object (callers do not share course references) still hits.
    scoreSkill({ ...base, course: { ...kyoto } });
    expect(baselineCacheStats().simulations).toBe(1);
    // Fields the simulation does not read (overrides, reference speed) do not miss.
    scoreSkill({ ...base, profile: { ...profile, dynamicOverrides: { overtake: 0.5 } } });
    expect(baselineCacheStats().simulations).toBe(1);
    scoreSkill({ ...base, style: 3 });
    expect(baselineCacheStats().simulations).toBe(2);
    scoreSkill({ ...base, profile: { ...profile, stats: { ...profile.stats, speed: profile.stats.speed - 100 } } });
    expect(baselineCacheStats().simulations).toBe(3);
    scoreSkill({ ...base, course: { ...kyoto, spurtStart: { ...kyoto.spurtStart!, meters: (kyoto.spurtStart!.meters ?? 0) + 50 } } });
    expect(baselineCacheStats().simulations).toBe(4);
  });

  test("the baseline cache is bounded", async () => {
    const kyoto = await course(10808);
    clearBaselineCache();
    for (let i = 0; i < 20; i++) scoreSkill({ skill: skillsById.get(120171)!, course: kyoto, raceParams: {}, style: 2, racerCount: 9, profile: { ...profile, stats: { ...profile.stats, speed: 1000 + i } } });
    expect(baselineCacheStats().size).toBeLessThanOrEqual(8);
  });

  test("consumers never mutate the shared cached baseline", async () => {
    const kyoto = await course(10808);
    clearBaselineCache();
    const run = cachedBaselineRun(simulationInputFor(kyoto, profile, 3));
    const snapshot = structuredClone(run);
    const skill = skillsById.get(101351)!; // chained trigger: several resumed windows
    scoreSkill({ skill, course: kyoto, raceParams: { groundCondition: 1 }, style: 3, racerCount: 9, profile, withSamples: true });
    const random = [...skillsById.values()].find((s) => s.rarity === 6 && /_random/.test(s.conditionGroups?.[0]?.condition ?? ""))!;
    scoreSkill({ skill: random, course: kyoto, raceParams: {}, style: 3, racerCount: 9, profile });
    computeGainDistribution(skill, [{ regions: [{ start: 900, end: 1400 }], isRandom: true }] as never, { course: kyoto, profile, runningStyle: 3 }, { activationRate: 1 } as never);
    expect(cachedBaselineRun(simulationInputFor(kyoto, profile, 3))).toBe(run);
    expect(run).toEqual(snapshot);
  });

  test("computeGainDistribution and generateRaceTrace reuse the same memoized baseline", async () => {
    const kyoto = await course(10808);
    clearBaselineCache();
    const skill = skillsById.get(120171)!;
    const freshTrace = (() => { const t = generateRaceTrace(skill, { course: kyoto, profile, runningStyle: 2 }, 1500, [{ regions: [{ start: 1500, end: 1510 }], isRandom: false }] as never); clearBaselineCache(); return t; })();
    scoreSkill({ skill, course: kyoto, raceParams: {}, style: 2, racerCount: 9, profile });
    const ctx = { course: kyoto, profile, runningStyle: 2 as const };
    const zones = [{ regions: [{ start: 1500, end: 1510 }], isRandom: false }];
    computeGainDistribution(skill, zones as never, ctx, { activationRate: 1 } as never);
    expect(baselineCacheStats().simulations).toBe(1);
    const t1 = generateRaceTrace(skill, ctx, 1500, zones as never);
    const t2 = generateRaceTrace(skill, ctx, 1500, zones as never);
    expect(t1).toEqual(freshTrace);
    expect(t2).toEqual(t1);
    expect(baselineCacheStats().pointRuns).toBe(1);
  });

  test("deterministic trigger fires at its region start, not earliestFire (R7.5): Stay Gold g0 at ~1100 m", async () => {
    const kyoto = await course(10808);
    const s = scoreSkill({ skill: skillsById.get(101351)!, course: kyoto, raceParams: { groundCondition: 1 }, style: 3, racerCount: 9, profile, withSamples: true });
    expect(s.samples).toHaveLength(1);
    expect(s.samples[0].meter).toBeCloseTo(1100, 0);
  });

  test("chained trigger is scored in the same run (R7.3): Stay Gold with g1 beats g0 alone", async () => {
    const kyoto = await course(10808);
    const skill = skillsById.get(101351)!;
    const both = scoreSkill({ skill, course: kyoto, raceParams: { groundCondition: 1 }, style: 3, racerCount: 9, profile });
    const g0only = scoreSkill({ skill: { ...skill, conditionGroups: [skill.conditionGroups![0]] }, course: kyoto, raceParams: { groundCondition: 1 }, style: 3, racerCount: 9, profile });
    expect(both.groupIndex).toBe(0);
    expect(both.meanBashin).toBeGreaterThan(g0only.meanBashin + 0.5);
  });

  test("dynamic conditions count as satisfied without overrides; priors are not multiplied in (R7.4)", async () => {
    const kyoto = await course(10808);
    const s = scoreSkill({ skill: skillsById.get(113301211)!, course: kyoto, raceParams: { groundCondition: 1 }, style: 2, racerCount: 9, profile });
    expect(s.activationRate).toBe(1); // R32: no wisdom roll
  });

  test("a dynamic override applies only to the @ branch that contains the key (R7.4)", async () => {
    const kyoto = await course(10808);
    // 113301211: branch A has is_overtake, branch B does not -> 1 - (1 - 0)(1 - 1) = 1.
    const s = scoreSkill({ skill: skillsById.get(113301211)!, course: kyoto, raceParams: {}, style: 2, racerCount: 9, profile: { ...profile, dynamicOverrides: { overtake: 0 } } });
    expect(s.activationRate).toBeCloseTo(1, 6);
    const single = { id: 990001, activation: 0, conditionGroups: [{ condition: "is_overtake==1&phase>=2", precondition: null, base_time: 30000, effects: [{ type: 27, value: 3500 }] }] };
    const o = scoreSkill({ skill: single, course: kyoto, raceParams: {}, style: 2, racerCount: 9, profile: { ...profile, dynamicOverrides: { overtake: 0.3 } } });
    expect(o.activationRate).toBeCloseTo(0.3, 6);
  });

  test("unique level raises the score monotonically", async () => {
    const kyoto = await course(10808);
    const lv1 = scoreSkill({ skill: skillsById.get(120171)!, course: kyoto, raceParams: {}, style: 2, racerCount: 9, profile });
    const lv6 = scoreSkill({ skill: skillsById.get(120171)!, course: kyoto, raceParams: {}, style: 2, racerCount: 9, profile, uniqueLevel: 6 });
    expect(lv6.expectedBashin).toBeGreaterThan(lv1.expectedBashin);
  });

  test("Lv1 scoring of 120171 is unchanged by the mdb level table (rankings stay Lv1)", async () => {
    const kyoto = await course(10808);
    const lv1 = scoreSkill({ skill: skillsById.get(120171)!, course: kyoto, raceParams: { groundCondition: 1 }, style: 2, racerCount: 9, profile, uniqueLevel: 1 });
    // PHYSICS_VERSION 4 (adjusted stats) moved this pin from 5.047709; 5 (slopes, expected downhill bonus) from 5.300169;
    // 6 (section random mean) from 4.780095; 7 (step 4b: minimum speed, corner lane loss) from 4.695222; 8 (step 4c: sub-frame phase / slope / skill switching) from 4.746643;
    // 13 (R33: fitted lane model) from 4.722823.
    expect(lv1.expectedBashin).toBe(4.715646);
  });

  test("unique level scales each effect by its own ability-type coefficient", () => {
    const unique = { id: 990002, rarity: 5, conditionGroups: [{ condition: "phase==1", base_time: 30000, effects: [{ type: 27, value: 3500 }, { type: 31, value: 3000 }, { type: 22, value: 4500 }] }] };
    const lv6 = triggerValues(unique, 0, 2000, 6).values;
    expect(lv6.target).toBeCloseTo(0.35 * 1.13, 10);
    expect(lv6.accel).toBeCloseTo(0.3 * 1.1, 10);
    expect(lv6.current).toBeCloseTo(0.45 * 1.1, 10);
    // Non-unique skills never scale.
    const evolved = triggerValues({ ...unique, rarity: 6 }, 0, 2000, 6).values;
    expect(evolved.target).toBeCloseTo(0.35, 10);
  });
});
