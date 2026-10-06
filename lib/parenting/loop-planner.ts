import { evaluateParentingMinmax, compareMinmax, type MinmaxScore, type ParentingMinmaxAssessment } from "./minmax";
import type { CharacterIndexEntry } from "../data/types";
import type { CareerG1Race } from "./career-engine";
import { characters, careersByCharId, successionFactors, uniqueInheritMap } from "../data/registry";
import type { KyumaruVeteranItem } from "../veterans/types";
import { decodeFactor } from "../lineage/factor-decoder";
import { calculateLineageAffinity, getCharaIdFromCardId } from "../lineage/affinity-engine";
import { evaluateUniqueSkill, runningStyleToNum } from "./skill-evaluator";
import type { Course } from "../skill-engine/types";
import type { RunningStyle } from "../deck/types";
import { evaluateG1Calendar, type G1CalendarAssessment } from "./g1-calendar";

export const LOOP_ANCESTOR_SLOTS = [
  "p1", "p2", "p1_gp1", "p1_gp2", "p2_gp1", "p2_gp2",
  "p1_gp1_g1", "p1_gp1_g2", "p1_gp2_g1", "p1_gp2_g2",
  "p2_gp1_g1", "p2_gp1_g2", "p2_gp2_g1", "p2_gp2_g2",
  "p1_gp1_g1_g1", "p1_gp1_g1_g2", "p1_gp1_g2_g1", "p1_gp1_g2_g2",
  "p1_gp2_g1_g1", "p1_gp2_g1_g2", "p1_gp2_g2_g1", "p1_gp2_g2_g2",
  "p2_gp1_g1_g1", "p2_gp1_g1_g2", "p2_gp1_g2_g1", "p2_gp1_g2_g2",
  "p2_gp2_g1_g1", "p2_gp2_g1_g2", "p2_gp2_g2_g1", "p2_gp2_g2_g2",
] as const;
export type LoopAncestorSlot = typeof LOOP_ANCESTOR_SLOTS[number];
export type LoopUmaSlot = Exclude<LoopAncestorSlot, `${string}_${string}_${string}_${string}`>;
export const LOOP_UMA_SLOTS = LOOP_ANCESTOR_SLOTS.filter((slot): slot is LoopUmaSlot => slot.split("_").length < 4);
export const GGGP_SPARK_SLOTS = LOOP_ANCESTOR_SLOTS.filter((slot) => slot.split("_").length === 4);
export const PARENT_WHITE_TARGET_SLOTS: LoopUmaSlot[] = ["p1", "p2", "p1_gp1", "p1_gp2", "p2_gp1", "p2_gp2"];
export const FARM_APTITUDES = ["Turf", "Dirt", "Sprint", "Mile", "Medium", "Long"] as const;
export type FarmAptitude = typeof FARM_APTITUDES[number];
export type FarmRank = "C" | "D" | "E";
export const DEFAULT_FARM_GOALS: Record<FarmAptitude, FarmRank> = { Turf: "C", Dirt: "E", Sprint: "C", Mile: "C", Medium: "C", Long: "C" };
export type LoopGeneType = "distance" | "style" | "surface";
export const APTITUDE_KEYS = ["Turf", "Dirt", "Sprint", "Mile", "Medium", "Long", "Runner", "Leader", "Betweener", "Chaser"] as const;
export type AptitudeKey = typeof APTITUDE_KEYS[number];
export const BLUE_SPARK_OPTIONS = [
  { value: "1", label: "Speed" }, { value: "2", label: "Stamina" }, { value: "3", label: "Power" },
  { value: "4", label: "Guts" }, { value: "5", label: "Wit" },
] as const;
export const DEFAULT_APTITUDE_GOALS: Record<AptitudeKey, string> = {
  Turf: "G", Dirt: "E", Sprint: "G", Mile: "C", Medium: "C", Long: "C",
  Runner: "G", Leader: "G", Betweener: "G", Chaser: "G",
};

export interface ParentingLoopConfig {
  slotWhiteTargets?: Partial<Record<LoopUmaSlot, AptitudeKey[]>>;
  slotAptitudeGoals?: Partial<Record<LoopUmaSlot, Partial<Record<FarmAptitude, FarmRank>>>>;
  geneGoals: Partial<Record<LoopGeneType, number[]>>;
  /** White aptitude factor group ID -> requested minimum rarity stars. */
  whiteFactorGoals?: Partial<Record<number, number>>;
  aptitudeGoals: Partial<Record<AptitudeKey, string>>;
  factorGoals?: Partial<Record<LoopAncestorSlot, { blue?: number | null; blueStars?: number | null; pink?: AptitudeKey | null; pinkStars?: number | null }>>;
  selectedSlots: Partial<Record<LoopAncestorSlot, string>>;
  lockedSlots: Partial<Record<LoopAncestorSlot, string>>;
  includeTripleCrownAffinity: boolean;
  includeTiaraAffinity: boolean;
}

export interface LoopCandidate {
  key: string;
  cardId: number;
  charId: number;
  name: string;
  source: "veteran" | "roster-goal" | "borrow-placeholder";
  veteran?: KyumaruVeteranItem;
  aptitude: string[];
  baseAptitude: string[];
  factorKnowledge: boolean;
  factorIds: number[];
  skillIds: number[];
  winSaddleIds: number[];
}

export interface AptitudeFloorGap {
  slot: LoopAncestorSlot;
  aptitude: AptitudeKey;
  required: string;
  actual: string | null;
  status: "met" | "unmet" | "unknown";
}

export interface LoopTrainingStep {
  id: number;
  label: string;
  traineeSlot: LoopUmaSlot | "target";
  donorSlots: [LoopAncestorSlot, LoopAncestorSlot];
  borrowCount: number;
  racePlan: { races: { saddleId: number; nameEn: string; donorSlots: LoopAncestorSlot[]; confidence: "confirmed" | "projected" | "feasible" }[]; confidence: "confirmed" | "projected" | "feasible"; note: string };
}

