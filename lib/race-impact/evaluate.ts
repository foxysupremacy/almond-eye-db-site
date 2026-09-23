import type { Course } from "../skill-engine/types";
import type { RunningStyle } from "../deck/types";
import { calculateStyleRankOverlap } from "../evaluator/rank-parser";
import { classifyEffect, type RawEffect } from "../evaluator/effects";
import type { EvaluatorZoneInput, SkillDetailInput } from "../evaluator/types";
import type { RaceImpactPriorsPayload } from "./types";
import type {
  ActivationEstimate,
  RaceImpactProfile,
  RaceImpactResult,
  RaceImpactSample,
  TacticalScoreBreakdown,
} from "./types";
import { dynamicConditionKeys, lookupDynamicPrior } from "./prior";
import { generateRaceTrace, computeGainDistribution } from "./trace";

const BASHIN_METERS = 2.5;

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function scaledDuration(baseTime: number | null | undefined, courseLength: number): number {
  return baseTime && baseTime > 0 ? (baseTime / 10_000) * (courseLength / 1_000) : 0;
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

function dependsOnPreviousTrigger(condition: string | null | undefined, precondition: string | null | undefined): boolean {
  return `${condition ?? ""}&${precondition ?? ""}`.includes("is_activate_other_skill_detail==1");
}

export interface RaceImpactContext {
  course: Course | null | undefined;
  runningStyle: RunningStyle | null | undefined;
  racerCount: number;
  raceParams?: { groundCondition?: number | string | null };
  profile: RaceImpactProfile;
  priors?: RaceImpactPriorsPayload;
}

/**
 * A small, intentionally transparent baseline-vs-skill model. It only models
 * direct velocity/acceleration effects; the result is a comparison metric, not
 * a full race or win-probability simulation.
 */
export function evaluateTriggerRaceImpact(
  skill: SkillDetailInput,
  zones: EvaluatorZoneInput[],
  context: RaceImpactContext,
): RaceImpactResult {
  const course = context.course;
  const group = skill.conditionGroups?.[0];
  const effects = (group?.effects ?? []) as RawEffect[];
  const regions = zones.flatMap((zone) => zone.regions);
  const courseLength = course?.length ?? 2_000;
  const spurt = course?.spurtStart?.meters ?? Math.round(courseLength * 2 / 3);
  const durationSeconds = scaledDuration(group?.base_time, courseLength);
  const start = regions.length ? Math.min(...regions.map((region) => region.start)) : null;
  const end = regions.length ? Math.max(...regions.map((region) => region.end)) : null;
  const estimatedCoverage = start === null ? 0 : durationSeconds * phaseVelocity(start, spurt);

  const allDynamicKeys = dynamicConditionKeys(group?.condition, group?.precondition);
  const isChainedDetail = dependsOnPreviousTrigger(group?.condition, group?.precondition);
  // A chained detail is evaluated conditional on the preceding detail firing.
  // Its dependency is applied once by aggregateRaceImpact("chain"), never as a
  // made-up independent 50% telemetry roll inside this trigger.
  const dynamicKeys = allDynamicKeys.filter((key) => key !== "other_skill");
  const priorLookups = dynamicKeys.map((key) => {
    const override = context.profile.dynamicOverrides[key];
    if (override !== undefined) return { probability: override, source: "manual" as const, samples: 0 };
    return lookupDynamicPrior(context.priors, key, {
      courseId: course?.id,
      groundCondition: typeof context.raceParams?.groundCondition === "number" ? context.raceParams.groundCondition : undefined,
      runningStyle: context.runningStyle,
      racerCount: context.racerCount,
    });
  });
  const dynamicRate = priorLookups.reduce((rate, prior) => rate * prior.probability, 1);
  const primaryPrior = priorLookups.sort((a, b) => b.samples - a.samples)[0];
  const rank = context.runningStyle && group
    ? calculateStyleRankOverlap(`${group.condition ?? ""}&${group.precondition ?? ""}`, context.runningStyle, context.racerCount)
    : null;
  const rankRate = rank?.hasOrderCondition ? rank.positionOverlap : 1;
  const wisdomRate = clamp(Math.max(100 - 9_000 / Math.max(1, context.profile.stats.wisdom), 20) / 100);
  const geometryRate = regions.length ? 1 : 0;
  const activation: ActivationEstimate = {
    geometryRate,
    wisdomRate,
    rankRate,
    dynamicRate,
    dependsOnPreviousTrigger: isChainedDetail,
    activationRate: geometryRate * wisdomRate * rankRate * dynamicRate,
    dynamicKeys: allDynamicKeys,
    priorSource: primaryPrior?.source ?? "manual",
    priorSamples: priorLookups.reduce((total, prior) => total + prior.samples, 0),
    confidence: primaryPrior?.samples >= 100 ? "high" : primaryPrior?.samples >= 30 ? "medium" : "low",
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

  const hasZenkai = effects.some((effect) => classifyEffect(effect) === "zenkai_acceleration");
  const modelable = effects.filter((effect) => {
    const category = classifyEffect(effect);
    return category === "current_speed" || category === "target_speed" || category === "acceleration";
  });
  const samples: RaceImpactSample[] = [];
  if (start !== null && modelable.length) {
    const representativeMeters = regions.flatMap((region) => region.start === region.end ? [region.start] : [region.start, (region.start + region.end) / 2, region.end]);
    for (const meter of representativeMeters) {
      const velocity = phaseVelocity(meter, spurt);
      let distanceGain = 0;
      for (const effect of modelable) {
        const value = (effect.value ?? 0) / 10_000;
        const category = classifyEffect(effect);
        if (category === "current_speed") distanceGain += value * durationSeconds;
        else if (category === "target_speed") distanceGain += value * durationSeconds * (meter < spurt + 130 ? 0.55 : 0.85);
        else if (category === "acceleration") distanceGain += 0.5 * value * Math.min(durationSeconds, 5) ** 2 * timingQuality;
      }
      const timeGain = distanceGain / Math.max(1, velocity);
      samples.push({ activationMeter: Math.round(meter), timeGainSeconds: timeGain, distanceGainMeters: distanceGain, bashin: distanceGain / BASHIN_METERS });
    }
  }
  const bashin = samples.map((sample) => sample.bashin);
  const meanBashin = bashin.length ? bashin.reduce((total, value) => total + value, 0) / bashin.length : null;
  const meanDistance = samples.length ? samples.reduce((total, sample) => total + sample.distanceGainMeters, 0) / samples.length : null;
  const meanTime = samples.length ? samples.reduce((total, sample) => total + sample.timeGainSeconds, 0) / samples.length : null;
  const physicsStatus = hasZenkai ? "provisional" : samples.length ? "modeled" : effects.length ? "partial" : "not-modeled";
  const trace = generateRaceTrace(skill, {
    course: context.course,
    profile: context.profile,
    runningStyle: context.runningStyle,
    racerCount: context.racerCount,
  }, null, zones);

  const distribution = computeGainDistribution(skill, zones, {
    course: context.course,
    profile: context.profile,
    runningStyle: context.runningStyle,
    racerCount: context.racerCount,
  }, activation);

  return {
    activation,
    tactical,
    usefulRate: samples.length ? activation.activationRate : 0,
    expectedTimeGainSeconds: meanTime === null ? null : meanTime * activation.activationRate,
    expectedDistanceGainMeters: meanDistance === null ? null : meanDistance * activation.activationRate,
    expectedBashin: meanBashin === null ? null : meanBashin * activation.activationRate,
    minBashin: bashin.length ? Math.min(...bashin) : null,
    meanBashin,
    medianBashin: median(bashin),
    maxBashin: bashin.length ? Math.max(...bashin) : null,
    samples,
    physicsStatus,
    physicsNote: hasZenkai
      ? "Zenkai Spurt Acceleration is shown as a provisional raw effect; its Power-scaled mechanics are not simulated."
      : samples.length ? undefined : "This effect has tactical value but is outside the direct velocity/acceleration physics model.",
    trace,
    distribution,
  };
}

/** Combine trigger impacts without turning alternative condition groups into additive effects. */
export function aggregateRaceImpact(
  impacts: RaceImpactResult[],
  mode: "chain" | "alternative",
): RaceImpactResult | undefined {
  if (!impacts.length) return undefined;
  if (impacts.length === 1) return impacts[0];
  const activationRate = mode === "chain"
    ? impacts.reduce((rate, impact) => rate * impact.activation.activationRate, 1)
    : Math.min(1, impacts.reduce((rate, impact) => rate + impact.activation.activationRate, 0));
  const conditional = (field: "expectedTimeGainSeconds" | "expectedDistanceGainMeters" | "expectedBashin") =>
    impacts.reduce((total, impact) => {
      const value = impact[field];
      const ownRate = impact.activation.activationRate;
      return total + (value === null || ownRate <= 0 ? 0 : value / ownRate);
    }, 0);
  const alternativeWeight = impacts.reduce((total, impact) => total + impact.activation.activationRate, 0);
  const scaled = (field: "expectedTimeGainSeconds" | "expectedDistanceGainMeters" | "expectedBashin") => {
    if (mode === "chain") return conditional(field) * activationRate;
    if (!alternativeWeight) return null;
    const weightedConditional = impacts.reduce((total, impact) => {
      const ownRate = impact.activation.activationRate;
      const value = impact[field];
      return total + (value === null ? 0 : (value / Math.max(ownRate, 1e-9)) * (ownRate / alternativeWeight));
    }, 0);
    return weightedConditional * activationRate;
  };
  const allBashin = impacts.flatMap((impact) => impact.samples.map((sample) => sample.bashin));
  const tactical = impacts.reduce<TacticalScoreBreakdown>((total, impact) => ({
    activation: mode === "chain" ? total.activation + impact.tactical.activation : Math.max(total.activation, impact.tactical.activation),
    effect: mode === "chain" ? total.effect + impact.tactical.effect : Math.max(total.effect, impact.tactical.effect),
    timing: mode === "chain" ? total.timing + impact.tactical.timing : Math.max(total.timing, impact.tactical.timing),
    duration: mode === "chain" ? total.duration + impact.tactical.duration : Math.max(total.duration, impact.tactical.duration),
    coverage: mode === "chain" ? total.coverage + impact.tactical.coverage : Math.max(total.coverage, impact.tactical.coverage),
    total: 0,
  }), { activation: 0, effect: 0, timing: 0, duration: 0, coverage: 0, total: 0 });
  tactical.total = tactical.activation + tactical.effect + tactical.timing + tactical.duration + tactical.coverage;
  const primary = impacts.reduce((best, impact) => impact.activation.priorSamples > best.activation.priorSamples ? impact : best);
  return {
    ...primary,
    activation: {
      ...primary.activation,
      activationRate,
      dynamicRate: mode === "chain" ? impacts.reduce((rate, impact) => rate * impact.activation.dynamicRate, 1) : primary.activation.dynamicRate,
      dependsOnPreviousTrigger: mode === "chain" && impacts.some((impact) => impact.activation.dependsOnPreviousTrigger),
    },
    tactical,
    usefulRate: activationRate,
    expectedTimeGainSeconds: scaled("expectedTimeGainSeconds"),
    expectedDistanceGainMeters: scaled("expectedDistanceGainMeters"),
    expectedBashin: scaled("expectedBashin"),
    minBashin: allBashin.length ? Math.min(...allBashin) : null,
    meanBashin: allBashin.length ? allBashin.reduce((sum, value) => sum + value, 0) / allBashin.length : null,
    medianBashin: median(allBashin),
    maxBashin: allBashin.length ? Math.max(...allBashin) : null,
    samples: impacts.flatMap((impact) => impact.samples),
    physicsStatus: impacts.some((impact) => impact.physicsStatus === "provisional") ? "provisional" : impacts.some((impact) => impact.physicsStatus === "partial") ? "partial" : "modeled",
    physicsNote: mode === "chain" ? "Aggregate impact requires every chained trigger to activate." : "Aggregate impact is a probability-weighted mixture of alternative trigger paths.",
    trace: primary.trace ?? impacts.find((i) => i.trace)?.trace,
    distribution: primary.distribution ?? impacts.find((i) => i.distribution)?.distribution,
  };
}
