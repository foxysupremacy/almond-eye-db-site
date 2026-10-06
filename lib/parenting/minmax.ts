import type { CharacterIndexEntry } from "../data/types";
import type { Course } from "../skill-engine/types";
import { successionFactors } from "../data/registry";
import {
  APTITUDE_KEYS, LOOP_UMA_SLOTS, PARENT_WHITE_TARGET_SLOTS, WHITE_FACTOR_APTITUDE,
  branchSourceSlots, evaluateParentingBranch, factorPlan,
  type AptitudeKey, type BranchAssessment, type LoopAncestorSlot,
  type LoopCandidate, type LoopUmaSlot, type ParentingLoopConfig,
} from "./loop-planner";

export type GeneticRisk = "low" | "frequent" | "guaranteed" | "unknown";
export interface AceGeneticTarget {
  surface: AptitudeKey | null;
  distance: AptitudeKey | null;
  style: AptitudeKey | null;
}
export interface PinkContribution {
  slot: LoopAncestorSlot;
  stars: number;
  known: boolean;
}
export interface GeneticForecast {
  aptitude: AptitudeKey;
  stars: number;
  risk: GeneticRisk;
  complete: boolean;
  sources: PinkContribution[];
}
export interface SlotGeneticAssessment {
  slot: LoopUmaSlot;
  useActual: boolean;
  actualKnown: boolean;
  actual: { aptitude: AptitudeKey; stars: number }[];
  forecasts: GeneticForecast[];
  mismatchedTargets: AptitudeKey[];
}
export interface MinmaxScore {
  aptitudeGaps: number;
  actualJunk: number;
  guaranteed: number;
  frequent: number;
  unknown: number;
  g1: number;
}
export interface ParentingMinmaxAssessment {
  target: AceGeneticTarget;
  slots: SlotGeneticAssessment[];
  score: MinmaxScore;
}
export interface ParentingMinmaxContext {
  ancestors: Partial<Record<LoopAncestorSlot, LoopCandidate | null>>;
  config: ParentingLoopConfig;
  target?: CharacterIndexEntry | null;
  course?: Course | null;
  runningStyle?: number | null;
}

/** Missing/invalid selections stay unknown; do not default them to Turf/Runner. */
export function aceGeneticTarget(course?: Course | null, style?: number | null): AceGeneticTarget {
  const distances: Record<number, AptitudeKey> = { 1: "Sprint", 2: "Mile", 3: "Medium", 4: "Long" };
  const styles: Record<number, AptitudeKey> = { 1: "Runner", 2: "Leader", 3: "Betweener", 4: "Chaser" };
  const bucket = course && (distances[course.distance] ? course.distance : course.length > 0
    ? course.length <= 1400 ? 1 : course.length <= 1800 ? 2 : course.length <= 2400 ? 3 : 4 : null);
  return {
    surface: course?.terrain === 1 ? "Turf" : course?.terrain === 2 ? "Dirt" : null,
    distance: bucket == null ? null : distances[bucket] ?? null,
    style: style == null ? null : styles[style] ?? null,
  };
}

export function isUnwantedGenetic(aptitude: AptitudeKey, target: AceGeneticTarget): boolean {
  const index = APTITUDE_KEYS.indexOf(aptitude);
  const wanted = index < 2 ? target.surface : index < 6 ? target.distance : target.style;
  return wanted != null && aptitude !== wanted;
}

/** Thresholds are the configured planning model, not measured probabilities. */
export function geneticRisk(stars: number, complete: boolean): GeneticRisk {
  return stars >= 12 ? "guaranteed" : stars >= 6 ? "frequent" : complete ? "low" : "unknown";
}

const RANKS = ["G", "F", "E", "D", "C", "B", "A", "S"];
function aptitudeGap(assessment: BranchAssessment): number {
  return assessment.projections.reduce((sum, entry) => {
    const required = entry.needsOutputA ? "A" : entry.target;
    return sum + (required && RANKS.includes(entry.projected)
      ? Math.max(0, RANKS.indexOf(required) - RANKS.indexOf(entry.projected)) : 0);
  }, 0);
}