export interface RankedLoopBlueprint {
  id: string;
  rank: number;
  isCurrent?: boolean;
  ancestors: Record<LoopUmaSlot, LoopCandidate>;
  trainingSteps: LoopTrainingStep[];
  aptitudeFloorGaps: AptitudeFloorGap[];
  aptitudeGoalGaps: AptitudeFloorGap[];
  floorMet: boolean;
  eligibleG1: { slot: LoopAncestorSlot | "target"; count: number; races: CareerG1Race[] }[];
  g1OpportunityCount: number;
  geneCoverage: Record<LoopGeneType, { desired: number[]; covered: number[]; count: number; confidence: "confirmed" | "projected" | "feasible" }>;
  whiteFactorProduction: WhiteFactorProduction[];
  aptitudeSparkCoverage: { factorGroupId: number; name: string; count: number; stars: number; confidence: "confirmed" | "projected" | "feasible" }[];
  deckSkillOverlap: { skillId: number; count: number }[];
  uniqueEvaluations: { slot: LoopAncestorSlot; name: string; tier: string; explanation: string }[];
  targetAptitude: AptitudeProjection[];
  parentAptitude: Record<"p1" | "p2", AptitudeProjection[]>;
  factorGoalScore: number;
  minmax: ParentingMinmaxAssessment;
  affinityBreakdown: { p1: number; p2: number; parents: number; total: number; confidence: "confirmed" | "projected" | "feasible"; tripleCrown: number; tiara: number };
  notes: string[];
}

export interface WhiteFactorProduction {
  factorGroupId: number;
  name: string;
  traineeSlot: LoopUmaSlot | "target";
  donorSlots: [LoopAncestorSlot, LoopAncestorSlot];
  availablePinkStars: number;
  projectedAptitude: string;
  aptitudeConfidence: AptitudeProjection["confidence"];
  status: "guaranteed" | "possible" | "insufficient" | "unknown";
}

export interface AptitudeProjection {
  aptitude: AptitudeKey;
  base: string;
  availablePinkStars: number;
  projected: string;
  confidence: "confirmed" | "projected" | "feasible" | "unknown";
  needsOutputA: boolean;
  target?: FarmRank;
  missingPinkStars?: number | null;
  targetStatus?: "met" | "unmet" | "unknown";
}

export interface BranchAssessment {
  slot: LoopUmaSlot | "target";
  projections: AptitudeProjection[];
  whiteFactors: WhiteFactorProduction[];
  sourceSlots: LoopAncestorSlot[];
  partialLineage: boolean;
  needsOutputA: AptitudeKey | null;
  g1: G1CalendarAssessment;
}

export interface ParentingLoopRequest {
  target: CharacterIndexEntry;
  veterans: KyumaruVeteranItem[];
  roster: CharacterIndexEntry[];
  course: Course | null;
  runningStyle: RunningStyle | number | null;
  mainDeckSkillIds: number[];
  config: ParentingLoopConfig;
  current?: Partial<Record<LoopAncestorSlot, string>>;
  mode: "generate" | "score-current";
}

export interface ParentingLoopResult {
  blueprints: RankedLoopBlueprint[];
  candidateCount: number;
  message?: string;
}

const RANKS = ["G", "F", "E", "D", "C", "B", "A", "S"];
const APT_INDEX: Record<string, number> = { Turf: 0, Dirt: 1, Sprint: 2, Mile: 3, Medium: 4, Long: 5, Runner: 6, Leader: 7, Betweener: 8, Chaser: 9 };
const slots = LOOP_UMA_SLOTS;
const STEPS: Omit<LoopTrainingStep, "borrowCount" | "racePlan">[] = [
  ...(["p1", "p2"] as const).flatMap((branch) => (["gp1", "gp2"] as const).flatMap((gp) => (["g1", "g2"] as const).map((ggp, index) => {
    const traineeSlot = `${branch}_${gp}_${ggp}` as LoopUmaSlot;
    return {
      id: (branch === "p1" ? 1 : 5) + (gp === "gp1" ? 0 : 2) + index,
      label: `Train ${branch.toUpperCase()} ${gp.toUpperCase()} ${ggp.toUpperCase()}`,
      traineeSlot,
      donorSlots: [`${traineeSlot}_g1`, `${traineeSlot}_g2`] as [LoopAncestorSlot, LoopAncestorSlot],
    };
  }))),
  { id: 9, label: "Train P1 GP1", traineeSlot: "p1_gp1", donorSlots: ["p1_gp1_g1", "p1_gp1_g2"] },
  { id: 10, label: "Train P1 GP2", traineeSlot: "p1_gp2", donorSlots: ["p1_gp2_g1", "p1_gp2_g2"] },
  { id: 11, label: "Train P2 GP1", traineeSlot: "p2_gp1", donorSlots: ["p2_gp1_g1", "p2_gp1_g2"] },
  { id: 12, label: "Train P2 GP2", traineeSlot: "p2_gp2", donorSlots: ["p2_gp2_g1", "p2_gp2_g2"] },
  { id: 13, label: "Train P1", traineeSlot: "p1", donorSlots: ["p1_gp1", "p1_gp2"] },
  { id: 14, label: "Train P2", traineeSlot: "p2", donorSlots: ["p2_gp1", "p2_gp2"] },
  { id: 15, label: "Train target", traineeSlot: "target", donorSlots: ["p1", "p2"] },
];

function charFor(cardId: number, charId: number): CharacterIndexEntry | undefined {
  return characters.find((c) => c.id === cardId) ?? characters.find((c) => c.charId === charId);
}

