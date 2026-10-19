import type { Course } from "../skill-engine/types";
import type { RunningStyle } from "../deck/types";
import { classifyEffect, type RawEffect } from "../evaluator/effects";
import type { SkillDetailInput, EvaluatorZoneInput } from "../evaluator/types";
import {
  ACTIVATION_SAMPLE_STEP_METERS, BASHIN_METERS, REFERENCE_MOTIVATION, REFERENCE_STRATEGY_PROFICIENCY,
  type ActivationEstimate, type ActivationMeterSample, type RaceEffectDistribution,
  type RaceEffectTrace, type RaceImpactProfile, type RaceTracePoint, type RaceTraceSpatialPoint,
} from "./types";
import { isUniqueSkill, uniqueLevelMultiplier } from "./unique-level";
import { adjustedStats, type StatBlock } from "./adjusted-stats";
import { cornerAt, cornerLossMeters, expectedLaneByFrame, laneGeometryFor, type LaneGeometry } from "./lanes";
import { additionalActivationFactor, durationScale, hpDurationMultiplier, scaledEffectValue, scalingContextFor, type ScalingContext } from "./scaling";

/**
 * Step 4c: a frame reads phase, slope and position triggers this share of its step behind its start, so on average a
 * switch lands half a frame after the crossing: the game's wait for the next frame start under a uniform alignment.
 */
const SUB_FRAME_LAG = 0.5;
const DT = 1 / 15; // Match the documented ~15 fps race update cadence.
const BASE_ACCEL = 0.0006;
const UPHILL_BASE_ACCEL = 0.0004;
const FRAMES_PER_SECOND = 15;
// Mechanics §Slope Modifier: downhill accel mode ends with 20% chance per second.
const DOWNHILL_EXIT_RATE = 0.2;
const START_DASH_ACCEL = 24;
// Mechanics §Deceleration: early / mid / late / spurt m/s^2.
const DECEL_BY_PHASE = [-1.2, -0.8, -1.0, -1.0];
const STRATEGY_PHASE_COEFFICIENT: Record<number, [number, number, number]> = {
  1: [1, 0.98, 0.962],
  2: [0.978, 0.991, 0.975],
  3: [0.938, 0.998, 0.994],
  4: [0.931, 1, 1],
  5: [1.063, 0.962, 0.95],
};
// Mechanics §Acceleration: strategy phase coefficient (early, mid, late and spurt).
const ACCEL_PHASE_COEFFICIENT: Record<number, [number, number, number]> = {
  1: [1, 1, 0.996], 2: [0.985, 1, 0.996], 3: [0.975, 1, 1], 4: [0.945, 1, 0.997], 5: [1.17, 0.94, 0.956],
};

export function scaledDuration(baseTime: number | null | undefined, courseLength: number): number {
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
    // Mechanics §Last Spurt: LastSpurtSpeedMax = (BaseTargetSpeedPhase2 + 0.01*BaseSpeed)*1.05 + speed term + guts term,
    // where BaseTargetSpeedPhase2 = BaseSpeed*lateCoef + speed term (§Base Target Speed, late-race).
    const latePhaseTarget = base * (coefficients?.[2] ?? 1) + speedStatBonus;
    const gutsBonus = Math.pow(450 * stats.guts, 0.597) * 0.0001;
    return (latePhaseTarget + 0.01 * base) * 1.05 + speedStatBonus + gutsBonus;
  }
  const target = base * coefficient;
  return phase >= 2 ? target + speedStatBonus : target;
}

/** A course slope with its gradient in % (SlopePer = stored raw / 10000; + uphill, - downhill). */
export interface SlopeSegment { start: number; end: number; per: number }

/**
 * `stats` are ADJUSTED stats (adjusted-stats.ts), not the raw profile stats. `slopes` drive the slope modifier
 * (step 3). `downhillMode` (default true) applies the expected downhill accel-mode bonus; false matches the umasim
 * fixture runs, which were produced with downhill accel mode off.
 */
export interface SimulationInput {
  courseLength: number; spurt: number; stats: RaceImpactProfile["stats"]; style: RunningStyle | null | undefined;
  slopes?: ReadonlyArray<SlopeSegment>; downhillMode?: boolean;
  /** HP consumption ground modifier (§HP Consumption); default 1. HP is tracked only for HP-scaled skills. */
  hpGroundCoef?: number;
  /** Metres run before the start line (step 4b): the run starts at -runUp and the clock starts at 0 m. */
  runUp?: number;
  /** Corner geometry for corner lane loss (step 4b, lanes.ts); null / absent: no loss (straight-only course). */
  lanes?: LaneGeometry | null;
}

/** Gradient % at `meter` (bounds inclusive, first matching segment wins); 0 off-slope. */
export function slopeAt(slopes: ReadonlyArray<SlopeSegment> | undefined, meter: number): number {
  if (!slopes) return 0;
  for (const s of slopes) if (meter >= s.start && meter <= s.end) return s.per;
  return 0;
}

/** Mechanics §Slope Modifier: an uphill (SlopePer >= 1) costs SlopePer x 200 / Power of target speed (adjusted Power). */
export function uphillTargetPenalty(slopePer: number, power: number): number {
  return slopePer >= 1 ? (slopePer * 200) / Math.max(1, power) : 0;
}

/** Mechanics §Base Acceleration: 0.0004 while uphill (SlopePer >= 1), 0.0006 otherwise. */
export function baseAccelAt(slopePer: number): number {
  return slopePer >= 1 ? UPHILL_BASE_ACCEL : BASE_ACCEL;
}

/** Mechanics §Slope Modifier: downhill accel mode raises target speed by 0.3 + |SlopePer| / 10 m/s. */
export function downhillTargetBonus(slopePer: number): number {
  return 0.3 + Math.abs(slopePer) / 10;
}

/**
 * Expected-value model of downhill accel mode (a two-state Markov chain stepped once per second while on a downhill):
 * enter with chance WizStat x 0.04% (adjusted Wisdom, capped at 1), leave with 20%. Returns the new in-mode probability.
 */
export function nextDownhillProbability(p: number, wisdom: number): number {
  const enter = Math.min(1, Math.max(0, wisdom * 0.0004));
  return p * (1 - DOWNHILL_EXIT_RATE) + (1 - p) * enter;
}
/**
 * Mechanics §Randomness Per Section: each section adds BaseSpeed x a random number in [Max - 0.65%, Max] to the target
 * speed outside the last spurt, Max = Wiz/5500 x log10(Wiz x 0.1) %. We use its mean, Max - 0.325% (R21); the umasim
 * classic results with randomness fixed agree with it. Adjusted wisdom is used for both terms (the reference horse
 * has strategy aptitude A, so base and adjusted wisdom agree).
 * Returned as a fraction of base speed.
 */
/** Mechanics §Minimum Speed: MinSpeed = 0.85 x BaseSpeed + 0.001 x sqrt(200 x Guts) (adjusted Guts). */
export function minimumSpeed(baseSpeed: number, guts: number): number {
  return 0.85 * baseSpeed + 0.001 * Math.sqrt(200 * Math.max(0, guts));
}