function assessForUse(context: ParentingMinmaxContext, slot: LoopUmaSlot): BranchAssessment {
  const candidate = context.ancestors[slot];
  if (candidate?.source !== "veteran") return evaluateParentingBranch(slot, context.ancestors, context.config, context.target);
  // Equipped veterans keep their trained aptitudes. Their edited donors only
  // describe a future retraining run, not a second boost on the imported run.
  const factorGoals = { ...context.config.factorGoals, [slot]: { pink: null, pinkStars: 0 } };
  for (const source of branchSourceSlots(slot)) factorGoals[source] = { pink: null, pinkStars: 0 };
  return evaluateParentingBranch(slot, { ...context.ancestors, [slot]: { ...candidate, baseAptitude: candidate.aptitude } }, { ...context.config, factorGoals }, context.target);
}

export function evaluateParentingMinmax(context: ParentingMinmaxContext): ParentingMinmaxAssessment {
  const { ancestors, config } = context;
  const target = aceGeneticTarget(context.course, context.runningStyle);
  const slots = PARENT_WHITE_TARGET_SLOTS.map((slot): SlotGeneticAssessment => {
    const candidate = ancestors[slot];
    const useActual = candidate?.source === "veteran";
    const actualKnown = Boolean(useActual && candidate.factorKnowledge);
    const actual = new Map<AptitudeKey, number>();
    if (useActual) for (const id of candidate.factorIds) {
      const factor = successionFactors.factors.find((entry) => entry.factorId === id);
      const aptitude = factor && [8, 10, 11].includes(factor.factorType) ? WHITE_FACTOR_APTITUDE[factor.factorGroupId] : undefined;
      if (aptitude && isUnwantedGenetic(aptitude, target)) actual.set(aptitude, Math.max(actual.get(aptitude) ?? 0, factor!.rarity));
    }
    const sourceSlots = branchSourceSlots(slot);
    const plans = sourceSlots.map((source) => ({ slot: source, ...factorPlan(ancestors[source], source, config) }));
    const complete = sourceSlots.length === 6 && plans.every((plan) => plan.known);
    const forecasts = APTITUDE_KEYS.filter((aptitude) => isUnwantedGenetic(aptitude, target)).map((aptitude): GeneticForecast => {
      const sources = plans.filter((plan) => plan.pink === aptitude).map((plan) => ({ slot: plan.slot, stars: plan.stars, known: plan.known }));
      const stars = sources.reduce((sum, source) => sum + source.stars, 0);
      return { aptitude, stars, complete, risk: geneticRisk(stars, complete), sources };
    });
    return {
      slot, useActual, actualKnown, actual: [...actual].map(([aptitude, stars]) => ({ aptitude, stars })), forecasts,
      mismatchedTargets: (config.slotWhiteTargets?.[slot] ?? []).filter((aptitude) => isUnwantedGenetic(aptitude, target)),
    };
  });
  const score: MinmaxScore = { aptitudeGaps: 0, actualJunk: 0, guaranteed: 0, frequent: 0, unknown: 0, g1: 0 };
  for (const slot of LOOP_UMA_SLOTS) {
    if (!ancestors[slot]) continue;
    const assessment = assessForUse(context, slot);
    score.aptitudeGaps += aptitudeGap(assessment);
    score.unknown += assessment.projections.filter((entry) => (entry.target || entry.needsOutputA) && (entry.projected === "?" || entry.targetStatus === "unknown")).length;
    score.g1 += assessment.g1.schedulableCount;
  }
  for (const slot of slots) {
    score.actualJunk += slot.actual.length;
    if (slot.useActual) {
      // An already trained run does not reroll its factors when equipped.
      if (!slot.actualKnown) score.unknown++;
      continue;
    }
    for (const forecast of slot.forecasts) {
      if (forecast.risk === "guaranteed") score.guaranteed++;
      else if (forecast.risk === "frequent") score.frequent++;
      else if (forecast.risk === "unknown") score.unknown++;
    }
  }
  return { target, slots, score };
}