export function buildLoopCandidates(veterans: KyumaruVeteranItem[], roster: CharacterIndexEntry[]): LoopCandidate[] {
  const entries: LoopCandidate[] = [];
  for (const vet of veterans) {
    const charId = getCharaIdFromCardId(vet.card_id);
    const character = charFor(vet.card_id, charId);
    if (!character) continue;
    entries.push({
      key: `v:${vet.trained_chara_id ?? vet.card_id}:${vet.create_time ?? ""}`,
      cardId: vet.card_id, charId: character.charId, name: vet.name || character.nameEn,
      source: "veteran", veteran: vet, aptitude: veteranAptitudes(vet), baseAptitude: character.aptitude,
      factorIds: (vet.factor_info_array ?? []).map((f) => f.factor_id), factorKnowledge: Array.isArray(vet.factor_info_array),
      skillIds: (vet.skill_array ?? []).map((s) => s.skill_id),
      winSaddleIds: vet.win_saddle_id_array ?? [],
    });
  }
  for (const character of roster) {
    entries.push({
      key: `r:${character.id}`, cardId: character.id, charId: character.charId,
      name: character.nameEn, source: "roster-goal", aptitude: character.aptitude, baseAptitude: character.aptitude,
      factorIds: [], factorKnowledge: false, skillIds: [], winSaddleIds: [],
    }, {
      key: `b:${character.id}`, cardId: character.id, charId: character.charId,
      name: character.nameEn, source: "borrow-placeholder", aptitude: character.aptitude, baseAptitude: character.aptitude,
      factorIds: [], factorKnowledge: false, skillIds: [], winSaddleIds: [],
    });
  }
  return entries;
}

function veteranAptitudes(vet: KyumaruVeteranItem): string[] {
  return [vet.proper_ground_turf, vet.proper_ground_dirt, vet.proper_distance_short,
    vet.proper_distance_mile, vet.proper_distance_middle, vet.proper_distance_long,
    vet.proper_running_style_nige, vet.proper_running_style_senko,
    vet.proper_running_style_sashi, vet.proper_running_style_oikomi]
    .map((value) => typeof value === "number" ? RANKS[Math.max(0, Math.min(7, value - 1))] : "");
}

function geneTypes(candidate: LoopCandidate): Record<LoopGeneType, number[]> {
  const result: Record<LoopGeneType, number[]> = { distance: [], style: [], surface: [] };
  for (const factorId of candidate.factorIds) {
    const factor = successionFactors.factors.find((f) => f.factorId === factorId);
    if (factor?.factorType === 8) result.distance.push(factor.factorGroupId);
    if (factor?.factorType === 10) result.surface.push(factor.factorGroupId);
    if (factor?.factorType === 11) result.style.push(factor.factorGroupId);
  }
  return result;
}

const eligibleRaceCache = new WeakMap<LoopCandidate, Map<string, CareerG1Race[]>>();
function eligibleRaces(candidate: LoopCandidate, goals = DEFAULT_FARM_GOALS): CareerG1Race[] {
  const key = FARM_APTITUDES.map((aptitude) => goals[aptitude]).join("");
  const cached = eligibleRaceCache.get(candidate)?.get(key);
  if (cached) return cached;
  const projections = APTITUDE_KEYS.map((aptitude, index) => ({ aptitude, base: candidate.aptitude[index] || "?", projected: candidate.aptitude[index] || "?", availablePinkStars: 0, confidence: "feasible" as const, needsOutputA: false }));
  const calendar = evaluateG1Calendar(candidate.charId, projections, goals);
  const seen = new Set<number>();
  const races = calendar.races.flatMap((entry) => {
    const key = entry.race.saddleId ?? entry.race.raceId;
    if (entry.status !== "eligible" || seen.has(key)) return [];
    seen.add(key);
    return [{ ...entry.race, mustWin: false }];
  });
  const perCandidate = eligibleRaceCache.get(candidate) ?? new Map<string, CareerG1Race[]>();
  perCandidate.set(key, races);
  eligibleRaceCache.set(candidate, perCandidate);
  return races;
}

function candidateWinIds(candidate: LoopCandidate): Set<number> {
  const ids = candidate.source === "veteran"
    ? candidate.winSaddleIds
    : candidate.winSaddleIds;
  return new Set(ids);
}

function trainingRacePlan(
  step: Omit<LoopTrainingStep, "borrowCount" | "racePlan">,
  ancestors: Record<LoopUmaSlot, LoopCandidate>,
  request: ParentingLoopRequest,
): LoopTrainingStep["racePlan"] {
  if (step.traineeSlot === "target") {
    return { races: [], confidence: "feasible", note: "Target training wins do not change lineage affinity; that race bonus comes from parent wins shared with their grandparents." };
  }
  if (step.donorSlots.every((slot) => slot.split("_").length === 4)) {
    return { races: [], confidence: "feasible", note: "GGGP supply pink sparks; their identities and shared G1 wins are outside this plan. The GGP calendar is assessed on its own card." };
  }
  const trainee = ancestors[step.traineeSlot as LoopUmaSlot];
  const knownWins = trainee.source === "veteran" ? candidateWinIds(trainee) : null;
  const races = eligibleRaces(trainee, farmGoals(request.config, step.traineeSlot as LoopUmaSlot)).flatMap((race) => {
    if (race.saddleId == null || (knownWins && !knownWins.has(race.saddleId))) return [];
    const donorSlots = step.donorSlots.filter((slot) => slots.includes(slot as LoopUmaSlot) && candidateWinIds(ancestors[slot as LoopUmaSlot]).has(race.saddleId!));
    return donorSlots.length ? [{
      saddleId: race.saddleId,
      nameEn: race.nameEn,
      donorSlots: [...donorSlots],
      confidence: trainee.source === "veteran" && donorSlots.every((slot) => ancestors[slot as LoopUmaSlot]?.source === "veteran") ? "confirmed" as const : "projected" as const,
    }] : [];
  });
  const confidence = races.length && races.every((race) => race.confidence === "confirmed") ? "confirmed" : races.length ? "projected" : "feasible";
  return { races, confidence, note: races.length ? "Shared, aptitude-supported G1s can add race affinity if the trained Uma wins them." : "No shared, aptitude-supported G1 opportunity is known for this run." };
}

