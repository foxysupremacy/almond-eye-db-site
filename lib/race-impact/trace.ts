import type { Course } from "../skill-engine/types";
import type { RunningStyle } from "../deck/types";
import { classifyEffect, type RawEffect } from "../evaluator/effects";
import type { SkillDetailInput, EvaluatorZoneInput } from "../evaluator/types";
import type {
  ActivationEstimate, ActivationMeterSample, RaceEffectDistribution,
  RaceEffectTrace, RaceImpactProfile, RaceTracePoint, RaceTraceSpatialPoint,
} from "./types";

const BASHIN_METERS = 2.5;
const DT = 1 / 15; // Match the documented ~15 fps race update cadence.
const STRATEGY_PHASE_COEFFICIENT: Record<number, [number, number, number]> = {
  1: [1, 0.98, 0.962],
  2: [0.978, 0.991, 0.975],
  3: [0.938, 0.998, 0.994],
  4: [0.931, 1, 1],
  5: [1.063, 0.962, 0.95],
};

function clamp(value: number, min = 0, max = 1): number { return Math.max(min, Math.min(max, value)); }
function scaledDuration(baseTime: number | null | undefined, courseLength: number): number {
  return baseTime && baseTime > 0 ? (baseTime / 10_000) * (courseLength / 1_000) : 0;
}

export function getPhaseAtMeter(meter: number, courseLength: number, spurt: number): number {
  if (meter >= spurt) return 3;
  if (meter >= (courseLength * 2) / 3) return 2;
  if (meter >= courseLength / 6) return 1;
  return 0;
}

function baseSpeed(courseLength: number): number {
  return 20 - (courseLength - 2_000) / 1_000;
}

/** Mechanics reference target speed. Distance aptitude is assumed to be A (1.0). */
export function getCruisingTargetSpeed(
  phase: number, courseLength: number, stats: RaceImpactProfile["stats"], style?: RunningStyle | null,
): number {
  const base = baseSpeed(courseLength);
  const coefficients = style == null ? null : STRATEGY_PHASE_COEFFICIENT[style];
  const coefficient = coefficients?.[Math.min(2, Math.max(0, phase === 3 ? 2 : phase))] ?? 1;
  const speedStatBonus = Math.sqrt(500 * stats.speed) * 0.002;
  if (phase === 3) {
    const midTarget = base * (coefficients?.[1] ?? 1);
    const gutsBonus = Math.pow(450 * stats.guts, 0.597) * 0.0001;
    return (midTarget + 0.01 * base) * 1.05 + speedStatBonus + gutsBonus;
  }
  const target = base * coefficient;
  return phase >= 2 ? target + speedStatBonus : target;
}

interface EffectValues { current: number; target: number; accel: number; }
function effectValues(effects: RawEffect[]): EffectValues {
  return effects.reduce<EffectValues>((out, effect) => {
    const value = (effect.value ?? 0) / 10_000;
    const category = classifyEffect(effect);
    if (category === "current_speed") out.current += value;
    if (category === "target_speed") out.target += value;
    if (category === "acceleration") out.accel += value;
    // Type 48 is deliberately excluded: its Power-scaled implementation remains provisional.
    return out;
  }, { current: 0, target: 0, accel: 0 });
}

