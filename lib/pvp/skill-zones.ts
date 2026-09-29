import { RegionList } from "../skill-engine/region";
import { computeAllZones, type SkillZoneResult } from "../skill-engine/zones";
import type { Course, HorseParameters, RaceParameters } from "../skill-engine/types";
import { isSkillBanned } from "./events";

/**
 * Apply Champions Meeting skill bans before delegating generic zone math.
 * The skill engine stays independent of PVP policy; callers that need event
 * rules opt into this adapter explicitly.
 */
export function computePvpSkillZones(
  course: Course,
  groups: { condition?: string | null; precondition?: string | null }[],
  horse: HorseParameters | undefined,
  raceParameters: Partial<RaceParameters>,
): SkillZoneResult[] {
  const skillId = Number(raceParameters.skillId);
  if (raceParameters.noDebuffs && isSkillBanned(skillId, true)) {
    return groups.map(() => ({
      regions: new RegionList(),
      isRandom: false,
      earliestFire: null,
    }));
  }

  return computeAllZones(course, groups, horse, raceParameters);
}