function projectedVeteran(candidate: LoopCandidate, grandparents?: [LoopCandidate, LoopCandidate]) {
  return {
    card_id: candidate.cardId,
    win_saddle_id_array: [...candidateWinIds(candidate)],
    succession_chara_array: grandparents?.map((gp, index) => ({ position_id: index === 0 ? 10 : 20, card_id: gp.cardId, win_saddle_id_array: [...candidateWinIds(gp)] })),
  };
}

function aptitudeName(value: string): AptitudeKey | null {
  const normalized = value === "Med" ? "Medium" : value;
  return APTITUDE_KEYS.includes(normalized as AptitudeKey) ? normalized as AptitudeKey : null;
}

function overlapScore(candidate: LoopCandidate, main: Set<number>): number {
  return candidate.skillIds.filter((id) => main.has(id)).length;
}

const PINK_FACTOR_APTITUDE: Record<number, AptitudeKey> = {
  11: "Turf", 12: "Dirt", 21: "Sprint", 22: "Mile", 23: "Medium", 24: "Long",
  31: "Runner", 32: "Leader", 33: "Betweener", 34: "Chaser",
};

export const WHITE_FACTOR_APTITUDE: Record<number, AptitudeKey> = {
  50001: "Turf", 50002: "Dirt", 50003: "Sprint", 50004: "Mile", 50005: "Medium", 50006: "Long",
  50007: "Runner", 50008: "Leader", 50009: "Betweener", 50010: "Chaser",
};


function hasSpark(candidate: LoopCandidate, color: "blue" | "pink", goal: number | AptitudeKey, stars?: number): boolean {
  return candidate.factorIds.some((factorId) => {
    if (color === "blue") return factorId >= 101 && factorId <= 503 && Math.floor(factorId / 100) === goal && (stars == null || factorId % 10 === stars);
    return factorId >= 1101 && factorId <= 3403 && PINK_FACTOR_APTITUDE[Math.floor(factorId / 100)] === goal && (stars == null || factorId % 10 === stars);
  });
}

export function factorPlan(candidate: LoopCandidate | null | undefined, slot: LoopAncestorSlot, config: ParentingLoopConfig) {
  const goal = config.factorGoals?.[slot];
  const explicit = goal != null;
  const actualBlueId = candidate?.factorIds.find((id) => id >= 101 && id <= 503);
  const actualPinkId = candidate?.factorIds.find((id) => id >= 1101 && id <= 3403);
  const actualPink = actualPinkId == null ? null : decodeFactor(actualPinkId);
  const actualAptitude = actualPink ? aptitudeName(actualPink.name) : null;
  const hasPinkChoice = goal != null && Object.prototype.hasOwnProperty.call(goal, "pink");
  const hasBlueStarsChoice = goal != null && Object.prototype.hasOwnProperty.call(goal, "blueStars");
  const hasStarsChoice = goal != null && Object.prototype.hasOwnProperty.call(goal, "pinkStars");
  const pink = hasPinkChoice ? goal?.pink ?? null : actualAptitude;
  const stars = hasStarsChoice ? goal?.pinkStars ?? 0 : pink ? (actualAptitude === pink ? actualPink?.stars ?? 1 : explicit ? 1 : 0) : 0;
  return {
    known: Boolean(candidate?.factorKnowledge) || (hasPinkChoice && hasStarsChoice),
    blue: goal && Object.prototype.hasOwnProperty.call(goal, "blue") ? goal.blue ?? null : actualBlueId == null ? null : Math.floor(actualBlueId / 100),
    blueStars: hasBlueStarsChoice ? goal?.blueStars ?? 0 : actualBlueId == null ? 0 : actualBlueId % 10,
    pink,
    stars,
  };
}

function projectAptitudes(
  baseAptitude: string[], sourceSlots: LoopAncestorSlot[], ancestors: Partial<Record<LoopAncestorSlot, LoopCandidate | null>>,
  config: ParentingLoopConfig, candidate?: LoopCandidate, ownSlot?: LoopAncestorSlot,
): AptitudeProjection[] {
  const plans = sourceSlots.map((slot) => factorPlan(ancestors[slot], slot, config));
  const known = plans.every((plan) => plan.known);
  const ownPlan = ownSlot ? factorPlan(candidate, ownSlot, config) : null;
  return APTITUDE_KEYS.map((aptitude, index) => {
    const stars = plans.reduce((sum, plan) => sum + (plan.pink === aptitude ? plan.stars : 0), 0);
    const threshold = successionFactors.aptitudeThresholds.find((entry) => entry.factorType === 2 && stars >= entry.minStars && stars <= entry.maxStars);
    const base = baseAptitude[index] || "?";
    const baseIndex = RANKS.indexOf(base);
    const projected = threshold && baseIndex >= 0 && baseIndex < RANKS.indexOf("A")
      ? RANKS[Math.min(RANKS.indexOf("A"), baseIndex + threshold.addRank)]
      : base;
    return {
      aptitude, base, availablePinkStars: stars, projected,
      confidence: !known ? "unknown" as const : stars > 0 ? "projected" as const : "feasible" as const,
      needsOutputA: Boolean(ownPlan?.pink === aptitude && baseIndex >= 0 && RANKS.indexOf(projected) < RANKS.indexOf("A")),
    };
  });
}

export function farmGoals(config: ParentingLoopConfig, slot: LoopUmaSlot | "target"): Record<FarmAptitude, FarmRank> {
  return { ...DEFAULT_FARM_GOALS, ...(slot === "target" ? {} : config.slotAptitudeGoals?.[slot]) };
}

