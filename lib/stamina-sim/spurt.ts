import { getCruisingTargetSpeed, hpConsumptionPerSecond } from "../race-impact/trace";
import type { RaceContext } from "./stats";

export interface SpurtPlan { speed: number; startMeter: number; isMax: boolean }

/** Doc §Last Spurt: HP need is estimated up to 60 m before the goal line. */
const SPURT_HP_MARGIN = 60;
/** Doc §Last Spurt: candidates lower the target speed by 0.1 m/s per step. */
const SPURT_STEP = 0.1;

/** sqrt(500 x Speed) x 0.002: the speed-stat term of doc §Base Target Speed (distance aptitude A). */
function speedTerm(ctx: RaceContext): number {
  return Math.sqrt(500 * ctx.stats.speed) * 0.002;
}

/**
 * Doc §Base Target Speed (no section randomness) for phase 0-3 with the speed term scaled by doc §Distance
 * Proficiency Modifier (getCruisingTargetSpeed assumes A). Phase 3 here is the late-race base target, not the spurt.
 */
export function baseTargetSpeed(ctx: RaceContext, phase: number): number {
  const p = Math.min(2, phase);
  const target = getCruisingTargetSpeed(p, ctx.courseLength, ctx.stats, ctx.style);
  return p >= 2 ? target - speedTerm(ctx) * (1 - ctx.distanceSpeedMod) : target;
}

/** Doc §Base Target Speed: the late-race base target speed, the slowest spurt candidate. */
export function lateRaceTargetSpeed(ctx: RaceContext): number {
  return baseTargetSpeed(ctx, 2);
}

/**
 * Doc §Last Spurt: LastSpurtSpeedMax = (BaseTargetSpeedPhase2 + 0.01 BaseSpeed) x 1.05 + speed term + guts term, the
 * speed term scaled by distance aptitude both inside BaseTargetSpeedPhase2 and on its own.
 */
export function lastSpurtSpeedMax(ctx: RaceContext): number {
  const atA = getCruisingTargetSpeed(3, ctx.courseLength, ctx.stats, ctx.style);
  return atA - speedTerm(ctx) * (1 - ctx.distanceSpeedMod) * 2.05;
}

/** Late-race HP per metre at `speed` (doc §HP Consumption, with the late-race guts modifier). */
function hpPerMeter(ctx: RaceContext, speed: number): number {
  return hpConsumptionPerSecond(speed, ctx.baseSpeed, ctx.hpGroundCoef, true, ctx.stats.guts) / speed;
}

/** HP needed to run from `meter` to 60 m before the goal at `speed` (doc §Last Spurt estimate, no acceleration). */
export function spurtHpNeed(ctx: RaceContext, meter: number, speed: number): number {
  return Math.max(0, ctx.courseLength - SPURT_HP_MARGIN - meter) * hpPerMeter(ctx, speed);
}

/**
 * Doc §Last Spurt: max speed if HP covers the rest (estimated to 60 m before the goal), else the fastest
 * candidate stepping speed down by 0.1 m/s to the late-race base target speed. Each candidate runs at the base target
 * speed until its start meter, then spurts as far as HP allows. No wisdom roll: the fastest candidate is taken.
 */
export function planSpurt(ctx: RaceContext, meter: number, hp: number): SpurtPlan {
  const vMax = lastSpurtSpeedMax(ctx);
  if (hp >= spurtHpNeed(ctx, meter, vMax)) return { speed: vMax, startMeter: meter, isMax: true };
  const vBase = lateRaceTargetSpeed(ctx);
  const L = ctx.courseLength;
  const estimateEnd = L - SPURT_HP_MARGIN;
  const dist = Math.max(0, estimateEnd - meter);
  const baseCost = hpPerMeter(ctx, vBase);
  let best: SpurtPlan = { speed: vBase, startMeter: meter, isMax: false };
  let bestTime = (L - meter) / vBase;
  for (let k = 1; ; k++) {
    const v = Math.max(vBase, vMax - SPURT_STEP * k);
    const cost = hpPerMeter(ctx, v);
    // Spurt distance d: (dist - d) x baseCost + d x cost <= hp.
    const d = cost > baseCost ? Math.min(dist, Math.max(0, (hp - dist * baseCost) / (cost - baseCost))) : dist;
    const startMeter = Math.max(meter, estimateEnd - d);
    const time = (startMeter - meter) / vBase + (L - startMeter) / v;
    if (time < bestTime) { bestTime = time; best = { speed: v, startMeter, isMax: false }; }
    if (v <= vBase) break;
  }
  return best;
}
