import type { Course, RaceParameters } from "../skill-engine/types";
import type { RunningStyle } from "../deck/types";
import { defaultRaceImpactProfile } from "../race-impact/profile";
import type { RaceImpactProfile, RaceImpactPriorsPayload } from "../race-impact/types";
import { createApplicationRatingSession } from "../skill-rating/application";
import type { SkillRating, SkillRatingSession } from "../skill-rating/types";
import { getInheritableSkillForGold } from "../skills/rarity";
import { describeEffect } from "./effects";
import { getCategoryBadge } from "./calculation-steps";
import { STYLE_EXPECTED_RANKS } from "./constants";
import type { SkillScalingContext } from "../skill-scaling";
import type { SkillDetailInput, EvaluatorZoneInput, SkillEvaluationResult, SkillTacticalCategory } from "./types";

export interface EvaluationOptions {
  skipTriggerEvaluations?: boolean;
  raceImpactProfile?: RaceImpactProfile;
  /** Retained for call-site compatibility; frame-frequency priors are not activation probabilities. */
  raceImpactPriors?: RaceImpactPriorsPayload;
  session?: SkillRatingSession;
  detail?: "summary" | "full";
  skillScaling?: SkillScalingContext;
}

type CompatibleRaceParameters = Omit<Partial<RaceParameters>, "groundCondition"> & { groundCondition?: number | string | null };

function categoryFor(rating: SkillRating, course: Course | null | undefined): SkillTacticalCategory {
  if (rating.eligibility.state === "ineligible") return "invalid";
  const contribution = [...rating.contributions].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
  const families = rating.selectedPaths.flatMap((path) => path.effects.map(describeEffect));
  const family = contribution?.family ?? families.find((effect) => effect.target === "self" && effect.sign !== "cost")?.family;
  const starts = rating.selectedPaths.flatMap((path) => path.regions.map((region) => region.start));
  const start = starts.length ? Math.min(...starts) : Number.POSITIVE_INFINITY;
  const spurt = course?.spurtStart?.meters ?? (course?.length ?? 2_000) * 2 / 3;
  if (family === "zenkai") return "zenkai_accel";
  if (family === "current_speed_21" || family === "current_speed_22") return "current_speed";
  if (family === "recovery") return "recovery";
  if (family?.startsWith("passive_")) return "passive";
  if (family === "acceleration") {
    if ((contribution?.attributedBenefit ?? rating.simulatedBenefit) <= 0) return "dead_accel";
    if (Math.abs(start - spurt) < 1) return "fastest_accel";
    if (start > spurt) return "delayed_accel";
    const duration = Math.max(0, ...rating.selectedPaths.map((path) => path.duration.seconds ?? 0));
    if (start + duration * 20 > spurt) return "carry_over";
    return "position_accel";
  }
  if (family === "target_speed") {
    if (start >= spurt) return "late_speed";
    if (start < (course?.length ?? 2_000) / 6) return "early_speed";
    return "mid_speed";
  }
  if (families.some((effect) => effect.category === "debuff")) return "debuff";
  return "other";
}

