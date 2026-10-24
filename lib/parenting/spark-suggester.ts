/**
 * Branch spark suggester: proposes pink-factor plans for the GGP/GGGP slots of
 * one pedigree branch so the three training runs of that branch (P + two GPs)
 * maximise on-target white genetics while meeting per-slot aptitude targets.
 * Hard rule ("no junk genetics"): every off-target pink star pool feeding one
 * of those runs stays at or below 5★, under the 6★ genetic roll threshold
 * (6–11★ ≈ 40%, 12★ = 100% — see docs/parenting/minmax.md).
 *
 * The search exploits that the scoring model is additive per aptitude: the
 * only coupling is the slot budget. Each GP sub-branch is solved with a small
 * DP keyed by (GGP star vector, GGGP slots used); the two sub-branches are
 * then joined pairwise because only their GGP parts feed the P trainee.
 */
import { successionFactors } from "../data/registry";
import {
  APTITUDE_KEYS, DEFAULT_FARM_GOALS, FARM_APTITUDES, evaluateParentingBranch, factorPlan,
  type AptitudeKey, type FarmAptitude, type LoopAncestorSlot, type LoopCandidate, type LoopUmaSlot,
  type ParentingLoopConfig, type TargetRank,
} from "./loop-planner";
import {
  aceGeneticTarget, evaluateParentingMinmax,
  type AceGeneticTarget, type GeneticRisk, type ParentingMinmaxContext,
} from "./minmax";

const RANKS = ["G", "F", "E", "D", "C", "B", "A", "S"];
/** Off-target pools must stay at or below this to keep the roll odds ~0. */
export const JUNK_STAR_CAP = 5;
export const GENETIC_ROLL_STARS = 6;
export const GENETIC_GUARANTEE_STARS = 12;
/** Extra credit for a 12★ pool on top of the full credit a 6★ pool already
 * earns. Kept small so spreading 6/6 across two (or all three) target
 * genetics always beats concentrating 12★ on one — each ≥6★ pool is a genetic
 * the loop can collect over reruns, up to all three Ace categories. */
export const GENETIC_GUARANTEE_BONUS = 0.1;

export type AptitudeGroup = "surface" | "distance" | "style";

export function aptitudeGroup(aptitude: AptitudeKey): AptitudeGroup {
  const index = APTITUDE_KEYS.indexOf(aptitude);
  return index < 2 ? "surface" : index < 6 ? "distance" : "style";
}

/** Turf aces prioritise Distance > Style > Turf; dirt aces Distance > Dirt > Style. */
export function geneticPriorityWeights(target: AceGeneticTarget): Record<AptitudeGroup, number> {
  return target.surface === "Dirt"
    ? { distance: 3, surface: 2, style: 1 }
    : { distance: 3, style: 2, surface: 1 };
}

export interface BranchSparkAssignment {
  pink: AptitudeKey | null;
  pinkStars: number;
}

export interface SparkTargetOutcome {
  aptitude: AptitudeKey;
  target: TargetRank;
  projected: string;
  met: boolean;
}

export interface SparkGeneticOutcome {
  aptitude: AptitudeKey;
  stars: number;
  status: "guaranteed" | "possible" | "insufficient" | "unknown";
}

export interface SparkJunkOutcome {
  aptitude: AptitudeKey;
  stars: number;
  risk: GeneticRisk;
}

export interface SparkTraineeOutcome {
  slot: LoopUmaSlot;
  targets: SparkTargetOutcome[];
  genetics: SparkGeneticOutcome[];
  junk: SparkJunkOutcome[];
  retrainingNote: boolean;
}

export interface BranchSparkSuggestion {
  branch: "p1" | "p2";
  /** Pink plan per deep slot of the branch (slots with manual picks excluded). */
  assignments: Partial<Record<LoopAncestorSlot, BranchSparkAssignment>>;
  /** Deep slots left untouched because the user (or the card's own factors) already set them. */
  kept: LoopAncestorSlot[];
  trainees: SparkTraineeOutcome[];
  /** On-target pools at ≥6★ — each is a genetic the loop can collect over reruns. */
  obtainableGenetics: number;
  /** Per-run roll expectation (12★ = 1, 6–11★ ≈ 0.4) over the three runs. */
  expectedGenetics: number;
  junkWarnings: string[];
  warnings: string[];
}

