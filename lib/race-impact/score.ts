// lib/race-impact/score.ts
import type { RunningStyle } from "../deck/types";
import { classifyEffect, type RawEffect } from "../evaluator/effects";
import type { SkillDetailInput } from "../evaluator/types";
import { isSkillBanned } from "../pvp/events";
import type { Course, RaceParameters } from "../skill-engine/types";
import { alternativeTriggerIndices, placedTriggerIndices, resolveConditionGroup } from "./condition-group";
import { dynamicPlacement, hasTimedStateTerm } from "./dynamic-placement";
import { dynamicActivationRate } from "./prior";
import {
  activationWindows, baselineTimelineOf, bashinGain, cachedBaselineRun, hpScaledDuration, resumeStateFor, scalingFor, simulateFinishTime, simulateRunWithStates, simulationInputFor, triggerValues, withStatBonus,
  type BaselineTimeline, type EffectValues, type RunState, type SimulationInput,
} from "./trace";
import {
  ACTIVATION_SAMPLE_STEP_METERS, USEFUL_THRESHOLD_BASHIN,
  type PhysicsStatus, type RaceImpactProfile, type SkillScore, type SkillScoreSample,
} from "./types";

export interface BaselineRun { readonly input: SimulationInput; readonly finishTime: number; readonly states?: ReadonlyArray<Readonly<RunState>>; readonly timeline?: BaselineTimeline }

export function simulateBaseline(course: Course, style: RunningStyle, profile: RaceImpactProfile, groundCondition?: number | null): BaselineRun {
  const input = simulationInputFor(course, profile, style, groundCondition);
  const { finishTime, states } = simulateRunWithStates(input);
  return { input, finishTime, states, timeline: baselineTimelineOf(states, finishTime, input.courseLength) };
}

export interface ScoreSkillInput {
  skill: SkillDetailInput;
  course: Course;
  raceParams: Partial<RaceParameters>;
  style: RunningStyle;
  racerCount: number;
  profile: RaceImpactProfile;
  uniqueLevel?: number;
  baseline?: BaselineRun;
  withSamples?: boolean;
  /**
   * Optional zones already computed by the caller, one per condition group in order (the Visualizer passes the
   * zones it draws). Used only when aligned with `skill.conditionGroups`; otherwise zones are resolved from the
   * course geometry. Same selection rule either way (placedTriggerIndices).
   */
  zones?: ReadonlyArray<CallerZone>;
}

export interface CallerZone { regions: ReadonlyArray<{ start: number; end: number }>; isRandom: boolean }

interface ScoredTrigger { index: number; zones: CallerZone }
type ConditionGroup = NonNullable<SkillDetailInput["conditionGroups"]>[number];

interface ResolvedTriggers {
  group: ConditionGroup; triggers: ScoredTrigger[];
  /** Later alternative groups (not chained) with their zones; used only when the placed group is dynamic (step 5a). */
  alternatives: ScoredTrigger[];
}

function resolveTriggers(input: ScoreSkillInput): ResolvedTriggers | null {
  const groups = input.skill.conditionGroups ?? [];
  let zones: ReadonlyArray<CallerZone>;
  let placed: number[];
  if (input.zones && groups.length && input.zones.length === groups.length) {
    zones = input.zones;
    placed = placedTriggerIndices(groups, zones, input.skill.id);
  } else {
    const resolved = resolveConditionGroup(input.skill, input.course, input.raceParams, input.style);
    if (!resolved) return null;
    zones = resolved.allZones;
    placed = resolved.triggers.map((t) => t.index);
  }
  if (!placed.length) return null;
  const first = placed[0];
  const alternatives = hasTimedStateTerm(groups[first].condition)
    ? alternativeTriggerIndices(groups, zones, first, input.skill.id).map((index) => ({ index, zones: zones[index] }))
    : [];
  return { group: groups[first], triggers: placed.map((index) => ({ index, zones: zones[index] })), alternatives };
}

export interface ActivationFactors { dynamicRate: number }

/**
 * Activation factors of the first placed group (chained triggers follow it, U-tools convention).
 * R32: a score is the skill's value IF it activates. There is no wisdom check (activate_lot) and no `random_lot_shared`
 * lottery, and every race-situation condition counts as met: dynamic state (R7.4), position (R28), own-activation counts
 * (R31), prerequisite skills and popularity. The only remaining factor is the user's `profile.dynamicOverrides`, which
 * can still lower a dynamic key (1 when unset).
 */
