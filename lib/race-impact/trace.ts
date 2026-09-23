import type { Course } from "../skill-engine/types";
import type { RunningStyle } from "../deck/types";
import { classifyEffect, type RawEffect } from "../evaluator/effects";
import type { SkillDetailInput, EvaluatorZoneInput } from "../evaluator/types";
import type {
  ActivationEstimate,
  ActivationMeterSample,
  RaceEffectDistribution,
  RaceEffectTrace,
  RaceImpactProfile,
  RaceImpactSample,
  RaceTracePoint,
} from "./types";

const BASHIN_METERS = 2.5;

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function scaledDuration(baseTime: number | null | undefined, courseLength: number): number {
  return baseTime && baseTime > 0 ? (baseTime / 10_000) * (courseLength / 1_000) : 0;
}

export interface TraceContext {
  course: Course | null | undefined;
  profile: RaceImpactProfile;
  runningStyle?: RunningStyle | null;
  racerCount?: number;
}

/**
 * Returns phase index 0, 1, 2, or 3 for a given distance along the course.
 */
export function getPhaseAtMeter(meter: number, courseLength: number, spurt: number): number {
  if (meter >= spurt) return 3;
  if (meter >= (courseLength * 2) / 3) return 2;
  if (meter >= courseLength / 6) return 1;
  return 0;
}

/**
 * Calculate target velocity for a given phase and stat profile.
 */
function getPhaseTargetSpeed(phase: number, stats: RaceImpactProfile["stats"]): number {
  // Speed stat bonus: ~0.0015 m/s per point above 1000
  const speedBonus = ((stats.speed ?? 2000) - 1000) * 0.0012;
  switch (phase) {
    case 0:
      return 18.0 + speedBonus * 0.3;
    case 1:
      return 20.5 + speedBonus * 0.5;
    case 2:
      return 21.0 + speedBonus * 0.6;
    case 3:
    default:
      return 25.5 + speedBonus;
  }
}

/**
 * Generates a full baseline vs. skill-on trajectory trace across the race.
 */