/** Lexicographic score, all minimised: junk overflow, target gaps, negative
 * genetics value, stars spent. Component magnitudes never cross tiers. */
type Score = readonly [number, number, number, number];
const ZERO: Score = [0, 0, 0, 0];

function addScore(a: Score, b: Score): Score {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]];
}

function compareScore(a: Score, b: Score): number {
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}

function rankIndex(rank: string): number {
  return RANKS.indexOf(rank);
}

function projectedRank(base: string, stars: number): string {
  const baseIndex = rankIndex(base);
  if (baseIndex < 0 || baseIndex >= rankIndex("A")) return base;
  const threshold = successionFactors.aptitudeThresholds.find((entry) =>
    entry.factorType === 2 && stars >= entry.minStars && stars <= entry.maxStars);
  if (!threshold) return base;
  return RANKS[Math.min(rankIndex("A"), baseIndex + threshold.addRank)];
}

interface TraineeModel {
  slot: LoopUmaSlot;
  base: string[];
  /** Explicit slot goals + farm defaults + implicit "output A" for the own pink. */
  targets: Partial<Record<AptitudeKey, TargetRank>>;
  /** Stars from inputs the engine cannot move (GP pinks, kept slots). */
  fixedStars: number[];
  isVeteran: boolean;
}

function wantedAptitude(group: AptitudeGroup, target: AceGeneticTarget): AptitudeKey | null {
  return group === "surface" ? target.surface : group === "distance" ? target.distance : target.style;
}

function aptitudeScore(model: TraineeModel, index: number, addStars: number, weights: Record<AptitudeGroup, number>, target: AceGeneticTarget): Score {
  const aptitude = APTITUDE_KEYS[index];
  const total = model.fixedStars[index] + addStars;
  const group = aptitudeGroup(aptitude);
  const wanted = wantedAptitude(group, target);
  if (wanted == null) {
    // Category undecided on the Global Track Bar: no genetic credit, no junk rule.
    return [0, targetGap(model, index, total), 0, addStars];
  }
  if (aptitude === wanted) {
    // On-target stars are never a cost: every ancestor carrying a matching
    // pink feeds a genetic the Ace wants. A ≥6★ pool already earns the full
    // weight (the loop can collect it over reruns); 12★ only adds the small
    // certainty bonus, so a wide 6/6 build outranks a deep 12★ one.
    const genetics = weights[group] * (total >= GENETIC_ROLL_STARS ? 1 : 0)
      + (total >= GENETIC_GUARANTEE_STARS ? weights[group] * GENETIC_GUARANTEE_BONUS : 0);
    return [0, targetGap(model, index, total), -genetics, 0];
  }
  const junk = total > JUNK_STAR_CAP ? total - JUNK_STAR_CAP : 0;
  return [junk, targetGap(model, index, total), 0, addStars];
}

function targetGap(model: TraineeModel, index: number, totalStars: number): number {
  const goal = model.targets[APTITUDE_KEYS[index]];
  if (!goal) return 0;
  const base = model.base[index] || "?";
  const projectedIndex = rankIndex(projectedRank(base, totalStars));
  const goalIndex = rankIndex(goal);
  if (projectedIndex < 0 || goalIndex < 0) return 0;
  return Math.max(0, goalIndex - projectedIndex);
}

function emptyStars(): number[] {
  return APTITUDE_KEYS.map(() => 0);
}

