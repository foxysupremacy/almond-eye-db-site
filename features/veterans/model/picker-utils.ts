import { compareMinmax } from "@/lib/parenting/minmax";
import type { LegacyCandidate, LegacyUniqueEval } from "@/lib/parenting/types";

export type VeteranPickerSort = "minmax" | "affinity" | "rank_score" | "blue_stars" | "skill_effect" | "unique_tier";

export interface WhiteUniqueInfo {
  skillId: number;
  nameEn: string;
  nameJp: string;
  rarity?: number;
  iconId: number | null;
}

const TIER_ORDER: Record<string, number> = {
  S: 0,
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  F: 5,
};

/** Prioritize unique skills that can activate on the selected course/style. */
export function uniqueFireState(uniqueEval?: LegacyUniqueEval): number {
  if (!uniqueEval) return 1;
  return uniqueEval.canonicalRating?.eligibility.state === "eligible" ? 2 : 0;
}

/** Stable candidate ordering shared by the recommendation and owned tabs. */
export function sortRecommended(
  candidates: LegacyCandidate[],
  mode: VeteranPickerSort,
): LegacyCandidate[] {
  if (mode === "minmax") return [...candidates].sort((a, b) => compareMinmax(a.minmax, b.minmax) || b.totalScore - a.totalScore || a.nameEn.localeCompare(b.nameEn));
  const fire = (candidate: LegacyCandidate) => -uniqueFireState(candidate.uniqueEval);
  if (mode === "affinity") {
    return [...candidates].sort((a, b) => fire(a) - fire(b) || b.totalScore - a.totalScore);
  }

  const sorted = [...candidates];
  if (mode === "rank_score") {
    sorted.sort((a, b) => (b.veteran?.rank_score ?? 0) - (a.veteran?.rank_score ?? 0) || b.totalScore - a.totalScore);
  } else if (mode === "blue_stars") {
    sorted.sort((a, b) => (b.blueStarsTotal ?? 0) - (a.blueStarsTotal ?? 0) || b.totalScore - a.totalScore);
  } else if (mode === "skill_effect") {
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