export function branchSourceSlots(slot: LoopUmaSlot | "target"): LoopAncestorSlot[] {
  const donors = STEPS.find((step) => step.traineeSlot === slot)?.donorSlots ?? [];
  return [...donors, ...donors.flatMap((donor) => {
    const parents = STEPS.find((step) => step.traineeSlot === donor)?.donorSlots;
    return parents ?? [];
  })];
}

/** Independent, partial-tree assessment used while the user edits any branch. */
export function evaluateParentingBranch(slot: LoopUmaSlot | "target", ancestors: Partial<Record<LoopAncestorSlot, LoopCandidate | null>>, config: ParentingLoopConfig, target?: CharacterIndexEntry | null): BranchAssessment {
  const candidate = slot === "target" ? null : ancestors[slot];
  const base = slot === "target" ? target?.aptitude ?? [] : candidate?.baseAptitude ?? [];
  const sourceSlots = branchSourceSlots(slot);
  const partialLineage = sourceSlots.length < 6;
  const projections = projectAptitudes(base, sourceSlots, ancestors, config, candidate ?? undefined, slot === "target" ? undefined : slot);
  const goals = farmGoals(config, slot);
  for (const projection of projections) {
    if (!FARM_APTITUDES.includes(projection.aptitude as FarmAptitude)) continue;
    const goal = goals[projection.aptitude as FarmAptitude];
    projection.target = goal;
    const baseRank = RANKS.indexOf(projection.base);
    const requiredBoost = RANKS.indexOf(goal) - baseRank;
    const threshold = successionFactors.aptitudeThresholds.find((entry) => entry.factorType === 2 && entry.addRank >= requiredBoost);
    projection.missingPinkStars = baseRank < 0 ? null : requiredBoost <= 0 ? 0 : threshold ? Math.max(0, threshold.minStars - projection.availablePinkStars) : null;
    projection.targetStatus = baseRank < 0 ? "unknown" : RANKS.indexOf(projection.projected) >= RANKS.indexOf(goal) ? "met" : projection.confidence === "unknown" ? "unknown" : "unmet";
  }
  const donors = STEPS.find((step) => step.traineeSlot === slot)!.donorSlots;
  const whiteFactors = APTITUDE_KEYS.map((aptitude): WhiteFactorProduction => {
    const projection = projections.find((entry) => entry.aptitude === aptitude)!;
    const factorGroupId = Number(Object.entries(WHITE_FACTOR_APTITUDE).find(([, name]) => name === aptitude)![0]);
    const stars = projection.availablePinkStars;
    return { factorGroupId, name: aptitude, traineeSlot: slot, donorSlots: donors,
      availablePinkStars: stars, projectedAptitude: projection.projected, aptitudeConfidence: projection.confidence,
      // Unknown additional inputs cannot undo a threshold already met.
      status: stars >= 12 ? "guaranteed" : stars >= 6 ? "possible" : projection.confidence === "unknown" ? "unknown" : "insufficient" };
  });
  const own = slot === "target" ? null : factorPlan(candidate, slot, config);
  const needsOutputA = own?.pink && projections.some((entry) => entry.aptitude === own.pink && RANKS.indexOf(entry.projected) < RANKS.indexOf("A")) ? own.pink : null;
  return { slot, projections, sourceSlots, partialLineage, whiteFactors, needsOutputA,
    g1: evaluateG1Calendar(slot === "target" ? target?.charId : candidate?.charId, projections, goals) };
}

type FactorGoal = NonNullable<ParentingLoopConfig["factorGoals"]>[LoopAncestorSlot];

function factorGoalScore(candidate: LoopCandidate, goal?: FactorGoal): number {
  if (!goal || candidate.source !== "veteran") return 0;
  const matches: (boolean | null)[] = [
    Object.prototype.hasOwnProperty.call(goal, "blue")
      ? (goal.blue == null ? !candidate.factorIds.some((id) => id >= 101 && id <= 503) : hasSpark(candidate, "blue", goal.blue, Object.prototype.hasOwnProperty.call(goal, "blueStars") ? goal.blueStars ?? 0 : undefined))
      : null,
    Object.prototype.hasOwnProperty.call(goal, "pink")
      ? (goal.pink == null ? !candidate.factorIds.some((id) => id >= 1101 && id <= 3403) : hasSpark(candidate, "pink", goal.pink, goal.pinkStars ?? undefined))
      : null,
  ];
  return matches.filter((match) => match !== null).reduce((sum, match) => sum + (match ? 5000 : -5000), 0);
}

function scoreCandidate(candidate: LoopCandidate, request: ParentingLoopRequest, strategy: number, slot?: LoopAncestorSlot): number {
  const genes = geneTypes(candidate);
  const targetCoverage = Object.entries(request.config.geneGoals).reduce((sum, [type, ids]) =>
    sum + (genes[type as LoopGeneType] ?? []).filter((id) => ids?.includes(id)).length, 0);
  const g1 = eligibleRaces(candidate).length;
  const overlap = overlapScore(candidate, new Set(request.mainDeckSkillIds));
  const sourcePenalty = candidate.source === "borrow-placeholder" ? 0.2 : 0;
  const factorGoal = slot ? request.config.factorGoals?.[slot] : undefined;
  const factorScore = factorGoalScore(candidate, factorGoal);
  const geneWeight = strategy === 1 ? 12 : strategy === 2 ? 6 : 10;
  return factorScore + g1 * 8 + targetCoverage * geneWeight - overlap * 9 - sourcePenalty;
}

