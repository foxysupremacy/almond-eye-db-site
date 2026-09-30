import type { TrackInfo } from "./types";

export interface CustomRaceConditions {
  season: number | null;
  weather: number | null;
  groundCondition: number | null;
  time: number | null;
}

export const RACE_CONDITION_OPTIONS = {
  season: ["Spring", "Summer", "Fall", "Winter", "Cherry blossom"],
  weather: ["Sunny", "Cloudy", "Rainy", "Snowy"],
  groundCondition: ["Good", "Slightly heavy", "Heavy", "Bad"],
  time: ["Morning", "Daytime", "Evening", "Night"],
} as const;

export function normalizeRaceConditions(value?: unknown): CustomRaceConditions {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  function field(key: keyof CustomRaceConditions): number | null {
    const v = source[key];
    return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= RACE_CONDITION_OPTIONS[key].length ? v : null;
  }
  return { season: field("season"), weather: field("weather"), groundCondition: field("groundCondition"), time: field("time") };
}

/** Leaving an event resets conditions; editing an existing custom course preserves them. */
export function customTrackInfo(info: TrackInfo, reset = false): TrackInfo {
  const shouldReset = reset || Boolean(info.pvpEventId || info.masterChallengeSelection);
  return {
    ...info,
    pvpEventId: null,
    masterChallengeSelection: null,
    customRaceConditions: normalizeRaceConditions(shouldReset ? null : info.customRaceConditions),
  };
}
