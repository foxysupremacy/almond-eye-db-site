import { expect, test } from "bun:test";
import { defaultRaceImpactProfile } from "../race-impact/profile";
import { rankingCacheKey } from "./cache-key";

test("cache key changes with course, conditions, racers, profile; stable otherwise", () => {
  const base = { courseId: 10808, raceParams: { groundCondition: 1, weather: 2 }, racerCount: 9, profile: defaultRaceImpactProfile() };
  const k = rankingCacheKey(base);
  expect(rankingCacheKey({ ...base })).toBe(k);
  expect(rankingCacheKey({ ...base, courseId: 10810 })).not.toBe(k);
  expect(rankingCacheKey({ ...base, racerCount: 12 })).not.toBe(k);
  expect(rankingCacheKey({ ...base, raceParams: { ...base.raceParams, noDebuffs: true } })).not.toBe(k);
  expect(rankingCacheKey({ ...base, profile: { ...base.profile, stats: { ...base.profile.stats, wisdom: 1300 } } })).not.toBe(k);
  expect(k.startsWith("rankings:v3|course=10808|")).toBe(true);
  // PHYSICS_VERSION 5 (innate skills held as prerequisites + slopes); 6 (engine step 3b/4: section random, HP, scaling) invalidates cached rankings; 10 (step 5b: phase boundary frame); 11 (step 5c: own-activation counts assumed met and sampled across the zone, R31); 12 (step 5d, R32: prerequisites and popularity met for every Uma, no wisdom or lottery roll); 13 (R33 fitted lane and race-state models, R34 strongest scaling).
  expect(k.endsWith("|physics=13")).toBe(true);
});
