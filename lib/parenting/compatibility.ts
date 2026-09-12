// Branch Compatibility Recommender for AlmondEye DB.
// GameTora-style ranked candidates, computed per pedigree slot for the
// parent picker's "Recommended" tab:
// - Parent slots (P1/P2): ranked by affinity with the target trainee.
// - Grandparent slots: ranked by affinity with the trainee + affinity with
//   that branch's parent ("with P1" / "with P2").
// Each slot returns two pools: "owned" (imported HoF veterans + untrained
// roster picks scored as potential veterans) and "borrow" (character templates
// for the run's single friend-borrow slot, which should be maximized).
// Candidates whose inheritable unique evaluates as F-tier for the selected
// track/style (dead accel, style/position mismatch) are filtered out.
// Zero-server, 100% client-side.

import type { CharacterIndexEntry } from "../api";
import rawCharactersData from "../data/characters.json";
import { getCharacterImageUrl } from "../data-store";
import type { KyumaruVeteranItem } from "../kyumaru-types";
import type { Course } from "../skill-engine/types";
import type { RunningStyle } from "../../components/store";
import {
  calculateAffinity,
  calculatePairAffinity,
  getCharaIdFromCardId,
} from "../affinity-engine";
import { calculateLineageBlueStars, decodeFactor } from "../factor-decoder";
import { getDeckAnalysis } from "./deck-analyzer";
import { evaluateUniqueSkill, runningStyleToNum } from "./skill-evaluator";
import {
  getCareerCourseFit,
  getCareerG1Races,
  getCareerG1Saddles,
  getCareerMustWinSaddles,
} from "./career-engine";
import type { LegacyCandidate, LegacyUniqueEval } from "./types";

const charactersList = rawCharactersData as CharacterIndexEntry[];
const characterMap = new Map<number, CharacterIndexEntry>(charactersList.map((c) => [c.id, c]));
const characterByCharIdMap = new Map<number, CharacterIndexEntry>(
  charactersList.map((c) => [c.charId, c])
);
const variantsByCharIdMap = new Map<number, CharacterIndexEntry[]>();
for (const c of charactersList) {
  const list = variantsByCharIdMap.get(c.charId) ?? [];
  list.push(c);
  variantsByCharIdMap.set(c.charId, list);
}

/** Avatar image URL for a character */
export function getCharacterAvatarUrl(charId: number, cardId: number): string {
  return getCharacterImageUrl(charId, cardId, "01");
}

/**
 * Synthesize the veteran stub used when assigning a character template to a
 * slot. Untrained picks are filled with their full career G1 saddle set (the
 * wins the user plans to take); friend-borrow stubs with the must-win subset
 * (a borrowed Uma has those wins by definition).
 */
export function candidateToVeteran(candidate: LegacyCandidate): KyumaruVeteranItem {
  if (candidate.veteran) return candidate.veteran;
  const winSaddles = candidate.isUntrained
    ? getCareerG1Saddles(candidate.charId)
    : getCareerMustWinSaddles(candidate.charId);
  return {
    card_id: candidate.cardId,
    name: candidate.nameEn,
    win_saddle_id_array: winSaddles,
    trained_chara_id: candidate.cardId,
  } as unknown as KyumaruVeteranItem;
}

export type SlotKind = "parent" | "grandparent";

export interface SlotRecommendationOptions {
  targetCharaId: number | null;
  /** For grandparent slots: the branch parent to score against ("with P1"). */
  branchParent?: KyumaruVeteranItem | null;
  /** Extra charIds to exclude (other parent, sibling GP, …). */
  excludedCharIds?: number[];
  course?: Course | null | undefined;
  runningStyle?: RunningStyle | number | null | undefined;
  veterans?: KyumaruVeteranItem[];
  supportCardIds?: (number | null)[];
  limit?: number;
}

export interface SlotRecommendations {
  /**
   * Owned candidates: imported Hall of Fame veterans (real factors / G1 wins)
   * plus untrained roster picks scored as potential veterans.
   */
  owned: LegacyCandidate[];
  /** Character templates — candidates for the run's single friend-borrow slot. */
  borrow: LegacyCandidate[];
}

interface PoolEntry {
  charId: number;
  cardId: number;
  vet?: KyumaruVeteranItem;
  allRuns?: KyumaruVeteranItem[];
  /** Roster pick with no imported run — scored via its career G1 schedule. */
  isUntrained?: boolean;
}

function evaluateUnique(
  cardId: number,
  course: Course | null | undefined,
  runningStyle: RunningStyle | number | null | undefined
): LegacyUniqueEval | undefined {
  if (!course) return undefined;
  const chara =
    characterMap.get(cardId) || characterByCharIdMap.get(getCharaIdFromCardId(cardId));
  const evalResult = evaluateUniqueSkill(
    chara?.uniqueSkillId ?? undefined,
    course,
    runningStyleToNum(runningStyle)
  );
  return {
    skillName: evalResult.skillName,
    category: evalResult.category,
    tier: evalResult.tier,
    badge: evalResult.badge,
    badgeClass: evalResult.badgeClass,
    explanation: evalResult.explanation,
  };
}