/** Ascending comparator; affinity and other ties remain the caller's metrics. */
export function compareMinmax(a?: MinmaxScore, b?: MinmaxScore): number {
  if (!a || !b) return a ? -1 : b ? 1 : 0;
  return a.aptitudeGaps - b.aptitudeGaps || a.actualJunk - b.actualJunk ||
    a.guaranteed - b.guaranteed || a.frequent - b.frequent || a.unknown - b.unknown || b.g1 - a.g1;
}

export interface PinkReductionSuggestion {
  changes: { slot: LoopAncestorSlot; from: number; to: number; retrain: boolean; replacement?: { pink: AptitudeKey; stars: number } }[];
  aptitudeChanges: { slot: LoopUmaSlot | "target"; aptitude: AptitudeKey; before: string; after: string; required?: string }[];
  totalStars: number;
  preservesAptitude: boolean;
  complete: boolean;
  lostG1: number;
  aptitudeGaps: number;
}

/** Local star reductions only. No identities, goals, or saved state are mutated. */
export function suggestPinkReduction(context: ParentingMinmaxContext, slot: LoopUmaSlot, aptitude: AptitudeKey): PinkReductionSuggestion | null {
  const forecast = evaluateParentingMinmax(context).slots.find((entry) => entry.slot === slot)?.forecasts.find((entry) => entry.aptitude === aptitude);
  if (!forecast || forecast.stars < 6) return null;
  const lineageComplete = forecast.complete;
  const sources = forecast.sources.filter((source) => source.stars > 0);
  const affected = LOOP_UMA_SLOTS.filter((branch) => context.ancestors[branch] && branchSourceSlots(branch).some((source) => sources.some((entry) => entry.slot === source)));
  const before = affected.map((branch) => evaluateParentingBranch(branch, context.ancestors, context.config, context.target));
  const beforeG1 = before.reduce((sum, branch) => sum + branch.g1.schedulableCount, 0);
  let best: PinkReductionSuggestion | null = null;
  function visit(index: number, stars: number[], total: number) {
    if (total > 5) return;
    if (index < sources.length) {
      for (let count = 0; count <= sources[index].stars; count++) visit(index + 1, [...stars, count], total + count);
      return;
    }
    const changes = sources.flatMap((source, index) => stars[index] === source.stars ? [] : [{ slot: source.slot, from: source.stars, to: stars[index], retrain: context.ancestors[source.slot]?.source === "veteran" }]);
    const factorGoals = { ...context.config.factorGoals };
    for (const change of changes) factorGoals[change.slot] = { ...factorGoals[change.slot], pink: change.to ? aptitude : null, pinkStars: change.to };
    const config = { ...context.config, factorGoals };
    const after = affected.map((branch) => evaluateParentingBranch(branch, context.ancestors, config, context.target));
    const complete = lineageComplete && Boolean(context.ancestors[slot]) && after.every((branch) => branch.projections.every((entry) => !entry.target && !entry.needsOutputA || entry.projected !== "?" && entry.targetStatus !== "unknown"));
    const gaps = after.reduce((sum, branch) => sum + aptitudeGap(branch), 0);
    const preservesAptitude = complete && gaps === 0;
    const lostG1 = Math.max(0, beforeG1 - after.reduce((sum, branch) => sum + branch.g1.schedulableCount, 0));
    const suggestion: PinkReductionSuggestion = { changes, totalStars: total, preservesAptitude, complete, lostG1, aptitudeGaps: gaps, aptitudeChanges: [] };
    const key = (item: PinkReductionSuggestion) => [item.preservesAptitude ? 0 : 1, item.aptitudeGaps, item.lostG1, item.changes.length, item.totalStars];
    const comparison = best ? key(suggestion).map((value, index) => value - key(best!)[index]).find((value) => value !== 0) ?? 0 : -1;
    if (comparison < 0) best = suggestion;
  }
  visit(0, [], 0);
  return best ? explainPinkReduction(context, aptitude, best, lineageComplete, affected) : null;
}

