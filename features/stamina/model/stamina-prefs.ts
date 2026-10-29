import { readJsonStorage, writeJsonStorage } from "@/lib/storage/persistence";
import { STAT_CAP, type Motivation, type Proficiency, type StatBlock } from "@/lib/race-impact/adjusted-stats";
import { GREEN_BUCKETS, HP_LOSS_BUCKETS, RECOVERY_BUCKETS, type StaminaInput } from "@/lib/stamina-sim";
import type { RunningStyle } from "@/lib/deck/types";

export const STAMINA_PREFS_KEY = "stamina.v1";
/** Most copies of one skill bucket a build can list. */
export const MAX_SKILL_COUNT = 20;

export const STAT_KEYS = ["speed", "stamina", "power", "guts", "wisdom"] as const satisfies readonly (keyof StatBlock)[];
export const GREEN_KEYS = Object.keys(GREEN_BUCKETS) as (keyof typeof GREEN_BUCKETS)[];
export const PROFICIENCIES: readonly Proficiency[] = ["S", "A", "B", "C", "D", "E", "F", "G"];
export const MOTIVATIONS: readonly Motivation[] = ["best", "good", "normal", "bad", "worst"];
export const STYLES: readonly RunningStyle[] = [1, 2, 3, 4, 5];
export const GROUNDS: readonly StaminaInput["groundCondition"][] = [1, 2, 3, 4];

export const DEFAULT_STAMINA_INPUT: StaminaInput = Object.freeze({
  stats: Object.freeze({ speed: 1200, stamina: 1000, power: 1000, guts: 800, wisdom: 1000 }),
  style: 2,
  aptitude: Object.freeze({ ground: "A", distance: "A", style: "A" }),
  motivation: "best",
  greens: Object.freeze({ spd60: 0, spd40: 0, sta60: 0, sta40: 0 }),
  recovery: Object.freeze(RECOVERY_BUCKETS.map(() => 0)),
  hpLoss: Object.freeze(HP_LOSS_BUCKETS.map(() => 0)),
  toggles: Object.freeze({ dueling: false, spotStruggle: false, kakari: false }),
  groundCondition: 1,
}) as StaminaInput;

const isRecord = (v: unknown): v is Record<string, unknown> => v != null && typeof v === "object" && !Array.isArray(v);
const intIn = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const pick = <T>(v: unknown, valid: readonly T[], fallback: T): T => (valid.includes(v as T) ? (v as T) : fallback);
const count = (v: unknown, fallback: number) => (intIn(v, 0, MAX_SKILL_COUNT) ? v : fallback);

/** A fresh, mutable copy of the defaults. */
export function defaultStaminaInput(): StaminaInput {
  const d = DEFAULT_STAMINA_INPUT;
  return { ...d, stats: { ...d.stats }, aptitude: { ...d.aptitude }, greens: { ...d.greens }, recovery: [...d.recovery], hpLoss: [...d.hpLoss], toggles: { ...d.toggles } };
}

/** Validates every field; anything missing or out of range falls back to its default on its own. */
export function normalizeStaminaInput(raw: unknown): StaminaInput {
  const d = defaultStaminaInput();
  if (!isRecord(raw)) return d;
  const stats = isRecord(raw.stats) ? raw.stats : {};
  const apt = isRecord(raw.aptitude) ? raw.aptitude : {};
  const greens = isRecord(raw.greens) ? raw.greens : {};
  const toggles = isRecord(raw.toggles) ? raw.toggles : {};
  const counts = (v: unknown, fallback: number[]) => (Array.isArray(v) && v.length === fallback.length ? fallback.map((f, i) => count(v[i], f)) : fallback);
  const flag = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
  return {
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, intIn(stats[k], 1, STAT_CAP) ? stats[k] : d.stats[k]])) as StatBlock,
    style: pick(raw.style, STYLES, d.style),
    aptitude: { ground: pick(apt.ground, PROFICIENCIES, d.aptitude.ground), distance: pick(apt.distance, PROFICIENCIES, d.aptitude.distance), style: pick(apt.style, PROFICIENCIES, d.aptitude.style) },
    motivation: pick(raw.motivation, MOTIVATIONS, d.motivation),
    greens: Object.fromEntries(GREEN_KEYS.map((k) => [k, count(greens[k], d.greens[k])])) as StaminaInput["greens"],
    recovery: counts(raw.recovery, d.recovery),
    hpLoss: counts(raw.hpLoss, d.hpLoss),
    toggles: { dueling: flag(toggles.dueling, d.toggles.dueling), spotStruggle: flag(toggles.spotStruggle, d.toggles.spotStruggle), kakari: flag(toggles.kakari, d.toggles.kakari) },
    groundCondition: pick(raw.groundCondition, GROUNDS, d.groundCondition),
  };
}

export function loadStaminaPrefs(): StaminaInput {
  return normalizeStaminaInput(readJsonStorage<unknown>(STAMINA_PREFS_KEY));
}

export function saveStaminaPrefs(v: StaminaInput): void {
  writeJsonStorage(STAMINA_PREFS_KEY, v);
}
