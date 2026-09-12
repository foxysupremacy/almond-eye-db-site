// Shared types for the skill-zone engine. Ported from uma-tools/uma-skill-tools,
// adapted to the flat course shape the AlmondEye DB API returns (corners/slopes
// carry `end` instead of `length`; total meters live in `length`; distance-type
// bucket lives in `distance`).

/** A flat race course, as produced by `lib/api.ts` flattenCourse(). */
export interface Course {
  id: number;
  terrain: number; // 1 turf, 2 dirt
  turn: number; // 1 right, 2 left, 4 straight
  distance: number; // distance-type bucket: 1 sprint, 2 mile, 3 middle, 4 long
  inout: number;
  length: number; // total meters
  corners: { start: number; end: number; number?: number }[];
  straights: { start: number; end: number; frontType: number }[];
  slopes: { start: number; end: number; slope: number }[];
  phases?: { id: number; start: number; end: number }[];
  spurtStart?: { meters?: number };
  positionKeepEnd?: number;
  trackId?: number;
}

export interface HorseParameters {
  speed: number;
  stamina: number;
  power: number;
  guts: number;
  wisdom: number;
  strategy: number;
}

export interface RaceParameters {
  skillId: string;
  orderRange?: [number, number];
  numUmas?: number;
  season?: number | null;
  weather?: number | null;
  groundCondition?: number | null;
  time?: number | null;
  grade?: number | null;
  noDebuffs?: boolean;
}

export type DynamicCondition = (s: unknown) => boolean;

export interface SamplePolicy {
  sample(regions: RegionList, nsamples: number): Region[];
  reconcile(other: SamplePolicy): SamplePolicy;
  reconcileImmediate(other: SamplePolicy): SamplePolicy;
  reconcileDistributionRandom(other: SamplePolicy): SamplePolicy;
  reconcileRandom(other: SamplePolicy): SamplePolicy;
  reconcileStraightRandom(other: SamplePolicy): SamplePolicy;
  reconcileAllCornerRandom(other: SamplePolicy): SamplePolicy;
}

import type { Region, RegionList } from "./region";

export interface Operator {
  samplePolicy: SamplePolicy;
  apply(
    regions: RegionList,
    course: Course,
    horse: HorseParameters,
    extra: RaceParameters,
  ): [RegionList, DynamicCondition];
}

export interface Condition {
  samplePolicy: SamplePolicy;
  filterEq(
    regions: RegionList,
    arg: number,
    course: Course,
    horse: HorseParameters,
    extra: RaceParameters,
  ): RegionList | [RegionList, DynamicCondition];
  filterNeq(
    regions: RegionList,
    arg: number,
    course: Course,
    horse: HorseParameters,
    extra: RaceParameters,
  ): RegionList | [RegionList, DynamicCondition];
  filterLt(
    regions: RegionList,
    arg: number,
    course: Course,
    horse: HorseParameters,
    extra: RaceParameters,
  ): RegionList | [RegionList, DynamicCondition];
  filterLte(
    regions: RegionList,
    arg: number,
    course: Course,
    horse: HorseParameters,
    extra: RaceParameters,
  ): RegionList | [RegionList, DynamicCondition];
  filterGt(
    regions: RegionList,
    arg: number,
    course: Course,
    horse: HorseParameters,
    extra: RaceParameters,
  ): RegionList | [RegionList, DynamicCondition];
  filterGte(
    regions: RegionList,
    arg: number,
    course: Course,
    horse: HorseParameters,
    extra: RaceParameters,
  ): RegionList | [RegionList, DynamicCondition];
}