export function activationFactors(
  group: { condition?: string | null; precondition?: string | null } | null | undefined, profile: RaceImpactProfile,
): ActivationFactors {
  return { dynamicRate: dynamicActivationRate(group?.condition, group?.precondition, (key) => profile.dynamicOverrides[key] ?? 1) };
}

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function zeroScore(skillId: number, extra: Partial<SkillScore> = {}): SkillScore {
  return {
    skillId, groupIndex: null, expectedBashin: 0, meanBashin: 0, minBashin: 0, maxBashin: 0, medianBashin: 0,
    activationRate: 0, usefulRate: 0, recoveryHpPercent: null, physicsStatus: "not-modeled", banned: false, samples: [], ...extra,
  };
}

function physicsStatusOf(effects: RawEffect[], passiveStats = false): PhysicsStatus {
  const cats = effects.map((e) => classifyEffect(e));
  if (cats.includes("zenkai_acceleration")) return "provisional";
  if (passiveStats || cats.some((c) => c === "current_speed" || c === "target_speed" || c === "acceleration")) return "modeled";
  return effects.length ? "partial" : "not-modeled";
}

function activationPositions(regions: { start: number; end: number }[], isRandom: boolean): { meter: number; weight: number }[] {
  if (!regions.length) return [];
  // R7.5: a deterministic trigger fires at its region start. `earliestFire` is only a lower bound
  // (precondition / chain start), not a point inside the zone; `regions` is already intersected with it.
  if (!isRandom) return [{ meter: regions[0].start, weight: 1 }];
  const total = regions.reduce((t, r) => t + Math.max(0, r.end - r.start), 0) || 1;
  const out: { meter: number; weight: number }[] = [];
  for (const r of regions) {
    const meters: number[] = [];
    for (let m = Math.ceil(r.start / ACTIVATION_SAMPLE_STEP_METERS) * ACTIVATION_SAMPLE_STEP_METERS; m < r.end; m += ACTIVATION_SAMPLE_STEP_METERS) meters.push(m);
    if (!meters.length) meters.push(r.start);
    const share = Math.max(0, r.end - r.start) / total / meters.length;
    for (const m of meters) out.push({ meter: m, weight: share });
  }
  return out;
}

function weightedMedian(samples: SkillScoreSample[]): number {
  const sorted = [...samples].sort((a, b) => a.bashin - b.bashin);
  const half = sorted.reduce((t, s) => t + s.weight, 0) / 2;
  let acc = 0;
  for (const s of sorted) { acc += s.weight; if (acc >= half) return s.bashin; }
  return sorted.at(-1)?.bashin ?? 0;
}

type Placed = { meter: number; weight: number; groupIndex?: number };

/**
 * Where a skill fires on this course and style, conditioned on firing: the step 5a race-state timing for a group with a
 * timed state term (its alternatives compete), else R7.5 / uniform random sampling over the placed zone.
 */
function placeTriggers(
  skill: SkillDetailInput, triggers: ReadonlyArray<ScoredTrigger>, course: Course, raceParams: Partial<RaceParameters>, style: RunningStyle,
  timeline: BaselineTimeline, finishTime: number,
): Placed[] {
  const [first] = triggers;
  const dynamic = hasTimedStateTerm(skill.conditionGroups?.[first.index]?.condition)
    ? dynamicPlacement(
      triggers.map((t) => ({
        index: t.index, condition: skill.conditionGroups?.[t.index]?.condition, precondition: skill.conditionGroups?.[t.index]?.precondition, regions: [...t.zones.regions],
      })),
      course, { ...raceParams, skillId: String(skill.id) }, style, timeline, finishTime,
    )
    : null;
  return dynamic ?? activationPositions([...first.zones.regions], first.zones.isRandom);
}