/** Enrich the chosen reduction without changing its search or ranking rules. */
function explainPinkReduction(context: ParentingMinmaxContext, aptitude: AptitudeKey, suggestion: PinkReductionSuggestion, lineageComplete: boolean, originalAffected: LoopUmaSlot[]): PinkReductionSuggestion {
  const factorGoals = { ...context.config.factorGoals };
  for (const change of suggestion.changes) factorGoals[change.slot] = { ...factorGoals[change.slot], pink: change.to ? aptitude : null, pinkStars: change.to };
  let config = { ...context.config, factorGoals };
  const changed = new Set(suggestion.changes.map((change) => change.slot));
  const affected = [...new Set([...originalAffected, ...LOOP_UMA_SLOTS.filter((branch) => context.ancestors[branch] && changed.has(branch))])];
  const assess = (value: ParentingLoopConfig) => affected.map((branch) => evaluateParentingBranch(branch, context.ancestors, value, context.target));
  const before = assess(context.config);
  const target = aceGeneticTarget(context.course, context.runningStyle);
  const matchingGroup = APTITUDE_KEYS.indexOf(aptitude) < 2 ? target.surface : APTITUDE_KEYS.indexOf(aptitude) < 6 ? target.distance : target.style;
  const replacements = [...new Set([matchingGroup, target.surface, target.distance, target.style].filter((value): value is AptitudeKey => value != null))];
  for (const change of suggestion.changes) {
    // An unknown donor cannot justify a new output pink requiring aptitude A.
    if (change.to || !context.ancestors[change.slot] || !LOOP_UMA_SLOTS.includes(change.slot as LoopUmaSlot)) continue;
    const baseline = assess(config);
    let replacement: { pink: AptitudeKey; stars: number } | undefined;
    for (const pink of replacements) {
      for (let stars = change.from; stars >= 1; stars--) {
        const proposed = { ...config, factorGoals: { ...config.factorGoals, [change.slot]: { ...config.factorGoals?.[change.slot], pink, pinkStars: stars } } };
        const donor = evaluateParentingBranch(change.slot as LoopUmaSlot, context.ancestors, proposed, context.target);
        if (RANKS.indexOf(donor.projections.find((entry) => entry.aptitude === pink)?.projected ?? "?") < RANKS.indexOf("A")) continue;
        const after = assess(proposed);
        if (!after.every((branch, index) => aptitudeGap(branch) <= aptitudeGap(baseline[index]) && branch.g1.schedulableCount >= baseline[index].g1.schedulableCount)) continue;
        replacement = { pink, stars };
        config = proposed;
        break;
      }
      if (replacement) break;
    }
    change.replacement = replacement;
  }
  const after = assess(config);
  const complete = suggestion.complete && lineageComplete && after.every((branch) => branch.projections.every((entry) => !entry.target && !entry.needsOutputA || entry.projected !== "?" && entry.targetStatus !== "unknown"));
  const aptitudeGaps = after.reduce((sum, branch) => sum + aptitudeGap(branch), 0);
  const aptitudeChanges = after.flatMap((branch, index) => branch.projections.flatMap((entry, projectionIndex) => {
    const previous = before[index].projections[projectionIndex].projected;
    const ownPink = branch.slot === "target" ? null : factorPlan(context.ancestors[branch.slot], branch.slot, config).pink;
    const required = ownPink === entry.aptitude ? "A" : entry.target;
    const unmet = required && RANKS.indexOf(entry.projected) >= 0 && RANKS.indexOf(entry.projected) < RANKS.indexOf(required);
    return RANKS.indexOf(entry.projected) < RANKS.indexOf(previous) || unmet
      ? [{ slot: branch.slot, aptitude: entry.aptitude, before: previous, after: entry.projected, required: unmet ? required : undefined }] : [];
  }));
  const lostG1 = before.reduce((sum, branch, index) => sum + Math.max(0, branch.g1.schedulableCount - after[index].g1.schedulableCount), 0);
  return { ...suggestion, aptitudeChanges, complete, aptitudeGaps, preservesAptitude: complete && aptitudeGaps === 0, lostG1 };
}
