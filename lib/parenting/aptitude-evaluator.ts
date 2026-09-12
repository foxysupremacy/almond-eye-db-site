import type { Course } from "../skill-engine/types";
import type { CharacterIndexEntry } from "../api";
import rawCharactersData from "../data/characters.json";
import { getCharaIdFromCardId } from "../affinity-engine";
import type { AptitudePatchInfo } from "./types";

const charactersList = rawCharactersData as CharacterIndexEntry[];
const characterMap = new Map<number, CharacterIndexEntry>(charactersList.map((c) => [c.id, c]));
const characterByCharIdMap = new Map<number, CharacterIndexEntry>(charactersList.map((c) => [c.charId, c]));

export const APTITUDE_RANK_VALUE: Record<string, number> = {
  G: 1,
  F: 2,
  E: 3,
  D: 4,
  C: 5,
  B: 6,
  A: 7,
  S: 8,
};

/**
 * Evaluates whether an Uma requires pink factor modifications to reach A-rank
 * in the course's distance/surface for G1 circuit farming (e.g. Nishino Flower Medium E -> A).
 */
export function evaluateAptitudePatch(
  cardOrCharId: number,
  course: Course | null | undefined
): AptitudePatchInfo {
  if (!course) {
    return {
      requiresPatch: false,
      canPatch: true,
      targetCategory: "",
      currentRank: "A",
      missingRanks: 0,
      requiredPinkStars: 0,
    };
  }

  const charId = cardOrCharId > 10000 ? getCharaIdFromCardId(cardOrCharId) : cardOrCharId;
  const chara = characterMap.get(cardOrCharId) || characterByCharIdMap.get(charId);
  const aptList = chara?.aptitude || [];

  // Surface: index 0 (Turf) if terrain === 1, index 1 (Dirt) if terrain === 2
  const surfIdx = course.terrain === 2 ? 1 : 0;
  const surfName = course.terrain === 2 ? "Dirt" : "Turf";
  const surfRank = aptList[surfIdx] || "A";

  // Distance: index 2 (Short <=1200), index 3 (Mile 1300-1800), index 4 (Medium 1900-2400), index 5 (Long >=2500)
  let distIdx = 4;
  let distName = "Medium";
  const distBucket = course.distance ?? (
    course.length <= 1200 ? 1 :
    course.length <= 1800 ? 2 :
    course.length <= 2400 ? 3 : 4
  );
  if (distBucket === 1) {
    distIdx = 2;
    distName = "Short";
  } else if (distBucket === 2) {
    distIdx = 3;
    distName = "Mile";
  } else if (distBucket === 3) {
    distIdx = 4;
    distName = "Medium";
  } else {
    distIdx = 5;
    distName = "Long";
  }
  const distRank = aptList[distIdx] || "A";

  const targetRankVal = 7; // Rank 'A'
  const surfVal = APTITUDE_RANK_VALUE[surfRank] ?? 7;
  const distVal = APTITUDE_RANK_VALUE[distRank] ?? 7;

  const surfDiff = Math.max(0, targetRankVal - surfVal);
  const distDiff = Math.max(0, targetRankVal - distVal);

  // Medium G1 circuit farming check: in Umamusume parenting, Turf parent runs rely on Medium G1s
  // (Classic/Senior Triple Crown, Tiara, Grand Prix) to maximize race bonus affinity.
  const medRank = aptList[4] || "A";
  const medVal = APTITUDE_RANK_VALUE[medRank] ?? 7;
  const medDiff = course.terrain !== 2 ? Math.max(0, targetRankVal - medVal) : 0;

  if (surfDiff === 0 && distDiff === 0 && medDiff === 0) {
    return {
      requiresPatch: false,
      canPatch: true,
      targetCategory: distName,
      currentRank: "A",
      missingRanks: 0,
      requiredPinkStars: 0,
    };
  }

  // Determine primary missing aptitude (course distance/surface has higher priority than Medium G1 farming)
  const primaryDiff = distDiff > 0 ? distDiff : surfDiff > 0 ? surfDiff : medDiff;
  const primaryCat = distDiff > 0 ? distName : surfDiff > 0 ? surfName : "Medium";
  const primaryRank = distDiff > 0 ? distRank : surfDiff > 0 ? surfRank : medRank;

  let requiredPinkStars = 0;
  if (primaryDiff === 1) requiredPinkStars = 1;
  else if (primaryDiff === 2) requiredPinkStars = 4;
  else if (primaryDiff === 3) requiredPinkStars = 7;
  else if (primaryDiff === 4) requiredPinkStars = 10;
  else requiredPinkStars = 10 + (primaryDiff - 4) * 3;

  const canPatch = primaryDiff <= 4;
  const warningMessage = canPatch
    ? `⚠️ Requires ${primaryCat} +${primaryDiff} Ranks (${requiredPinkStars}★ Pink) to farm G1s`
    : `❌ Requires ${primaryCat} +${primaryDiff} Ranks (${requiredPinkStars}★ Pink) - Exceeds standard breeding limit`;

  return {
    requiresPatch: true,
    canPatch,
    targetCategory: primaryCat,
    currentRank: primaryRank,
    missingRanks: primaryDiff,
    requiredPinkStars,
    warningMessage,
  };
}