export function sectionRandomMean(wisdom: number): number {
  const wiz = Math.max(1, wisdom);
  return (wiz / 5500) * Math.log10(wiz * 0.1) * 0.01 - 0.00325;
}

/** Mechanics §Strategy Coefficient (HP): Front Runner, Pace Chaser, Late Surger, End Closer, Oonige. */
const HP_STRATEGY_COEFFICIENT: Record<number, number> = { 1: 0.95, 2: 0.89, 3: 1, 4: 0.995, 5: 0.86 };
/** Mechanics §HP Consumption ground modifier by surface (1 turf, 2 dirt) and ground condition (1 良 .. 4 不良). */
const HP_GROUND_COEFFICIENT: Record<number, [number, number, number, number]> = { 1: [1, 1, 1.02, 1.02], 2: [1, 1, 1.01, 1.02] };

/** Mechanics §Stamina: MaxHP = 0.8 x StrategyCoefficient x adjusted Stamina + CourseDistance. */
export function maxHp(courseLength: number, stamina: number, style: RunningStyle | null | undefined): number {
  return courseLength + 0.8 * (HP_STRATEGY_COEFFICIENT[style ?? 1] ?? 1) * stamina;
}

/** Mechanics §HP Consumption: 20 (v - BaseSpeed + 12)^2 / 144 x ground, x the guts modifier in the late race / spurt. */
export function hpConsumptionPerSecond(speed: number, baseSpeed: number, groundCoef: number, lateRace: boolean, guts: number): number {
  const consume = (20 * (speed - baseSpeed + 12) ** 2) / 144 * groundCoef;
  return lateRace ? consume * (1 + 200 / Math.sqrt(600 * Math.max(1, guts))) : consume;
}

/** HP at the start of the frame a trigger at `meter` fires on (the first frame whose start meter is >= meter). */
export function hpAtMeter(states: ReadonlyArray<Readonly<RunState>>, meter: number): number {
  if (!states.length) return 0;
  if (states[0].meter >= meter) return states[0].hp ?? 0;
  const idx = resumeIndexFor(states, meter);
  return (states[Math.min(states.length - 1, idx + 1)].hp ?? 0);
}

export interface EffectValues { current: number; carryCurrent: number; target: number; accel: number }
export interface RunResult {
  points: { t: number; meter: number; speed: number; targetSpeed: number; phase: number }[];
  finishTime: number;
  /** Activation time of the first window (the first trigger). */
  activationTime: number | null;
  /** Activation time per window, same order as the windows passed in. */
  activationTimes: (number | null)[];
}
/** One skill effect window: activates where the run crosses `meter` (between frames, step 4c), lasts `duration` seconds. */
export interface ActivationWindow { meter: number; duration: number; values: EffectValues }
export const NO_EFFECT: EffectValues = { current: 0, carryCurrent: 0, target: 0, accel: 0 };

/**
 * Physics input for a course. The raw profile stats go through the in-game stat pipeline (past 1200 counts half,
 * course stat-threshold bonus, ground modifier; reference motivation normal and strategy aptitude A). Ground
 * defaults to firm (良) when the caller gives none.
 */
export function simulationInputFor(
  course: Course | null | undefined, profile: RaceImpactProfile, style: RunningStyle | null | undefined, groundCondition?: number | null,
): SimulationInput {
  const courseLength = course?.length ?? 2_000;
  const stats = adjustedStats(profile.stats, {
    surface: course?.terrain ?? 1, groundCondition, statThresholds: course?.statThresholds ?? [],
    motivation: REFERENCE_MOTIVATION, strategyProficiency: REFERENCE_STRATEGY_PROFICIENCY,
  });
  const slopes = (course?.slopes ?? []).map((s) => ({ start: s.start, end: s.end, per: s.slope / 10_000 }));
  const ground = groundCondition != null && groundCondition >= 1 && groundCondition <= 4 ? Math.trunc(groundCondition) - 1 : 0;
  const hpGroundCoef = HP_GROUND_COEFFICIENT[course?.terrain === 2 ? 2 : 1][ground];
  return {
    courseLength, spurt: course?.spurtStart?.meters ?? Math.round(courseLength * 2 / 3), stats, style, slopes, hpGroundCoef,
    runUp: course?.runUp ?? 0, lanes: laneGeometryFor(course),
  };
}

/** Ability types 1-5 (speed, stamina, power, guts, wisdom). */
const PASSIVE_STAT_KEY: Record<number, keyof StatBlock> = { 1: "speed", 2: "stamina", 3: "power", 4: "guts", 5: "wisdom" };

/**
 * Step 5a (task 3): the stat bonus of a passive group, i.e. ability types 1-5 on a group whose duration is -1 (the whole
 * race, green skills and passive evolutions such as Laplace's Demon). Null when the group has none. Values are leveled
 * and scaled like effectValues. Mechanics doc §Stats: FinalStat = AdjustedStat + SkillModifier, so the bonus is added
 * to the adjusted stat (withStatBonus): it is not halved past 1200 and not multiplied by the course modifier. The umasim
 * classic results for Laplace's Demon agree (passive-stats.test.ts).
 */
export function passiveStatBonus(
  group: { base_time?: number | null; effects?: ReadonlyArray<RawEffect> | null } | null | undefined,
  multiplier: number | ((abilityType: number) => number) = 1, scaling?: ScalingContext | null,
): StatBlock | null {
  if (!group || group.base_time == null || group.base_time >= 0) return null;
  const out: StatBlock = { speed: 0, stamina: 0, power: 0, guts: 0, wisdom: 0 };
  let found = false;
  for (const effect of group.effects ?? []) {
    const key = PASSIVE_STAT_KEY[effect.type ?? 0];
    if (!key) continue;
    const factor = typeof multiplier === "number" ? multiplier : multiplier(effect.type ?? 0);
    const leveled = (effect.value ?? 0) * factor;
    out[key] += Math.trunc((scaling ? scaledEffectValue(effect, leveled, scaling) * additionalActivationFactor(effect.additional_activation) : leveled) / 10_000);
    found = true;
  }
  return found ? out : null;
}

/** True when a passive bonus moves the physics (stamina only matters for HP, which is assumed sufficient: R25). */
export function isPhysicalStatBonus(bonus: StatBlock | null | undefined): bonus is StatBlock {
  return bonus != null && (bonus.speed !== 0 || bonus.power !== 0 || bonus.guts !== 0 || bonus.wisdom !== 0);
}

/** The simulation input with a passive bonus added to the final (adjusted) stats. */
export function withStatBonus(input: SimulationInput, bonus: StatBlock): SimulationInput {
  const s = input.stats;
  return {
    ...input,
    stats: { speed: s.speed + bonus.speed, stamina: s.stamina + bonus.stamina, power: s.power + bonus.power, guts: s.guts + bonus.guts, wisdom: s.wisdom + bonus.wisdom },
  };
}

/**
 * `multiplier` is a constant or a per-ability-type function (unique skill levels scale by type). With `scaling`
 * (engine step 4) each effect's `value_scale` applies to the leveled value, times its additional-activation count.
 */
