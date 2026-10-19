import { notifyLocalUpdate, readJsonStorage, subscribeLocalUpdates, writeJsonStorage } from "../storage/persistence";
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

const LEGACY_DEFAULT_WISDOM = 1800;

export function defaultRaceImpactProfile(): RaceImpactProfile {
  return { version: 2, stats: { ...DEFAULT_RACE_IMPACT_STATS }, dynamicOverrides: {}, bashinReferenceSpeed: null };
}

function validSpeed(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 30;
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
  const raw = value as Partial<Omit<RaceImpactProfile, "version">> & { version?: number };
  const stats = { ...fallback.stats };
  for (const key of Object.keys(stats) as RaceImpactStat[]) {
    if (validStat(raw.stats?.[key])) stats[key] = raw.stats![key];
  }
  // v1 stored the old default wisdom; only that exact value is migrated.
  if (raw.version !== 2 && raw.stats?.wisdom === LEGACY_DEFAULT_WISDOM) stats.wisdom = DEFAULT_RACE_IMPACT_STATS.wisdom;
  const dynamicOverrides: RaceImpactProfile["dynamicOverrides"] = {};
  for (const [key, probability] of Object.entries(raw.dynamicOverrides ?? {})) {
    if (validProbability(probability)) dynamicOverrides[key as DynamicConditionKey] = probability;
  }
  const bashinReferenceSpeed = validSpeed(raw.bashinReferenceSpeed) ? raw.bashinReferenceSpeed : null;
  return { version: 2, stats, dynamicOverrides, bashinReferenceSpeed };
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