function buildTrainee(
  slot: LoopUmaSlot,
  ancestors: Partial<Record<LoopAncestorSlot, LoopCandidate | null>>,
  config: ParentingLoopConfig,
  fixedStars: number[],
): TraineeModel | null {
  const candidate = ancestors[slot];
  if (!candidate) return null;
  const disabled = new Set<FarmAptitude>(config.disabledFarmAptitudes ?? []);
  const defaults = Object.fromEntries(FARM_APTITUDES.filter((aptitude) => !disabled.has(aptitude)).map((aptitude) => [aptitude, DEFAULT_FARM_GOALS[aptitude]]));
  const targets: Partial<Record<AptitudeKey, TargetRank>> = { ...defaults, ...config.slotAptitudeGoals?.[slot] };
  // The trainee's own pink must output A for its red factor to stay controllable.
  const ownPink = factorPlan(candidate, slot, config).pink;
  if (ownPink) targets[ownPink] = "A";
  return { slot, base: candidate.baseAptitude, targets, fixedStars, isVeteran: candidate.source === "veteran" };
}

interface SubBranchModel {
  gpSlot: LoopUmaSlot;
  ggpSlots: LoopAncestorSlot[];
  gggpSlots: LoopAncestorSlot[];
  /** Fixed stars from kept GGP/GGGP slots of this sub-branch (GP pool view). */
  fixed: number[];
  trainee: TraineeModel;
}

interface SubAllocation {
  score: Score;
  ggp: number[];
  gggp: number[];
}

function slotsFor(stars: number): number {
  return Math.ceil(stars / 3);
}

/** Totals worth considering for one aptitude inside a sub-branch: each value is
 * the minimal star count for a threshold (aptitude step band or 6★/12★ genetic). */
function usefulTotals(aptitude: AptitudeKey, target: AceGeneticTarget, trainees: TraineeModel[], fixedPerAptitude: (index: number) => number): number[] {
  const group = aptitudeGroup(aptitude);
  const wanted = wantedAptitude(group, target);
  const index = APTITUDE_KEYS.indexOf(aptitude);
  if (wanted === aptitude) return [1, 4, 6, 7, 10, 12];
  const needsStars = trainees.some((model) => {
    const goal = model.targets[aptitude];
    if (!goal) return false;
    return targetGap(model, index, fixedPerAptitude(index)) > 0;
  });
  if (!needsStars) return [];
  if (wanted == null) return [1, 4, 7, 10];
  // Off-target stars exist only to serve a target floor and never pass the junk cap.
  return [1, 4].filter((stars) => fixedPerAptitude(index) + stars <= JUNK_STAR_CAP);
}

function enumerateSubBranch(
  model: SubBranchModel,
  weights: Record<AptitudeGroup, number>,
  target: AceGeneticTarget,
  pTrainee: TraineeModel,
): Map<string, SubAllocation> {
  const ggpCapacity = model.ggpSlots.length * 3;
  const gggpCapacity = model.gggpSlots.length * 3;
  const relevant = APTITUDE_KEYS.filter((aptitude) => usefulTotals(aptitude, target, [model.trainee, pTrainee], (index) => model.fixed[index]).length > 0);
  // State: GGP star vector -> GGGP slots used -> best entry.
  let dp = new Map<string, Map<number, SubAllocation>>();
  dp.set(emptyStars().join(","), new Map([[0, { score: ZERO, ggp: emptyStars(), gggp: emptyStars() }]]));
  for (const aptitude of relevant) {
    const index = APTITUDE_KEYS.indexOf(aptitude);
    const totals = [0, ...usefulTotals(aptitude, target, [model.trainee, pTrainee], (i) => model.fixed[i])];
    const next = new Map<string, Map<number, SubAllocation>>();
    for (const [vectorKey, bySlots] of dp) {
      for (const [slotsUsed, entry] of bySlots) {
        for (const total of totals) {
          const maxG = Math.min(total, ggpCapacity);
          for (let g = 0; g <= maxG; g++) {
            const h = total - g;
            if (h > gggpCapacity) continue;
            if (slotsUsed + slotsFor(h) > model.gggpSlots.length) continue;
            const ggp = [...entry.ggp];
            ggp[index] += g;
            if (ggp.reduce((sum, stars) => sum + slotsFor(stars), 0) > model.ggpSlots.length) continue;
            const gggp = [...entry.gggp];
            gggp[index] += h;
            const marginal = aptitudeScore(model.trainee, index, g + h, weights, target);
            const candidate: SubAllocation = { score: addScore(entry.score, marginal), ggp, gggp };
            const key = ggp.join(",");
            const bucket = next.get(key) ?? new Map<number, SubAllocation>();
            const slots = slotsUsed + slotsFor(h);
            const existing = bucket.get(slots);
            if (!existing || compareScore(candidate.score, existing.score) < 0) bucket.set(slots, candidate);
            next.set(key, bucket);
          }
        }
      }
    }
    dp = next;
  }
  const results = new Map<string, SubAllocation>();
  for (const bySlots of dp.values()) {
    let best: SubAllocation | undefined;
    for (const entry of bySlots.values()) {
      if (!best || compareScore(entry.score, best.score) < 0) best = entry;
    }
    if (best) results.set(best.ggp.join(","), best);
  }
  return results;
}

