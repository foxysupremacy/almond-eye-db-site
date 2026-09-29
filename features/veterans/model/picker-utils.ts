import type { LegacyCandidate, LegacyUniqueEval } from "@/lib/parenting/types";

export type VeteranPickerSort = "affinity" | "rank_score" | "blue_stars" | "skill_effect" | "unique_tier";

export interface WhiteUniqueInfo {
  skillId: number;
  nameEn: string;
  nameJp: string;
  rarity?: number;
  iconId: number | null;
}

const TIER_ORDER: Record<string, number> = {
  "S+": 0,
  S: 1,
  A: 2,
  B: 3,
  C: 4,
  D: 5,
  F: 6,
};

/** Prioritize unique skills that can activate on the selected course/style. */
export function uniqueFireState(uniqueEval?: LegacyUniqueEval): number {
  if (!uniqueEval) return 1;
  return uniqueEval.tier === "F" ? 0 : 2;
}

/** Stable candidate ordering shared by the recommendation and owned tabs. */
export function sortRecommended(
  candidates: LegacyCandidate[],
  mode: VeteranPickerSort,
): LegacyCandidate[] {
  const fire = (candidate: LegacyCandidate) => -uniqueFireState(candidate.uniqueEval);
  if (mode === "affinity") {
    return [...candidates].sort((a, b) => fire(a) - fire(b) || b.totalScore - a.totalScore);
  }

  const sorted = [...candidates];
  if (mode === "skill_effect") {
    sorted.sort(
      (a, b) =>
        fire(a) - fire(b) ||
        (b.uniqueEval?.score ?? -1) - (a.uniqueEval?.score ?? -1) ||
        b.totalScore - a.totalScore,
    );
  } else if (mode === "unique_tier") {
    sorted.sort(
      (a, b) =>
        fire(a) - fire(b) ||
        (TIER_ORDER[a.uniqueEval?.tier ?? "F"] ?? 9) -
          (TIER_ORDER[b.uniqueEval?.tier ?? "F"] ?? 9) ||
        b.totalScore - a.totalScore,
    );
  }
  return sorted;
}

export function compareUniqueTier(a?: LegacyUniqueEval, b?: LegacyUniqueEval): number {
  return (TIER_ORDER[a?.tier ?? "F"] ?? 9) - (TIER_ORDER[b?.tier ?? "F"] ?? 9);
}
