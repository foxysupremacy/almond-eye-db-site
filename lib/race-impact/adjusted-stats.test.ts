import { describe, expect, test } from "bun:test";
import { loadRacetracks } from "../data/registry";
import { flattenCourse } from "../api/course-format";
import { adjustedStats, baseStats, raceCourseModifier, STAT_CAP } from "./adjusted-stats";
import { defaultRaceImpactProfile } from "./profile";
import { simulationInputFor } from "./trace";

// Hand-computed from the mechanics doc (§Stats): Raw → Base (>1200 halved, × motivation) → Adjusted.
const REF = { speed: 2200, stamina: 1800, power: 1700, guts: 1500, wisdom: 1200 };

async function course(id: number) {
  for (const t of await loadRacetracks()) { const r = t.courses.find((c) => c.id === id); if (r) return { ...flattenCourse(r), trackId: t.id }; }
  throw new Error(String(id));
}

describe("stat pipeline (mechanics §Stats)", () => {
  test("base stats: raw past 1200 counts half; normal motivation is 1.0", () => {
    expect(baseStats(REF)).toEqual({ speed: 1700, stamina: 1500, power: 1450, guts: 1350, wisdom: 1200 });
  });

  test("base stats: motivation coefficient (best 1.04, worst 0.96)", () => {
    expect(baseStats(REF, "best").speed).toBeCloseTo(1768, 6);
    expect(baseStats(REF, "worst").guts).toBeCloseTo(1296, 6);
  });

  test("raw stats clamp to the 5th-anniversary cap of 2500 before compression", () => {
    expect(STAT_CAP).toBe(2500);
    expect(baseStats({ ...REF, speed: 3000 }).speed).toBe(1850);
    expect(baseStats({ ...REF, speed: 0 }).speed).toBe(1);
  });

  test("race course modifier averages the per-threshold bonus over the listed base stats", () => {
    const base = { speed: 800, stamina: 1000, power: 500, guts: 250, wisdom: 1200 };
    expect(raceCourseModifier(base, [])).toBe(1);
    expect(raceCourseModifier(base, [1])).toBeCloseTo(1.15, 10); // 600 < 800 <= 900
    expect(raceCourseModifier(base, [1, 3])).toBeCloseTo(1.125, 10); // (0.15 + 0.1) / 2
    expect(raceCourseModifier(base, [4, 2])).toBeCloseTo(1.125, 10); // (0.05 + 0.2) / 2
  });

  test("Kyoto 2200 turf (speed threshold), good ground: speed 1700 x 1.2 = 2040, other stats = base", () => {
    expect(adjustedStats(REF, { surface: 1, groundCondition: 1, statThresholds: [1] })).toEqual({ speed: 2040, stamina: 1500, power: 1450, guts: 1350, wisdom: 1200 });
  });

  test("dirt good ground: power -100; heavy turf: speed -50, power -50", () => {
    expect(adjustedStats(REF, { surface: 2, groundCondition: 1, statThresholds: [] }).power).toBe(1350);
    const heavy = adjustedStats(REF, { surface: 1, groundCondition: 4, statThresholds: [] });
    expect(heavy.speed).toBe(1650);
    expect(heavy.power).toBe(1400);
  });

  test("strategy proficiency scales wisdom (B = 0.85)", () => {
    expect(adjustedStats(REF, { surface: 1, groundCondition: 1, statThresholds: [], strategyProficiency: "B" }).wisdom).toBe(1020);
  });

  test("simulationInputFor feeds adjusted stats to the physics (Kyoto 10808, Tokyo dirt 10611)", async () => {
    const profile = { ...defaultRaceImpactProfile(), stats: { ...REF } };
    expect(simulationInputFor(await course(10808), profile, 2, 1).stats).toEqual({ speed: 2040, stamina: 1500, power: 1450, guts: 1350, wisdom: 1200 });
    // Tokyo dirt 1600 lists speed + stamina thresholds; ground defaults to good.
    const dirt = simulationInputFor(await course(10611), profile, 2).stats;
    expect(dirt.speed).toBe(2040);
    expect(dirt.power).toBe(1350);
  });
});