export function effectValues(
  effects: RawEffect[], multiplier: number | ((abilityType: number) => number) = 1, scaling?: ScalingContext | null,
): EffectValues {
  return effects.reduce<EffectValues>((out, effect) => {
    const factor = typeof multiplier === "number" ? multiplier : multiplier(effect.type ?? 0);
    const leveled = (effect.value ?? 0) * factor;
    const value = (scaling ? scaledEffectValue(effect, leveled, scaling) * additionalActivationFactor(effect.additional_activation) : leveled) / 10_000;
    const category = classifyEffect(effect);
    if (category === "current_speed") {
      out.current += value;
      if (effect.type === 22) out.carryCurrent += value; // natural-deceleration carry (mechanics §CurrentSpeedWithNaturalDeceleration (22))
    }
    if (category === "target_speed") out.target += value;
    if (category === "acceleration") out.accel += value;
    // Type 48 (zenkai) stays excluded: provisional.
    return out;
  }, { ...NO_EFFECT });
}

/**
 * Simulation state at the START of a frame (before that frame's update). `downhill`: in-mode probability. `hp`: remaining
 * HP (step 4.1). HP never changes the motion: every race is assumed to have enough HP to finish at full spurt speed.
 */
export interface RunState {
  time: number; meter: number; speed: number; startDash: boolean; downhill?: number; hp?: number;
  /** Frame number since the race start, run-up included (equals the state index when there is no run-up). */
  frame?: number;
}
export interface ResumeState extends RunState { index: number }

/**
 * Runs the simulation. When `resume` is given (a baseline state captured by simulateRunWithStates),
 * frames before it are skipped and `points` only holds frames from the resume point onward; finishTime
 * and activationTime are unchanged. Callers that need the full trace (generateRaceTrace) must not pass it.
 */
export function simulateRun(input: SimulationInput, activationMeter: number | null, duration: number, values: EffectValues, resume?: ResumeState): RunResult {
  return runCore(input, activationMeter == null ? [] : [{ meter: activationMeter, duration, values }], resume, null);
}

/**
 * Runs the simulation with several independent activation windows (e.g. a skill's first trigger plus its
 * chained `is_activate_other_skill_detail` trigger). A resume state must come from a frame whose start meter is
 * below every window's meter (use resumeIndexFor with the earliest window meter) to stay exact.
 */
export function simulateRunWindows(input: SimulationInput, windows: ActivationWindow[], resume?: ResumeState): RunResult {
  return runCore(input, windows, resume, null);
}

/** simulateRunWindows without the per-frame trace (`points` is empty): finish time only, for scoring sweeps. */
export function simulateFinishTime(input: SimulationInput, windows: ActivationWindow[], resume?: ResumeState): number {
  return runCore(input, windows, resume, null, false).finishTime;
}

/** Baseline (no-effect) run that records the pre-update state of every frame; states[i] = start of frame i. */
export function simulateRunWithStates(input: SimulationInput): { finishTime: number; states: RunState[] } {
  const states: RunState[] = [];
  const run = runCore(input, [], undefined, states);
  return { finishTime: run.finishTime, states };
}

/** Baseline position over time: times[i] / meters[i], strictly increasing in time, ending at the finish. */
export interface BaselineTimeline { readonly times: readonly number[]; readonly meters: readonly number[] }

/**
 * A memoized no-effect run, shared by every caller with the same key. Read-only: the types forbid writes, and no
 * consumer (scoreSkill, resume via `{ ...states[i] }`, distributions, traces) mutates it. It is deliberately not
 * Object.freeze'd: frozen arrays leave JSC's fast indexed storage and made scoring slower than re-simulating.
 */
export interface CachedBaselineRun {
  readonly input: SimulationInput; readonly finishTime: number; readonly states: ReadonlyArray<Readonly<RunState>>; readonly timeline: BaselineTimeline;
}
type BaselinePointsRun = Readonly<Pick<RunResult, "finishTime">> & { readonly points: ReadonlyArray<Readonly<RunResult["points"][number]>> };
interface BaselineCacheEntry { run: CachedBaselineRun; points?: BaselinePointsRun }

/**
 * Baseline memo. The no-effect run depends only on what runCore reads from the SimulationInput: courseLength,
 * spurt, style and the speed / power / guts stats. Keying on those values (not on object identity) hits across
 * callers that rebuild course or profile objects (the evaluator, hover cards and tests all spread new course
 * objects). Bounded LRU so memory stays small.
 */
const BASELINE_CACHE_LIMIT = 8;
const baselineCache = new Map<string, BaselineCacheEntry>();
let baselineSimulations = 0;
let baselinePointRuns = 0;

function baselineKey(input: SimulationInput): string {
  const { courseLength, spurt, style, stats } = input;
  const slopes = (input.slopes ?? []).map((s) => `${s.start}:${s.end}:${s.per}`).join(",");
  const corners = input.lanes ? `${input.lanes.corners.map((c) => `${c.start}:${c.end}`).join(",")}@${input.lanes.extraLaneAt}` : "-";
  return `${courseLength}|${spurt}|${style ?? "-"}|${stats.speed}|${stats.stamina}|${stats.power}|${stats.guts}|${stats.wisdom}|${slopes}|${input.downhillMode === false ? 0 : 1}|${input.hpGroundCoef ?? 1}|${input.runUp ?? 0}|${corners}`;
}

function baselineEntry(input: SimulationInput): BaselineCacheEntry {
  const key = baselineKey(input);
  const hit = baselineCache.get(key);
  if (hit) {
    baselineCache.delete(key);
    baselineCache.set(key, hit); // refresh LRU position
    return hit;
  }
  // Own copy of the input so a caller mutating its profile later cannot change what the cached run was built from.
  const ownInput: SimulationInput = Object.freeze({ ...input, stats: Object.freeze({ ...input.stats }), slopes: Object.freeze([...(input.slopes ?? [])]), lanes: input.lanes ?? null });
  const { finishTime, states } = simulateRunWithStates(ownInput);
  baselineSimulations++;
  const entry: BaselineCacheEntry = { run: { input: ownInput, finishTime, states, timeline: baselineTimelineOf(states, finishTime, ownInput.courseLength) } };
  baselineCache.set(key, entry);
  if (baselineCache.size > BASELINE_CACHE_LIMIT) baselineCache.delete(baselineCache.keys().next().value!);
  return entry;
}

/** Memoized simulateRunWithStates + timeline for a no-effect run (identical values, simulated once per key). */
export function cachedBaselineRun(input: SimulationInput): CachedBaselineRun {
  return baselineEntry(input).run;
}

/** Memoized full-trace no-effect run, as simulateRun(input, null, 0, NO_EFFECT) returns it (same cache entry). */
function cachedBaselinePoints(input: SimulationInput): BaselinePointsRun {
  const entry = baselineEntry(input);
  if (!entry.points) {
    entry.points = simulateRun(entry.run.input, null, 0, NO_EFFECT);
    baselinePointRuns++;
  }
  return entry.points;
}