/** Presentation projection only: this function never assigns points or changes tiers. */
function projectSkillRatingFields(rating: SkillRating, course: Course | null | undefined, skill: SkillDetailInput, parentMode = false): SkillEvaluationResult {
  const category = categoryFor(rating, course);
  const courseLength = course?.length ?? 0;
  const spurt = course?.spurtStart?.meters ?? courseLength * 2 / 3;
  const paths = rating.selectedPaths;
  const regions = paths.flatMap((path) => path.regions);
  const start = regions.length ? Math.min(...regions.map((region) => region.start)) : null;
  const end = regions.length ? Math.max(...regions.map((region) => region.end)) : null;
  const duration = Math.max(0, ...paths.map((path) => path.duration.seconds ?? 0));
  const baseDuration = Math.max(0, ...(skill.conditionGroups ?? []).map((group) => (group.base_time ?? 0) / 10_000));
  const durationMeters = rating.trace?.effectEndMeter != null && rating.trace.activationMeter != null
    ? Math.max(0, rating.trace.effectEndMeter - rating.trace.activationMeter) : 0;
  const delay = start == null ? null : start - spurt;
  const summary = rating.eligibility.state === "ineligible" ? rating.eligibility.reasons.join("; ")
    : rating.status === "unavailable" ? [...rating.eligibility.reasons, ...rating.partialReasons].join("; ") || "Insufficient context to rate this skill"
    : `${rating.score.toFixed(1)} benchmark points on the selected track and style. ${rating.status === "complete" ? "" : `${rating.status}: `}${rating.breakdown.join("; ")}`;
  const details: SkillEvaluationResult["specialEffects"] = [];
  for (const [index, assumption] of rating.assumptions.entries()) details.push({ id: `assumption_${index}`, type: "warning", badge: "Conditional", title: assumption.clause, description: assumption.description });
  for (const [index, reason] of [...rating.partialReasons, ...rating.warnings].entries()) details.push({ id: `rating_note_${index}`, type: "warning", badge: rating.status, title: "Rating model limitation", description: reason });
  if (rating.eligibility.state === "ineligible") details.push({ id: "ineligible", type: "error", badge: "Unavailable", title: "Skill cannot activate in this context", description: rating.eligibility.reasons.join("; ") });
  const style = rating.selectedStyle ?? rating.bestStyle;
  const envelope = style == null ? undefined : STYLE_EXPECTED_RANKS[style];
  const rankSet = [...new Set(paths.flatMap(path => path.rankSet))];
  const hasRankCondition = rating.assumptions.some(assumption => assumption.kind === "rank");
  const positionOverlap = hasRankCondition && envelope
    ? rankSet.filter(rank => rank >= envelope[0] && rank <= envelope[1]).length / (envelope[1] - envelope[0] + 1)
    : undefined;
  if (hasRankCondition && envelope && positionOverlap === 0) details.push({ id: "rank_mismatch", type: "warning", badge: "Conditional", title: "Rank condition outside style envelope", description: `The selected style usually occupies positions ${envelope[0]}–${envelope[1]}; the skill condition assumes ${rankSet.join(", ")}.` });
  const physicsStatus = rating.status === "complete" ? "modeled" : rating.status === "unavailable" ? "not-modeled" : rating.status;
  const modeledActivation = rating.eligibility.state === "eligible" && (rating.activationOutcome ?? "activated") === "activated" ? 1 : 0;
  const result: SkillEvaluationResult = {
    canonicalRating: rating,
    score: rating.score, stars: rating.stars, tier: rating.tier, category,
    primaryBadge: getCategoryBadge(category), verdictSummary: summary, specialEffects: details,
    positionOverlap,
    timingAnalysis: { spurtMeters: spurt, triggerStartMeters: start, triggerEndMeters: end, isRandom: paths.some((path) => path.sampling !== "immediate"), durationSeconds: duration, durationMeters, delayFromSpurt: delay, connectsToLateRace: start != null && start < spurt && (rating.trace?.effectEndMeter ?? 0) >= spurt },
    calculationBreakdown: {
      courseLength, spurtLineMeters: spurt, spurtFormula: "Selected course spurt boundary", triggerStartMeters: start, triggerEndMeters: end,
      baseDurationSeconds: baseDuration, scaledDurationSeconds: duration, durationFormula: "Resolved per selected trigger, including duration metadata",
      estimatedDistanceMeters: durationMeters, distanceFormula: "Distance traversed in the modeled effect timeline", delayFromSpurtMeters: delay,
      delayFormula: "trigger start − course spurt boundary", delayStatus: category === "invalid" ? "invalid" : category === "dead_accel" ? "dead" : category === "fastest_accel" ? "optimal" : category === "carry_over" ? "early_overlap" : category === "delayed_accel" ? "delayed" : "mid_race",
      delayExplanation: "Timing is descriptive; points come from the canonical simulation and family benchmarks.", accelPhaseEndMeters: spurt,
      dynamicMathExplanation: rating.breakdown.join("; "),
      steps: rating.breakdown.map((explanation, index) => ({ title: `Rating contribution ${index + 1}`, formula: "Canonical simulation points + explicit Recovery policy points", result: explanation, explanation, badgeType: "neutral" })),
    },
    raceImpact: {
      // Conditional impact is not a calibrated activation forecast. Consumers
      // use canonicalRating assumptions/status to label this legacy field.
      activation: { geometryRate: rating.eligibility.state === "eligible" ? 1 : 0, wisdomRate: 1, rankRate: 1, dynamicRate: 1, dependsOnPreviousTrigger: paths.some((path) => path.dependsOn.length > 0) || rating.assumptions.some((assumption) => assumption.kind === "prerequisite"), activationRate: modeledActivation, dynamicKeys: [], priorSource: "manual", priorSamples: 0, confidence: "low" },
      tactical: { activation: 0, effect: rating.score, timing: 0, duration: 0, coverage: 0, total: rating.score },
      usefulRate: rating.simulatedBenefit > 0 ? 1 : 0,
      expectedTimeGainSeconds: rating.status === "unavailable" ? null : rating.timeGainSeconds,
      expectedDistanceGainMeters: rating.status === "unavailable" ? null : rating.simulatedBenefit,
      expectedBashin: rating.status === "unavailable" ? null : rating.simulatedBenefit / 2.5,
      minBashin: null, meanBashin: rating.status === "unavailable" ? null : rating.simulatedBenefit / 2.5, medianBashin: null, maxBashin: null, samples: [], physicsStatus,
      physicsNote: "Conditional single-Uma modeled impact; dynamic and rank assumptions are not a measured activation probability.", trace: rating.trace, distribution: rating.distribution,
    },
  };
  if (parentMode) {
    const mapping = skill.rarity === 2 ? getInheritableSkillForGold(skill.id) : null;
    result.parentMeta = { isParentMode: true, isGoldTransformed: Boolean(mapping), inheritedWhiteId: mapping?.whiteId, inheritedWhiteNameEn: mapping?.whiteNameEn, inheritedWhiteNameJp: mapping?.whiteNameJp, factorTier: rating.tier };
  }
  return result;
}