interface RunResult { points: { t: number; meter: number; speed: number; targetSpeed: number; phase: number }[]; finishTime: number; activationTime: number | null; }
function simulateRun(
  courseLength: number, spurt: number, stats: RaceImpactProfile["stats"], style: RunningStyle | null | undefined,
  activationMeter: number | null, duration: number, values: EffectValues,
): RunResult {
  let time = 0, meter = 0, speed = 3, activated = false, activationTime = Number.POSITIVE_INFINITY;
  const points: RunResult["points"] = [];
  const phaseTargets = [0, 1, 2, 3].map((phase) => getCruisingTargetSpeed(phase, courseLength, stats, style));
  const maxSteps = Math.ceil(500 / DT);
  for (let i = 0; i < maxSteps && meter < courseLength; i++) {
    const phase = getPhaseAtMeter(meter, courseLength, spurt);
    const justActivated = !activated && activationMeter != null && meter >= activationMeter;
    if (justActivated) { activated = true; activationTime = time; }
    const effectActive = activated && time < activationTime + duration;
    const targetBonus = effectActive ? values.target : 0;
    const target = phaseTargets[phase] + targetBonus;
    const accelLimit = phase === 3 ? Math.max(0.35, 0.424 + (stats.power - 1_000) * 0.00012) : 0.8;
    let acceleration = meter < 15 ? 12 : clamp(target - speed, 0, 1) * accelLimit;
    if (effectActive) acceleration += values.accel;
    if (speed > target + 0.05) acceleration = -Math.min(1.2, (speed - target) * 0.8);
    speed = Math.max(0, speed + acceleration * DT);
    if (effectActive && values.current !== 0 && justActivated) speed += values.current;
    const stepDistance = speed * DT;
    const remaining = courseLength - meter;
    const fraction = stepDistance > remaining ? remaining / Math.max(stepDistance, 1e-9) : 1;
    meter = Math.min(courseLength, meter + stepDistance);
    time += DT * fraction;
    points.push({ t: time, meter: Math.min(courseLength, meter), speed, targetSpeed: target, phase });
  }
  return { points, finishTime: time, activationTime: Number.isFinite(activationTime) ? activationTime : null };
}

function valuesAt(skill: SkillDetailInput | null | undefined, courseLength: number): { duration: number; values: EffectValues; effects: RawEffect[] } {
  const group = skill?.conditionGroups?.[0];
  const effects = (group?.effects ?? []) as RawEffect[];
  return { duration: scaledDuration(group?.base_time, courseLength), values: effectValues(effects), effects };
}