export function generateRaceTrace(
  skill: SkillDetailInput | null | undefined,
  context: TraceContext,
  activationMeterOverride?: number | null,
  activeZones?: EvaluatorZoneInput[] | null,
): RaceEffectTrace {
  const courseLength = context.course?.length ?? 2000;
  const spurt = context.course?.spurtStart?.meters ?? Math.round((courseLength * 2) / 3);
  const stats = context.profile.stats;

  const group = skill?.conditionGroups?.[0];
  const effects = (group?.effects ?? []) as RawEffect[];
  const durationSeconds = scaledDuration(group?.base_time, courseLength);

  const hasZenkai = effects.some((e) => classifyEffect(e) === "zenkai_acceleration");
  const modelable = effects.filter((e) => {
    const c = classifyEffect(e);
    return c === "current_speed" || c === "target_speed" || c === "acceleration" || c === "zenkai_acceleration";
  });

  const physicsStatus: RaceEffectTrace["physicsStatus"] = hasZenkai
    ? "provisional"
    : modelable.length
      ? "modeled"
      : effects.length
        ? "partial"
        : "not-modeled";

  // Determine activation meter: override > earliest in active zones > spurt > 0
  const regions = (activeZones ?? []).flatMap((z) => z.regions);
  let activationMeter = activationMeterOverride ?? null;
  if (activationMeter == null) {
    if (regions.length > 0) {
      activationMeter = Math.min(...regions.map((r) => r.start));
    } else {
      activationMeter = spurt;
    }
  }
  activationMeter = Math.max(0, Math.min(courseLength, activationMeter));

  // Simulation parameters
  const dt = 0.2; // 200ms per integration step
  const powerBonus = ((stats.power ?? 1700) - 1000) * 0.00018;
  const normalStartAccel = 12.0;
  const normalSpurtAccel = Math.max(0.35, 0.45 + powerBonus);
  const normalDecel = -1.2;

  let baseTime = 0;
  let baseMeter = 0;
  let baseSpeed = 3.0; // Starting gate speed

  let skillTime = 0;
  let skillMeter = 0;
  let skillSpeed = 3.0;

  let activationTime = 0;
  let activated = false;
  let effectEndTime = 0;

  // Compute effect values
  let currentSpeedDelta = 0;
  let targetSpeedDelta = 0;
  let accelDelta = 0;

  for (const eff of modelable) {
    const cat = classifyEffect(eff);
    const val = (eff.value ?? 0) / 10_000;
    if (cat === "current_speed") currentSpeedDelta += val;
    else if (cat === "target_speed") targetSpeedDelta += val;
    else if (cat === "acceleration") accelDelta += val;
    else if (cat === "zenkai_acceleration") accelDelta += val * 0.9;
  }

  // Pre-calculate baseline trace
  interface SimStep {
    t: number;
    baseX: number;
    baseV: number;
    skillX: number;
    skillV: number;
    phase: number;
  }
  const rawSteps: SimStep[] = [];

  // Run simulation loop
  const maxSteps = 2500; // safety ceiling (~500s)
  let step = 0;
  while (baseMeter < courseLength && step < maxSteps) {
    step++;
    const currentPhase = getPhaseAtMeter(baseMeter, courseLength, spurt);
    const baseTargetV = getPhaseTargetSpeed(currentPhase, stats);

    // Baseline acceleration
    let baseAccel = 0;
    if (baseMeter < 15) {
      baseAccel = normalStartAccel;
    } else if (currentPhase === 3 && baseMeter >= spurt && baseSpeed < baseTargetV) {
      baseAccel = normalSpurtAccel;
    } else if (baseSpeed < baseTargetV) {
      baseAccel = 0.8;
    } else if (baseSpeed > baseTargetV + 0.1) {
      baseAccel = normalDecel;
    }

    baseSpeed = Math.max(0, baseSpeed + baseAccel * dt);
    baseMeter += baseSpeed * dt;
    baseTime += dt;

    // Check skill activation trigger
    if (!activated && physicsStatus !== "not-modeled" && (baseMeter >= activationMeter || skillMeter >= activationMeter)) {
      activated = true;
      activationTime = baseTime;
      effectEndTime = activationTime + durationSeconds;
      if (currentSpeedDelta > 0) {
        skillSpeed += currentSpeedDelta;
      }
    }

    const isEffectActive = activated && baseTime <= effectEndTime;

    // Skill-on target and acceleration
    const skillTargetV = baseTargetV + (isEffectActive ? targetSpeedDelta : 0);
    let skillAccel = 0;

    if (skillMeter < 15) {
      skillAccel = normalStartAccel;
    } else if (currentPhase === 3 && skillMeter >= spurt && skillSpeed < skillTargetV) {
      skillAccel = normalSpurtAccel + (isEffectActive ? accelDelta : 0);
    } else if (skillSpeed < skillTargetV) {
      skillAccel = 0.8 + (isEffectActive ? accelDelta : 0);
    } else if (skillSpeed > skillTargetV + 0.1) {
      skillAccel = normalDecel;
    }

    skillSpeed = Math.max(0, skillSpeed + skillAccel * dt);
    skillMeter += skillSpeed * dt;
    skillTime += dt;

    rawSteps.push({
      t: baseTime,
      baseX: Math.min(courseLength, baseMeter),
      baseV: baseSpeed,
      skillX: Math.min(courseLength, skillMeter),
      skillV: skillSpeed,
      phase: currentPhase,
    });
  }

  // Downsample to ~80-120 clean points for performant rendering
  const totalSteps = rawSteps.length;
  const sampleStride = Math.max(1, Math.floor(totalSteps / 100));
  const points: RaceTracePoint[] = [];

  for (let i = 0; i < totalSteps; i += sampleStride) {
    const s = rawSteps[i];
    points.push({
      timeSeconds: Number(s.t.toFixed(2)),
      baselineMeter: Number(s.baseX.toFixed(1)),
      baselineSpeed: Number(s.baseV.toFixed(2)),
      skillMeter: Number(s.skillX.toFixed(1)),
      skillSpeed: Number(s.skillV.toFixed(2)),
      phase: s.phase,
    });
  }

  // Ensure finish point is always included
  if (rawSteps.length > 0) {
    const last = rawSteps[rawSteps.length - 1];
    if (points[points.length - 1].timeSeconds !== Number(last.t.toFixed(2))) {
      points.push({
        timeSeconds: Number(last.t.toFixed(2)),
        baselineMeter: Number(last.baseX.toFixed(1)),
        baselineSpeed: Number(last.baseV.toFixed(2)),
        skillMeter: Number(last.skillX.toFixed(1)),
        skillSpeed: Number(last.skillV.toFixed(2)),
        phase: last.phase,
      });
    }
  }

  // Gains calculation
  const finishTimeBase = baseTime;
  const finishTimeSkill = skillTime * (courseLength / Math.max(1, skillMeter));
  const timeGainSeconds = Math.max(0, finishTimeBase - finishTimeSkill);
  const distanceGainMeters = Math.max(0, (skillMeter - baseMeter));
  const bashinGain = distanceGainMeters / BASHIN_METERS;

  return {
    version: 1,
    points,
    activationMeter: Math.round(activationMeter),
    activationTimeSeconds: Number(activationTime.toFixed(2)),
    effectEndTimeSeconds: Number(effectEndTime.toFixed(2)),
    totalTimeSeconds: Number(baseTime.toFixed(2)),
    timeGainSeconds: Number(timeGainSeconds.toFixed(3)),
    distanceGainMeters: Number(distanceGainMeters.toFixed(2)),
    bashinGain: Number(bashinGain.toFixed(2)),
    physicsStatus,
  };
}