export function scoreSkill(input: ScoreSkillInput): SkillScore {
  const { skill, course, raceParams, style, racerCount, profile } = input;
  const allEffects = (skill.conditionGroups ?? []).flatMap((g) => (g.effects ?? []) as RawEffect[]);
  if (raceParams.noDebuffs && isSkillBanned(skill.id, true)) {
    return zeroScore(skill.id, { banned: true, physicsStatus: physicsStatusOf(allEffects) });
  }
  const resolved = resolveTriggers(input);
  if (!resolved) return zeroScore(skill.id, { physicsStatus: physicsStatusOf(allEffects) });

  const uniqueLevel = input.uniqueLevel ?? 1;
  const [firstTrigger, ...chainedTriggers] = resolved.triggers;
  // Without an explicit baseline, reuse the memoized no-effect run (identical values; read-only).
  const baseline: BaselineRun = input.baseline ?? cachedBaselineRun(simulationInputFor(course, profile, style, raceParams.groundCondition));
  const states = baseline.states ?? simulateRunWithStates(baseline.input).states;
  // Engine step 4: value / duration scaling and additional activation; HP-scaled durations read the baseline HP.
  const scaling = scalingFor(course, profile, baseline.input);
  const firstValues = triggerValues(skill, firstTrigger.index, course.length, uniqueLevel, scaling);
  const first = { ...firstValues, durationAt: hpScaledDuration(firstValues, states) };
  const chained = chainedTriggers.map((t) => {
    const v = triggerValues(skill, t.index, course.length, uniqueLevel, scaling);
    return { ...v, durationAt: hpScaledDuration(v, states), regions: [...t.zones.regions], isRandom: t.zones.isRandom };
  });
  const effects = [...first.effects, ...chained.flatMap((c) => c.effects)];
  const timeline = baseline.timeline ?? baselineTimelineOf(states, baseline.finishTime, course.length);
  const isModelable = (v: EffectValues) => v.current !== 0 || v.target !== 0 || v.accel !== 0;
  // Task 3: a passive stat bonus (duration -1, types 1-5) re-runs the whole race with the stat added to the final stat;
  // the gain is baseline finish - boosted finish, in Bashin like every other effect.
  const boosted = firstValues.stats ? withStatBonus(baseline.input, firstValues.stats) : null;
  const modelable = boosted != null || isModelable(first.values) || chained.some((c) => isModelable(c.values));

  // Step 5a: a group whose condition depends on the race state fires where our race-state model (dynamic-placement.ts,
  // fitted to umasim results) first makes it hold (the placed group and its alternatives compete); otherwise R7.5 / uniform random sampling.
  // R31: own-activation count terms pass through the zone engine as random conditions, so such a group is sampled
  // uniformly across its eligible zone (10 m steps), as U-tools does; its rate is the activate_count key (R7.4).
  const positions = placeTriggers(skill, [firstTrigger, ...resolved.alternatives], course, raceParams, style, timeline, baseline.finishTime);
  const alternativeSpecs = new Map<number, typeof first>();
  const specFor = (groupIndex: number | undefined) => {
    if (groupIndex == null || groupIndex === firstTrigger.index) return first;
    let spec = alternativeSpecs.get(groupIndex);
    if (!spec) {
      const v = triggerValues(skill, groupIndex, course.length, uniqueLevel, scaling);
      spec = { ...v, durationAt: hpScaledDuration(v, states) };
      alternativeSpecs.set(groupIndex, spec);
    }
    return spec;
  };
  const samples: SkillScoreSample[] = positions.map(({ meter, weight, groupIndex }) => {
    if (!modelable) return { meter, bashin: 0, weight, timeGainSeconds: 0 };
    const windows = activationWindows(meter, specFor(groupIndex), chained);
    const earliest = Math.min(...windows.map((w) => w.meter));
    const finishTime = boosted
      ? simulateFinishTime(boosted, windows)
      : simulateFinishTime(baseline.input, windows, resumeStateFor(states, earliest));
    return {
      meter, weight,
      bashin: r6(bashinGain(timeline, baseline.finishTime, finishTime, course.length, profile)),
      timeGainSeconds: r6(Math.max(0, baseline.finishTime - finishTime)),
    };
  });
  const weightSum = samples.reduce((t, s) => t + s.weight, 0) || 1;
  const meanBashin = samples.reduce((t, s) => t + s.bashin * s.weight, 0) / weightSum;
  const bashins = samples.map((s) => s.bashin);

  // Activation is decided by the first trigger; chained triggers follow it (U-tools convention).
  const activationRate = activationFactors(resolved.group, profile).dynamicRate;
  const usefulShare = samples.filter((s) => s.bashin >= USEFUL_THRESHOLD_BASHIN).reduce((t, s) => t + s.weight, 0) / weightSum;
  const heal = effects.filter((e) => classifyEffect(e) === "heal").reduce((t, e) => t + (e.value ?? 0), 0);

  return {
    skillId: skill.id,
    groupIndex: resolved.triggers[0].index,
    expectedBashin: r6(activationRate * meanBashin),
    meanBashin: r6(meanBashin),
    minBashin: bashins.length ? Math.min(...bashins) : 0,
    maxBashin: bashins.length ? Math.max(...bashins) : 0,
    medianBashin: weightedMedian(samples),
    activationRate: r6(activationRate),
    usefulRate: r6(activationRate * usefulShare),
    recoveryHpPercent: heal ? heal / 100 : null,
    physicsStatus: physicsStatusOf(effects, boosted != null),
    banned: false,
    samples: input.withSamples ? samples : [],
  };
}