/** Generates a transparent, simplified baseline-vs-skill comparison trace. */
export function generateRaceTrace(
  skill: SkillDetailInput | null | undefined, context: TraceContext, activationMeterOverride?: number | null,
  activeZones?: EvaluatorZoneInput[] | null,
): RaceEffectTrace {
  const courseLength = context.course?.length ?? 2_000;
  const spurt = context.course?.spurtStart?.meters ?? Math.round(courseLength * 2 / 3);
  const { duration, values, effects } = valuesAt(skill, courseLength);
  const hasZenkai = effects.some((e) => classifyEffect(e) === "zenkai_acceleration");
  const modelable = effects.some((e) => { const category = classifyEffect(e); return category != null && ["current_speed", "target_speed", "acceleration"].includes(category); });
  const physicsStatus: RaceEffectTrace["physicsStatus"] = hasZenkai ? "provisional" : modelable ? "modeled" : effects.length ? "partial" : "not-modeled";
  const regions = (activeZones ?? []).flatMap((z) => z.regions);
  const activationMeter = activationMeterOverride === undefined
    ? (regions.length ? Math.min(...regions.map((r) => r.start)) : null)
    : activationMeterOverride == null ? null : Math.max(0, Math.min(courseLength, activationMeterOverride));
  const baseline = simulateRun(courseLength, spurt, context.profile.stats, context.runningStyle, null, 0, { current: 0, target: 0, accel: 0 });
  const skillRun = simulateRun(courseLength, spurt, context.profile.stats, context.runningStyle, modelable ? activationMeter : null, duration, modelable ? values : { current: 0, target: 0, accel: 0 });
  const effectEndPoint = skillRun.points.find((point) => point.t >= (skillRun.activationTime ?? Number.POSITIVE_INFINITY) + duration);
  const activationPoint = skillRun.activationTime == null
    ? undefined
    : skillRun.points.find((point) => point.t > skillRun.activationTime!);
  const points: RaceTracePoint[] = [];
  // Decimate the long course trace, while preserving the frames around skill events.
  const stride = Math.max(1, Math.floor(baseline.points.length / 240));
  const pointIndices = new Set<number>();
  for (let i = 0; i < baseline.points.length; i += stride) pointIndices.add(i);
  const addEventFrames = (time: number | null, radius: number) => {
    if (time == null) return;
    const center = Math.round(time / DT) - 1;
    for (let offset = -radius; offset <= radius; offset++) {
      const index = center + offset;
      if (index >= 0 && index < baseline.points.length) pointIndices.add(index);
    }
  };
  addEventFrames(skillRun.activationTime, 3);
  addEventFrames(skillRun.activationTime == null ? null : skillRun.activationTime + duration, 2);
  pointIndices.add(baseline.points.length - 1);
  for (const i of [...pointIndices].sort((a, b) => a - b)) {
    const base = baseline.points[i];
    const skillPoint = skillRun.points[Math.min(i, skillRun.points.length - 1)] ?? base;
    points.push({ timeSeconds: Number(base.t.toFixed(2)), baselineMeter: Number(base.meter.toFixed(1)), baselineSpeed: Number(base.speed.toFixed(2)), baselineTargetSpeed: Number(base.targetSpeed.toFixed(2)), skillMeter: Number(skillPoint.meter.toFixed(1)), skillSpeed: Number(skillPoint.speed.toFixed(2)), skillTargetSpeed: Number(skillPoint.targetSpeed.toFixed(2)), phase: base.phase });
  }
  const lastBase = baseline.points.at(-1)!;
  const lastSkill = skillRun.points.at(-1)!;
  if (!points.length || points.at(-1)!.timeSeconds !== Number(lastBase.t.toFixed(2))) points.push({ timeSeconds: Number(lastBase.t.toFixed(2)), baselineMeter: courseLength, baselineSpeed: lastBase.speed, baselineTargetSpeed: lastBase.targetSpeed, skillMeter: lastSkill.meter, skillSpeed: lastSkill.speed, skillTargetSpeed: lastSkill.targetSpeed, phase: lastBase.phase });
  const spatialPoints: RaceTraceSpatialPoint[] = [];
  const spatialStride = Math.max(1, Math.ceil(courseLength / 400));
  const spatialMeters = new Set<number>();
  for (let meter = 0; meter <= courseLength; meter += spatialStride) spatialMeters.add(meter);
  spatialMeters.add(courseLength);
  if (activationPoint) spatialMeters.add(Number(activationPoint.meter.toFixed(1)));
  if (effectEndPoint) spatialMeters.add(Number(effectEndPoint.meter.toFixed(1)));
  const sortedMeters = [...spatialMeters].sort((a, b) => a - b);
  const sampleRun = (run: RunResult) => {
    const points = run.points;
    let cursor = 0;
    return sortedMeters.map((meter) => {
      while (cursor < points.length - 1 && points[cursor].meter < meter) cursor++;
      const b = points[cursor];
      const a = points[Math.max(0, cursor - 1)];
      const ratio = meter <= a.meter ? 0 : (meter - a.meter) / Math.max(0.001, b.meter - a.meter);
      return {
        speed: a.speed + (b.speed - a.speed) * ratio,
        targetSpeed: a.targetSpeed + (b.targetSpeed - a.targetSpeed) * ratio,
      };
    });
  };
  const baselineSpatial = sampleRun(baseline);
  const skillSpatial = sampleRun(skillRun);
  for (let index = 0; index < sortedMeters.length; index++) {
    const meter = sortedMeters[index];
    spatialPoints.push({
      meter,
      baselineSpeed: Number(baselineSpatial[index].speed.toFixed(2)),
      baselineTargetSpeed: Number(baselineSpatial[index].targetSpeed.toFixed(2)),
      skillSpeed: Number(skillSpatial[index].speed.toFixed(2)),
      skillTargetSpeed: Number(skillSpatial[index].targetSpeed.toFixed(2)),
    });
  }
  const timeGain = Math.max(0, baseline.finishTime - skillRun.finishTime);
  return {
    version: 1, points, spatialPoints, activationMeter: activationMeter == null ? null : Math.round(activationMeter),
    effectEndMeter: effectEndPoint ? Number(effectEndPoint.meter.toFixed(1)) : activationMeter == null ? null : courseLength,
    activationTimeSeconds: Number((skillRun.activationTime ?? 0).toFixed(2)),
    effectEndTimeSeconds: Number((skillRun.activationTime == null ? 0 : skillRun.activationTime + duration).toFixed(2)),
    totalTimeSeconds: Number(baseline.finishTime.toFixed(2)), timeGainSeconds: Number(timeGain.toFixed(3)),
    distanceGainMeters: Number((timeGain * baseSpeed(courseLength)).toFixed(2)),
    bashinGain: Number((timeGain * baseSpeed(courseLength) / BASHIN_METERS).toFixed(2)), physicsStatus,
  };
}

export interface TraceContext { course: Course | null | undefined; profile: RaceImpactProfile; runningStyle?: RunningStyle | null; racerCount?: number; }