/** Test / diagnostic hook: simulations performed by the memo and its current size. */
export function baselineCacheStats(): { simulations: number; pointRuns: number; size: number } {
  return { simulations: baselineSimulations, pointRuns: baselinePointRuns, size: baselineCache.size };
}

/** Test hook: empties the memo and resets its counters. */
export function clearBaselineCache(): void {
  baselineCache.clear();
  baselineSimulations = 0;
  baselinePointRuns = 0;
}

/** Timeline from simulateRunWithStates output: every frame start plus the finish. */
export function baselineTimelineOf(states: ReadonlyArray<Readonly<RunState>>, finishTime: number, courseLength: number): BaselineTimeline {
  const times = states.map((s) => s.time);
  const meters = states.map((s) => s.meter);
  times.push(finishTime);
  meters.push(courseLength);
  return { times, meters };
}

/** Timeline from a full (non-resumed) run's post-update points. */
export function baselineTimelineFromPoints(points: ReadonlyArray<Readonly<RunResult["points"][number]>>): BaselineTimeline {
  return { times: [0, ...points.map((p) => p.t)], meters: [0, ...points.map((p) => p.meter)] };
}

/** Baseline meter at `time`, linearly interpolated between frames (no frame quantisation). */
export function baselineMeterAt(timeline: BaselineTimeline, time: number): number {
  const { times, meters } = timeline;
  if (!times.length) return 0;
  if (time <= times[0]) return meters[0];
  const last = times.length - 1;
  if (time >= times[last]) return meters[last];
  let lo = 0, hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= time) lo = mid; else hi = mid;
  }
  const span = times[hi] - times[lo];
  return span > 0 ? meters[lo] + (meters[hi] - meters[lo]) * (time - times[lo]) / span : meters[hi];
}

/**
 * Distance gained by the skill run (controller ruling R7.2). Default: the position gap at the moment the faster
 * (skill) run finishes, L - baselineMeterAt(skillFinishTime), as uma-tools measures it. When the profile sets
 * `bashinReferenceSpeed`, that user override is used instead: time gain x reference speed.
 */
export function distanceGainMeters(
  timeline: BaselineTimeline, baselineFinishTime: number, skillFinishTime: number, courseLength: number, profile: RaceImpactProfile,
): number {
  if (profile.bashinReferenceSpeed != null) return Math.max(0, baselineFinishTime - skillFinishTime) * profile.bashinReferenceSpeed;
  if (skillFinishTime >= baselineFinishTime) return 0;
  return Math.max(0, courseLength - baselineMeterAt(timeline, skillFinishTime));
}

/** distanceGainMeters in Bashin (2.5 m). The single Bashin conversion used by scoring, traces and distributions. */
export function bashinGain(
  timeline: BaselineTimeline, baselineFinishTime: number, skillFinishTime: number, courseLength: number, profile: RaceImpactProfile,
): number {
  return distanceGainMeters(timeline, baselineFinishTime, skillFinishTime, courseLength, profile) / BASHIN_METERS;
}

/**
 * Activation meter of a chained trigger (is_activate_other_skill_detail) given the meter where
 * the first trigger fired. Only the part of its regions at or after `firstMeter` can fire. Deterministic: the first
 * such point. Random: the length-weighted midpoint of that remaining part (a single representative point, paired
 * with each first-trigger sample instead of a nested sample sweep). null when nothing remains.
 */