function currentSlotCandidates(request: ParentingLoopRequest, all: LoopCandidate[], slot: LoopAncestorSlot): LoopCandidate[] {
  const lockedKey = request.config.lockedSlots[slot] ?? (request.mode === "score-current" ? request.current?.[slot] : undefined);
  if (lockedKey) return all.filter((candidate) => candidate.key === lockedKey).slice(0, 1);
  const current = Object.fromEntries(slots.map((key) => [key, all.find((candidate) => candidate.key === (request.current?.[key] ?? request.config.selectedSlots[key] ?? request.config.lockedSlots[key]))]));
  const scores = new Map(all.map((candidate) => [candidate.key, evaluateParentingMinmax({ ancestors: { ...current, [slot]: candidate }, config: request.config, target: request.target, course: request.course, runningStyle: request.runningStyle }).score]));
  return [...all]
    .sort((a, b) => factorGoalScore(b, request.config.factorGoals?.[slot]) - factorGoalScore(a, request.config.factorGoals?.[slot]) || compareMinmax(scores.get(a.key), scores.get(b.key)) || scoreCandidate(b, request, 0, slot) - scoreCandidate(a, request, 0, slot) || a.key.localeCompare(b.key));
}

function borrowRulesSatisfied(partial: Partial<Record<LoopAncestorSlot, LoopCandidate>>): boolean {
  for (const step of STEPS) {
    const donors = step.donorSlots.map((slot) => partial[slot]).filter((candidate) => candidate != null);
    if (donors.filter((candidate) => candidate.source === "borrow-placeholder").length > 1) return false;
  }
  return true;
}

function slotOptions(request: ParentingLoopRequest, candidates: LoopCandidate[], slot: LoopAncestorSlot): LoopCandidate[] {
  const all = currentSlotCandidates(request, candidates, slot);
  if (all.length <= 1) return all;
  const selected = new Map<string, LoopCandidate>();
  for (const candidate of all.slice(0, 16)) selected.set(candidate.key, candidate);
  // Retain niche gene donors and both roster/friend lookup choices even when
  // their raw career score is lower than a broadly useful veteran.
  for (const type of ["distance", "style", "surface"] as const) {
    for (const groupId of request.config.geneGoals[type] ?? []) {
      const match = all.find((candidate) => geneTypes(candidate)[type].includes(groupId));
      if (match) selected.set(match.key, match);
    }
  }
  for (const source of ["roster-goal", "borrow-placeholder"] as const) {
    const match = all.find((candidate) => candidate.source === source);
    if (match) selected.set(match.key, match);
  }
  return [...selected.values()];
}

/** Beam search over slot assignments. Each step expands ranked candidates,
 * prunes incomplete trees, and enforces borrow capacity as soon as a training
 * run's donor pair is known. Reusing a donor in another run remains allowed. */
function searchBlueprints(request: ParentingLoopRequest, candidates: LoopCandidate[]): Record<LoopUmaSlot, LoopCandidate>[] {
  let beam: { ancestors: Partial<Record<LoopAncestorSlot, LoopCandidate>>; score: number; factorScore: number; minmax?: MinmaxScore }[] = [{ ancestors: {}, score: 0, factorScore: 0 }];
  const beamWidth = 48;
  for (const slot of slots) {
    const options = slotOptions(request, candidates, slot);
    if (!options.length) return [];
    const expanded: typeof beam = [];
    for (const state of beam) for (const candidate of options) {
      const ancestors = { ...state.ancestors, [slot]: candidate };
      if (!borrowRulesSatisfied(ancestors)) continue;
      const previouslyCovered = new Set<number>();
      for (const previous of Object.values(state.ancestors)) {
        for (const [type, ids] of Object.entries(geneTypes(previous!))) {
          for (const id of ids) if (request.config.geneGoals[type as LoopGeneType]?.includes(id)) previouslyCovered.add(id);
        }
      }
      const newGeneCoverage = Object.values(geneTypes(candidate)).flat().filter((id) =>
        Object.values(request.config.geneGoals).flat().includes(id) && !previouslyCovered.has(id)).length;
      expanded.push({ ancestors, score: state.score + scoreCandidate(candidate, request, 0, slot) + newGeneCoverage * 15,
        factorScore: state.factorScore + factorGoalScore(candidate, request.config.factorGoals?.[slot]),
        minmax: evaluateParentingMinmax({ ancestors, config: request.config, target: request.target, course: request.course, runningStyle: request.runningStyle }).score });
    }
    if (!expanded.length) return [];
    // Prune by the same minmax order used for final results, so high-affinity
    // dirty trees do not crowd clean alternatives out of the search beam.
    expanded.sort((a, b) => b.factorScore - a.factorScore || compareMinmax(a.minmax, b.minmax) || b.score - a.score || JSON.stringify(a.ancestors).localeCompare(JSON.stringify(b.ancestors)));
    beam = expanded.slice(0, beamWidth);
  }
  return beam.flatMap((state) => slots.every((slot) => state.ancestors[slot])
    ? [state.ancestors as Record<LoopUmaSlot, LoopCandidate>] : []);
}

