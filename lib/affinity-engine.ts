// Compatibility & Affinity Calculation Engine for AlmondEye DB
// Ported from Umamusume master data and hakuraku production affinity math.
// Zero-server, 100% client-side.

import rawAffinityData from "./data/affinity.json";
import type { KyumaruVeteranItem } from "./kyumaru-types";

export interface AffinityDataPayload {
  relationPoints: Record<string, number>;
  charaRelationTypes: Record<string, number[]>;
  g1Saddles: number[];
  winSaddleToRaceInstance: Record<string, number>;
  factorNames: Record<string, string>;
  saddleNames: Record<string, string>;
}

const affinityData = rawAffinityData as AffinityDataPayload;

export const G1_RACE_AFFINITY_VALUE = 3;

// Cache Set of G1 saddle IDs for fast O(1) lookups
const g1SaddleSet = new Set<number>(affinityData.g1Saddles);

// Cache Chara Relation Sets for fast O(1) lookups
const charaRelationSetCache = new Map<number, Set<number>>();
for (const [charaIdStr, types] of Object.entries(affinityData.charaRelationTypes)) {
  charaRelationSetCache.set(Number(charaIdStr), new Set(types));
}

/** Extract base character ID from card_id (e.g. 100101 -> 1001) */
export function getCharaIdFromCardId(cardId: number): number {
  return Math.floor(cardId / 100);
}

/** Get Set of relation type IDs for a base character ID */
export function getRelationTypesForChara(charaId: number): Set<number> {
  return charaRelationSetCache.get(charaId) || new Set<number>();
}

/** Sum shared relation points between 2 or 3 sets of relation types */
export function sumSharedRelationPoints(
  setA: Set<number>,
  setB: Set<number>,
  setC?: Set<number>
): number {
  let total = 0;
  for (const rt of setA) {
    if (setB.has(rt) && (setC === undefined || setC.has(rt))) {
      total += affinityData.relationPoints[rt] || 0;
    }
  }
  return total;
}

/** Count shared G1 race wins between two horses */
export function countSharedG1Wins(
  winsA?: number[],
  winsB?: number[]
): number {
  if (!winsA || !winsB || winsA.length === 0 || winsB.length === 0) return 0;
  const setB = new Set(winsB);
  let shared = 0;
  for (const saddleId of new Set(winsA)) {
    if (g1SaddleSet.has(saddleId) && setB.has(saddleId)) {
      shared++;
    }
  }
  return shared;
}

/** Calculate shared G1 race affinity bonus between two horses */
export function calculateSharedG1RaceAffinity(
  winsA?: number[],
  winsB?: number[]
): number {
  return countSharedG1Wins(winsA, winsB) * G1_RACE_AFFINITY_VALUE;
}

export interface RaceBonusEntry {
  saddleId: number;
  name: string;
  bonus: number;
}

export interface RaceBonusResult {
  entries: RaceBonusEntry[];
  total: number;
}

export interface MinimalGrandparent {
  card_id: number;
  win_saddle_id_array?: number[];
  position_id?: number;
}

/** Calculate internal G1 race win bonus of a veteran with its own grandparents */
export function calculateRaceBonus(
  veteran: {
    win_saddle_id_array?: number[];
    succession_chara_array?: Array<{ position_id: number; win_saddle_id_array?: number[] }>;
  },
  customGrandparents?: { gp1?: MinimalGrandparent | null; gp2?: MinimalGrandparent | null }
): RaceBonusResult {
  const gp1FromVet = veteran.succession_chara_array?.find((p) => p.position_id === 10);
  const gp2FromVet = veteran.succession_chara_array?.find((p) => p.position_id === 20);

  const gp1Wins = new Set(customGrandparents?.gp1?.win_saddle_id_array ?? gp1FromVet?.win_saddle_id_array ?? []);
  const gp2Wins = new Set(customGrandparents?.gp2?.win_saddle_id_array ?? gp2FromVet?.win_saddle_id_array ?? []);

  const entries: RaceBonusEntry[] = (veteran.win_saddle_id_array ?? []).map((saddleId) => {
    const isG1 = g1SaddleSet.has(saddleId);
    const bonus = isG1
      ? ((gp1Wins.has(saddleId) ? 1 : 0) + (gp2Wins.has(saddleId) ? 1 : 0)) * G1_RACE_AFFINITY_VALUE
      : 0;
    const name = affinityData.saddleNames[saddleId] || `Race ${saddleId}`;
    return { saddleId, name, bonus };
  });

  const total = entries.reduce((acc, curr) => acc + curr.bonus, 0);
  return { entries, total };
}

export interface AffinityCalculationResult {
  total: number;
  base: number;
  raceBonus: number;
  gp1Points: number;
  gp2Points: number;
  parentPoints: number;
}

