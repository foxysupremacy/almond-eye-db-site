import type { Course } from "../skill-engine/types";
import type { RunningStyle } from "../deck/types";
import { classifyEffect, type RawEffect } from "../evaluator/effects";
import type { EvaluatorZoneInput, SkillDetailInput } from "../evaluator/types";
import {
  BASHIN_METERS,
  type ActivationEstimate,
  type RaceImpactProfile,
  type RaceImpactResult,
  type RaceImpactSample,
  type TacticalScoreBreakdown,
} from "./types";
import { dynamicConditionKeys } from "./prior";
import { generateRaceTrace, computeGainDistribution, scaledDuration, type ChainedTriggerZone } from "./trace";
import { placedTriggerIndices, resolveConditionGroup } from "./condition-group";
import { activationFactors, scoreSkill } from "./score";

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function phaseVelocity(meter: number, spurt: number): number {
  return meter >= spurt ? 26 : meter < spurt / 3 ? 18 : 20.5;
}

function effectMagnitude(effects: RawEffect[]): number {
  return effects.reduce((total, effect) => {
    const category = classifyEffect(effect);
    if (category === "acceleration" || category === "zenkai_acceleration" || category === "target_speed" || category === "current_speed") {
      return total + Math.abs(effect.value ?? 0) / 10_000;
    }
    if (category === "heal") return total + Math.abs(effect.value ?? 0) / 10_000 * 0.55;
    if (category === "passive" || category === "debuff") return total + Math.abs(effect.value ?? 0) / 10_000 * 0.35;
    return total;
  }, 0);
}

function isModelableEffect(effect: RawEffect): boolean {
  const category = classifyEffect(effect);
  return category === "current_speed" || category === "target_speed" || category === "acceleration";
}

function dependsOnPreviousTrigger(condition: string | null | undefined, precondition: string | null | undefined): boolean {
  return `${condition ?? ""}&${precondition ?? ""}`.includes("is_activate_other_skill_detail==1");
}

export interface RaceImpactContext {
  course: Course | null | undefined;
  runningStyle: RunningStyle | null | undefined;
  racerCount: number;
  raceParams?: { groundCondition?: number | string | null };
  profile: RaceImpactProfile;
  /** Unique-skill level used for the effect multiplier; default Lv1, same as the Rankings/modal callers. */
  uniqueLevel?: number;
}

/**
 * Visualizer race impact. R14: every headline number (expected/mean/min/max/median Bashin, activation rate,
 * usefulRate, expected distance/time gain) comes from `scoreSkill`, the engine the Rankings and the effect modal
 * use, so all three agree. The per-meter distribution (gain-by-meter tooltip, optimalMeter) and the speed trace
 * are illustrations built on the same placed triggers and activation rate.
 */