/**
 * Computes dense gain samples, activation probability, and useful rate along the course.
 */
export function computeGainDistribution(
  skill: SkillDetailInput | null | undefined,
  zones: EvaluatorZoneInput[] | null | undefined,
  context: TraceContext,
  activation: ActivationEstimate,
): RaceEffectDistribution {
  const courseLength = context.course?.length ?? 2000;
  const spurt = context.course?.spurtStart?.meters ?? Math.round((courseLength * 2) / 3);
  const durationSeconds = scaledDuration(skill?.conditionGroups?.[0]?.base_time, courseLength);
  const effects = (skill?.conditionGroups?.[0]?.effects ?? []) as RawEffect[];

  const modelable = effects.filter((e) => {
    const c = classifyEffect(e);
    return c === "current_speed" || c === "target_speed" || c === "acceleration" || c === "zenkai_acceleration";
  });

  const regions = (zones ?? []).flatMap((z) => z.regions);
  const samples: ActivationMeterSample[] = [];

  // Resolution: sample every 20m along course, plus exact boundaries of regions and spurt
  const keyMeters = new Set<number>([0, spurt, courseLength]);
  for (const r of regions) {
    keyMeters.add(Math.round(r.start));
    keyMeters.add(Math.round(r.end));
    keyMeters.add(Math.round((r.start + r.end) / 2));
  }
  for (let m = 0; m <= courseLength; m += 20) {
    keyMeters.add(m);
  }

  const sortedMeters = Array.from(keyMeters).sort((a, b) => a - b);

  let maxGainMeters = 0;
  let minGainMeters = 0;
  let optimalMeter: number | null = null;
  let optimalGainMeters: number | null = null;

  for (const meter of sortedMeters) {
    // Check if meter is inside any region
    let eligible = false;
    let zoneIndex: number | undefined = undefined;

    if (zones && zones.length > 0) {
      for (let zi = 0; zi < zones.length; zi++) {
        const inZone = zones[zi].regions.some((r) => meter >= r.start - 0.5 && meter <= r.end + 0.5);
        if (inZone) {
          eligible = true;
          zoneIndex = zi;
          break;
        }
      }
    }

    let gainMeters = 0;
    if (eligible && modelable.length > 0) {
      // Calculate gain at this activation point
      const timingQuality = effects.some((e) => classifyEffect(e) === "acceleration" || classifyEffect(e) === "zenkai_acceleration")
        ? clamp(1 - Math.abs(meter - spurt) / 180)
        : effects.some((e) => classifyEffect(e) === "target_speed" || classifyEffect(e) === "current_speed")
          ? meter >= spurt ? 1 : clamp(0.55 + Math.max(0, meter + durationSeconds * 20 - spurt) / 300)
          : 0.65;

      for (const eff of modelable) {
        const value = (eff.value ?? 0) / 10_000;
        const cat = classifyEffect(eff);
        if (cat === "current_speed") {
          gainMeters += value * durationSeconds;
        } else if (cat === "target_speed") {
          gainMeters += value * durationSeconds * (meter < spurt + 130 ? 0.6 : 0.9);
        } else if (cat === "acceleration" || cat === "zenkai_acceleration") {
          gainMeters += 0.5 * value * Math.min(durationSeconds, 4.5) ** 2 * timingQuality;
        }
      }

      // Clip gain if activation is too close to finish line to realize full duration
      const metersToFinish = Math.max(0, courseLength - meter);
      const neededMeters = durationSeconds * 25.0;
      if (neededMeters > 0 && metersToFinish < neededMeters) {
        gainMeters *= metersToFinish / neededMeters;
      }
    }

    gainMeters = Number(gainMeters.toFixed(2));
    const bashin = Number((gainMeters / BASHIN_METERS).toFixed(2));

    const activationRate = eligible ? activation.activationRate : 0;
    const usefulRate = eligible && gainMeters > 0.05 ? activation.activationRate : 0;

    if (gainMeters > maxGainMeters) {
      maxGainMeters = gainMeters;
      optimalMeter = meter;
      optimalGainMeters = gainMeters;
    }
    if (eligible && gainMeters < minGainMeters) {
      minGainMeters = gainMeters;
    }

    samples.push({
      meter,
      gainMeters,
      bashin,
      eligible,
      activationRate,
      usefulRate,
      zoneIndex,
    });
  }

  // Describe eligible ranges
  let eligibleRangeDescription = "No activation region";
  if (regions.length > 0) {
    eligibleRangeDescription = regions
      .slice(0, 3)
      .map((r) => `${Math.round(r.start)}m – ${Math.round(r.end)}m`)
      .join(", ") + (regions.length > 3 ? ` (+${regions.length - 3} more)` : "");
  }

  return {
    version: 1,
    samples,
    maxGainMeters,
    minGainMeters,
    optimalMeter,
    optimalGainMeters,
    eligibleRangeDescription,
  };
}