/** Calculate compatibility affinity between a single parent branch and target trainee */
export function calculateAffinity(
  veteran: {
    card_id: number;
    win_saddle_id_array?: number[];
    succession_chara_array?: Array<{ position_id: number; card_id: number; win_saddle_id_array?: number[] }>;
  },
  targetCharaId: number,
  customGrandparents?: { gp1?: MinimalGrandparent | null; gp2?: MinimalGrandparent | null }
): AffinityCalculationResult {
  const veteranCharaId = getCharaIdFromCardId(veteran.card_id);
  const targetRelations = getRelationTypesForChara(targetCharaId);
  const veteranRelations = getRelationTypesForChara(veteranCharaId);

  // Grandparents
  const gp1Item = customGrandparents?.gp1 ?? veteran.succession_chara_array?.find((p) => p.position_id === 10);
  const gp2Item = customGrandparents?.gp2 ?? veteran.succession_chara_array?.find((p) => p.position_id === 20);

  const gp1CharaId = gp1Item ? getCharaIdFromCardId(gp1Item.card_id) : null;
  const gp2CharaId = gp2Item ? getCharaIdFromCardId(gp2Item.card_id) : null;

  // In-game rule: if grandparent is the same character as the target trainee, it yields 0 relation points
  const gp1Relations = gp1CharaId && gp1CharaId !== targetCharaId
    ? getRelationTypesForChara(gp1CharaId)
    : new Set<number>();
  const gp2Relations = gp2CharaId && gp2CharaId !== targetCharaId
    ? getRelationTypesForChara(gp2CharaId)
    : new Set<number>();

  const parentPoints = sumSharedRelationPoints(targetRelations, veteranRelations);
  const gp1Points = sumSharedRelationPoints(targetRelations, veteranRelations, gp1Relations);
  const gp2Points = sumSharedRelationPoints(targetRelations, veteranRelations, gp2Relations);
  const base = parentPoints + gp1Points + gp2Points;

  const raceBonus = calculateRaceBonus(veteran, customGrandparents).total;

  return {
    total: base + raceBonus,
    base,
    raceBonus,
    gp1Points,
    gp2Points,
    parentPoints,
  };
}

export interface PairAffinityResult {
  total: number;
  base: number;
  raceBonus: number;
  sharedG1Count: number;
}

/** Calculate pair affinity between Parent 1 and Parent 2 */
export function calculatePairAffinity(
  parent1: { card_id: number; win_saddle_id_array?: number[] },
  parent2: { card_id: number; win_saddle_id_array?: number[] }
): PairAffinityResult {
  const id1 = getCharaIdFromCardId(parent1.card_id);
  const id2 = getCharaIdFromCardId(parent2.card_id);

  const rel1 = getRelationTypesForChara(id1);
  const rel2 = getRelationTypesForChara(id2);

  const base = sumSharedRelationPoints(rel1, rel2);
  const sharedG1Count = countSharedG1Wins(parent1.win_saddle_id_array, parent2.win_saddle_id_array);
  const raceBonus = sharedG1Count * G1_RACE_AFFINITY_VALUE;

  return {
    total: base + raceBonus,
    base,
    raceBonus,
    sharedG1Count,
  };
}

export type CompatibilityRating = "double_circle" | "circle" | "triangle";

export interface CompatibilityMeta {
  rating: CompatibilityRating;
  symbol: string;
  label: string;
  badgeClass: string;
  textColor: string;
}

/** Determine the in-game compatibility icon and rating based on total score */
export function getCompatibilityRating(totalScore: number): CompatibilityMeta {
  if (totalScore >= 151) {
    return {
      rating: "double_circle",
      symbol: "◎",
      label: "Double Circle (High)",
      badgeClass: "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300",
      textColor: "text-amber-500",
    };
  }
  if (totalScore >= 51) {
    return {
      rating: "circle",
      symbol: "◯",
      label: "Circle (Normal)",
      badgeClass: "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
      textColor: "text-emerald-500",
    };
  }
  return {
    rating: "triangle",
    symbol: "△",
    label: "Triangle (Low)",
    badgeClass: "bg-zinc-500/15 border-zinc-500/30 text-zinc-600 dark:text-zinc-400",
    textColor: "text-zinc-400",
  };
}

export interface FullLineageAffinityBreakdown {
  targetCharaId: number | null;
  p1Affinity: AffinityCalculationResult | null;
  p2Affinity: AffinityCalculationResult | null;
  pairAffinity: PairAffinityResult | null;
  totalScore: number;
  rating: CompatibilityMeta;
}

/** Calculate the complete lineage compatibility tree */
export function calculateLineageAffinity(
  targetCharaId: number | null,
  parent1: KyumaruVeteranItem | MinimalGrandparent | null,
  parent2: KyumaruVeteranItem | MinimalGrandparent | null,
  p1Grandparents?: { gp1?: MinimalGrandparent | null; gp2?: MinimalGrandparent | null },
  p2Grandparents?: { gp1?: MinimalGrandparent | null; gp2?: MinimalGrandparent | null }
): FullLineageAffinityBreakdown {
  const p1Aff = targetCharaId && parent1
    ? calculateAffinity(parent1, targetCharaId, p1Grandparents)
    : null;

  const p2Aff = targetCharaId && parent2
    ? calculateAffinity(parent2, targetCharaId, p2Grandparents)
    : null;

  const pairAff = parent1 && parent2
    ? calculatePairAffinity(parent1, parent2)
    : null;

  const totalScore = (p1Aff?.total ?? 0) + (p2Aff?.total ?? 0) + (pairAff?.total ?? 0);
  const rating = getCompatibilityRating(totalScore);

  return {
    targetCharaId,
    p1Affinity: p1Aff,
    p2Affinity: p2Aff,
    pairAffinity: pairAff,
    totalScore,
    rating,
  };
}

/** Retrieve factor name from canonical factor text table */
export function getCanonicalFactorName(factorId: number): string | null {
  return affinityData.factorNames[factorId] || null;
}

/** Retrieve saddle / trophy name */
export function getCanonicalSaddleName(saddleId: number): string | null {
  return affinityData.saddleNames[saddleId] || null;
}
