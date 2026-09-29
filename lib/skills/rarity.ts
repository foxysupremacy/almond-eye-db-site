import { goldToWhiteMap, uniqueInheritMap } from "../data/registry";
import type { MappedGoldSkill } from "../data/types";

export type { MappedGoldSkill };

export type RarityFilterKey = "all" | "white" | "gold" | "unique" | "evolved";

export const GOLD_TO_WHITE_MAP = goldToWhiteMap;

/**
 * Determine the rarity category from raw rarity number (1..6).
 * 1: White
 * 2: Gold
 * 3, 4, 5: Unique (3: 1-2★, 4: Inherited, 5: 3★+ Unique)
 * 6: Evolved
 */
export function getRarityCategory(rarity?: number): "white" | "gold" | "unique" | "evolved" {
  if (!rarity || rarity === 1) return "white";
  if (rarity === 2) return "gold";
  if (rarity === 6) return "evolved";
  return "unique";
}

/**
 * Checks whether a skill's rarity matches the active filter tab.
 */
export function matchesRarityFilter(rarity: number | undefined, filter: RarityFilterKey): boolean {
  if (filter === "all") return true;
  return getRarityCategory(rarity) === filter;
}

/**
 * Look up the inheritable White skill mapping for a Gold skill.
 * Returns the mapped data if available, or null if the skill has no inheritable version.
 */
export function getInheritableSkillForGold(goldSkillId: number): MappedGoldSkill | null {
  return GOLD_TO_WHITE_MAP[String(goldSkillId)] ?? null;
}

/**
 * Unique skills downgrade to a white inherit version when passed down a
 * lineage tree — a separate skill id, not a rarity change. Mapping generated
 * from master.mdb (skill_data.unique_skill_id_1/2), see
 * scripts/generate_inherit_skills.py.
 */

/** Get the white inherit skill id for a unique skill, or null if unmapped. */
export function getInheritableSkillForUnique(uniqueSkillId: number): number | null {
  return uniqueInheritMap[String(uniqueSkillId)] ?? null;
}

/**
 * Evolved inherit skills (rarity 6) mapping for upgraded succession skills (継承進化).
 * In master.mdb: skill_upgrade_succession_skill
 * - 901351 (Stay Gold white inherit) -> 91101351 (evol inherit)
 * - 901411 (Epiphaneia white inherit) -> 91101411 (evol inherit)
 * - 911091 (Rhein Kraft white inherit) -> 92111091 (evol inherit)
 */
export const UNIQUE_TO_EVOL_INHERIT_MAP: Record<number, number> = {
  101351: 91101351, // Stay Gold (Unique -> Evol Inherit)
  101411: 91101411, // Epiphaneia (Unique -> Evol Inherit)
  111091: 92111091, // Rhein Kraft (Unique -> Evol Inherit)
};

export const WHITE_TO_EVOL_INHERIT_MAP: Record<number, number> = {
  901351: 91101351, // Stay Gold (White Inherit -> Evol Inherit)
  901411: 91101411, // Epiphaneia (White Inherit -> Evol Inherit)
  911091: 92111091, // Rhein Kraft (White Inherit -> Evol Inherit)
};

export const EVOL_TO_UNIQUE_MAP: Record<number, number> = {
  91101351: 101351,
  91101411: 101411,
  92111091: 111091,
};

/** Get the evolved inherit skill id for a unique skill, or null if unmapped. */
export function getEvolInheritableSkillForUnique(uniqueSkillId: number): number | null {
  return UNIQUE_TO_EVOL_INHERIT_MAP[uniqueSkillId] ?? null;
}

/** Get the evolved inherit skill id for a white inherit skill, or null if unmapped. */
export function getEvolInheritableSkillForWhite(whiteInheritId: number): number | null {
  return WHITE_TO_EVOL_INHERIT_MAP[whiteInheritId] ?? null;
}

/** Check if a skill id is an evolved inherit or has an evolved inherit version. */
export function hasEvolInheritSkill(skillId: number): boolean {
  return skillId in UNIQUE_TO_EVOL_INHERIT_MAP || skillId in WHITE_TO_EVOL_INHERIT_MAP || skillId in EVOL_TO_UNIQUE_MAP;
}
