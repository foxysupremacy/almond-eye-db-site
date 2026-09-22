import { notifyLocalUpdate, readJsonStorage, subscribeLocalUpdates, writeJsonStorage } from "../persistence";
import {
  DEFAULT_RACE_IMPACT_STATS,
  RACE_IMPACT_PROFILE_KEY,
  type DynamicConditionKey,
  type RaceImpactProfile,
  type RaceImpactStat,
} from "./types";

const EVENT_KEY = "race-impact-profile-update";
const STAT_MIN = 1;
const STAT_MAX = 3000;

export function defaultRaceImpactProfile(): RaceImpactProfile {
  return { version: 1, stats: { ...DEFAULT_RACE_IMPACT_STATS }, dynamicOverrides: {} };
}

function validStat(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= STAT_MIN && value <= STAT_MAX;
}

function validProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function normalizeRaceImpactProfile(value: unknown): RaceImpactProfile {
  const fallback = defaultRaceImpactProfile();
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Partial<RaceImpactProfile>;
  const stats = { ...fallback.stats };
  for (const key of Object.keys(stats) as RaceImpactStat[]) {
    if (validStat(raw.stats?.[key])) stats[key] = raw.stats![key];
  }
  const dynamicOverrides: RaceImpactProfile["dynamicOverrides"] = {};
  for (const [key, probability] of Object.entries(raw.dynamicOverrides ?? {})) {
    if (validProbability(probability)) dynamicOverrides[key as DynamicConditionKey] = probability;
  }
  return { version: 1, stats, dynamicOverrides };
}

export function loadRaceImpactProfile(): RaceImpactProfile {
  return normalizeRaceImpactProfile(readJsonStorage<unknown>(RACE_IMPACT_PROFILE_KEY));
}

export function saveRaceImpactProfile(profile: RaceImpactProfile): void {
  writeJsonStorage(RACE_IMPACT_PROFILE_KEY, normalizeRaceImpactProfile(profile));
  notifyLocalUpdate(EVENT_KEY);
}

export function subscribeRaceImpactProfile(handler: () => void): () => void {
  return subscribeLocalUpdates(EVENT_KEY, handler);
}
