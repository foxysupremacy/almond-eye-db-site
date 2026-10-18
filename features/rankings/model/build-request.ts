import { characters, getCharacterEvolutions, skillsById } from "@/lib/data/registry";
import { buildRankingCandidates, rankingCacheKey, skillIdsReferenced, type RankingCandidate, type RankingRequest } from "@/lib/rankings";
import type { RaceImpactProfile } from "@/lib/race-impact";
import type { Course, RaceParameters } from "@/lib/skill-engine/types";

export interface RankingsContext { course: Course; raceParams: Partial<RaceParameters>; racerCount: number; profile: RaceImpactProfile }

let candidatesCache: RankingCandidate[] | null = null;
export function getRankingCandidates(): RankingCandidate[] {
  // Slots come from character-evolutions.json, kept in sync with master.mdb skill_upgrade_description.
  candidatesCache ??= buildRankingCandidates(characters, (id) => getCharacterEvolutions(id));
  return candidatesCache;
}

export function buildRankingRequest(ctx: RankingsContext): RankingRequest {
  const candidates = getRankingCandidates();
  const skills: RankingRequest["skills"] = {};
  for (const id of skillIdsReferenced(candidates)) {
    const s = skillsById.get(id);
    if (s) skills[id] = { id: s.id, rarity: s.rarity, conditionGroups: s.conditionGroups };
  }
  return {
    key: rankingCacheKey({ courseId: ctx.course.id, raceParams: ctx.raceParams, racerCount: ctx.racerCount, profile: ctx.profile }),
    course: ctx.course, raceParams: ctx.raceParams, racerCount: ctx.racerCount, profile: ctx.profile,
    candidates, skills,
  };
}
