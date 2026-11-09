import { g1Races } from "../data/registry";
import type { G1RaceEntry } from "../data/types";
import { customTrackInfo, normalizeRaceConditions } from "./race-conditions";
import type { TrackInfo } from "./types";

/** One G1 race the Custom map can jump to (GameTora races data). */
export type G1RacePreset = G1RaceEntry;

export const G1_RACES: readonly G1RacePreset[] = g1Races;

/** Custom track for a G1: its course, season and time; weather and ground stay random. */
export function g1TrackInfo(info: TrackInfo, race: G1RacePreset): TrackInfo {
  return {
    ...customTrackInfo(info, true),
    trackId: race.trackId,
    courseId: race.courseId,
    customRaceConditions: normalizeRaceConditions({ season: race.season, time: race.time }),
  };
}

/** G1s whose course, season and time match the current Custom track. */
export function matchingG1Races(info: TrackInfo): G1RacePreset[] {
  if (info.pvpEventId || info.masterChallengeSelection) return [];
  const conditions = normalizeRaceConditions(info.customRaceConditions);
  return G1_RACES.filter((race) => race.courseId === info.courseId && race.season === conditions.season && race.time === conditions.time);
}
