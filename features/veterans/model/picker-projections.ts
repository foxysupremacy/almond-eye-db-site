import type { CharacterIndexEntry } from "@/lib/api";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";
import type { LegacyUniqueEval } from "@/lib/parenting/types";
import type { WhiteUniqueInfo, VeteranPickerSort } from "./picker-utils";
import { compareUniqueTier, uniqueFireState } from "./picker-utils";

export type OwnedUmas = Record<string, [number, number]>;

export interface OwnedUmaEntry {
  chara: CharacterIndexEntry;
  ownedRarity: number;
  ownedTalent: number;
  hasHofRuns: boolean;
  affBase: number;
  affTotal: number;
  sharedG1WithParent: number;
  sharedG1WithTrainee: number;
  careerG1Count: number;
  whiteUnique: WhiteUniqueInfo | null;
  uniqueEval?: LegacyUniqueEval;
}

export interface VeteranGroup {
  charId: number;
  cardId: number;
  nameEn: string;
  nameJp: string;
  titleEn?: string;
  avatarUrl: string;
  bestVet: KyumaruVeteranItem;
  runs: KyumaruVeteranItem[];
  runCount: number;
  maxBlueStars: number;
  bestRankScore: number;
  affinity: number | null;
  whiteUnique: WhiteUniqueInfo | null;
  uniqueEval?: LegacyUniqueEval;
}

export interface PickerProjectionDependencies {
  getCharaIdFromCardId(cardId: number): number;
  getCareerG1Saddles(charId: number): number[];
  calculateAffinity(
    veteran: Pick<KyumaruVeteranItem, "card_id" | "win_saddle_id_array">,
    targetCharaId: number,
  ): { base: number; total: number };
  countSharedG1Wins(winsA?: number[], winsB?: number[]): number;
  calculateBlueStars(veteran: KyumaruVeteranItem): number;
  getCharacterImageUrl(charId: number, cardId: number): string;
  resolveWhiteUnique(cardId: number): WhiteUniqueInfo | null;
}

export function projectOwnedUmaEntries(input: {
  ownedUmas: OwnedUmas;
  charactersByCardId: Map<number, CharacterIndexEntry>;
  veterans: KyumaruVeteranItem[];
  targetCharaId: number | null;
  excludedCharId?: number | null;
  contextParent?: KyumaruVeteranItem | null;
  search: string;
  sortBy: VeteranPickerSort;
  uniqueEvalByCardId: Map<number, LegacyUniqueEval>;
  eligibleCardIds: ReadonlySet<number>;
  dependencies: PickerProjectionDependencies;
}): OwnedUmaEntry[] {
  const {
    ownedUmas,
    charactersByCardId,
    veterans,
    targetCharaId,
    excludedCharId,
    contextParent,
    search,
    sortBy,
    uniqueEvalByCardId,
    eligibleCardIds,
    dependencies,
  } = input;
  if (!targetCharaId) return [];

  const query = search.trim().toLowerCase();
  const excluded = new Set([targetCharaId, ...(excludedCharId ? [excludedCharId] : [])]);
  const hofCharIds = new Set(veterans.map((vet) => dependencies.getCharaIdFromCardId(vet.card_id)));
  const traineeCareerG1s = dependencies.getCareerG1Saddles(targetCharaId);
  const entries: OwnedUmaEntry[] = [];

  for (const [cardIdString, details] of Object.entries(ownedUmas)) {
    const chara = charactersByCardId.get(Number(cardIdString));
    if (!chara || !eligibleCardIds.has(chara.id) || excluded.has(chara.charId)) continue;
    const searchable = `${chara.nameEn || ""} ${chara.nameJp} ${chara.titleEn ?? ""}`.toLowerCase();
    if (query && !searchable.includes(query)) continue;

    const saddles = dependencies.getCareerG1Saddles(chara.charId);
    const affinity = dependencies.calculateAffinity(
      { card_id: chara.id, win_saddle_id_array: saddles },
      targetCharaId,
    );
    entries.push({
      chara,
      ownedRarity: details[0],
      ownedTalent: details[1],
      hasHofRuns: hofCharIds.has(chara.charId),
      affBase: affinity.base,
      affTotal: affinity.total,
      sharedG1WithParent: contextParent
        ? dependencies.countSharedG1Wins(saddles, contextParent.win_saddle_id_array)
        : 0,
      sharedG1WithTrainee: dependencies.countSharedG1Wins(saddles, traineeCareerG1s),
      careerG1Count: saddles.length,
      whiteUnique: dependencies.resolveWhiteUnique(chara.id),
      uniqueEval: uniqueEvalByCardId.get(chara.id),
    });
  }

  entries.sort((a, b) => {
    const fire = uniqueFireState(b.uniqueEval) - uniqueFireState(a.uniqueEval);
    if (fire) return fire;
    if (sortBy === "skill_effect") {
      return (b.uniqueEval?.score ?? -1) - (a.uniqueEval?.score ?? -1) || b.affTotal - a.affTotal;
    }
    if (sortBy === "unique_tier") {
      return compareUniqueTier(a.uniqueEval, b.uniqueEval) || b.affTotal - a.affTotal;
    }
    // Evaluation score and blue-star sorting have no owned-uma metric; preserve
    // the existing affinity fallback and alphabetical tie-break.
    return b.affTotal - a.affTotal || a.chara.nameEn.localeCompare(b.chara.nameEn);
  });
  return entries;
}