function isUniqueFiltered(uniqueEval: LegacyUniqueEval | undefined): boolean {
  if (!uniqueEval) return false;
  return (
    uniqueEval.tier === "F" ||
    uniqueEval.category === "dead_accel" ||
    uniqueEval.category === "invalid" ||
    uniqueEval.category === "style_invalid" ||
    uniqueEval.category === "rank_invalid"
  );
}

// CharacterIndexEntry.aptitude indexes: 0 Turf, 1 Dirt, 2 Short, 3 Mile,
// 4 Medium, 5 Long, 6 Front, 7 Pace, 8 Late, 9 End.
const STYLE_APTITUDE_INDEX: Record<number, number> = { 1: 6, 2: 7, 3: 8, 4: 9 };

function distanceAptitudeIndex(course: Course): number {
  const bucket = course.distance || (course.length <= 1200 ? 1 : course.length <= 1800 ? 2 : course.length <= 2400 ? 3 : 4);
  return bucket === 1 ? 2 : bucket === 2 ? 3 : bucket === 3 ? 4 : 5;
}

/**
 * Hard gate for untrained picks: exclude characters that cannot realistically
 * win the selected course — G distance aptitude is beyond the standard pink
 * patch limit (see evaluateAptitudePatch), and a G style aptitude cannot run
 * the selected style at all.
 */
export function isAptitudeExcluded(
  chara: CharacterIndexEntry,
  course: Course | null | undefined,
  runningStyle: RunningStyle | number | null | undefined
): boolean {
  if (!course) return false;
  const apt = chara.aptitude || [];
  if (apt[course.terrain === 2 ? 1 : 0] === "G") return true;
  if (apt[distanceAptitudeIndex(course)] === "G") return true;
  const styleNum = runningStyleToNum(runningStyle);
  if (styleNum && STYLE_APTITUDE_INDEX[styleNum] != null && apt[STYLE_APTITUDE_INDEX[styleNum]] === "G") {
    return true;
  }
  return false;
}

function buildCandidate(
  entry: PoolEntry,
  targetCharaId: number,
  branchParent: KyumaruVeteranItem | null,
  course: Course | null | undefined,
  runningStyle: RunningStyle | number | null | undefined
): LegacyCandidate | null {
  const chara = characterMap.get(entry.cardId) || characterByCharIdMap.get(entry.charId);
  if (!chara) return null;

  const uniqueEval = evaluateUnique(entry.cardId, course, runningStyle);
  if (isUniqueFiltered(uniqueEval)) return null;

  // Untrained picks are gated: they cannot be trained to win the course.
  if (entry.isUntrained && isAptitudeExcluded(chara, course, runningStyle)) return null;

  // Templates are scored as potential veterans: career G1 objectives become
  // their win set (all G1s for untrained picks the user will optimize, must-win
  // G1s for friend borrows whose Uma has those wins by definition). This lets
  // the standard affinity G1-bonus math apply unchanged.
  const potentialSaddles = entry.isUntrained
    ? getCareerG1Saddles(entry.charId)
    : getCareerMustWinSaddles(entry.charId);
  const vetForScoring = entry.vet ?? {
    card_id: entry.cardId,
    win_saddle_id_array: potentialSaddles,
  };

  const affBreakdown = calculateAffinity(vetForScoring, targetCharaId);
  const affinityScore = affBreakdown.total;

  let pairScore: number | undefined;
  let sharedG1WithBranch = 0;
  if (branchParent) {
    const pair = calculatePairAffinity(vetForScoring, branchParent);
    pairScore = pair.total;
    sharedG1WithBranch = pair.sharedG1Count;
  }

  const totalScore = affinityScore + (pairScore ?? 0);
  // Templates with no relation data and no schedule overlap contribute nothing.
  if (!entry.vet && totalScore <= 0) return null;

  const reasons: string[] = [];
  if (entry.vet) {
    if (affBreakdown.base > 0) reasons.push(`+${affBreakdown.base} Affinity`);
    if (affBreakdown.raceBonus > 0) reasons.push(`+${affBreakdown.raceBonus} G1 Lineage`);
    if (sharedG1WithBranch > 0) reasons.push(`${sharedG1WithBranch} Shared G1s`);
    if ((entry.allRuns?.length ?? 0) > 1) reasons.push(`${entry.allRuns!.length} Runs in HoF`);
  } else {
    if (affBreakdown.base > 0) reasons.push(`+${affBreakdown.base} Affinity`);
    if (sharedG1WithBranch > 0) reasons.push(`${sharedG1WithBranch} Shared G1s w/ Branch`);
    else if (pairScore !== undefined && pairScore > 0) reasons.push(`+${pairScore} With Branch Parent`);
    const courseFit = course ? getCareerCourseFit(entry.charId, course) : [];
    if (courseFit.length > 0) reasons.push(`Career G1: ${courseFit[0].nameEn}`);
    if (entry.isUntrained) reasons.push(`${getCareerG1Races(entry.charId).length} Career G1s`);
  }

  const lineage = entry.vet ? calculateLineageBlueStars(entry.vet) : null;
  const selfFactors = entry.vet
    ? (entry.vet.factor_info_array || []).map((f) => decodeFactor(f.factor_id))
    : [];

  return {
    charId: entry.charId,
    cardId: entry.cardId,
    nameEn: chara.nameEn,
    nameJp: chara.nameJp,
    titleEn: chara.titleEn,
    avatarUrl: getCharacterAvatarUrl(entry.charId, entry.cardId),
    isVeteran: !!entry.vet,
    isUntrained: entry.isUntrained,
    careerG1Count: entry.vet ? undefined : potentialSaddles.length,
    veteran: entry.vet,
    allRuns: entry.allRuns,
    runCount: entry.allRuns?.length,
    blueStarsTotal: lineage?.total,
    selfBlueFactor: selfFactors.find((f) => f.type === "blue"),
    selfPinkFactor: selfFactors.find((f) => f.type === "pink"),
    affinityScore,
    pairScore,
    totalScore,
    uniqueEval,
    reasons,
  };
}