export function branchTraineeSlots(branch: "p1" | "p2"): [LoopUmaSlot, LoopUmaSlot, LoopUmaSlot] {
  return [branch, `${branch}_gp1`, `${branch}_gp2`] as [LoopUmaSlot, LoopUmaSlot, LoopUmaSlot];
}

export function branchIsComplete(ancestors: Partial<Record<LoopAncestorSlot, LoopCandidate | null>>, branch: "p1" | "p2"): boolean {
  return branchTraineeSlots(branch).every((slot) => ancestors[slot] != null);
}

/**
 * Suggest pink plans for the 12 deep slots (4 GGP + 8 GGGP) of one branch.
 * Returns null until the branch is fully selected (1 P + 2 GPs).
 */
export function suggestBranchSparks(context: ParentingMinmaxContext, branch: "p1" | "p2"): BranchSparkSuggestion | null {
  const { ancestors, config } = context;
  if (!branchIsComplete(ancestors, branch)) return null;
  const [pSlot, gp1Slot, gp2Slot] = branchTraineeSlots(branch);
  const target = aceGeneticTarget(context.course, context.runningStyle);
  const weights = geneticPriorityWeights(target);

  const kept: LoopAncestorSlot[] = [];
  const fixedP = emptyStars();
  const subModels: SubBranchModel[] = [];
  for (const gpSlot of [gp1Slot, gp2Slot] as const) {
    const ggpSlots = [`${gpSlot}_g1`, `${gpSlot}_g2`] as LoopAncestorSlot[];
    const gggpSlots = ggpSlots.flatMap((slot) => [`${slot}_g1`, `${slot}_g2`] as LoopAncestorSlot[]);
    const freeGgp: LoopAncestorSlot[] = [];
    const freeGggp: LoopAncestorSlot[] = [];
    const fixed = emptyStars();
    const pin = (slot: LoopAncestorSlot, free: LoopAncestorSlot[]) => {
      const candidate = ancestors[slot];
      const goal = config.factorGoals?.[slot];
      const goalHasPink = goal != null && Object.prototype.hasOwnProperty.call(goal, "pink");
      if (goalHasPink || candidate?.factorKnowledge) {
        kept.push(slot);
        const plan = factorPlan(candidate ?? null, slot, config);
        if (plan.pink) {
          const index = APTITUDE_KEYS.indexOf(plan.pink);
          fixed[index] += plan.stars;
          if (ggpSlots.includes(slot)) fixedP[index] += plan.stars;
        }
      } else {
        free.push(slot);
      }
    };
    for (const slot of ggpSlots) pin(slot, freeGgp);
    for (const slot of gggpSlots) pin(slot, freeGggp);
    const trainee = buildTrainee(gpSlot, ancestors, config, fixed);
    subModels.push({ gpSlot, ggpSlots: freeGgp, gggpSlots: freeGggp, fixed, trainee: trainee! });
  }
  // The P run's fixed pool: both GP pinks plus every kept GGP pink of the branch.
  for (const gpSlot of [gp1Slot, gp2Slot] as const) {
    const plan = factorPlan(ancestors[gpSlot], gpSlot, config);
    if (plan.pink) fixedP[APTITUDE_KEYS.indexOf(plan.pink)] += plan.stars;
  }
  const pTrainee = buildTrainee(pSlot, ancestors, config, fixedP)!;

  const sub1 = [...enumerateSubBranch(subModels[0], weights, target, pTrainee).entries()];
  const sub2 = [...enumerateSubBranch(subModels[1], weights, target, pTrainee).entries()];
  let best: { score: Score; ggp: [number[], number[]]; gggp: [number[], number[]] } | null = null;
  for (const [, allocation1] of sub1) {
    for (const [, allocation2] of sub2) {
      let pScore: Score = ZERO;
      APTITUDE_KEYS.forEach((_, index) => {
        pScore = addScore(pScore, aptitudeScore(pTrainee, index, allocation1.ggp[index] + allocation2.ggp[index], weights, target));
      });
      const score = addScore(addScore(allocation1.score, allocation2.score), pScore);
      if (!best || compareScore(score, best.score) < 0) {
        best = { score, ggp: [allocation1.ggp, allocation2.ggp], gggp: [allocation1.gggp, allocation2.gggp] };
      }
    }
  }

  const assignments: Partial<Record<LoopAncestorSlot, BranchSparkAssignment>> = {};
  // "No empty slots": leftover capacity becomes on-target pink in priority
  // order — every ancestor carrying a matching pink feeds a genetic the Ace
  // wants, so a spare slot is never left as "no factor".
  const onTargetOrdered = APTITUDE_KEYS
    .filter((aptitude) => wantedAptitude(aptitudeGroup(aptitude), target) === aptitude)
    .sort((a, b) => weights[aptitudeGroup(b)] - weights[aptitudeGroup(a)] || APTITUDE_KEYS.indexOf(a) - APTITUDE_KEYS.indexOf(b));
  const fillLeftovers = (stars: number[], slotCount: number, pool: (index: number) => number) => {
    let free = slotCount - stars.reduce((sum, value) => sum + slotsFor(value), 0);
    while (free > 0 && onTargetOrdered.length) {
      const pick = onTargetOrdered.find((aptitude) => {
          const index = APTITUDE_KEYS.indexOf(aptitude);
          return pool(index) < GENETIC_ROLL_STARS && pool(index) + 3 >= GENETIC_ROLL_STARS;
        })
        ?? onTargetOrdered.find((aptitude) => {
          const index = APTITUDE_KEYS.indexOf(aptitude);
          return pool(index) < GENETIC_GUARANTEE_STARS && pool(index) + 3 >= GENETIC_GUARANTEE_STARS;
        })
        ?? onTargetOrdered.find((aptitude) => pool(APTITUDE_KEYS.indexOf(aptitude)) < GENETIC_GUARANTEE_STARS)
        ?? onTargetOrdered[0];
      stars[APTITUDE_KEYS.indexOf(pick)] += 3;
      free--;
    }
  };
  const realize = (stars: number[], slots: LoopAncestorSlot[]) => {
    let cursor = 0;
    const ordered = stars.map((value, position) => ({ value, position })).sort((a, b) => b.value - a.value);
    for (const { value, position } of ordered) {
      let remaining = value;
      while (remaining > 0 && cursor < slots.length) {
        const placed = Math.min(3, remaining);
        assignments[slots[cursor]] = { pink: APTITUDE_KEYS[position], pinkStars: placed };
        remaining -= placed;
        cursor++;
      }
      if (remaining > 0) break;
    }
    while (cursor < slots.length) {
      assignments[slots[cursor]] = { pink: null, pinkStars: 0 };
      cursor++;
    }
  };
  if (best) {
    subModels.forEach((model, index) => {
      const pool = (aptitudeIndex: number) => best!.ggp[index][aptitudeIndex] + best!.gggp[index][aptitudeIndex];
      fillLeftovers(best!.ggp[index], model.ggpSlots.length, pool);
      fillLeftovers(best!.gggp[index], model.gggpSlots.length, pool);
      realize(best!.ggp[index], model.ggpSlots);
      realize(best!.gggp[index], model.gggpSlots);
    });
  }
  for (const slot of kept) delete assignments[slot];

  const overlay: ParentingLoopConfig = { ...config, factorGoals: { ...config.factorGoals } };
  for (const [slot, assignment] of Object.entries(assignments)) {
    const key = slot as LoopAncestorSlot;
    overlay.factorGoals![key] = { ...overlay.factorGoals?.[key], pink: assignment.pink, pinkStars: assignment.pinkStars };
  }

  const minmax = evaluateParentingMinmax({ ...context, config: overlay });
  const trainees: SparkTraineeOutcome[] = [pSlot, gp1Slot, gp2Slot].map((slot) => {
    const assessment = evaluateParentingBranch(slot, ancestors, overlay, context.target);
    const onTarget = (name: string): boolean => {
      const aptitude = APTITUDE_KEYS.includes(name as AptitudeKey) ? name as AptitudeKey : null;
      return aptitude != null && wantedAptitude(aptitudeGroup(aptitude), target) === aptitude;
    };
    const forecasts = minmax.slots.find((entry) => entry.slot === slot)?.forecasts ?? [];
    return {
      slot,
      targets: assessment.projections.flatMap((projection) => projection.target
        ? [{ aptitude: projection.aptitude, target: projection.target, projected: projection.projected, met: projection.targetStatus === "met" }]
        : []),
      genetics: assessment.whiteFactors
        .filter((factor) => onTarget(factor.name))
        .map((factor) => ({ aptitude: factor.name as AptitudeKey, stars: factor.availablePinkStars, status: factor.status })),
      junk: forecasts.filter((forecast) => forecast.stars > 0)
        .map((forecast) => ({ aptitude: forecast.aptitude, stars: forecast.stars, risk: forecast.risk })),
      retrainingNote: ancestors[slot]?.source === "veteran",
    };
  });

  const reachable = (genetic: SparkGeneticOutcome) => genetic.stars >= GENETIC_ROLL_STARS;
  const obtainableGenetics = trainees.reduce((sum, trainee) => sum + trainee.genetics.filter(reachable).length, 0);
  const expectedGenetics = trainees.reduce((sum, trainee) =>
    sum + trainee.genetics.reduce((inner, genetic) =>
      inner + (genetic.stars >= GENETIC_GUARANTEE_STARS ? 1 : genetic.stars >= GENETIC_ROLL_STARS ? 0.4 : 0), 0), 0);

  const junkWarnings = trainees.flatMap((trainee) =>
    trainee.junk.filter((entry) => entry.risk === "frequent" || entry.risk === "guaranteed")
      .map((entry) => `${trainee.slot}: off-target ${entry.aptitude} pool at ${entry.stars}★ (${entry.risk} junk genetic risk)`));
  const warnings: string[] = [];
  const missingCategories = (["surface", "distance", "style"] as const).filter((group) => wantedAptitude(group, target) == null);
  if (missingCategories.length === 3) warnings.push("No course or style set on the Global Track Bar — genetics priority is disabled; only aptitude targets drive the plan.");
  else if (missingCategories.length) warnings.push(`Global Track Bar is missing ${missingCategories.join(" and ")} — that category gets no genetic credit and no junk rule.`);
  for (const trainee of trainees) {
    const unmet = trainee.targets.filter((entry) => !entry.met);
    for (const entry of unmet) warnings.push(`${trainee.slot}: ${entry.aptitude} target ${entry.target} unmet (projected ${entry.projected}).`);
    if (trainee.retrainingNote) warnings.push(`${trainee.slot} is an imported veteran — this plan describes a future retraining run, not the imported one.`);
  }

  return { branch, assignments, kept, trainees, obtainableGenetics, expectedGenetics, junkWarnings, warnings };
}
