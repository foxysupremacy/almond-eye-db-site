import {
  baseAccelAt, downhillTargetBonus, hpConsumptionPerSecond, sectionRandomMean, slopeAt, uphillTargetPenalty,
} from "../race-impact/trace";
import { onHeal, onOutOfHp, stepMechanics, type FrameView, type MechanicsState } from "./mechanics";
import { baseTargetSpeed, planSpurt, type SpurtPlan } from "./spurt";
import type { RaceContext } from "./stats";
import type { Rng } from "./types";

export interface RunEvents {
  /** Sorted by meter ascending (unsorted input is sorted once per run). pct > 0 heal, < 0 HP loss, % of max HP. */
  heals: { meter: number; pct: number }[];
}
export interface RunOutcome { reachedGoal: boolean; maxSpurt: boolean; finalHp: number; enteredStaminaKeep: boolean }
export interface RunFrame { t: number; meter: number; speed: number; hp: number }

/** Doc §Frame Rate: ~15 frames per second. */
const DT = 1 / 15;
const FRAMES_PER_SECOND = 15;
/** Doc §Starting Speed. */
const START_SPEED = 3;
/** Doc §Start Dash: +24 m/s^2 until speed reaches 0.85 x BaseSpeed. */
const START_DASH_ACCEL = 24;
const START_DASH_END = 0.85;
/** Doc §Target Speed: target speed never exceeds 30 m/s. */
const MAX_TARGET_SPEED = 30;
/** Doc §Deceleration: early / mid / late / last-spurt phase, and out of HP (overrides). */
const DECEL_BY_PHASE = [-1.2, -0.8, -1.0, -1.0] as const;
const OUT_OF_HP_DECEL = -1.2;
/** Doc §Acceleration, strategy phase coefficient (early, mid, late & last spurt) by running style. */
const ACCEL_PHASE_COEFFICIENT: Record<number, readonly [number, number, number]> = {
  1: [1, 1, 0.996], 2: [0.985, 1, 0.996], 3: [0.975, 1, 1], 4: [0.945, 1, 0.997], 5: [1.17, 0.94, 0.956],
};
/** Doc §Slope Modifier: downhill accel mode exits with 20% per second; it cuts HP consumption by 60%. */
const DOWNHILL_EXIT_CHANCE = 0.2;
const DOWNHILL_HP_FACTOR = 0.4;
/** Safety cap on frames (10 minutes of race). */
const MAX_FRAMES = 600 * FRAMES_PER_SECOND;

/** Doc §Section: 24 equal sections numbered 1..24. */
export function sectionAt(ctx: RaceContext, meter: number): number {
  return Math.min(24, Math.max(1, Math.floor(meter / (ctx.courseLength / 24)) + 1));
}

/** Doc §Phase: 0 early, 1 mid, 2 late, 3 last spurt phase, from the context's phase starts. */
function phaseAt(phases: readonly [number, number, number], meter: number): number {
  return meter >= phases[2] ? 3 : meter >= phases[1] ? 2 : meter >= phases[0] ? 1 : 0;
}

function sortedHeals(heals: RunEvents["heals"]): RunEvents["heals"] {
  for (let i = 1; i < heals.length; i++) if (heals[i].meter < heals[i - 1].meter) return [...heals].sort((a, b) => a.meter - b.meter);
  return heals;
}

/**
 * One race for one uma, frame by frame (DT = 1/15 s): start dash, phase target speeds, slopes (uphill penalty, random
 * downhill accel mode), HP consumption, the last-spurt plan made on entering the late race and re-made when a heal
 * lands after it, and out-of-HP minimum speed. `mech` (from initMechanics) adds the race mechanics; without it the run
 * is the bare model. `onFrame` is for tests only.
 */
