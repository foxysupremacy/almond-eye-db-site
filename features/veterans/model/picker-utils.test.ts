import { describe, expect, test } from "bun:test";
import type { LegacyCandidate } from "@/lib/parenting/types";
import { sortRecommended, uniqueFireState, type VeteranPickerSort } from "./picker-utils";

function candidate(cardId: number, totalScore: number, tier?: string, score = 0): LegacyCandidate {
  return {
    charId: cardId,
    cardId,
    nameEn: `Uma ${cardId}`,
    nameJp: "",
    avatarUrl: "",
    isVeteran: false,
    affinityScore: totalScore,
    totalScore,
    uniqueEval: tier ? ({ tier, score } as NonNullable<LegacyCandidate["uniqueEval"]>) : undefined,
    reasons: [],
  };
}

describe("veteran picker candidate ordering", () => {
  const rows = [candidate(1, 100, "F"), candidate(2, 10, "A"), candidate(3, 50)];

  test("Minmax order survives the picker while manual affinity and blue sorting stay available", () => {
    const clean = { ...candidate(1, 10, "A"), blueStarsTotal: 1, minmax: { aptitudeGaps: 0, actualJunk: 0, guaranteed: 0, frequent: 0, unknown: 0, g1: 1 } };
    const dirty = { ...candidate(2, 100, "S"), blueStarsTotal: 18, minmax: { ...clean.minmax, actualJunk: 1, g1: 50 } };
    const input = [dirty, clean];
    expect(sortRecommended(input, "minmax")).toEqual([clean, dirty]);
    expect(sortRecommended(input, "affinity")).toEqual([dirty, clean]);
    expect(sortRecommended(input, "blue_stars")).toEqual([dirty, clean]);
    expect(input).toEqual([dirty, clean]);
  });

  test("prioritizes fireable uniques, then affinity", () => {
    expect(sortRecommended(rows, "affinity").map((row) => row.cardId)).toEqual([2, 3, 1]);
  });

  test("uses unique tier or skill score after activation state", () => {
    const byTier = sortRecommended([candidate(1, 40, "B"), candidate(2, 10, "S")], "unique_tier");
    const byEffect = sortRecommended([candidate(1, 40, "A", 1), candidate(2, 10, "A", 8)], "skill_effect");
    expect(byTier.map((row) => row.cardId)).toEqual([2, 1]);
    expect(byEffect.map((row) => row.cardId)).toEqual([2, 1]);
  });

  test("does not mutate the source array", () => {
    const source = [...rows];
    sortRecommended(source, "affinity" satisfies VeteranPickerSort);
    expect(source.map((row) => row.cardId)).toEqual([1, 2, 3]);
  });

  test("classifies missing and unactivatable uniques", () => {
    expect(uniqueFireState()).toBe(1);
    expect(uniqueFireState({ tier: "F" } as NonNullable<LegacyCandidate["uniqueEval"]>)).toBe(0);
  });
});
