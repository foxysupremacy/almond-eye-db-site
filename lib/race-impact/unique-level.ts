import { SKILL_LEVEL_COEF } from "./generated/skill-level-coef";

export const MAX_UNIQUE_LEVEL = 6;

/** Unique skills are rarity 3–5 (1★–3★ trainees); rarity 6 is an evolved skill. */
export function isUniqueSkill(skill: { rarity?: number }): boolean {
  const r = skill.rarity ?? 0;
  return r >= 3 && r <= 5;
}

/**
 * Effect-value multiplier of a unique skill at `level` for one effect's ability type, from master.mdb
 * `skill_level_value` (default level usage, which every unique uses). Lv1 is 1.0 for every type; unknown
 * types fall back to 1.0. Durations are not scaled.
 */
export function uniqueLevelMultiplier(level: number, abilityType: number): number {
  if (!Number.isFinite(level)) return 1;
  const l = Math.min(MAX_UNIQUE_LEVEL, Math.max(1, Math.trunc(level)));
  const coef = SKILL_LEVEL_COEF[abilityType]?.[l - 1];
  return coef == null ? 1 : coef / 10_000;
}