export function evaluateTriggerRaceImpact(
  skill: SkillDetailInput,
  zones: EvaluatorZoneInput[],
  context: RaceImpactContext,
): RaceImpactResult {
  const course = context.course;
  const groundCondition = typeof context.raceParams?.groundCondition === "number" ? context.raceParams.groundCondition : undefined;
  const uniqueLevel = context.uniqueLevel ?? 1;
  const groupCount = skill.conditionGroups?.length ?? 0;
  const aligned = groupCount > 0 && zones.length === groupCount;
  // Caller zones aligned per group: the first placeable group with a non-empty zone is the one that fires
  // (placedTriggerIndices, the rule scoreSkill uses). Otherwise resolve the group from the course geometry.
  const alignedPlaced = aligned ? placedTriggerIndices(skill.conditionGroups ?? [], zones, skill.id) : [];
  const alignedIndex = alignedPlaced.length ? alignedPlaced[0] : -1;
  const resolved = !aligned && course
    ? resolveConditionGroup(skill, course, { groundCondition }, context.runningStyle ?? null)
    : null;
  const groupIndex = aligned ? Math.max(0, alignedIndex) : resolved?.index ?? 0;
  // R7.3: chained later groups (is_activate_other_skill_detail) run in the same simulated race.
  const chained: ChainedTriggerZone[] = aligned
    ? alignedPlaced.slice(1).map((i) => ({ groupIndex: i, regions: zones[i].regions, isRandom: zones[i].isRandom }))
    : (resolved?.triggers ?? []).slice(1).map((t) => ({ groupIndex: t.index, regions: [...t.zones.regions], isRandom: t.zones.isRandom }));
  const traceOptions = { groupIndex, chained, uniqueLevel };
  const group = skill.conditionGroups?.[groupIndex];
  // Only the resolved group's zone may value meters; none firing means geometry 0.
  const activeZones: EvaluatorZoneInput[] = aligned ? (alignedIndex >= 0 ? [zones[alignedIndex]] : []) : zones;
  const effects = (group?.effects ?? []) as RawEffect[];
  const placedEffects = [...effects, ...chained.flatMap((c) => (skill.conditionGroups?.[c.groupIndex]?.effects ?? []) as RawEffect[])];
  const regions = activeZones.flatMap((zone) => zone.regions);
  const courseLength = course?.length ?? 2_000;
  const spurt = course?.spurtStart?.meters ?? Math.round(courseLength * 2 / 3);
  const durationSeconds = scaledDuration(group?.base_time, courseLength);
  const start = regions.length ? Math.min(...regions.map((region) => region.start)) : null;
  const estimatedCoverage = start === null ? 0 : durationSeconds * phaseVelocity(start, spurt);

  // The single engine (R14). Caller zones are handed over when aligned so the headline, distribution and trace
  // are all built on the same zones; otherwise scoreSkill resolves them from the course geometry.
  const score = course && context.runningStyle
    ? scoreSkill({
      skill, course, raceParams: { groundCondition }, style: context.runningStyle, racerCount: context.racerCount,
      profile: context.profile, uniqueLevel, withSamples: true, zones: aligned ? zones : undefined,
    })
    : null;

  const allDynamicKeys = dynamicConditionKeys(group?.condition, group?.precondition);
  const isChainedDetail = dependsOnPreviousTrigger(group?.condition, group?.precondition);
  // A chained detail is evaluated as part of the full skill: scoreSkill places it in the same simulated race as the
  // trigger it depends on (R7.3), so it is never given an extra independent telemetry roll. R7.4/R14: dynamic
  // conditions count as satisfied unless the profile overrides them; telemetry priors are not multiplied in.
  const { dynamicRate } = activationFactors(group, context.profile);
  const geometryRate = regions.length ? 1 : 0;
  const activation: ActivationEstimate = {
    geometryRate,
    dynamicRate,
    dependsOnPreviousTrigger: isChainedDetail,
    activationRate: score ? score.activationRate : geometryRate * dynamicRate,
    dynamicKeys: allDynamicKeys,
    // Priors are no longer used (R14): these fields are filled consistently as "manual / 0 samples".
    priorSource: "manual",
    priorSamples: 0,
    confidence: "low",
  };

  const magnitude = effectMagnitude(effects);
  const timingQuality = start === null ? 0 : effects.some((effect) => classifyEffect(effect) === "acceleration")
    ? clamp(1 - Math.abs(start - spurt) / 180)
    : effects.some((effect) => classifyEffect(effect) === "target_speed" || classifyEffect(effect) === "current_speed")
      ? start >= spurt ? 1 : clamp(0.55 + Math.max(0, start + estimatedCoverage - spurt) / 300)
      : 0.65;
  const tactical: TacticalScoreBreakdown = {
    activation: Math.round(activation.activationRate * 45),
    effect: Math.round(magnitude * 48),
    timing: Math.round(timingQuality * 34),
    duration: Math.round(clamp(durationSeconds / 5, 0, 1.5) * 18),
    coverage: Math.round(clamp(estimatedCoverage / 120, 0, 1.5) * 16),
    total: 0,
  };
  tactical.total = tactical.activation + tactical.effect + tactical.timing + tactical.duration + tactical.coverage;

  const hasZenkai = placedEffects.some((effect) => classifyEffect(effect) === "zenkai_acceleration");
  const traceContext = { course: context.course, profile: context.profile, runningStyle: context.runningStyle, racerCount: context.racerCount, groundCondition };
  // Per-meter "what if it fired here" curve for the tooltip; its per-sample rates use the headline activation rate.
  const distribution = computeGainDistribution(skill, activeZones, traceContext, activation, traceOptions);
  // Task 3: a passive stat group (duration -1) is modeled by re-running the race with the boosted stats (scoreSkill).
  const modelable = placedEffects.some(isModelableEffect) || score?.physicsStatus === "modeled";
  const scored = modelable && score ? score.samples : [];
  const samples: RaceImpactSample[] = scored.map((sample) => ({
    activationMeter: sample.meter,
    distanceGainMeters: sample.bashin * BASHIN_METERS,
    timeGainSeconds: sample.timeGainSeconds ?? 0,
    bashin: sample.bashin,
  }));
  const hasHeadline = score !== null && samples.length > 0;
  const weightSum = scored.reduce((total, sample) => total + sample.weight, 0) || 1;
  const meanTime = scored.reduce((total, sample) => total + (sample.timeGainSeconds ?? 0) * sample.weight, 0) / weightSum;
  const physicsStatus = hasZenkai ? "provisional" : modelable && samples.length ? "modeled" : effects.length ? "partial" : "not-modeled";
  // R7.5: a deterministic trigger is drawn at its region start, matching the headline; a random one at its best meter.
  const randomFirst = activeZones.some((zone) => zone.isRandom);
  const traceMeter = !randomFirst
    ? undefined
    : distribution.optimalGainMeters != null && distribution.optimalGainMeters > 0 ? distribution.optimalMeter : null;
  const trace = generateRaceTrace(skill, traceContext, traceMeter, activeZones, traceOptions);

  return {
    activation,
    tactical,
    usefulRate: score ? score.usefulRate : 0,
    expectedTimeGainSeconds: hasHeadline ? meanTime * score!.activationRate : null,
    expectedDistanceGainMeters: hasHeadline ? score!.expectedBashin * BASHIN_METERS : null,
    expectedBashin: hasHeadline ? score!.expectedBashin : null,
    minBashin: hasHeadline ? score!.minBashin : null,
    meanBashin: hasHeadline ? score!.meanBashin : null,
    medianBashin: hasHeadline ? score!.medianBashin : null,
    maxBashin: hasHeadline ? score!.maxBashin : null,
    samples,
    physicsStatus,
    physicsNote: hasZenkai
      ? "Zenkai Spurt Acceleration is shown as a provisional raw effect; its Power-scaled mechanics are not simulated."
      : samples.length ? undefined : "This effect has tactical value but is outside the direct velocity/acceleration physics model.",
    trace,
    distribution,
  };
}
