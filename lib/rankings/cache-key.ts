import type { RaceImpactProfile } from "../race-impact/types";
import { PHYSICS_VERSION } from "../race-impact/types";
import type { RaceParameters } from "../skill-engine/types";

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function rankingCacheKey(input: { courseId: number; raceParams: Partial<RaceParameters>; racerCount: number; profile: RaceImpactProfile }): string {
  const p = input.raceParams;
  const n = (v: unknown) => (v == null ? "x" : String(v));
  const profileHash = hash(JSON.stringify([input.profile.stats, input.profile.dynamicOverrides, input.profile.bashinReferenceSpeed]));
  return `rankings:v3|course=${input.courseId}|ground=${n(p.groundCondition)}|weather=${n(p.weather)}|season=${n(p.season)}|time=${n(p.time)}|grade=${n(p.grade)}|racers=${input.racerCount}|noDebuffs=${p.noDebuffs ? 1 : 0}|profile=${profileHash}|physics=${PHYSICS_VERSION}`;
}
