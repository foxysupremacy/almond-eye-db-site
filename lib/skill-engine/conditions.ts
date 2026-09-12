// Geometric skill-activation conditions. Ported from
// uma-tools/uma-skill-tools/ActivationConditions.ts, adapted to the flat DB
// course shape (see types.ts):
//
//   * corners use {start,end} (reference used {start,length})
//   * slopes  use {start,end,slope} (reference used {start,length,slope})
//   * `phase` prefers the explicit course.phases[] array (falls back to the
//     1/6 · 2/3 · 5/6 formula), matching the DB's own per-course phases.
//   * stat conditions (base_speed, ground_type, distance_type, rotation, …)
//     are evaluated with a fixed max-stat horse and the course's real scalars.
//   * simulation-only conditions (order, near_count, hp_per, accumulatetime,
//     is_badstart, …) degrade to pass-through noops so they never zero a zone.

import { Region, RegionList } from "./region";
import { CourseHelpers } from "./course";
import {
  ImmediatePolicy,
  RandomPolicy,
  StraightRandomPolicy,
  AllCornerRandomPolicy,
  ErlangRandomPolicy,
} from "./sample-policy";
import type {
  Condition,
  Course,
  DynamicCondition,
  HorseParameters,
  Operator,
  RaceParameters,
  SamplePolicy,
} from "./types";

function kTrue(): boolean {
  return true;
}

function withDefaultCond(r: RegionList | [RegionList, DynamicCondition]): [RegionList, DynamicCondition] {
  if (r instanceof RegionList) return [r, kTrue];
  return r;
}

class CmpOperatorBase implements Operator {
  constructor(
    readonly condition: Condition,
    readonly argument: number,
  ) {}
  get samplePolicy(): SamplePolicy {
    return this.condition.samplePolicy;
  }
  apply(regions: RegionList, course: Course, horse: HorseParameters, extra: RaceParameters) {
    return withDefaultCond(this.condition.filterEq(regions, this.argument, course, horse, extra));
  }
}

export class EqOperator extends CmpOperatorBase {}
export class NeqOperator extends CmpOperatorBase {
  apply(regions: RegionList, course: Course, horse: HorseParameters, extra: RaceParameters) {
    return withDefaultCond(this.condition.filterNeq(regions, this.argument, course, horse, extra));
  }
}
export class LtOperator extends CmpOperatorBase {
  apply(regions: RegionList, course: Course, horse: HorseParameters, extra: RaceParameters) {
    return withDefaultCond(this.condition.filterLt(regions, this.argument, course, horse, extra));
  }
}
export class LteOperator extends CmpOperatorBase {
  apply(regions: RegionList, course: Course, horse: HorseParameters, extra: RaceParameters) {
    return withDefaultCond(this.condition.filterLte(regions, this.argument, course, horse, extra));
  }
}
export class GtOperator extends CmpOperatorBase {
  apply(regions: RegionList, course: Course, horse: HorseParameters, extra: RaceParameters) {
    return withDefaultCond(this.condition.filterGt(regions, this.argument, course, horse, extra));
  }
}
export class GteOperator extends CmpOperatorBase {
  apply(regions: RegionList, course: Course, horse: HorseParameters, extra: RaceParameters) {
    return withDefaultCond(this.condition.filterGte(regions, this.argument, course, horse, extra));
  }
}

export class AndOperator implements Operator {
  constructor(
    readonly left: Operator,
    readonly right: Operator,
  ) {}
  get samplePolicy(): SamplePolicy {
    return this.left.samplePolicy.reconcile(this.right.samplePolicy);
  }
  apply(regions: RegionList, course: Course, horse: HorseParameters, extra: RaceParameters) {
    const [leftval, leftcond] = this.left.apply(regions, course, horse, extra);
    const [rightval, rightcond] = this.right.apply(leftval, course, horse, extra);
    if (leftcond === kTrue && rightcond === kTrue) {
      return [rightval, kTrue] as [RegionList, DynamicCondition];
    }
    return [rightval, (s: unknown) => leftcond(s) && rightcond(s)] as [RegionList, DynamicCondition];
  }
}

