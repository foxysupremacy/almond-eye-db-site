// Parent factor matcher & classification engine.
// Evaluates Hall of Fame veterans against active Parent Deck skills to detect
// matching inheritance sparks across a 3-generation bloodline.

import type { KyumaruVeteranItem, KyumaruFactorInfo } from "./kyumaru-types";
import type { ParentDeckSkill } from "./deck/types";
import type { Course, RaceParameters } from "./skill-engine/types";
import type { RunningStyle } from "./deck/types";
import { evaluateSkillActivation } from "./parenting/skill-evaluator";
import { decodeFactor } from "./factor-decoder";
import { getInheritableSkillForGold, getInheritableSkillForUnique } from "./skill-rarity";
import { readJsonStorage, writeJsonStorage } from "./persistence";

export const PARENT_OVERRIDES_STORAGE_KEY = "almondeye_parent_manual_overrides";

/**
 * Checks whether an Uma's rank falls in the default Parent qualification range (UF to UC9).
 * Rank ID 29 (UF) to 68 (UC9), or score 23,900 to 47,599.
 */
export function isRankInParentRange(rank?: number, score?: number): boolean {
  if (typeof rank === "number" && rank > 0) {
    return rank >= 29 && rank <= 68;
  }
  if (typeof score === "number" && score > 0) {
    return score >= 23900 && score <= 47599;
  }
  return false;
}

export function loadParentManualOverrides(): Record<string, boolean> {
  return readJsonStorage<Record<string, boolean>>(PARENT_OVERRIDES_STORAGE_KEY) || {};
}

export function saveParentManualOverrides(overrides: Record<string, boolean>): void {
  writeJsonStorage(PARENT_OVERRIDES_STORAGE_KEY, overrides);
}

export function getVeteranKey(vet: KyumaruVeteranItem): string {
  return String(vet.trained_chara_id || `${vet.card_id}-${vet.create_time || ""}`);
}

/**
 * Extracts active target skills from the parent deck that activate on the given course & style.
 */
export function extractActiveParentTargetSkills(
  parentSkills: ParentDeckSkill[],
  course: Course | null | undefined,
  runningStyle: RunningStyle | null | undefined,
  raceParams?: Partial<RaceParameters>
): Map<number, ParentDeckSkill> {
  const activeMap = new Map<number, ParentDeckSkill>();
  if (!parentSkills || parentSkills.length === 0) return activeMap;

  for (const s of parentSkills) {
    const act = evaluateSkillActivation(s.id, course, runningStyle, raceParams);
    if (act.activates) {
      activeMap.set(s.id, s);
    }
  }

  return activeMap;
}

export interface FactorOccurrence {
  origin: "self" | "parent1" | "parent2";
  originLabel: string;
  stars: number;
}

export interface MatchedTargetFactorDetail {
  skillId: number;
  skillNameEn: string;
  skillNameJa: string;
  factorNameEn: string;
  factorNameJa: string;
  maxStars: number;
  occurrences: FactorOccurrence[];
}

export interface VeteranTargetFactorMatch {
  count: number;
  matchedSkills: MatchedTargetFactorDetail[];
}

/**
 * Scans a veteran's 3-generation lineage (self + parent 1 + parent 2)
 * for factors corresponding to active target skills.
 */
export function evaluateVeteranTargetFactors(
  veteran: {
    factor_info_array?: KyumaruFactorInfo[];
    succession_chara_array?: { position_id?: number; factor_info_array?: KyumaruFactorInfo[] }[];
  },
  activeTargetSkillMap: Map<number, ParentDeckSkill>
): VeteranTargetFactorMatch {
  if (!activeTargetSkillMap || activeTargetSkillMap.size === 0) {
    return { count: 0, matchedSkills: [] };
  }

  const matchedMap = new Map<number, MatchedTargetFactorDetail>();

  // Process a list of factors from a lineage participant
  const processFactors = (
    factors: KyumaruFactorInfo[] | undefined,
    origin: "self" | "parent1" | "parent2",
    originLabel: string
  ) => {
    if (!factors || factors.length === 0) return;

    for (const f of factors) {
      const decoded = decodeFactor(f.factor_id);
      const skillIds = decoded.skillIds || [];
      const stars = decoded.stars || Number(String(f.factor_id).slice(-1)) || 1;

      for (const sid of skillIds) {
        // Direct match with active target skill
        let targetSkill = activeTargetSkillMap.get(sid);

        // Try mapping gold to white
        if (!targetSkill) {
          const goldMapped = getInheritableSkillForGold(sid);
          if (goldMapped) {
            targetSkill = activeTargetSkillMap.get(goldMapped.whiteId);
          }
        }

        // Try mapping unique to white inherit
        if (!targetSkill) {
          const uniqueInheritId = getInheritableSkillForUnique(sid);
          if (uniqueInheritId) {
            targetSkill = activeTargetSkillMap.get(uniqueInheritId);
          }
        }

        if (targetSkill) {
          const key = targetSkill.id;
          const existing = matchedMap.get(key);

          const occurrence: FactorOccurrence = {
            origin,
            originLabel,
            stars,
          };

          if (!existing) {
            matchedMap.set(key, {
              skillId: targetSkill.id,
              skillNameEn: targetSkill.nameEn,
              skillNameJa: targetSkill.nameJp,
              factorNameEn: decoded.nameEn || decoded.name || targetSkill.nameEn,
              factorNameJa: decoded.nameJa || targetSkill.nameJp,
              maxStars: stars,
              occurrences: [occurrence],
            });
          } else {
            existing.occurrences.push(occurrence);
            if (stars > existing.maxStars) {
              existing.maxStars = stars;
            }
          }
        }
      }
    }
  };

  // 1. Self factors
  processFactors(veteran.factor_info_array, "self", "Self");

  // 2. Succession parents (position_id 10 = Parent 1, position_id 20 = Parent 2)
  for (const p of veteran.succession_chara_array || []) {
    if (p.position_id === 10) {
      processFactors(p.factor_info_array, "parent1", "Parent 1");
    } else if (p.position_id === 20) {
      processFactors(p.factor_info_array, "parent2", "Parent 2");
    }
  }

  const matchedSkills = Array.from(matchedMap.values()).sort(
    (a, b) => b.maxStars - a.maxStars || a.skillNameEn.localeCompare(b.skillNameEn)
  );

  return {
    count: matchedSkills.length,
    matchedSkills,
  };
}