export function projectVeteranGroups(input: {
  veterans: KyumaruVeteranItem[];
  charactersByCardId: Map<number, CharacterIndexEntry>;
  targetCharaId: number | null;
  excludedCharId?: number | null;
  search: string;
  sortBy: VeteranPickerSort;
  uniqueEvalByCardId: Map<number, LegacyUniqueEval>;
  eligibleCardIds: ReadonlySet<number>;
  dependencies: PickerProjectionDependencies;
}): VeteranGroup[] {
  const { veterans, charactersByCardId, targetCharaId, excludedCharId, search, sortBy, uniqueEvalByCardId, eligibleCardIds, dependencies } = input;
  const query = search.trim().toLowerCase();
  const groupsByCharId = new Map<number, KyumaruVeteranItem[]>();

  for (const veteran of veterans) {
    if (!eligibleCardIds.has(veteran.card_id)) continue;
    const charId = dependencies.getCharaIdFromCardId(veteran.card_id);
    if ((targetCharaId && charId === targetCharaId) || (excludedCharId && charId === excludedCharId)) continue;
    const character = charactersByCardId.get(veteran.card_id);
    const searchable = `${character?.nameEn || veteran.name || ""} ${character?.nameJp || ""} ${character?.titleEn || ""}`.toLowerCase();
    if (query && !searchable.includes(query)) continue;
    const runs = groupsByCharId.get(charId) ?? [];
    runs.push(veteran);
    groupsByCharId.set(charId, runs);
  }

  const groups = Array.from(groupsByCharId, ([charId, sourceRuns]) => {
    const runs = [...sourceRuns].sort((a, b) =>
      dependencies.calculateBlueStars(b) - dependencies.calculateBlueStars(a) ||
      (b.rank_score || 0) - (a.rank_score || 0),
    );
    const bestVet = runs[0];
    const character = charactersByCardId.get(bestVet.card_id);
    const affinity = targetCharaId ? dependencies.calculateAffinity(bestVet, targetCharaId) : null;
    const uniqueEval = uniqueEvalByCardId.get(bestVet.card_id);
    return {
      charId,
      cardId: bestVet.card_id,
      nameEn: character?.nameEn || bestVet.name || `Chara ${charId}`,
      nameJp: character?.nameJp || "",
      titleEn: character?.titleEn || character?.titleJp,
      avatarUrl: dependencies.getCharacterImageUrl(charId, bestVet.card_id),
      bestVet,
      runs,
      runCount: runs.length,
      maxBlueStars: Math.max(...runs.map(dependencies.calculateBlueStars)),
      bestRankScore: Math.max(...runs.map((run) => run.rank_score || 0)),
      affinity: affinity?.total ?? null,
      whiteUnique: dependencies.resolveWhiteUnique(bestVet.card_id),
      uniqueEval,
    } satisfies VeteranGroup;
  });

  groups.sort((a, b) => {
    const fire = uniqueFireState(b.uniqueEval) - uniqueFireState(a.uniqueEval);
    if (fire) return fire;
    if (sortBy === "affinity" && targetCharaId) {
      return (b.affinity || 0) - (a.affinity || 0) || b.bestRankScore - a.bestRankScore;
    }
    if (sortBy === "blue_stars") return b.maxBlueStars - a.maxBlueStars || b.bestRankScore - a.bestRankScore;
    if (sortBy === "skill_effect") {
      return (b.uniqueEval?.score ?? -1) - (a.uniqueEval?.score ?? -1) || b.bestRankScore - a.bestRankScore;
    }
    if (sortBy === "unique_tier") return compareUniqueTier(a.uniqueEval, b.uniqueEval) || b.bestRankScore - a.bestRankScore;
    return b.bestRankScore - a.bestRankScore;
  });
  return groups;
}

export function projectCharacterTemplates(input: {
  characters: CharacterIndexEntry[];
  targetCharaId: number | null;
  excludedCharId?: number | null;
  search: string;
  sortBy: VeteranPickerSort;
  uniqueEvalByCardId: Map<number, LegacyUniqueEval>;
  eligibleCardIds: ReadonlySet<number>;
  calculateAffinity(cardId: number, targetCharaId: number): number;
}): CharacterIndexEntry[] {
  const { characters, targetCharaId, excludedCharId, search, sortBy, uniqueEvalByCardId, eligibleCardIds, calculateAffinity } = input;
  const query = search.trim().toLowerCase();
  const filtered = characters.filter((character) => {
    if (!eligibleCardIds.has(character.id)) return false;
    if ((targetCharaId && character.charId === targetCharaId) || (excludedCharId && character.charId === excludedCharId)) return false;
    const searchable = `${character.nameEn || ""} ${character.nameJp || ""} ${character.titleEn || ""}`.toLowerCase();
    return !query || searchable.includes(query);
  });
  // The prior picker kept source ordering when affinity was selected without a
  // target; preserve that fallback because affinity is disabled in the UI then.
  if (sortBy === "affinity" && !targetCharaId) return filtered;
  filtered.sort((a, b) => {
    const aEval = uniqueEvalByCardId.get(a.id);
    const bEval = uniqueEvalByCardId.get(b.id);
    const fire = uniqueFireState(bEval) - uniqueFireState(aEval);
    if (fire) return fire;
    if (sortBy === "affinity" && targetCharaId) {
      return calculateAffinity(b.id, targetCharaId) - calculateAffinity(a.id, targetCharaId);
    }
    if (sortBy === "skill_effect") {
      return (bEval?.score ?? -1) - (aEval?.score ?? -1) || (a.nameEn || "").localeCompare(b.nameEn || "");
    }
    if (sortBy === "unique_tier") {
      return compareUniqueTier(aEval, bEval) || (a.nameEn || "").localeCompare(b.nameEn || "");
    }
    // Templates have no score or blue-star metric; name is the stable fallback.
    return (a.nameEn || "").localeCompare(b.nameEn || "");
  });
  return filtered;
}