export class OrOperator implements Operator {
  constructor(
    readonly left: Operator,
    readonly right: Operator,
  ) {}
  get samplePolicy(): SamplePolicy {
    return this.left.samplePolicy.reconcile(this.right.samplePolicy);
  }
  apply(regions: RegionList, course: Course, horse: HorseParameters, extra: RaceParameters) {
    const [leftval, leftcond] = this.left.apply(regions, course, horse, extra);
    const [rightval, rightcond] = this.right.apply(regions, course, horse, extra);
    return [leftval.union(rightval), (s: unknown) => leftcond(s) || rightcond(s)] as [
      RegionList,
      DynamicCondition,
    ];
  }
}

// ---------------------------------------------------------------------------
// Condition builders
// ---------------------------------------------------------------------------

// The last-spurt section starts at the course's spurt marker (== 2/3 distance
// in the DB) if present, else phase 2 — matching uma-tools, which uses
// `phaseStart(distance, 2)` for is_lastspurt/lastspurt.
function lastSpurtStart(course: Course): number {
  if (course.spurtStart?.meters != null) return course.spurtStart.meters;
  return CourseHelpers.phaseStart(course, 2);
}

/** Region of the last-spurt section; [] when the course has no corner data. */
function lastSpurtBounds(course: Course): Region[] {
  const corners = CourseHelpers.sortedCorners(course);
  if (corners.length === 0) return [];
  return [new Region(Math.max(lastSpurtStart(course), corners[0].start), course.length)];
}

function notSupported(): never {
  throw new Error("unsupported comparison");
}

function noop(regions: RegionList): RegionList {
  return regions;
}

const noopAll = Object.freeze({
  filterEq: noop,
  filterNeq: noop,
  filterLt: noop,
  filterLte: noop,
  filterGt: noop,
  filterGte: noop,
});

const noopImmediate: Condition = Object.freeze(
  Object.assign({ samplePolicy: ImmediatePolicy }, noopAll),
);
const noopRandom: Condition = Object.freeze(Object.assign({ samplePolicy: RandomPolicy }, noopAll));

function immediate(o: Partial<Condition>): Condition {
  const base: Condition = {
    samplePolicy: ImmediatePolicy,
    filterEq: notSupported,
    filterNeq: notSupported,
    filterLt: notSupported,
    filterLte: notSupported,
    filterGt: notSupported,
    filterGte: notSupported,
  };
  return Object.assign({}, base, o);
}

function random(o: Partial<Condition>): Condition {
  const base: Condition = {
    samplePolicy: RandomPolicy,
    filterEq: notSupported,
    filterNeq: notSupported,
    filterLt: notSupported,
    filterLte: notSupported,
    filterGt: notSupported,
    filterGte: notSupported,
  };
  return Object.assign({}, base, o);
}

/** A `_random` condition that always collapses to the provided bounds. */
function randomRegion(f: (course: Course, arg: number) => Region | Region[]): Condition {
  function allBounds(course: Course, arg: number): Region[] {
    const r = f(course, arg);
    return Array.isArray(r) ? r : [r];
  }
  return random({
    filterEq(regions, arg, course) {
      const list = allBounds(course, arg);
      return regions.rmap((x) => list.map((b) => x.intersect(b)));
    },
    // `X_random>0` / `X_random>=0` appear in real data as boolean-exists
    // checks ("on some uphill", "on some corner"). Paint the union of every
    // candidate region rather than zeroing the zone.
    filterGt(regions, arg, course) {
      const list = allBounds(course, 0).filter((b) => b.start > -1);
      return list.length ? regions.rmap((x) => list.map((b) => x.intersect(b))) : new RegionList();
    },
    filterGte(regions, arg, course) {
      const list = allBounds(course, 0).filter((b) => b.start > -1);
      return list.length ? regions.rmap((x) => list.map((b) => x.intersect(b))) : new RegionList();
    },
    // `X_random<1` / `X_random<=0` / `X_random!=1` (i.e. "not on any X") → empty.
    filterLt(regions, arg) {
      return arg >= 1 ? regions : new RegionList();
    },
    filterLte(regions, arg) {
      return arg >= 0 ? regions : new RegionList();
    },
    filterNeq(regions, arg, course) {
      if (arg === 0) {
        const list = allBounds(course, 0).filter((b) => b.start > -1);
        return list.length ? regions.rmap((x) => list.map((b) => x.intersect(b))) : new RegionList();
      }
      return new RegionList();
    },
  });
}