function evaluateBlueprint(ancestors: Record<LoopUmaSlot, LoopCandidate>, request: ParentingLoopRequest, strategy: number): RankedLoopBlueprint {
  const assessments = Object.fromEntries(slots.map((slot) => [slot, evaluateParentingBranch(slot, ancestors, request.config)])) as Record<LoopUmaSlot, BranchAssessment>;
  const gaps: AptitudeFloorGap[] = slots.flatMap((slot) => assessments[slot].projections.flatMap((entry) => entry.target ? [{ slot, aptitude: entry.aptitude, required: entry.target, actual: entry.base === "?" ? null : entry.projected, status: entry.targetStatus! }] : []));
  const goalGaps = gaps;
  const projected = Object.fromEntries(slots.map((slot) => [slot, { ...ancestors[slot], aptitude: assessments[slot].projections.map((entry) => entry.projected), winSaddleIds: ancestors[slot].source === "veteran" ? ancestors[slot].winSaddleIds : assessments[slot].g1.scheduledSaddles }])) as Record<LoopUmaSlot, LoopCandidate>;
  const trainingSteps = STEPS.map((step) => ({ ...step,
    borrowCount: step.donorSlots.filter((slot) => projected[slot as LoopUmaSlot]?.source === "borrow-placeholder").length,
    racePlan: trainingRacePlan(step, projected, request),
  }));
  const g1: RankedLoopBlueprint["eligibleG1"] = slots.map((slot) => ({ slot, count: assessments[slot].g1.schedulableCount, races: assessments[slot].g1.races.filter((entry) => entry.status === "eligible").map((entry) => ({ ...entry.race, mustWin: false })) }));
  const targetAssessment = evaluateParentingBranch("target", ancestors, request.config, request.target);
  g1.push({ slot: "target", count: targetAssessment.g1.schedulableCount, races: targetAssessment.g1.races.filter((entry) => entry.status === "eligible").map((entry) => ({ ...entry.race, mustWin: false })) });
  const desired: ParentingLoopConfig["geneGoals"] = { distance: [50003,50004,50005,50006], surface: [50001,50002], style: [50007,50008,50009,50010] };
  const geneSources = { distance: false, style: false, surface: false } as Record<LoopGeneType, boolean>;
  const geneProjected = { distance: false, style: false, surface: false } as Record<LoopGeneType, boolean>;
  for (const slot of slots) for (const type of ["distance", "style", "surface"] as const) {
    const candidate = ancestors[slot];
    const ids = geneTypes(candidate)[type];
    if (ids.some((id) => desired[type]?.includes(id)) && candidate.source === "veteran") {
      if (slot.endsWith("_g1") || slot.endsWith("_g2")) geneProjected[type] = true;
      else geneSources[type] = true;
    }
  }
  const geneFactorStars = (candidate: LoopCandidate, groupId: number) => candidate.factorIds.reduce((max, factorId) => {
    const factor = successionFactors.factors.find((entry) => entry.factorId === factorId);
    return factor?.factorGroupId === groupId && [8, 10, 11].includes(factor.factorType) ? Math.max(max, factor.rarity) : max;
  }, 0);
  const genes = {} as RankedLoopBlueprint["geneCoverage"];
  for (const type of ["distance", "style", "surface"] as const) {
    const covered = new Set<number>();
    let count = 0;
    for (const candidate of Object.values(ancestors)) for (const id of geneTypes(candidate)[type]) {
      if (!desired[type]?.includes(id) || geneFactorStars(candidate, id) < 1) continue;
      covered.add(id);
      count++;
    }
    genes[type] = { desired: desired[type] ?? [], covered: [...covered], count, confidence: geneSources[type] ? "confirmed" : geneProjected[type] ? "projected" : "feasible" };
  }
  const sparkCounts = new Map<number, { name: string; count: number; stars: number }>();
  for (const candidate of Object.values(ancestors)) for (const factorId of candidate.factorIds) {
    const meta = successionFactors.factors.find((factor) => factor.factorId === factorId);
    if (meta?.factorType !== 2) continue;
    const current = sparkCounts.get(meta.factorGroupId) ?? { name: meta.nameEn, count: 0, stars: 0 };
    current.count++;
    current.stars += meta.rarity;
    sparkCounts.set(meta.factorGroupId, current);
  }
  const aptitudeSparkCoverage = [...sparkCounts].map(([factorGroupId, value]) => ({
    factorGroupId, ...value,
    confidence: slots.some((slot) => !(slot.endsWith("_g1") || slot.endsWith("_g2")) && ancestors[slot as LoopUmaSlot]?.source === "veteran" &&
      ancestors[slot].factorIds.some((factorId) => successionFactors.factors.find((factor) => factor.factorId === factorId)?.factorGroupId === factorGroupId))
      ? "confirmed" as const : "projected" as const,
  }));
  const skillCounts = new Map<number, number>();
  for (const c of Object.values(ancestors)) for (const skillId of c.skillIds) if (request.mainDeckSkillIds.includes(skillId)) skillCounts.set(skillId, (skillCounts.get(skillId) ?? 0) + 1);
  const uniqueEvaluations = slots.flatMap((slot) => {
    if (!request.course) return [];
    const char = charFor(ancestors[slot].cardId, ancestors[slot].charId);
    const skillId = char?.uniqueSkillId == null ? undefined : uniqueInheritMap[String(char.uniqueSkillId)];
    const result = evaluateUniqueSkill(skillId, request.course, runningStyleToNum(request.runningStyle));
    return [{ slot, name: result.skillName || char?.nameEn || ancestors[slot].name, tier: result.tier, explanation: result.explanation }];
  });
  const targetG1 = careersByCharId[String(request.target.charId)] ?? [];
  const targetSaddles = new Set(targetG1.flatMap((race) => race.saddleId == null ? [] : [race.saddleId]));
  const donorSaddles = new Set(Object.values(projected).flatMap((candidate) => [...candidateWinIds(candidate)]));
  const sharedSaddles = [...targetSaddles].filter((id) => donorSaddles.has(id));
  // Canonical MDB single_mode_wins_saddle ids for the two optional affinity
  // circuits. IDs are stable even where localized race names are Japanese.
  const tripleCrownIds = new Set([18, 12, 16]); // Satsuki Sho, Tokyo Yushun, Kikuka Sho
  const tiaraIds = new Set([24, 19, 28]); // Oka Sho, Japanese Oaks, Shuka Sho
  const tripleCrown = request.config.includeTripleCrownAffinity
    ? sharedSaddles.filter((id) => tripleCrownIds.has(id)).length : 0;
  const tiara = request.config.includeTiaraAffinity
    ? sharedSaddles.filter((id) => tiaraIds.has(id)).length : 0;
  const p1Affinity = calculateLineageAffinity(request.target.charId,
    projectedVeteran(projected.p1, [projected.p1_gp1, projected.p1_gp2]), null,
    { gp1: projectedVeteran(projected.p1_gp1), gp2: projectedVeteran(projected.p1_gp2) }).p1Affinity?.total ?? 0;
  const p2Affinity = calculateLineageAffinity(request.target.charId,
    null, projectedVeteran(projected.p2, [projected.p2_gp1, projected.p2_gp2]),
    undefined, { gp1: projectedVeteran(projected.p2_gp1), gp2: projectedVeteran(projected.p2_gp2) }).p2Affinity?.total ?? 0;
  const pairAffinity = calculateLineageAffinity(request.target.charId,
    projectedVeteran(projected.p1), projectedVeteran(projected.p2)).pairAffinity?.total ?? 0;
  const affinityConfidence = [ancestors.p1, ancestors.p2, ancestors.p1_gp1, ancestors.p1_gp2, ancestors.p2_gp1, ancestors.p2_gp2].every((c) => c.source === "veteran") ? "confirmed" as const : "projected" as const;
  const affinityTotal = p1Affinity + p2Affinity + pairAffinity;
  const targetAptitude = targetAssessment.projections;
  const parentAptitude = { p1: assessments.p1.projections, p2: assessments.p2.projections };
  const plannedFactorScore = slots.reduce((sum, slot) => sum + factorGoalScore(ancestors[slot], request.config.factorGoals?.[slot]), 0);
  const whiteOutputs = [...slots.flatMap((slot) => assessments[slot].whiteFactors), ...targetAssessment.whiteFactors];
  const floorMet = gaps.every((gap) => gap.status === "met");
  const notes = [
    "Roster and friend entries are training goals/placeholders; their future factors and aptitude are not confirmed.",
    "A factor anywhere in this family is a planned pool, not a promise that the final trainee inherits it.",
    "G1 values are ordinary calendar opportunities supported by projected aptitude; fan requirements and wins are not confirmed.",
  ];
  return {
    id: `loop-${Object.values(ancestors).map((candidate) => candidate.key).join("|")}`,
    minmax: evaluateParentingMinmax({ ancestors, config: request.config, target: request.target, course: request.course, runningStyle: request.runningStyle }),
    rank: strategy, ancestors, trainingSteps, aptitudeFloorGaps: gaps, aptitudeGoalGaps: goalGaps, floorMet,
    eligibleG1: g1, g1OpportunityCount: g1.reduce((sum, row) => sum + row.count, 0), targetAptitude, parentAptitude, factorGoalScore: plannedFactorScore,
    geneCoverage: genes, whiteFactorProduction: whiteOutputs, aptitudeSparkCoverage, deckSkillOverlap: [...skillCounts].map(([skillId, count]) => ({ skillId, count })),
    uniqueEvaluations, affinityBreakdown: { p1: p1Affinity, p2: p2Affinity, parents: pairAffinity, total: affinityTotal, confidence: affinityConfidence, tripleCrown, tiara }, notes,
  };
}