export function simulateRun(
  ctx: RaceContext, rng: Rng, events: RunEvents, mech?: MechanicsState, onFrame?: (f: RunFrame) => void,
): RunOutcome {
  const L = ctx.courseLength;
  const { phases, slopes, stats, maxHp, minSpeed } = ctx;
  const base = ctx.baseSpeed;
  // Doc §Randomness Per Section: its mean (Max - 0.325%) on the base target speed outside the last spurt, as trace.ts.
  const sectionRandom = base * sectionRandomMean(stats.wisdom);
  const cruise0 = baseTargetSpeed(ctx, 0) + sectionRandom;
  const cruise1 = baseTargetSpeed(ctx, 1) + sectionRandom;
  const cruise2 = baseTargetSpeed(ctx, 2) + sectionRandom;
  const coeff = ACCEL_PHASE_COEFFICIENT[ctx.style] ?? ACCEL_PHASE_COEFFICIENT[1];
  // Doc §Acceleration: sqrt(500 x Power) x ground x distance proficiency modifiers.
  const accelTerm = Math.sqrt(500 * stats.power) * ctx.accelMods.ground * ctx.accelMods.distance;
  // Doc §Slope Modifier: chance per second of entering downhill accel mode, WizStat x 0.04%.
  const downhillEnter = Math.min(1, Math.max(0, stats.wisdom * 0.0004));
  const dashEnd = START_DASH_END * base;
  const hasSlopes = slopes.length > 0;
  const heals = sortedHeals(events.heals);

  let meter = 0, speed = START_SPEED, hp = maxHp, time = 0;
  let startDash = true, downhill = false;
  // Spec §3: the goal counts as reached only if HP never hit 0 before the finish (a later heal does not undo it).
  let outOfHp = false;
  let plan: SpurtPlan | null = null;
  let spurtBeganMax = false;
  let healIndex = 0;
  const frame: RunFrame = { t: 0, meter: 0, speed: 0, hp: 0 };
  const view: FrameView = { t: 0, meter: 0, hp: 0, speed: 0, section: 1, phase: 0, spurtPlan: null };

  for (let f = 0; f < MAX_FRAMES && meter < L; f++) {
    // Heals and HP losses that land at this frame's position; heals after the late-race start re-plan the spurt.
    while (healIndex < heals.length && heals[healIndex].meter <= meter) {
      const pct = heals[healIndex++].pct;
      hp = Math.min(maxHp, Math.max(0, hp + (pct / 100) * maxHp));
      if (pct > 0 && plan) plan = planSpurt(ctx, meter, hp);
      if (pct > 0 && mech) onHeal(mech);
    }
    // Doc §Zenkai Spurt: out of HP during Zenkai drops straight to minimum speed.
    if (hp <= 0 && mech && onOutOfHp(mech)) speed = minSpeed;
    const phase = phaseAt(phases, meter);
    if (!plan && phase >= 2) { plan = planSpurt(ctx, meter, hp); spurtBeganMax = plan.isMax; }

    // Doc §Slope Modifier: downhill accel mode is rolled once per second on a downhill and ends off it.
    const slope = hasSlopes ? slopeAt(slopes, meter) : 0;
    if (slope <= -1) {
      if (f % FRAMES_PER_SECOND === FRAMES_PER_SECOND - 1) {
        downhill = downhill ? rng.next() >= DOWNHILL_EXIT_CHANCE : rng.next() < downhillEnter;
      }
    } else downhill = false;

    let mul = 1, add = 0, accelAdd = 0, hpMul = 1, hpLoss = 0;
    if (mech) {
      view.t = time; view.meter = meter; view.hp = hp; view.speed = speed;
      view.section = sectionAt(ctx, meter); view.phase = phase; view.spurtPlan = plan;
      const mods = stepMechanics(mech, view, rng);
      mul = mods.targetSpeedMul; add = mods.targetSpeedAdd; accelAdd = mods.accelAdd; hpMul = mods.hpMul; hpLoss = mods.hpLoss;
    }

    if (startDash && speed >= dashEnd) startDash = false;
    let target: number;
    if (hp <= 0) target = minSpeed; // doc §Out of HP
    else {
      target = plan && meter >= plan.startMeter ? plan.speed : phase >= 2 ? cruise2 : phase === 1 ? cruise1 : cruise0;
      // Doc §Target Speed: (base | last spurt) x position-keep coefficient + skill-like additions.
      target = target * mul + add;
      if (slope >= 1) target -= uphillTargetPenalty(slope, stats.power);
      else if (downhill) target += downhillTargetBonus(slope);
      // Doc §Target Speed: between minimum speed (after the start dash) and 30 m/s.
      target = Math.min(MAX_TARGET_SPEED, startDash ? target : Math.max(minSpeed, target));
    }

    if (speed < target) {
      const accel = baseAccelAt(slope) * accelTerm * coeff[Math.min(2, phase)] + accelAdd + (startDash ? START_DASH_ACCEL : 0);
      speed = Math.min(target, speed + accel * DT);
      if (startDash) speed = Math.min(speed, dashEnd); // doc §Start Dash cap
    } else if (speed > target) {
      speed = Math.max(target, speed + (hp <= 0 ? OUT_OF_HP_DECEL : DECEL_BY_PHASE[phase]) * DT);
    }
    // Doc §Minimum Speed: after the start dash, speed is raised to the minimum after acceleration.
    if (!startDash && speed < minSpeed) speed = minSpeed;

    const step = speed * DT;
    const fraction = step > L - meter ? (L - meter) / step : 1;
    meter = fraction < 1 ? L : meter + step;
    time += DT * fraction;
    // Doc §HP Consumption (start dash relative to its own speed, as trace.ts), guts modifier in the late race,
    // x0.4 in downhill accel mode; mechanics status modifiers (rushed, pace down); competition HP once per activation (R8).
    const burn = hpConsumptionPerSecond(speed, startDash ? speed : base, ctx.hpGroundCoef, phase >= 2, stats.guts)
      * (downhill ? DOWNHILL_HP_FACTOR : 1) * hpMul * DT * fraction + hpLoss;
    hp -= burn;
    if (hp <= 0) { hp = 0; outOfHp = true; }

    if (onFrame) { frame.t = time; frame.meter = meter; frame.speed = speed; frame.hp = hp; onFrame(frame); }
  }

  const reachedGoal = meter >= L && !outOfHp;
  return { reachedGoal, maxSpurt: reachedGoal && spurtBeganMax, finalHp: hp, enteredStaminaKeep: mech?.enteredStaminaKeep ?? false };
}