/** A fixed, stat-like condition evaluated against course/horse/extra scalars. */
function valueFilter(getValue: (c: Course, h: HorseParameters, e: RaceParameters) => number): Condition {
  return immediate({
    filterEq(regions, value, course, horse, extra) {
      return getValue(course, horse, extra) === value ? regions : new RegionList();
    },
    filterNeq(regions, value, course, horse, extra) {
      return getValue(course, horse, extra) !== value ? regions : new RegionList();
    },
    filterLt(regions, value, course, horse, extra) {
      return getValue(course, horse, extra) < value ? regions : new RegionList();
    },
    filterLte(regions, value, course, horse, extra) {
      return getValue(course, horse, extra) <= value ? regions : new RegionList();
    },
    filterGt(regions, value, course, horse, extra) {
      return getValue(course, horse, extra) > value ? regions : new RegionList();
    },
    filterGte(regions, value, course, horse, extra) {
      return getValue(course, horse, extra) >= value ? regions : new RegionList();
    },
  });
}

/** An environmental scalar condition that passes through when unset (null/undefined)
 *  and tests strictly when specified. */
function optionalValueFilter(
  getValue: (c: Course, h: HorseParameters, e?: RaceParameters) => number | null | undefined,
): Condition {
  return immediate({
    filterEq(regions, value, course, horse, extra) {
      const v = getValue(course, horse, extra);
      if (v == null) return regions;
      return v === value ? regions : new RegionList();
    },
    filterNeq(regions, value, course, horse, extra) {
      const v = getValue(course, horse, extra);
      if (v == null) return regions;
      return v !== value ? regions : new RegionList();
    },
    filterLt(regions, value, course, horse, extra) {
      const v = getValue(course, horse, extra);
      if (v == null) return regions;
      return v < value ? regions : new RegionList();
    },
    filterLte(regions, value, course, horse, extra) {
      const v = getValue(course, horse, extra);
      if (v == null) return regions;
      return v <= value ? regions : new RegionList();
    },
    filterGt(regions, value, course, horse, extra) {
      const v = getValue(course, horse, extra);
      if (v == null) return regions;
      return v > value ? regions : new RegionList();
    },
    filterGte(regions, value, course, horse, extra) {
      const v = getValue(course, horse, extra);
      if (v == null) return regions;
      return v >= value ? regions : new RegionList();
    },
  });
}

/** A phase-bound skill activation count condition (e.g. activate_count_middle>=3).
 *  Narrows >= and > to the specified phase/section bounds while preserving pass-through
 *  behavior for == (historical checks like Neo Universe's unique). */