export function computeGainDistribution(
  skill: SkillDetailInput | null | undefined, zones: EvaluatorZoneInput[] | null | undefined,
  context: TraceContext, activation: ActivationEstimate,
): RaceEffectDistribution {
  const courseLength = context.course?.length ?? 2_000;
  const spurt = context.course?.spurtStart?.meters ?? Math.round(courseLength * 2 / 3);
  const { duration, values, effects } = valuesAt(skill, courseLength);
  const modelable = effects.some((e) => { const category = classifyEffect(e); return category != null && ["current_speed", "target_speed", "acceleration"].includes(category); });
  const regions = (zones ?? []).flatMap((z) => z.regions);
  const keyMeters = new Set<number>([0, spurt, courseLength]);
  for (const region of regions) { keyMeters.add(Math.round(region.start)); keyMeters.add(Math.round(region.end)); }
  for (const region of regions) for (let meter = Math.ceil(region.start / 20) * 20; meter <= region.end; meter += 20) keyMeters.add(meter);
  // Keep the whole course visible, including ineligible positions at zero gain.
  for (let meter = 0; meter <= courseLength; meter += 20) keyMeters.add(meter);
  const samples: ActivationMeterSample[] = [];
  const baseTime = simulateRun(courseLength, spurt, context.profile.stats, context.runningStyle, null, 0, { current: 0, target: 0, accel: 0 }).finishTime;
  let maxGainMeters = 0, minGainMeters = 0, optimalMeter: number | null = null, optimalGainMeters: number | null = null;
  for (const meter of [...keyMeters].sort((a, b) => a - b)) {
    const zoneIndex = (zones ?? []).findIndex((zone) => zone.regions.some((r) => meter >= r.start - 0.5 && meter <= r.end + 0.5));
    const eligible = zoneIndex >= 0;
    let gainMeters = 0;
    if (eligible && modelable && meter < courseLength) {
      const run = simulateRun(courseLength, spurt, context.profile.stats, context.runningStyle, meter, duration, values);
      gainMeters = Math.max(0, (baseTime - run.finishTime) * baseSpeed(courseLength));
    }
    gainMeters = Number(gainMeters.toFixed(2));
    const useful = eligible && gainMeters > 0.05;
    samples.push({ meter, gainMeters, bashin: Number((gainMeters / BASHIN_METERS).toFixed(2)), eligible, activationRate: eligible ? activation.activationRate : 0, usefulRate: useful ? activation.activationRate : 0, zoneIndex: eligible ? zoneIndex : undefined });
    if (eligible && gainMeters < minGainMeters) minGainMeters = gainMeters;
    if (eligible && gainMeters > maxGainMeters) { maxGainMeters = gainMeters; optimalMeter = meter; optimalGainMeters = gainMeters; }
  }
  const eligibleRangeDescription = regions.length ? regions.slice(0, 3).map((r) => `${Math.round(r.start)}m – ${Math.round(r.end)}m`).join(", ") + (regions.length > 3 ? ` (+${regions.length - 3} more)` : "") : "No activation region";
  return { version: 1, samples, maxGainMeters, minGainMeters, optimalMeter, optimalGainMeters, eligibleRangeDescription };
}

export function meterToBaselineTime(meter: number, trace: RaceEffectTrace): number {
  if (!trace.points.length || meter <= 0) return 0;
  for (let i = 1; i < trace.points.length; i++) {
    const a = trace.points[i - 1], b = trace.points[i];
    if (meter <= b.baselineMeter) return a.timeSeconds + (b.timeSeconds - a.timeSeconds) * (meter - a.baselineMeter) / Math.max(0.001, b.baselineMeter - a.baselineMeter);
  }
  return trace.totalTimeSeconds;
}

export function timeToBaselineMeter(timeSeconds: number, trace: RaceEffectTrace): number {
  if (!trace.points.length || timeSeconds <= 0) return 0;
  for (let i = 1; i < trace.points.length; i++) {
    const a = trace.points[i - 1], b = trace.points[i];
    if (timeSeconds <= b.timeSeconds) return a.baselineMeter + (b.baselineMeter - a.baselineMeter) * (timeSeconds - a.timeSeconds) / Math.max(0.001, b.timeSeconds - a.timeSeconds);
  }
  return trace.points.at(-1)!.baselineMeter;
}
