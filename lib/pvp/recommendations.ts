import type {
  PvpRaceFitAssistance,
  PvpRecommendedRace,
  PvpRunningStyle,
  RecommendedPvpSkill,
} from "../data/types";
import type { RunningStyle } from "../deck/types";
import type { RaceParameters } from "../skill-engine/types";

export const PVP_RECOMMENDATION_STYLE_BY_ID: Partial<Record<RunningStyle, PvpRunningStyle>> = {
  1: "nige",
  2: "senko",
  3: "sashi",
  4: "oikomi",
};

export function getRecommendedRace(
  events: readonly PvpRaceFitAssistance[],
  eventId: number | null | undefined,
  raceCourseSetId: number | null | undefined,
  eventSubId: number | null | undefined,
  eventType = 1,
): PvpRecommendedRace | null {
  if (eventId == null || raceCourseSetId == null || eventSubId == null) return null;
  const event = events.find((candidate) => candidate.eventType === eventType && candidate.eventId === eventId);
  return event?.races.find(
    (race) => race.raceCourseSetId === raceCourseSetId && race.eventSubId === eventSubId,
  ) ?? null;
}

/**
 * Game recommendation values are kept as their original 0/1/2 values. For
 * filtering, zero means the style is absent from this skill's recommendation;
 * both positive codes remain eligible without assigning labels or rank to them.
 */
export function filterRecommendedSkillsByStyle(
  skills: readonly RecommendedPvpSkill[],
  style: RunningStyle | null,
): RecommendedPvpSkill[] {
  if (style == null) {
    return skills.filter((skill) => Object.values(skill.runningStyleValues).some((value) => value > 0));
  }
  const sourceStyle = PVP_RECOMMENDATION_STYLE_BY_ID[style];
  if (!sourceStyle) return [];
  return skills.filter((skill) => skill.runningStyleValues[sourceStyle] > 0);
}

export function raceParametersForMasterChallenge(race: PvpRecommendedRace): Partial<RaceParameters> {
  return {
    season: race.season,
    weather: race.weather,
    groundCondition: race.ground,
    time: race.timezone,
    numUmas: race.entryCount,
    noDebuffs: false,
  };
}

export function findMasterChallengeRace(
  events: readonly PvpRaceFitAssistance[],
  eventId: number | null | undefined,
  eventSubId: number | null | undefined,
): { event: PvpRaceFitAssistance; race: PvpRecommendedRace } | null {
  if (eventId == null || eventSubId == null) return null;
  const event = events.find((candidate) => candidate.eventType === 3 && candidate.eventId === eventId);
  const race = event?.races.find((candidate) => candidate.eventSubId === eventSubId);
  return event && race ? { event, race } : null;
}