export function planParentingLoop(request: ParentingLoopRequest): ParentingLoopResult {
  request = { ...request, config: { ...request.config, geneGoals: {}, whiteFactorGoals: {}, aptitudeGoals: {} } };
  const candidates = buildLoopCandidates(request.veterans, request.roster);
  const searched = searchBlueprints(request, candidates);
  const evaluated = searched.map((selected) => evaluateBlueprint(selected, request, 1));
  const blueprints: RankedLoopBlueprint[] = [];
  const baselineEntries = request.current ? slots.map((slot) => [slot, candidates.find((candidate) => candidate.key === request.current?.[slot])] as const) : [];
  const baseline = baselineEntries.length === slots.length && baselineEntries.every(([, candidate]) => candidate != null)
    ? Object.fromEntries(baselineEntries) as Record<LoopUmaSlot, LoopCandidate>
    : null;
  if (baseline && slots.every((slot) => !request.config.lockedSlots[slot] || request.config.lockedSlots[slot] === baseline[slot].key) && borrowRulesSatisfied(baseline)) {
    const currentPlan = evaluateBlueprint(baseline, request, 0);
    currentPlan.isCurrent = true;
    evaluated.unshift(currentPlan);
  }
  for (const result of evaluated) {
    if (!blueprints.some((entry) => slots.every((slot) => entry.ancestors[slot].key === result.ancestors[slot].key))) blueprints.push(result);
  }
  const uniqueScore = (plan: RankedLoopBlueprint) => plan.uniqueEvaluations.reduce((sum, item) =>
    sum + ({ "S+": 7, S: 6, A: 5, B: 4, C: 3, D: 2, F: 0 }[item.tier] ?? 0), 0);
  const optionalAffinity = (plan: RankedLoopBlueprint) => plan.affinityBreakdown.tripleCrown + plan.affinityBreakdown.tiara;
  blueprints.sort((a, b) => Number(Boolean(b.isCurrent)) - Number(Boolean(a.isCurrent)) || b.factorGoalScore - a.factorGoalScore || compareMinmax(a.minmax.score, b.minmax.score) || Number(b.floorMet) - Number(a.floorMet) || b.affinityBreakdown.total - a.affinityBreakdown.total || b.g1OpportunityCount - a.g1OpportunityCount ||
    optionalAffinity(b) - optionalAffinity(a) ||
    Object.values(b.geneCoverage).reduce((sum, g) => sum + g.count, 0) - Object.values(a.geneCoverage).reduce((sum, g) => sum + g.count, 0) ||
    a.deckSkillOverlap.reduce((sum, skill) => sum + skill.count, 0) - b.deckSkillOverlap.reduce((sum, skill) => sum + skill.count, 0) ||
    uniqueScore(b) - uniqueScore(a) || b.affinityBreakdown.total - a.affinityBreakdown.total);
  const ranked = blueprints.slice(0, 3);
  ranked.forEach((blueprint, index) => blueprint.rank = index + 1);
  return { blueprints: ranked, candidateCount: candidates.length, message: ranked.length ? undefined : "No complete plan could be made from this roster and the current locks. Check locked slots and per-run borrow limits." };
}