export function chainedTriggerMeter(regions: ReadonlyArray<{ start: number; end: number }>, isRandom: boolean, firstMeter: number): number | null {
  const clipped = regions
    .map((r) => ({ start: Math.max(r.start, firstMeter), end: r.end }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  if (!clipped.length) return null;
  if (!isRandom) return clipped[0].start;
  const half = clipped.reduce((t, r) => t + (r.end - r.start), 0) / 2;
  let acc = 0;
  for (const r of clipped) {
    const len = r.end - r.start;
    if (acc + len >= half) return r.start + (half - acc);
    acc += len;
  }
  return clipped.at(-1)!.end;
}

/** A trigger's effect window. `durationAt` (HP-scaled skills) gives the duration for an activation meter. */
export interface TriggerSpec { duration: number; values: EffectValues; durationAt?: (meter: number) => number }
export interface ChainedTriggerSpec extends TriggerSpec { regions: ReadonlyArray<{ start: number; end: number }>; isRandom: boolean }

/** Windows for one simulated race: the first trigger at `firstMeter` plus every chained trigger that can still fire. */
export function activationWindows(firstMeter: number, first: TriggerSpec, chained: ChainedTriggerSpec[] = []): ActivationWindow[] {
  const windows: ActivationWindow[] = [{ meter: firstMeter, duration: first.durationAt?.(firstMeter) ?? first.duration, values: first.values }];
  for (const c of chained) {
    const meter = chainedTriggerMeter(c.regions, c.isRandom, firstMeter);
    if (meter != null) windows.push({ meter, duration: c.durationAt?.(meter) ?? c.duration, values: c.values });
  }
  return windows;
}

/** Latest baseline frame whose start meter is still < activationMeter (frames up to it are identical to the baseline). */
export function resumeIndexFor(states: ReadonlyArray<Readonly<RunState>>, activationMeter: number): number {
  let lo = 0, hi = states.length - 1, best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (states[mid].meter < activationMeter) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return best;
}

/**
 * The baseline state to resume a run with windows from `activationMeter` on, or undefined when no recorded frame starts
 * before it (a start run-up: the frame crossing 0 m is not recorded, and step 4c activates a skill inside it).
 */
export function resumeStateFor(states: ReadonlyArray<Readonly<RunState>>, activationMeter: number): ResumeState | undefined {
  const idx = resumeIndexFor(states, activationMeter);
  return states[idx] && states[idx].meter < activationMeter ? { ...states[idx], index: idx } : undefined;
}

/**
 * Expected lane (m) per whole metre from -runUp to the finish, for corner lane loss (lanes.ts). `lossRate[k]` is the
 * share of a frame's step lost at metre k - offset ((pi/2) x lane / corner length; 0 off-corner); `edge[k]` marks the
 * metres that hold a corner bound, where the exact (inclusive) corner test is used instead.
 */
export interface LaneProfile {
  readonly offset: number; readonly lane: Float64Array; readonly lossRate: Float64Array; readonly edge: Uint8Array;
  laneAt(meter: number): number;
}

const LANE_CACHE_LIMIT = 32;
const laneCache = new Map<string, LaneProfile>();
const laneByInput = new WeakMap<SimulationInput, LaneProfile | null>();

/**
 * The expected lane along the course (memoized per input object and per baseline key). It is built from the frame
 * positions of the no-loss baseline run: the lane process is time-driven, and the loss itself moves positions by a
 * few metres at most. null when the input has no lane geometry.
 */
export function expectedLaneProfile(input: SimulationInput): LaneProfile | null {
  if (!input.lanes) return null;
  const hit = laneByInput.get(input);
  if (hit !== undefined) return hit;
  const key = baselineKey(input);
  let profile = laneCache.get(key);
  if (!profile) {
    const frameMeters: number[] = [];
    runCore({ ...input, lanes: null }, [], undefined, null, false, frameMeters);
    const byFrame = expectedLaneByFrame(input.lanes, frameMeters, input.courseLength, input.style, input.stats.power);
    const offset = Math.ceil(input.runUp ?? 0);
    const lane = new Float64Array(offset + Math.ceil(input.courseLength) + 1);
    let j = 0;
    for (let k = 0; k < lane.length; k++) {
      const m = k - offset;
      while (j + 1 < frameMeters.length && frameMeters[j + 1] <= m) j++;
      const a = frameMeters[j], b = j + 1 < frameMeters.length ? frameMeters[j + 1] : a;
      lane[k] = b > a && m > a ? byFrame[j] + (byFrame[Math.min(j + 1, byFrame.length - 1)] - byFrame[j]) * (m - a) / (b - a) : byFrame[j];
    }
    const last = lane.length - 1;
    const lossRate = new Float64Array(lane.length), edge = new Uint8Array(lane.length);
    for (const c of input.lanes.corners) {
      for (let m = Math.ceil(c.start); m < c.end; m++) {
        const k = m + offset;
        if (k >= 0 && k <= last) lossRate[k] = cornerLossMeters(1, lane[k], c.end - c.start);
      }
      for (const bound of [c.start, c.end]) { const k = Math.floor(bound) + offset; if (k >= 0 && k <= last) edge[k] = 1; }
    }
    profile = { offset, lane, lossRate, edge, laneAt: (meter: number) => lane[Math.min(last, Math.max(0, Math.floor(meter) + offset))] };
    laneCache.set(key, profile);
    if (laneCache.size > LANE_CACHE_LIMIT) laneCache.delete(laneCache.keys().next().value!);
  }
  laneByInput.set(input, profile);
  return profile;
}

interface FrameSpeedContext { powerTerm: number; coeff: [number, number, number]; base: number; minSpeed: number }

/** One frame's speed update (§Acceleration / §Deceleration / §Start Dash cap / §Minimum Speed) toward `target`. */
function frameSpeed(ctx: FrameSpeedContext, v: number, target: number, slope: number, phase: number, accelBonus: number, dash: boolean): number {
  if (v < target) {
    // Mechanics §Acceleration: constant while below target.
    const accel = baseAccelAt(slope) * ctx.powerTerm * ctx.coeff[Math.min(2, phase)] + accelBonus + (dash ? START_DASH_ACCEL : 0);
    v = Math.min(target, v + accel * DT);
    if (dash) v = Math.min(v, 0.85 * ctx.base); // mechanics §Start Dash cap
  } else if (v > target) {
    // Mechanics §Deceleration: by phase, never undershooting the target.
    v = Math.max(target, v + DECEL_BY_PHASE[phase] * DT);
  }
  // Mechanics §Minimum Speed (step 4b): after the start dash, speed is raised to the minimum after acceleration.
  return !dash && v < ctx.minSpeed ? ctx.minSpeed : v;
}

/** Lowest meter of a window not yet activated (Infinity when none). */
function pendingWindowMeter(windows: ActivationWindow[], activated: boolean[]): number {
  let m = Number.POSITIVE_INFINITY;
  for (let w = 0; w < windows.length; w++) if (!activated[w] && windows[w].meter < m) m = windows[w].meter;
  return m;
}

/** Earliest end time after `now` of an activated window (Infinity when none). */
function pendingWindowEnd(windows: ActivationWindow[], activated: boolean[], activationTimes: number[], now: number): number {
  let e = Number.POSITIVE_INFINITY;
  for (let w = 0; w < windows.length; w++) {
    const end = activationTimes[w] + windows[w].duration;
    if (activated[w] && end > now && end < e) e = end;
  }
  return e;
}

/** Inserts `f` into the sorted prefix buf[0..n) and returns the new length. */
function insertCut(buf: Float64Array, n: number, f: number): number {
  let i = n;
  while (i > 0 && buf[i - 1] > f) { buf[i] = buf[i - 1]; i--; }
  buf[i] = f;
  return n + 1;
}

const boundariesByInput = new WeakMap<SimulationInput, number[]>();

/** Metres where the phase (getPhaseAtMeter) or the slope (slopeAt) can change, ascending: the sub-frame boundaries. */
function subFrameBoundaries(input: SimulationInput): number[] {
  let hit = boundariesByInput.get(input);
  if (!hit) {
    const { courseLength, spurt, slopes } = input;
    // Only slopes of at least 1% change anything (uphill penalty / accel, downhill mode), so other slope ends are skipped.
    const effective = (meter: number) => { const sl = slopes?.length ? slopeAt(slopes, meter) : 0; return sl >= 1 || sl <= -1 ? sl : 0; };
    hit = [...new Set([courseLength / 6, (courseLength * 2) / 3, spurt, ...(slopes ?? []).flatMap((s) => [s.start, s.end])])]
      .filter((b) => b < courseLength)
      .filter((b) => getPhaseAtMeter(b - 1e-6, courseLength, spurt) !== getPhaseAtMeter(b + 1e-6, courseLength, spurt) || effective(b - 1e-6) !== effective(b + 1e-6))
      .sort((a, b) => a - b);
    boundariesByInput.set(input, hit);
  }
  return hit;
}

function runCore(
  input: SimulationInput, windows: ActivationWindow[], resume: ResumeState | undefined, record: RunState[] | null, collectPoints = true,
  frameMeters: number[] | null = null,
): RunResult {
  const { courseLength, spurt, stats, style, slopes } = input;
  const base = baseSpeed(courseLength);
  // Section randomness (mean) applies to the base target speed of phases 0-2, never to the last spurt.
  const sectionRandom = base * sectionRandomMean(stats.wisdom);
  const phaseTargets = [0, 1, 2, 3].map((phase) => getCruisingTargetSpeed(phase, courseLength, stats, style) + (phase < 3 ? sectionRandom : 0));
  const coeff = ACCEL_PHASE_COEFFICIENT[style ?? 1] ?? ACCEL_PHASE_COEFFICIENT[1];
  const powerTerm = Math.sqrt(500 * stats.power);
  const downhillMode = input.downhillMode !== false;
  const minSpeed = minimumSpeed(base, stats.guts);
  const geometry = input.lanes ?? null;
  const laneProfile = geometry ? expectedLaneProfile(input) : null;
  const laneOffset = laneProfile?.offset ?? 0;
  // Run-up (step 4b): the horse starts behind the line; the clock starts when it crosses 0 m.
  let time = resume?.time ?? 0, meter = resume?.meter ?? -Math.max(0, input.runUp ?? 0), speed = resume?.speed ?? 3, startDash = resume?.startDash ?? true;
  let frame = resume ? (resume.frame ?? resume.index) : 0;
  let downhill = resume?.downhill ?? 0;
  let hp = resume?.hp ?? maxHp(courseLength, stats.stamina, style);
  const hpGround = input.hpGroundCoef ?? 1;
  const n = windows.length;
  const activated = new Array<boolean>(n).fill(false);
  const carried = new Array<boolean>(n).fill(false);
  const activationTimes = new Array<number>(n).fill(Number.POSITIVE_INFINITY);
  const winFrom = new Array<number>(n).fill(0), winTo = new Array<number>(n).fill(0);
  const cutBuf = new Float64Array(subFrameBoundaries(input).length + 2 * n + 1);
  const points: RunResult["points"] = [];
  const maxSteps = Math.ceil(500 / DT);
  const speedCtx: FrameSpeedContext = { powerTerm, coeff, base, minSpeed };
  const boundaries = subFrameBoundaries(input);
  let boundaryIndex = 0;
  // The next window event: the lowest meter of a window not yet activated, the earliest end of one still running.
  // nextEventMeter folds in the next phase / slope boundary, so a frame without events costs two comparisons. (Plain
  // locals, no closures: captured variables would slow every frame.)
  let pendingMeter = pendingWindowMeter(windows, activated);
  let pendingEnd = Number.POSITIVE_INFINITY;
  let nextEventMeter = Math.min(pendingMeter, boundaries.length ? boundaries[0] : Number.POSITIVE_INFINITY);
  for (let step = 0; step < maxSteps && meter < courseLength; step++, frame++) {
    if (frameMeters) frameMeters.push(meter);
    if (record && meter >= 0) record.push({ time, meter, speed, startDash, downhill, hp, frame });
    // Where this frame reads phase, slope and skill triggers (see the sub-frame note below).
    const ref = meter - SUB_FRAME_LAG * speed * DT;
    const phase = getPhaseAtMeter(ref, courseLength, spurt);
    // Slopes (mechanics §Slope Modifier): read at the frame-start position. Downhill accel mode is
    // re-rolled on the last frame of each second while on a downhill and ends off it; we carry its probability.
    const slope = slopes?.length ? slopeAt(slopes, ref) : 0;
    if (downhillMode && slope <= -1) {
      if (frame % FRAMES_PER_SECOND === FRAMES_PER_SECOND - 1) downhill = nextDownhillProbability(downhill, stats.wisdom);
    } else downhill = 0;
    const slopeTarget = slope >= 1 ? -uphillTargetPenalty(slope, stats.power) : downhill * downhillTargetBonus(slope);
    let targetBonus = 0, accelBonus = 0, currentBonus = 0;
    let refresh = time >= pendingEnd;
    for (let w = 0; w < n; w++) {
      const win = windows[w];
      if (!activated[w] && ref >= win.meter) { activated[w] = true; activationTimes[w] = time; refresh = true; }
      if (!activated[w]) continue;
      if (time < activationTimes[w] + win.duration) {
        targetBonus += win.values.target; accelBonus += win.values.accel; currentBonus += win.values.current;
      } else if (!carried[w]) { carried[w] = true; speed += win.values.carryCurrent; }
    }
    if (refresh) {
      pendingMeter = pendingWindowMeter(windows, activated); pendingEnd = pendingWindowEnd(windows, activated, activationTimes, time);
      nextEventMeter = Math.min(pendingMeter, boundaryIndex < boundaries.length ? boundaries[boundaryIndex] : Number.POSITIVE_INFINITY);
    }
    if (startDash && speed >= 0.85 * base) startDash = false;
    let target = phaseTargets[phase] + targetBonus + slopeTarget;
    // Corner lane loss (step 4b, lanes.ts): progress shrinks inside a corner by the expected lane's extra arc
    // (a share of the step, read at the frame-start position).
    let lossShare = 0;
    if (laneProfile) {
      const k = (meter + laneOffset) | 0; // meter is in [-runUp, courseLength) here, so k is a valid index
      if (laneProfile.edge[k]) {
        const corner = cornerAt(geometry!, meter);
        if (corner) lossShare = cornerLossMeters(1, laneProfile.lane[k], corner.end - corner.start);
      } else lossShare = laneProfile.lossRate[k];
    }
    // One frame's speed update (frameSpeed, inlined on this hot path).
    let next = speed;
    if (next < target) {
      next = Math.min(target, next + (baseAccelAt(slope) * powerTerm * coeff[Math.min(2, phase)] + accelBonus + (startDash ? START_DASH_ACCEL : 0)) * DT);
      if (startDash) next = Math.min(next, 0.85 * base);
    } else if (next > target) next = Math.max(target, next + DECEL_BY_PHASE[phase] * DT);
    if (!startDash && next < minSpeed) next = minSpeed;
    let actual = next + currentBonus; // type 21/22 add to the actual (distance) speed for the window only
    // Sub-frame events (step 4c). The game switches phase (entering the last spurt), read the slope and
    // activate skills on the first frame whose START is past the meter, and end a skill on the first frame past its
    // duration. Over random alignments (start delay, lane noise) that is a switch half a frame after the
    // crossing on average, varying smoothly with position, while one fixed alignment moved late-race gains by a whole
    // frame. So a frame reads its state at `ref`, half a step behind its start, and the frame whose span from `ref`
    // holds an event runs each part of its step with the state from that part's start (phase / slope boundaries and
    // skill activation by position, skill end by time), weighted by its share: the mean over a uniform alignment.
    // Everything triggered by position shares the same lag, so a skill at the spurt point still starts with the spurt
    // (the umasim results agree: a target-speed skill there gains nothing).
    const stepBefore = actual * DT * (1 - lossShare);
    const end = ref + stepBefore;
    if (end > nextEventMeter || pendingEnd < time + DT) {
      if (boundaryIndex < boundaries.length && boundaries[boundaryIndex] <= ref) {
        while (boundaryIndex < boundaries.length && boundaries[boundaryIndex] <= ref) boundaryIndex++;
        pendingMeter = pendingWindowMeter(windows, activated); pendingEnd = pendingWindowEnd(windows, activated, activationTimes, time);
        nextEventMeter = Math.min(pendingMeter, boundaryIndex < boundaries.length ? boundaries[boundaryIndex] : Number.POSITIVE_INFINITY);
      }
    }
    if (stepBefore > 0 && (end > nextEventMeter || pendingEnd < time + DT)) {
      // The race clock at this frame's start: the frame crossing 0 m (run-up) starts the clock inside it.
      const clock = meter < 0 && meter + stepBefore >= 0 ? DT * meter / stepBefore : time;
      // Cut points of this frame as step fractions in (0, 1), insertion-sorted into a reused buffer.
      let nc = 0;
      for (let i = boundaryIndex; i < boundaries.length && boundaries[i] < end; i++) nc = insertCut(cutBuf, nc, (boundaries[i] - ref) / stepBefore);
      const boundaryCuts = nc > 0;
      if (pendingMeter < end || pendingEnd < clock + DT) {
        // A window starts or ends here. Each window's active part of this frame as fractions [from, to) (the same
        // numbers for the cuts and the segment test).
        for (let w = 0; w < n; w++) {
          winFrom[w] = activated[w] ? (activationTimes[w] - clock) / DT : (windows[w].meter - ref) / stepBefore;
          winTo[w] = winFrom[w] + windows[w].duration / DT;
          if (winFrom[w] > 0 && winFrom[w] < 1) nc = insertCut(cutBuf, nc, winFrom[w]);
          if (winTo[w] > 0 && winTo[w] < 1 && winFrom[w] < 1) nc = insertCut(cutBuf, nc, winTo[w]);
        }
      } else {
        // Phase / slope boundary only: windows keep their frame-start state for the whole frame.
        for (let w = 0; w < n; w++) {
          const on = activated[w] && time < activationTimes[w] + windows[w].duration;
          winFrom[w] = on ? -1 : 2; winTo[w] = 2;
        }
      }
      if (nc) {
        cutBuf[nc++] = 1;
        let blendedSpeed = 0, blendedActual = 0, blendedTarget = 0;
        for (let c = 0, from = 0; c < nc; c++) {
          const to = cutBuf[c];
          if (to <= from) continue;
          // Phase and slope only change at a boundary cut; a window-only frame keeps the frame-start ones.
          const at = from === 0 ? ref : ref + from * stepBefore + 1e-6;
          const p = boundaryCuts && from > 0 ? getPhaseAtMeter(at, courseLength, spurt) : phase;
          const sl = boundaryCuts && from > 0 && slopes?.length ? slopeAt(slopes, at) : slope;
          let tB = 0, aB = 0, cB = 0;
          for (let w = 0; w < n; w++) {
            if (winFrom[w] <= from && winTo[w] > from) {
              tB += windows[w].values.target; aB += windows[w].values.accel; cB += windows[w].values.current;
            }
          }
          let v = next, t = target;
          if (p !== phase || sl !== slope || tB !== targetBonus || aB !== accelBonus) {
            const slTarget = sl >= 1 ? -uphillTargetPenalty(sl, stats.power) : sl <= -1 ? downhill * downhillTargetBonus(sl) : 0;
            t = phaseTargets[p] + tB + slTarget;
            v = frameSpeed(speedCtx, speed, t, sl, p, aB, startDash);
          }
          blendedSpeed += v * (to - from);
          blendedTarget += t * (to - from);
          blendedActual += (v + cB) * (to - from);
          from = to;
        }
        for (let w = 0; w < n; w++) {
          if (!activated[w] && winFrom[w] < 1) { activated[w] = true; activationTimes[w] = clock + DT * winFrom[w]; }
        }
        pendingMeter = pendingWindowMeter(windows, activated); pendingEnd = pendingWindowEnd(windows, activated, activationTimes, time);
        nextEventMeter = Math.min(pendingMeter, boundaryIndex < boundaries.length ? boundaries[boundaryIndex] : Number.POSITIVE_INFINITY);
        next = blendedSpeed;
        actual = blendedActual;
        target = blendedTarget; // the trace reports the frame's share-weighted target
      }
    }
    speed = next;
    let stepDistance = actual * DT;
    if (lossShare) stepDistance -= stepDistance * lossShare;
    const remaining = courseLength - meter;
    const fraction = stepDistance > remaining ? remaining / Math.max(stepDistance, 1e-9) : 1;
    const crossesStart = meter < 0 && meter + stepDistance >= 0;
    meter = Math.min(courseLength, meter + stepDistance);
    // At the start line the clock starts: the time already run past 0 m is the overshoot at the actual speed.
    time = crossesStart ? meter / Math.max(actual, 1e-9) : time + DT * fraction;
    // §HP Consumption on current speed (start dash: relative to itself, 20 HP/s); downhill accel mode saves 60%. Only the
    // recorded baseline needs HP (HP-scaled durations read it from baseline states), so skill runs skip it.
    if (record) hp -= hpConsumptionPerSecond(speed, startDash ? speed : base, hpGround, phase >= 2, stats.guts) * (1 - 0.6 * downhill) * DT * fraction;
    if (collectPoints && meter >= 0) points.push({ t: time, meter, speed: actual, targetSpeed: target, phase });
  }
  const times = activationTimes.map((t) => (Number.isFinite(t) ? t : null));
  return { points, finishTime: time, activationTime: times[0] ?? null, activationTimes: times };
}

/** A later condition group placed in the same race as the first trigger (see resolveConditionGroup triggers). */
export interface ChainedTriggerZone { groupIndex: number; regions: ReadonlyArray<{ start: number; end: number }>; isRandom: boolean }
export interface TraceOptions { groupIndex?: number; uniqueLevel?: number; chained?: ChainedTriggerZone[] }

/**
 * Duration, effect values and raw effects of one condition group (unique-level multiplier applied). With `scaling`
 * (engine step 4) the group's `time_scale` applies; HP-scaled types (3, 7) also return `hpTimeScale`, and the caller
 * multiplies the duration by hpDurationMultiplier at the activation meter (see hpScaledDuration).
 */
export function triggerValues(
  skill: SkillDetailInput | null | undefined, groupIndex: number, courseLength: number, uniqueLevel = 1, scaling?: ScalingContext | null,
): { duration: number; values: EffectValues; effects: RawEffect[]; hpTimeScale?: number; stats: StatBlock | null } {
  const group = skill?.conditionGroups?.[groupIndex];
  const effects = (group?.effects ?? []) as RawEffect[];
  const multiplier = skill && isUniqueSkill(skill) ? (type: number) => uniqueLevelMultiplier(uniqueLevel, type) : 1;
  const base = group?.base_time && group.base_time > 0 ? group.base_time / 10_000 : 0;
  const scaled = scaling && base > 0 ? durationScale(group?.time_scale, base, scaling) : { seconds: base, hp: false };
  const duration = scaled.seconds * (courseLength / 1_000);
  const bonus = passiveStatBonus(group, multiplier, scaling);
  return { duration, values: effectValues(effects, multiplier, scaling), effects, stats: isPhysicalStatBonus(bonus) ? bonus : null, ...(scaled.hp ? { hpTimeScale: group!.time_scale! } : {}) };
}

/** `durationAt` for an HP-scaled trigger: the duration times the HP band at the activation frame of the baseline run. */
export function hpScaledDuration(
  trigger: { duration: number; hpTimeScale?: number }, states: ReadonlyArray<Readonly<RunState>>,
): ((meter: number) => number) | undefined {
  const timeScale = trigger.hpTimeScale;
  if (timeScale == null) return undefined;
  return (meter) => trigger.duration * hpDurationMultiplier(timeScale, hpAtMeter(states, meter));
}

/** The scaling context for a course and profile as the physics sees it (adjusted speed from the simulation input). */
export function scalingFor(course: Course | null | undefined, profile: RaceImpactProfile, sim: SimulationInput): ScalingContext | null {
  return course ? scalingContextFor(course, profile.stats, sim.stats.speed, { greenSkillCount: profile.greenSkillCount }) : null;
}

function isModelableEffect(effect: RawEffect): boolean {
  const category = classifyEffect(effect);
  return category === "current_speed" || category === "target_speed" || category === "acceleration";
}

function valuesAt(
  skill: SkillDetailInput | null | undefined, courseLength: number, options: TraceOptions = {},
  scaling: ScalingContext | null = null, states: ReadonlyArray<Readonly<RunState>> = [],
) {
  const primary = triggerValues(skill, options.groupIndex ?? 0, courseLength, options.uniqueLevel ?? 1, scaling);
  const chainedFull = (options.chained ?? []).map((zone) => ({ zone, ...triggerValues(skill, zone.groupIndex, courseLength, options.uniqueLevel ?? 1, scaling) }));
  const chained: ChainedTriggerSpec[] = chainedFull.map((c) => ({ regions: c.zone.regions, isRandom: c.zone.isRandom, duration: c.duration, values: c.values, durationAt: hpScaledDuration(c, states) }));
  const allEffects = [...primary.effects, ...chainedFull.flatMap((c) => c.effects)];
  return { ...primary, durationAt: hpScaledDuration(primary, states), chained, allEffects, windowsModelable: allEffects.some(isModelableEffect), modelable: allEffects.some(isModelableEffect) || primary.stats != null };
}

/** Generates a transparent, simplified baseline-vs-skill comparison trace. */
export function generateRaceTrace(
  skill: SkillDetailInput | null | undefined, context: TraceContext, activationMeterOverride?: number | null,
  activeZones?: EvaluatorZoneInput[] | null, options: TraceOptions = {},
): RaceEffectTrace {
  const courseLength = context.course?.length ?? 2_000;
  const sim = simulationInputFor(context.course, context.profile, context.runningStyle, context.groundCondition);
  const { durationAt, values, chained, allEffects, modelable, windowsModelable, stats, ...primary } = valuesAt(skill, courseLength, options, scalingFor(context.course, context.profile, sim), cachedBaselineRun(sim).states);
  const hasZenkai = allEffects.some((e) => classifyEffect(e) === "zenkai_acceleration");
  const physicsStatus: RaceEffectTrace["physicsStatus"] = hasZenkai ? "provisional" : modelable ? "modeled" : allEffects.length ? "partial" : "not-modeled";
  const regions = (activeZones ?? []).flatMap((z) => z.regions);
  // Deterministic placement: the first trigger fires at its region start (R7.5).
  const activationMeter = activationMeterOverride === undefined
    ? (regions.length ? Math.min(...regions.map((r) => r.start)) : null)
    : activationMeterOverride == null ? null : Math.max(0, Math.min(courseLength, activationMeterOverride));
  const baseline = cachedBaselinePoints(sim);
  const duration = activationMeter != null && durationAt ? durationAt(activationMeter) : primary.duration;
  const windows = windowsModelable && activationMeter != null ? activationWindows(activationMeter, { duration, values }, chained) : [];
  // Task 3: a passive stat bonus runs the whole skill race with the boosted stats (the speed curve shows the difference).
  const skillRun = simulateRunWindows(stats && activationMeter != null ? withStatBonus(sim, stats) : sim, windows);
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
  skillRun.activationTimes.forEach((time, w) => {
    addEventFrames(time, 3);
    addEventFrames(time == null ? null : time + windows[w].duration, 2);
  });
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
  const sampleRun = (run: { readonly points: ReadonlyArray<Readonly<RunResult["points"][number]>> }) => {
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
  const gainMeters = distanceGainMeters(baselineTimelineFromPoints(baseline.points), baseline.finishTime, skillRun.finishTime, courseLength, context.profile);
  return {
    version: 1, points, spatialPoints, activationMeter: activationMeter == null ? null : Math.round(activationMeter),
    effectEndMeter: effectEndPoint ? Number(effectEndPoint.meter.toFixed(1)) : activationMeter == null ? null : courseLength,
    activationTimeSeconds: Number((skillRun.activationTime ?? 0).toFixed(2)),
    effectEndTimeSeconds: Number((skillRun.activationTime == null ? 0 : skillRun.activationTime + duration).toFixed(2)),
    totalTimeSeconds: Number(baseline.finishTime.toFixed(2)), timeGainSeconds: Number(timeGain.toFixed(3)),
    distanceGainMeters: Number(gainMeters.toFixed(2)),
    bashinGain: Number((gainMeters / BASHIN_METERS).toFixed(2)), physicsStatus,
  };
}

export interface TraceContext { course: Course | null | undefined; profile: RaceImpactProfile; runningStyle?: RunningStyle | null; racerCount?: number; groundCondition?: number | null }

export function computeGainDistribution(
  skill: SkillDetailInput | null | undefined, zones: EvaluatorZoneInput[] | null | undefined,
  context: TraceContext, activation: ActivationEstimate, options: TraceOptions = {},
): RaceEffectDistribution {
  const courseLength = context.course?.length ?? 2_000;
  const sim = simulationInputFor(context.course, context.profile, context.runningStyle, context.groundCondition);
  const spurt = sim.spurt;
  const base = cachedBaselineRun(sim);
  const { duration, durationAt, values, chained, modelable, windowsModelable, stats } = valuesAt(skill, courseLength, options, scalingFor(context.course, context.profile, sim), base.states);
  // Task 3: a passive stat bonus applies to the whole race, so its gain does not depend on the meter.
  const boosted = stats ? withStatBonus(sim, stats) : null;
  const passiveFinish = boosted && !windowsModelable ? simulateFinishTime(boosted, []) : null;
  const step = ACTIVATION_SAMPLE_STEP_METERS;
  const regions = (zones ?? []).flatMap((z) => z.regions);
  const keyMeters = new Set<number>([0, spurt, courseLength]);
  for (const region of regions) { keyMeters.add(Math.round(region.start)); keyMeters.add(Math.round(region.end)); }
  for (const region of regions) for (let meter = Math.ceil(region.start / step) * step; meter <= region.end; meter += step) keyMeters.add(meter);
  // Keep the whole course visible, including ineligible positions at zero gain.
  for (let meter = 0; meter <= courseLength; meter += step) keyMeters.add(meter);
  const samples: ActivationMeterSample[] = [];
  const baseTime = base.finishTime;
  const timeline = base.timeline;
  let maxGainMeters = 0, minGainMeters = 0, optimalMeter: number | null = null, optimalGainMeters: number | null = null;
  for (const meter of [...keyMeters].sort((a, b) => a - b)) {
    const zoneIndex = (zones ?? []).findIndex((zone) => zone.regions.some((r) => meter >= r.start - 0.5 && meter <= r.end + 0.5));
    const eligible = zoneIndex >= 0;
    let gainMeters = 0, timeGainSeconds = 0;
    if (eligible && modelable && meter < courseLength) {
      const finish = passiveFinish ?? (boosted
        ? simulateFinishTime(boosted, activationWindows(meter, { duration, values, durationAt }, chained))
        : simulateFinishTime(sim, activationWindows(meter, { duration, values, durationAt }, chained), resumeStateFor(base.states, meter)));
      gainMeters = distanceGainMeters(timeline, baseTime, finish, courseLength, context.profile);
      timeGainSeconds = Math.max(0, baseTime - finish);
    }
    gainMeters = Number(gainMeters.toFixed(2));
    const useful = eligible && gainMeters > 0.05;
    samples.push({ meter, gainMeters, timeGainSeconds: Number(timeGainSeconds.toFixed(4)), bashin: Number((gainMeters / BASHIN_METERS).toFixed(2)), eligible, activationRate: eligible ? activation.activationRate : 0, usefulRate: useful ? activation.activationRate : 0, zoneIndex: eligible ? zoneIndex : undefined });
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