/**
 * Helper to convert meter position to corresponding baseline time (seconds).
 */
export function meterToBaselineTime(meter: number, trace: RaceEffectTrace): number {
  if (!trace.points.length) return 0;
  if (meter <= 0) return 0;
  if (meter >= trace.points[trace.points.length - 1].baselineMeter) {
    return trace.points[trace.points.length - 1].timeSeconds;
  }

  for (let i = 0; i < trace.points.length - 1; i++) {
    const p1 = trace.points[i];
    const p2 = trace.points[i + 1];
    if (meter >= p1.baselineMeter && meter <= p2.baselineMeter) {
      const frac = (meter - p1.baselineMeter) / Math.max(0.001, p2.baselineMeter - p1.baselineMeter);
      return Number((p1.timeSeconds + frac * (p2.timeSeconds - p1.timeSeconds)).toFixed(2));
    }
  }
  return trace.points[trace.points.length - 1].timeSeconds;
}

/**
 * Helper to convert baseline time to corresponding baseline meter.
 */
export function timeToBaselineMeter(timeSeconds: number, trace: RaceEffectTrace): number {
  if (!trace.points.length) return 0;
  if (timeSeconds <= 0) return 0;
  if (timeSeconds >= trace.points[trace.points.length - 1].timeSeconds) {
    return trace.points[trace.points.length - 1].baselineMeter;
  }

  for (let i = 0; i < trace.points.length - 1; i++) {
    const p1 = trace.points[i];
    const p2 = trace.points[i + 1];
    if (timeSeconds >= p1.timeSeconds && timeSeconds <= p2.timeSeconds) {
      const frac = (timeSeconds - p1.timeSeconds) / Math.max(0.001, p2.timeSeconds - p1.timeSeconds);
      return Math.round(p1.baselineMeter + frac * (p2.baselineMeter - p1.baselineMeter));
    }
  }
  return trace.points[trace.points.length - 1].baselineMeter;
}