/** Existing positional API and return shape project the canonical rating. */
export function projectSkillRating(rating: SkillRating, course: Course | null | undefined, skill: SkillDetailInput, parentMode = false): SkillEvaluationResult {
  const result = projectSkillRatingFields(rating, course, skill, parentMode);
  result.triggerEvaluations = (skill.conditionGroups ?? []).map((_group, triggerIndex) => {
    const selectedPaths = rating.selectedPaths.filter(path => path.triggerIndex === triggerIndex);
    if (!selectedPaths.length) return { triggerIndex, evaluation: null };
    const triggerRating: SkillRating = {
      ...rating,
      selectedPaths,
      assumptions: selectedPaths.flatMap(path => path.assumptions),
      selectedScenarioId: `${rating.selectedScenarioId ?? "rating"}:trigger:${triggerIndex}`,
    };
    return { triggerIndex, evaluation: projectSkillRatingFields(triggerRating, course, skill, parentMode) };
  });
  return result;
}

/** Existing positional API delegates to the shared rating session. Supplied zones
 * remain accepted for compatibility; canonical analysis owns trigger alignment. */
export function evaluateSkillForTrack(skill: SkillDetailInput, course: Course | null | undefined, runningStyle: RunningStyle | null | undefined, racerCount = 9, isParentMode = false, _zones: EvaluatorZoneInput[] = [], raceParams?: CompatibleRaceParameters, options?: EvaluationOptions): SkillEvaluationResult {
  const ground = raceParams?.groundCondition;
  const session = options?.session ?? createApplicationRatingSession({
    course: course ?? null, style: runningStyle ?? null, racerCount,
    raceParameters: { ...raceParams, groundCondition: typeof ground === "string" ? (Number.isFinite(Number(ground)) ? Number(ground) : null) : ground },
    profile: options?.raceImpactProfile ?? defaultRaceImpactProfile(),
    skillScaling: options?.skillScaling,
  });
  const variant = !isParentMode ? "original" : skill.rarity === 2 ? "parent-factor" : skill.rarity === 3 || skill.rarity === 5 ? "inherited-unique" : "original";
  const rating = session.evaluate({ skill, variant }, { detail: options?.detail ?? "full" });
  return projectSkillRating(rating, course, skill, isParentMode);
}