function sortCandidates(candidates: LegacyCandidate[]): LegacyCandidate[] {
  return candidates.sort(
    (a, b) => b.totalScore - a.totalScore || a.nameEn.localeCompare(b.nameEn)
  );
}

/**
 * Ranked candidates for one pedigree slot, split into owned (HoF veterans) and
 * borrow (character templates) pools.
 */
export function getSlotRecommendations(
  options: SlotRecommendationOptions
): SlotRecommendations {
  const {
    targetCharaId,
    branchParent = null,
    excludedCharIds = [],
    course,
    runningStyle,
    veterans = [],
    supportCardIds,
    limit = 20,
  } = options;
  if (!targetCharaId) return { owned: [], borrow: [] };

  const excluded = new Set<number>([targetCharaId, ...excludedCharIds]);
  if (branchParent) excluded.add(getCharaIdFromCardId(branchParent.card_id));
  // Deck collision: a character with an equipped support card cannot be trained as a parent.
  for (const cId of getDeckAnalysis(supportCardIds).equippedDeckCharIds) excluded.add(cId);

  // Owned pool: user veterans, best run per character.
  const ownedEntries = new Map<number, PoolEntry>();
  const veteransByCharId = new Map<number, KyumaruVeteranItem[]>();
  for (const vet of veterans) {
    const cId = getCharaIdFromCardId(vet.card_id);
    if (excluded.has(cId)) continue;
    const list = veteransByCharId.get(cId) ?? [];
    list.push(vet);
    veteransByCharId.set(cId, list);
  }
  for (const [cId, runs] of veteransByCharId.entries()) {
    const sorted = [...runs].sort((a, b) => {
      const aStars = calculateLineageBlueStars(a).total;
      const bStars = calculateLineageBlueStars(b).total;
      return bStars - aStars || (b.rank_score || 0) - (a.rank_score || 0);
    });
    ownedEntries.set(cId, {
      charId: cId,
      cardId: sorted[0].card_id,
      vet: sorted[0],
      allRuns: sorted,
    });
  }

  // Borrow pool + untrained picks: character templates not covered by a veteran.
  // Untrained picks surface under "Your Umas" for every slot (train-then-use);
  // the same characters stay listed as borrows, where a friend's trained version
  // (with real factors) is strictly better.
  const borrowEntries: PoolEntry[] = [];
  const untrainedEntries: PoolEntry[] = [];
  for (const [cId, variants] of variantsByCharIdMap.entries()) {
    if (excluded.has(cId) || ownedEntries.has(cId)) continue;
    borrowEntries.push({ charId: cId, cardId: variants[0].id });
    untrainedEntries.push({ charId: cId, cardId: variants[0].id, isUntrained: true });
  }

  const owned: LegacyCandidate[] = [];
  for (const entry of ownedEntries.values()) {
    const c = buildCandidate(entry, targetCharaId, branchParent, course, runningStyle);
    if (c) owned.push(c);
  }
  for (const entry of untrainedEntries) {
    const c = buildCandidate(entry, targetCharaId, branchParent, course, runningStyle);
    if (c) owned.push(c);
  }

  const borrow: LegacyCandidate[] = [];
  for (const entry of borrowEntries) {
    const c = buildCandidate(entry, targetCharaId, branchParent, course, runningStyle);
    if (c) borrow.push(c);
  }

  return {
    owned: sortCandidates(owned).slice(0, limit),
    borrow: sortCandidates(borrow).slice(0, limit),
  };
}
