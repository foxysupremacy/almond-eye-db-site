import type { RaceImpactProfile } from '../race-impact/types';

export type Stats = RaceImpactProfile['stats'];
export const adjustedStat = (value: number) => value <= 1200 ? value : 1200 + (value - 1200) / 2;
export const raceBaseSpeed = (length: number) => 20 - (length - 2000) / 1000;
const PHASE_COEFF: Record<number, number[]> = { 1: [1,.98,.962], 2: [.978,.991,.975], 3: [.938,.998,.994], 4: [.931,1,1], 5: [1.063,.962,.95] };
const HP_COEFF: Record<number, number> = { 1:.95, 2:.89, 3:1, 4:.995, 5:.86 };
export function effectiveStats(raw: Stats, modifiers: Stats): Stats {
  return Object.fromEntries(Object.entries(raw).map(([key,value]) => [key,Math.max(1, adjustedStat(value) + modifiers[key as keyof Stats])])) as Stats;
}
export function maxHP(length: number, stamina: number, style: number): number { return length + .8 * (HP_COEFF[style] ?? 1) * stamina; }
/** stats are already adjusted, with skill stat modifiers applied afterwards. */
export function baseTargetSpeed(phase: number, length: number, stats: Stats, style: number): number {
  return raceBaseSpeed(length) * (PHASE_COEFF[style] ?? PHASE_COEFF[2])[Math.min(2,phase)] + (phase >= 2 ? Math.sqrt(500 * stats.speed) * .002 : 0);
}
export function maxSpurtSpeed(length: number, stats: Stats, style: number): number {
  return (baseTargetSpeed(2,length,stats,style) + .01 * raceBaseSpeed(length)) * 1.05 + Math.sqrt(500 * stats.speed) * .002 + Math.pow(450 * stats.guts,.597) * .0001;
}
export function minimumSpeed(length: number, guts: number): number { return .85 * raceBaseSpeed(length) + Math.sqrt(200 * guts) * .001; }
export function hpPerSecond(velocity: number, length: number, guts: number, phase: number, terrain = 1, ground = 1): number {
  const groundFactor = terrain === 2 && ground === 3 ? 1.01 : ground >= 3 ? 1.02 : 1;
  return 20 * Math.pow(velocity - raceBaseSpeed(length) + 12,2) / 144 * groundFactor * (phase >= 2 ? 1 + 200 / Math.sqrt(600 * Math.max(1,guts)) : 1);
}
export function limitBreakDistanceFactor(length: number): number { return length < 2101 ? 0 : length < 2201 ? .5 : length < 2401 ? 1 : length < 2601 ? 1.5 : 1.8; }
/** raw panel stat + skill bonus is deliberately not halved for the threshold/buff. */
export function staminaLimitBreak(length: number, thresholdStamina: number): number {
  return thresholdStamina > 1200 ? Math.sqrt(thresholdStamina - 1200) * .0085 * limitBreakDistanceFactor(length) * .9865 : 0;
}