function phaseCountRandom(getBounds: (course: Course) => Region): Condition {
  return Object.freeze(
    Object.assign({}, noopRandom, {
      filterGt(regions: RegionList, _n: number, course: Course) {
        return regions.rmap((r) => r.intersect(getBounds(course)));
      },
      filterGte(regions: RegionList, _n: number, course: Course) {
        return regions.rmap((r) => r.intersect(getBounds(course)));
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// The Conditions map (geometric subset + stat filters + noop pass-throughs)
// ---------------------------------------------------------------------------

export const Conditions: { [cond: string]: Condition } = Object.freeze({
  always: noopImmediate,

  // -- geometric phase / section positioning --------------------------------
  phase: immediate({
    filterEq(regions, phase, course) {
      CourseHelpers.assertIsPhase(phase);
      const bounds = new Region(
        CourseHelpers.phaseStart(course, phase),
        CourseHelpers.phaseEnd(course, phase),
      );
      return regions.rmap((r) => r.intersect(bounds));
    },
    filterNeq(regions, phase, course) {
      CourseHelpers.assertIsPhase(phase);
      const b = new Region(0, CourseHelpers.phaseStart(course, phase));
      const after = new Region(CourseHelpers.phaseEnd(course, phase), course.length);
      return regions.rmap((r) => [r.intersect(b), r.intersect(after)]);
    },
    filterLt(regions, phase, course) {
      CourseHelpers.assertIsPhase(phase);
      if (phase === 0) return new RegionList();
      const bounds = new Region(0, CourseHelpers.phaseStart(course, phase));
      return regions.rmap((r) => r.intersect(bounds));
    },
    filterLte(regions, phase, course) {
      CourseHelpers.assertIsPhase(phase);
      const bounds = new Region(0, CourseHelpers.phaseEnd(course, phase));
      return regions.rmap((r) => r.intersect(bounds));
    },
    filterGt(regions, phase, course) {
      CourseHelpers.assertIsPhase(phase);
      if (phase === 3) return new RegionList();
      const bounds = new Region(CourseHelpers.phaseStart(course, phase + 1), course.length);
      return regions.rmap((r) => r.intersect(bounds));
    },
    filterGte(regions, phase, course) {
      CourseHelpers.assertIsPhase(phase);
      const bounds = new Region(CourseHelpers.phaseStart(course, phase), course.length);
      return regions.rmap((r) => r.intersect(bounds));
    },
  }),

  corner: immediate({
    filterEq(regions, cornerNum, course) {
      const corners = CourseHelpers.sortedCorners(course);
      if (cornerNum === 0) {
        // non-corners = gaps between corners (plus any leading/trailing track)
        let lastEnd = 0;
        const nonCorners = corners.map((c) => {
          const r = new Region(lastEnd, c.start);
          lastEnd = c.end;
          return r;
        });
        if (lastEnd !== course.length) nonCorners.push(new Region(lastEnd, course.length));
        return regions.rmap((r) => nonCorners.map((s) => r.intersect(s)));
      } else if (corners.length + cornerNum >= 5) {
        const out: Region[] = [];
        for (let idx = corners.length + cornerNum - 5; idx >= 0; idx -= 4) {
          const c = corners[idx];
          out.push(new Region(c.start, c.end));
        }
        out.reverse();
        return regions.rmap((r) => out.map((c) => r.intersect(c)));
      }
      return new RegionList();
    },
    filterNeq(regions, cornerNum, course) {
      if (cornerNum !== 0) throw new Error("only supports corner!=0");
      const corners = CourseHelpers.sortedCorners(course).map((c) => new Region(c.start, c.end));
      return regions.rmap((r) => corners.map((c) => r.intersect(c)));
    },
  }),

  corner_count: valueFilter((course) => CourseHelpers.sortedCorners(course).length),

  corner_random: randomRegion((course, cornerNum) => {
    const corners = CourseHelpers.sortedCorners(course);
    if (corners.length + cornerNum >= 5) {
      const c = corners[corners.length + cornerNum - 5];
      return new Region(c.start, c.end);
    }
    return new Region(-1, -1);
  }),

  all_corner_random: randomRegion((course) =>
    CourseHelpers.sortedCorners(course).map((c) => new Region(c.start, c.end)),
  ),

  is_finalcorner: immediate({
    filterEq(regions, flag, course) {
      const fc = CourseHelpers.finalCornerStart(course);
      if (fc == null) return new RegionList();
      const bounds = flag ? new Region(fc, course.length) : new Region(0, fc);
      return regions.rmap((r) => r.intersect(bounds));
    },
  }),

  is_finalcorner_laterhalf: immediate({
    filterEq(regions, one, course) {
      if (one !== 1) throw new Error("must be is_finalcorner_laterhalf==1");
      const corners = CourseHelpers.sortedCorners(course);
      if (corners.length === 0) return new RegionList();
      const fc = corners[corners.length - 1];
      const bounds = new Region((fc.start + fc.end) / 2, fc.end);
      return regions.rmap((r) => r.intersect(bounds));
    },
  }),

  is_finalcorner_random: randomRegion((course) => {
    const corners = CourseHelpers.sortedCorners(course);
    if (corners.length === 0) return new Region(-1, -1);
    const fc = corners[corners.length - 1];
    return new Region(fc.start, fc.end);
  }),

  change_order_up_finalcorner_after: randomRegion((course) => {
    const fc = CourseHelpers.finalCornerStart(course);
    if (fc == null) return new Region(-1, -1);
    return new Region(fc, course.length);
  }),

  change_order_up_end_after: random({
    filterGte(regions, arg, course) {
      const bounds = new Region(CourseHelpers.phaseStart(course, 2), course.length);
      return regions.rmap((r) => r.intersect(bounds));
    },
  }),

  change_order_up_middle: random({
    filterGte(regions, arg, course) {
      const bounds = new Region(CourseHelpers.phaseStart(course, 1), CourseHelpers.phaseEnd(course, 1));
      return regions.rmap((r) => r.intersect(bounds));
    },
  }),

  // -- straight -----------------------------------------------------------------
  is_last_straight: immediate({
    filterEq(regions, one, course) {
      if (one !== 1) throw new Error("must be is_last_straight_onetime==1");
      const ls = CourseHelpers.lastStraight(course);
      if (ls == null) return new RegionList();
      return regions.rmap((r) => r.intersect(ls));
    },
  }),

  is_last_straight_onetime: immediate({
    filterEq(regions, one, course) {
      if (one !== 1) throw new Error("must be is_last_straight_onetime==1");
      const ls = CourseHelpers.lastStraight(course);
      if (ls == null) return new RegionList();
      const trigger = new Region(ls.start, ls.start + 10);
      return regions.rmap((r) => r.intersect(trigger));
    },
  }),

  straight_front_type: immediate({
    filterEq(regions, frontType, course) {
      const straights = course.straights.filter((s) => s.frontType === frontType);
      return regions.rmap((r) => straights.map((s) => r.intersect(s)));
    },
  }),

  straight_random: randomRegion((course) => course.straights.map((s) => new Region(s.start, s.end))),

  phase_straight_random: randomRegion((course, phase) => {
    CourseHelpers.assertIsPhase(phase);
    const pb = new Region(CourseHelpers.phaseStart(course, phase), CourseHelpers.phaseEnd(course, phase));
    return course.straights.map((s) => new Region(s.start, s.end).intersect(pb));
  }),

  phase_first_half_straight_random: randomRegion((course, phase) => {
    CourseHelpers.assertIsPhase(phase);
    const s = CourseHelpers.phaseStart(course, phase);
    const e = CourseHelpers.phaseEnd(course, phase);
    const pb = new Region(s, s + (e - s) / 2);
    return course.straights.map((st) => new Region(st.start, st.end).intersect(pb));
  }),

  phase_latter_half_straight_random: randomRegion((course, phase) => {
    CourseHelpers.assertIsPhase(phase);
    const s = CourseHelpers.phaseStart(course, phase);
    const e = CourseHelpers.phaseEnd(course, phase);
    const pb = new Region((s + e) / 2, e);
    return course.straights.map((st) => new Region(st.start, st.end).intersect(pb));
  }),

  last_straight_random: randomRegion((course) => {
    const ls = CourseHelpers.lastStraight(course);
    if (ls == null) return new Region(-1, -1);
    return new Region(ls.start, ls.end);
  }),

  compete_fight_count: randomRegion((course) => {
    const ls = CourseHelpers.lastStraight(course);
    if (ls == null) return new Region(-1, -1);
    return new Region(ls.start, ls.end);
  }),

  // -- slope --------------------------------------------------------------------
  slope: immediate({
    filterEq(regions, slopeType, course) {
      if (slopeType !== 0 && slopeType !== 1 && slopeType !== 2) throw new Error("slopeType");
      const slopes = course.slopes
        .slice()
        .sort((a, b) => a.start - b.start)
        .filter((s) => (slopeType !== 2 && s.slope > 0) || (slopeType !== 1 && s.slope < 0));
      let lastEnd = 0;
      const slopeR =
        slopeType === 0
          ? slopes.map((s) => {
              const r = new Region(lastEnd, s.start);
              lastEnd = s.end;
              return r;
            })
          : slopes.map((s) => new Region(s.start, s.end));
      if (slopeType === 0 && lastEnd !== course.length) slopeR.push(new Region(lastEnd, course.length));
      return regions.rmap((r) => slopeR.map((s) => r.intersect(s)));
    },
  }),

  up_slope_random: randomRegion((course) =>
    course.slopes.filter((s) => s.slope > 0).map((s) => new Region(s.start, s.end)),
  ),

  down_slope_random: randomRegion((course) =>
    course.slopes.filter((s) => s.slope < 0).map((s) => new Region(s.start, s.end)),
  ),

  up_slope_random_later_half: randomRegion((course) => {
    const half = course.length / 2;
    return course.slopes
      .filter((s) => s.slope > 0 && s.end > half)
      .map((s) => new Region(Math.max(s.start, half), s.end));
  }),

  down_slope_random_later_half: randomRegion((course) => {
    const half = course.length / 2;
    return course.slopes
      .filter((s) => s.slope < 0 && s.end > half)
      .map((s) => new Region(Math.max(s.start, half), s.end));
  }),

  // -- distance / phase fractions ----------------------------------------------
  distance_rate: immediate({
    filterLte(regions, rate, course) {
      const bounds = new Region(0, (course.length * rate) / 100);
      return regions.rmap((r) => r.intersect(bounds));
    },
    filterGte(regions, rate, course) {
      const bounds = new Region((course.length * rate) / 100, course.length);
      return regions.rmap((r) => r.intersect(bounds));
    },
  }),

  distance_rate_after_random: randomRegion((course, rate) =>
    new Region((course.length * rate) / 100, course.length),
  ),

  remain_distance: immediate({
    filterEq(regions, remain, course) {
      const bounds = new Region(course.length - remain, course.length - remain + 1);
      return regions.rmap((r) => r.intersect(bounds));
    },
    filterLte(regions, remain, course) {
      const bounds = new Region(course.length - remain, course.length);
      return regions.rmap((r) => r.intersect(bounds));
    },
    filterGte(regions, remain, course) {
      const bounds = new Region(0, course.length - remain);
      return regions.rmap((r) => r.intersect(bounds));
    },
  }),

  phase_random: randomRegion((course, phase) => {
    CourseHelpers.assertIsPhase(phase);
    return new Region(CourseHelpers.phaseStart(course, phase), CourseHelpers.phaseEnd(course, phase));
  }),

  phase_corner_random: randomRegion((course, phase) => {
    CourseHelpers.assertIsPhase(phase);
    const ps = CourseHelpers.phaseStart(course, phase);
    const pe = CourseHelpers.phaseEnd(course, phase);
    return course.corners
      .filter((c) => (c.start >= ps && c.start < pe) || (c.end >= ps && c.end < pe))
      .map((c) => new Region(Math.max(c.start, ps), Math.min(c.end, pe)));
  }),

  phase_firsthalf_random: randomRegion((course, phase) => {
    CourseHelpers.assertIsPhase(phase);
    const s = CourseHelpers.phaseStart(course, phase);
    const e = CourseHelpers.phaseEnd(course, phase);
    return new Region(s, s + (e - s) / 2);
  }),

  phase_laterhalf_random: randomRegion((course, phase) => {
    CourseHelpers.assertIsPhase(phase);
    const s = CourseHelpers.phaseStart(course, phase);
    const e = CourseHelpers.phaseEnd(course, phase);
    return new Region((s + e) / 2, e);
  }),

  phase_firsthalf: immediate({
    filterEq(regions, phase, course) {
      CourseHelpers.assertIsPhase(phase);
      const s = CourseHelpers.phaseStart(course, phase);
      const e = CourseHelpers.phaseEnd(course, phase);
      return regions.rmap((r) => r.intersect(new Region(s, s + (e - s) / 2)));
    },
  }),

  phase_laterhalf: immediate({
    filterEq(regions, phase, course) {
      CourseHelpers.assertIsPhase(phase);
      const s = CourseHelpers.phaseStart(course, phase);
      const e = CourseHelpers.phaseEnd(course, phase);
      return regions.rmap((r) => r.intersect(new Region((s + e) / 2, e)));
    },
  }),

  phase_firstquarter: immediate({
    filterEq(regions, phase, course) {
      CourseHelpers.assertIsPhase(phase);
      const s = CourseHelpers.phaseStart(course, phase);
      const e = CourseHelpers.phaseEnd(course, phase);
      return regions.rmap((r) => r.intersect(new Region(s, s + (e - s) / 4)));
    },
  }),

  phase_firstquarter_random: randomRegion((course, phase) => {
    CourseHelpers.assertIsPhase(phase);
    const s = CourseHelpers.phaseStart(course, phase);
    const e = CourseHelpers.phaseEnd(course, phase);
    return new Region(s, s + (e - s) / 4);
  }),

  // -- course scalar filters -----------------------------------------------------
  distance_type: valueFilter((course) => course.distance),
  ground_type: valueFilter((course) => course.terrain),
  rotation: valueFilter((course) => course.turn),
  course_distance: valueFilter((course) => course.length),
  is_basis_distance: valueFilter((course) => (course.length % 400 === 0 ? 1 : 0)),
  track_id: valueFilter((course) => course.trackId ?? -1),
  is_tight_track: valueFilter((course) =>
    [10001, 10002, 10004, 10010, 10101, 10103, 10104, 10105].includes(course.trackId ?? -1) ? 1 : 0,
  ),
  is_abroad: valueFilter((course) => ((course.trackId ?? 0) >= 10200 ? 1 : 0)),
  is_dirtgrade: valueFilter((course) =>
    [10101, 10103, 10104, 10105].includes(course.trackId ?? -1) ? 1 : 0,
  ),

  // -- environmental / race context filters (optional pass-through when unset) --
  season: optionalValueFilter((_c, _h, extra) => extra?.season),
  weather: optionalValueFilter((_c, _h, extra) => extra?.weather),
  ground_condition: optionalValueFilter((_c, _h, extra) => extra?.groundCondition),
  time: optionalValueFilter((_c, _h, extra) => extra?.time),
  grade: optionalValueFilter((_c, _h, extra) => extra?.grade),

  base_speed: valueFilter((_c, horse) => horse.speed),
  base_stamina: valueFilter((_c, horse) => horse.stamina),
  base_power: valueFilter((_c, horse) => horse.power),
  base_guts: valueFilter((_c, horse) => horse.guts),
  base_wiz: valueFilter((_c, horse) => horse.wisdom),
  running_style: valueFilter((_c, horse) => horse.strategy),

  // -- furlong (Japanese racing 200m intervals) ---------------------------------
  furlong: immediate({
    filterEq(regions, n, course) {
      const bounds = new Region(n * 200, Math.min((n + 1) * 200, course.length));
      return regions.rmap((r) => r.intersect(bounds));
    },
    filterGte(regions, n, course) {
      const bounds = new Region(n * 200, course.length);
      return regions.rmap((r) => r.intersect(bounds));
    },
    filterLte(regions, n, course) {
      const bounds = new Region(0, Math.min((n + 1) * 200, course.length));
      return regions.rmap((r) => r.intersect(bounds));
    },
  }),

  // -- simulation-only / unknown → pass-through noops (never zero a zone) --------
  accumulatetime: immediate({
    filterGte(regions, t, course) {
      const startDist = Math.min(t * 20, course.length);
      const bounds = new Region(startDist, course.length);
      return regions.rmap((r) => r.intersect(bounds));
    },
    filterGt(regions, t, course) {
      const startDist = Math.min(t * 20, course.length);
      const bounds = new Region(startDist, course.length);
      return regions.rmap((r) => r.intersect(bounds));
    },
    filterEq: noop,
    filterNeq: noop,
    filterLt: noop,
    filterLte: noop,
  }),
  activate_count_all: noopRandom,
  activate_count_all_team: noopRandom,
  activate_count_end_after: phaseCountRandom(
    (course) => new Region(CourseHelpers.phaseStart(course, 2), CourseHelpers.phaseEnd(course, 3)),
  ),
  activate_count_heal: noopRandom,
  activate_count_later_half: phaseCountRandom(
    (course) => new Region(course.length / 2, course.length),
  ),
  activate_count_middle: phaseCountRandom(
    (course) => new Region(CourseHelpers.phaseStart(course, 1), CourseHelpers.phaseEnd(course, 1)),
  ),
  activate_count_start: phaseCountRandom(
    (course) => new Region(CourseHelpers.phaseStart(course, 0), CourseHelpers.phaseEnd(course, 0)),
  ),
  bashin_diff_behind: noopRandom,
  bashin_diff_infront: noopRandom,
  behind_near_lane_time: noopRandom,
  behind_near_lane_time_set1: noopRandom,
  blocked_all_continuetime: noopRandom,
  blocked_front: noopRandom,
  blocked_front_continuetime: noopRandom,
  blocked_side_continuetime: noopRandom,
  change_order_onetime: noopRandom,
  distance_diff_rate: noopImmediate,
  distance_diff_top: noopImmediate,
  distance_diff_top_float: noopImmediate,
  hp_per: noopImmediate,
  infront_near_lane_time: noopRandom,
  is_activate_any_skill: noopRandom,
  is_activate_heal_skill: noopRandom,
  is_activate_other_skill_detail: noopImmediate,
  is_badstart: noopImmediate,
  is_behind_in: noopImmediate,
  is_exist_chara_id: noopImmediate,
  is_exist_skill_id: noopImmediate,
  is_goodstart: noopImmediate,
  is_hp_empty_onetime: noopImmediate,
  is_lastspurt: immediate({
    // `is_lastspurt==1` → only inside the last-spurt section; `==0` → only
    // before it. (Bounds [] when the course has no corners → never fires.)
    filterEq(regions, flag, course) {
      const bounds = lastSpurtBounds(course);
      if (flag === 1) {
        return bounds.length ? regions.rmap((r) => bounds.map((b) => r.intersect(b))) : new RegionList();
      }
      if (flag === 0) {
        const s = lastSpurtStart(course);
        return regions.rmap((r) => r.intersect(new Region(0, Math.min(s, course.length))));
      }
      throw new Error("must be is_lastspurt==0|1");
    },
  }),
  is_move_lane: noopRandom,
  is_overtake: noopRandom,
  is_surrounded: noopRandom,
  is_temptation: noopImmediate,
  is_used_skill_id: noopImmediate,
  is_used_skill_id_with_detail_one: noopImmediate,
  is_popularity_top_character_activate_advantage_skill: noopImmediate,
  is_other_character_activate_advantage_skill: noopImmediate,
  lane_type: noopImmediate,
  // `lastspurt==1` (entered last spurt) / `==2` (deep in it) → last-spurt
  // section; `==3` ("not in last spurt") → before it. The precise
  // transition-frame distinction is simulation-only; the section bounds are
  // what's paintable.
  lastspurt: immediate({
    filterEq(regions, case_, course) {
      if (case_ === 1 || case_ === 2) {
        const bounds = lastSpurtBounds(course);
        return bounds.length ? regions.rmap((r) => bounds.map((b) => r.intersect(b))) : new RegionList();
      }
      if (case_ === 3) {
        const s = lastSpurtStart(course);
        return regions.rmap((r) => r.intersect(new Region(0, Math.min(s, course.length))));
      }
      throw new Error("lastspurt must be 1-3");
    },
  }),
  motivation: noopImmediate,
  near_count: noopRandom,
  near_infront_count: noopRandom,
  order: noopImmediate,
  order_rate: noopImmediate,
  order_rate_in20_continue: noopImmediate,
  order_rate_in40_continue: noopImmediate,
  order_rate_in50_continue: noopImmediate,
  order_rate_in80_continue: noopImmediate,
  order_rate_out20_continue: noopImmediate,
  order_rate_out40_continue: noopImmediate,
  order_rate_out50_continue: noopImmediate,
  order_rate_out70_continue: noopImmediate,
  overtake_target_no_order_up_time: noopRandom,
  overtake_target_time: noopRandom,
  popularity: noopImmediate,
  post_number: noopImmediate,
  random_lot: noopImmediate,
  remain_distance_viewer_id: noopImmediate,
  run_at_full_speed_random: random({
    filterEq(regions, flag, course) {
      if (flag !== 1) return new RegionList();
      const bounds = lastSpurtBounds(course);
      return bounds.length ? regions.rmap((r) => bounds.map((b) => r.intersect(b))) : new RegionList();
    },
  }),
  running_style_count_nige_otherself: noopImmediate,
  running_style_count_senko_otherself: noopImmediate,
  running_style_count_sashi_otherself: noopImmediate,
  running_style_count_oikomi_otherself: noopImmediate,
  running_style_count_same: noopImmediate,
  running_style_count_same_rate: noopImmediate,
  running_style_equal_popularity_one: noopImmediate,
  running_style_temptation_count_nige: noopRandom,
  running_style_temptation_count_senko: noopRandom,
  running_style_temptation_count_sashi: noopRandom,
  running_style_temptation_count_oikomi: noopRandom,
  running_style_temptation_opponent_count_nige: noopRandom,
  running_style_temptation_opponent_count_senko: noopRandom,
  running_style_temptation_opponent_count_sashi: noopRandom,
  running_style_temptation_opponent_count_oikomi: noopRandom,
  same_skill_horse_count: noopImmediate,
  succession_skill_count: noopImmediate,
  temptation_count: noopImmediate,
  temptation_count_behind: noopRandom,
  temptation_count_infront: noopRandom,
  temptation_opponent_count_behind: noopRandom,
  temptation_opponent_count_infront: noopRandom,
  visiblehorse: noopImmediate,
  fan_count: noopImmediate,
});

// Erlang-distributed timing conditions (modeled as noop-random in the static view).
export { ErlangRandomPolicy };
