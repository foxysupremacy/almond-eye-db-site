/**
 * Step 5a (task 2), model rewritten for R33: where a race-state trigger fires inside its zone.
 *
 * The zone engine treats race-state conditions (is_overtake, blocked_side_continuetime, change_order_up_end_after, ...)
 * as pass-throughs, so a group holding one would be sampled uniformly over its static zone. The game fires a skill on
 * the first frame its whole condition holds, so the placement should follow the timing of the race state.
 *
 * Our race-state model (own design; parameters fitted to black-box results, see RACE_STATE_MODEL):
 * - FIELD POSITION. Each running style has a share `f` of the field ahead of it within overtaking reach (front runner
 *   near the lead, mechanics §Position Keeping). Front runner 0.1 and runaway 0.05 are assumed; pace chaser, late
 *   surger and end closer are fitted (an end closer can trail the pack beyond the 20 m overtake-target reach).
 * - OVERTAKE ATTEMPTS (mechanics §Overtake Targets / §Overtake Mode). A horse enters overtake mode when a slower horse
 *   is close ahead, so attempts start at a rate proportional to the horses ahead (`attemptRate` x f per second) and
 *   last `attemptSeconds` on average. Being targeted by a horse behind is the mirror image (rate `attemptRate` x (1-f),
 *   lasting `targetedSeconds`).
 * - PLACE CHANGES. A share `passShare` of attempts ends in a completed pass: places are gained at passShare x the
 *   attempt rate and lost at passShare x the targeted rate, times `latePassBoost` in the late race (Poisson events;
 *   counted per phase window for the change_order_up_* terms).
 * - PROXIMITY (mechanics §near_count, §is_surrounded, §behind/infront_near_lane_time, §Front/Side Blocking). Nearby
 *   horses are a Poisson field of `density` horses per metre x horse lane (times `spread` per later phase, as the field
 *   strings out). Ahead of the horse the density is scaled by 2f, behind by 2(1-f). Each state holds when its box from
 *   the mechanics doc holds a horse (P = 1 - exp(-density x area)); a state's episodes last `proximitySeconds` on average.
 *   The horse starts between its gate neighbours, so side-blocked and "near" states hold at the start.
 * - Rushing horses behind (temptation_opponent_count_behind) follow the doc's rush chance; lane moves (is_move_lane)
 *   follow the attempt rate. Neither is identified by the fit data.
 *
 * Every state is an on/off episode (with its elapsed time), a per-second event, or a count, propagated exactly over a
 * 1 s grid along the baseline run (no sampling). The first-hit distribution of the condition is then conditioned on
 * firing: R7.4 keeps the activation rate at 1, so only the position moves. Hits are binned to 10 m like random zones.
 *
 * Scope:
 * - Only the CONDITION is timed; dynamic parts of a precondition stay satisfied (R7.4).
 * - When the placed group is dynamic, the skill's later alternative groups (not chained ones) compete: the earliest
 *   group whose condition holds fires (lower index on a tie), as the game evaluates every group each frame.
 * - A branch whose static part is random (`*_random`, phase_random, ...) fires at a uniform point of its static zone,
 *   independent of the race state; when it also holds a state term, the term is checked at that point.
 * - Own-activation counts (activate_count_*) are not race states. R31: they are assumed met and a group holding one is
 *   sampled uniformly across its eligible zone by the zone engine, not timed here.
 */
import { CourseHelpers, computeZones, horseForStrategy } from "../skill-engine/zones";
import type { Course, RaceParameters } from "../skill-engine/types";
import type { RunningStyle } from "../deck/types";
import { ACTIVATION_SAMPLE_STEP_METERS } from "./types";
import { baselineMeterAt, type BaselineTimeline } from "./trace";

/** One fitted parameter: its value and what it was fitted to (residuals: r33-r34-report.md). */
export interface FittedParameter { value: number; fittedOn: string }

export interface RaceStateModel {
  /** Overtake attempts per second for a horse with the whole field ahead (f = 1). */
  attemptRate: FittedParameter;
  /** Mean length (s) of an overtake attempt. */
  attemptSeconds: FittedParameter;
  /** Mean length (s) of being targeted by a horse behind (several attackers can overlap, so it can outlast one attempt). */
  targetedSeconds: FittedParameter;
  /** Share of attempts that complete a pass (place gained / lost). */
  passShare: FittedParameter;
  /** Place-change multiplier in the late race (spurts open gaps and close them). */
  latePassBoost: FittedParameter;
  /** Early-race density of nearby horses (per metre x horse lane). */
  density: FittedParameter;
  /** Density multiplier per later phase (the field strings out). */
  spread: FittedParameter;
  /** Mean length (s) of a proximity episode (blocked, near lane, near count, surrounded). */
  proximitySeconds: FittedParameter;
  /** Effective share of the field ahead (within overtaking reach) of a pace chaser, late surger and end closer. */
  paceShare: FittedParameter;
  lateShare: FittedParameter;
  endShare: FittedParameter;
}

const UMASIM_PASS_ROWS = "umasim real-skill results 100211, 110141, 108501211, 112101211, 113301211, 100171 x2, 100102211, 100011, 100581, 110561";
const UMASIM_NEAR_ROWS = "umasim real-skill results 100241, 105501211, 201651";

/** The fitted race-state model. Read-only in production (the calibration script adjusts `value` between runs). */
export const RACE_STATE_MODEL: RaceStateModel = {
  attemptRate: { value: 0.317, fittedOn: UMASIM_PASS_ROWS },
  attemptSeconds: { value: 1.11, fittedOn: UMASIM_PASS_ROWS },
  targetedSeconds: { value: 1.64, fittedOn: "umasim real-skill result 110561 (the only overtake_target_time row)" },
  passShare: { value: 0.751, fittedOn: UMASIM_PASS_ROWS },
  latePassBoost: { value: 1.98, fittedOn: UMASIM_PASS_ROWS },
  density: { value: 0.04, fittedOn: "not fitted: first-principles estimate (9 horses in a pack about 25 m long and 9 horse lanes wide)" },
  spread: { value: 0.266, fittedOn: UMASIM_NEAR_ROWS },
  proximitySeconds: { value: 1.03, fittedOn: UMASIM_NEAR_ROWS },
  paceShare: { value: 0.363, fittedOn: UMASIM_PASS_ROWS },
  lateShare: { value: 0.558, fittedOn: UMASIM_PASS_ROWS },
  endShare: { value: 0.486, fittedOn: UMASIM_PASS_ROWS },
};

/** Share of the field ahead (within overtaking reach) by running style: front runner and runaway assumed, the rest fitted. */
export function fieldShare(style: RunningStyle, model: RaceStateModel = RACE_STATE_MODEL): number {
  switch (style) {
    case 2: return model.paceShare.value;
    case 3: return model.lateShare.value;
    case 4: return model.endShare.value;
    case 5: return 0.05;
    default: return 0.1;
  }
}

/**
 * Box areas (metres x horse lanes) from the mechanics doc's definitions:
 * side block |gap| < 1.05 m, |lane| < 2 (§Side Blocking); front block 0-2 m ahead within (1 - 0.3 gap / 2 m) x 0.75
 * lanes either side (§Front Blocking); near lane within 2.5 m ahead (or behind), |lane| < 1 (§behind/infront_near_lane_time);
 * near |gap| < 3 m, |lane| < 3 (§near_count); surrounded: 3 boxes of 3 m x 3 lanes (§is_surrounded).
 */
export const PROXIMITY_AREAS = {
  side: 2.1 * 4,
  front: 1.5 * (2 - 0.3),
  nearLane: 2.5 * 2,
  near: 6 * 6,
  nearAhead: 3 * 6,
  surroundBox: 3 * 3,
} as const;

/** Mechanics §Rushed: rush chance per race (6.5 / log10(0.1 x wisdom + 1))^2 %, at reference wisdom 1200, lasting ~6 s. */
const RUSH_SHARE_PER_HORSE = (((6.5 / Math.log10(0.1 * 1200 + 1)) ** 2) / 100) * 6 / 130;
const FIELD_SIZE = 9;

/** P(at least k horses) in a box holding `mean` horses on average (Poisson). */
export function atLeast(mean: number, k: number): number {
  let term = Math.exp(-mean), below = 0;
  for (let j = 0; j < k; j++) { below += term; term *= mean / (j + 1); }
  return Math.max(0, Math.min(1, 1 - below));
}

/** Per-second start probability of an episode that holds a share `on` of the time with mean length `seconds`. */
export function episodeStart(on: number, seconds: number): number {
  if (on <= 0) return 0;
  if (on >= 1) return 1;
  return 1 - Math.exp(-on / ((1 - on) * seconds));
}

interface StepContext { phase: number; afterFinalCorner: boolean; f: number }

type ProcessKind = "episode" | "event" | "count";
interface ProcessDef {
  kind: ProcessKind;
  /** Episode: on at the race start. */
  startsOn?: boolean;
  /** Per-second probability: episode start, event, or count increment. */
  rate: (ctx: StepContext, m: RaceStateModel) => number;
  /** Episode: per-second probability that an ongoing episode goes on. */
  stay?: (m: RaceStateModel) => number;
}

const perSecond = (rate: number) => 1 - Math.exp(-Math.max(0, rate));
const phaseDensity = (ctx: StepContext, m: RaceStateModel) => m.density.value * m.spread.value ** Math.min(2, ctx.phase);
/** Places changing per second towards the side holding a share `side` of the field (ahead: gained; behind: lost). */
const placeRate = (ctx: StepContext, m: RaceStateModel, side: number) =>
  m.passShare.value * m.attemptRate.value * side * (ctx.phase >= 2 ? m.latePassBoost.value : 1);
const proximityStay = (m: RaceStateModel) => Math.exp(-1 / m.proximitySeconds.value);
const proximity = (share: (ctx: StepContext, m: RaceStateModel) => number, startsOn = false): ProcessDef => ({
  kind: "episode", startsOn, stay: proximityStay, rate: (c, m) => episodeStart(share(c, m), m.proximitySeconds.value),
});

const PROCESSES: Record<string, ProcessDef> = {
  attempt: { kind: "episode", rate: (c, m) => perSecond(m.attemptRate.value * c.f), stay: (m) => Math.exp(-1 / m.attemptSeconds.value) },
  targeted: { kind: "episode", rate: (c, m) => perSecond(m.attemptRate.value * (1 - c.f)), stay: (m) => Math.exp(-1 / m.targetedSeconds.value) },
  gained: { kind: "event", rate: (c, m) => perSecond(placeRate(c, m, c.f)) },
  lost: { kind: "event", rate: (c, m) => perSecond(placeRate(c, m, 1 - c.f)) },
  passesMiddle: { kind: "count", rate: (c, m) => (c.phase === 1 ? perSecond(placeRate(c, m, c.f)) : 0) },
  passesLate: { kind: "count", rate: (c, m) => (c.phase >= 2 ? perSecond(placeRate(c, m, c.f)) : 0) },
  passesFinalCorner: { kind: "count", rate: (c, m) => (c.afterFinalCorner ? perSecond(placeRate(c, m, c.f)) : 0) },
  laneMove: { kind: "event", rate: (c, m) => perSecond(m.attemptRate.value * c.f) },
  side: proximity((c, m) => atLeast(phaseDensity(c, m) * PROXIMITY_AREAS.side, 1), true),
  front: proximity((c, m) => atLeast(phaseDensity(c, m) * 2 * c.f * PROXIMITY_AREAS.front, 1)),
  aheadLane: proximity((c, m) => atLeast(phaseDensity(c, m) * 2 * c.f * PROXIMITY_AREAS.nearLane, 1)),
  behindLane: proximity((c, m) => atLeast(phaseDensity(c, m) * 2 * (1 - c.f) * PROXIMITY_AREAS.nearLane, 1)),
  nearAhead: proximity((c, m) => atLeast(phaseDensity(c, m) * 2 * c.f * PROXIMITY_AREAS.nearAhead, 1)),
  surrounded: proximity((c, m) => {
    const d = phaseDensity(c, m), a = PROXIMITY_AREAS.surroundBox;
    return atLeast(d * a, 1) * atLeast(d * 2 * c.f * a, 1) * atLeast(d * 2 * (1 - c.f) * a, 1);
  }),
  rushBehind: { kind: "episode", rate: (c) => episodeStart(1 - (1 - RUSH_SHARE_PER_HORSE) ** ((FIELD_SIZE - 1) * (1 - c.f)), 6), stay: () => Math.exp(-1 / 6) },
};
/** near_count >= k: one process per threshold (the gate neighbours put up to 4 horses near at the start). */
function nearProcess(k: number): ProcessDef {
  return proximity((c, m) => atLeast(phaseDensity(c, m) * PROXIMITY_AREAS.near, k), k <= 4);
}

/** A parsed race-state term: the process it reads and the test on that process's state. */
interface StateTerm { process: string; test: (state: number) => boolean; threshold?: number }

const OFF = -1;
const TERM_PATTERN = /^([a-z0-9_]+)(==|!=|>=|<=|>|<)(-?\d+)$/;

function compare(op: string, a: number, b: number): boolean {
  switch (op) {
    case "==": return a === b;
    case "!=": return a !== b;
    case ">=": return a >= b;
    case "<=": return a <= b;
    case ">": return a > b;
    default: return a < b;
  }
}

/**
 * Maps a condition term to our model. Episode state = elapsed seconds since the episode started (OFF when not on);
 * event state = 1 in a second where the event happens; count state = events so far in the window.
 */
function stateTermOf(key: string, op: string, value: number): StateTerm | null {
  const on = (s: number) => s !== OFF;
  const flag = (process: string): StateTerm => ({ process, test: (s) => compare(op, on(s) ? 1 : 0, value) });
  const elapsed = (process: string): StateTerm => ({ process, test: (s) => on(s) && compare(op, s, value) });
  const count = (process: string): StateTerm => ({ process, test: (s) => compare(op, s, value) });
  switch (key) {
    case "is_overtake": return flag("attempt");
    case "overtake_target_time": return elapsed("targeted");
    case "change_order_onetime":
      if (op === "<" && value === 0) return { process: "lost", test: (s) => s === 1 };
      if (op === ">" && value === 0) return { process: "gained", test: (s) => s === 1 };
      return null;
    case "change_order_up_middle": return count("passesMiddle");
    case "change_order_up_end_after": return count("passesLate");
    case "change_order_up_finalcorner_after": return count("passesFinalCorner");
    case "is_move_lane": return { process: "laneMove", test: (s) => s === 1 };
    case "blocked_front": return flag("front");
    case "blocked_front_continuetime": return elapsed("front");
    case "blocked_side_continuetime": return elapsed("side");
    case "infront_near_lane_time": return elapsed("aheadLane");
    case "behind_near_lane_time": return elapsed("behindLane");
    case "is_surrounded": return flag("surrounded");
    case "temptation_opponent_count_behind": return flag("rushBehind");
    case "near_infront_count": return flag("nearAhead");
    case "near_count":
      if ((op === ">=" || op === ">") && value >= 0) { const k = op === ">" ? value + 1 : value; return k <= 0 ? null : { process: `near${k}`, test: on }; }
      return null;
    default: return null;
  }
}

function processDef(name: string): ProcessDef {
  return PROCESSES[name] ?? nearProcess(Number(name.slice(4)));
}

/** Splits a branch into its race-state terms and the static rest (state terms replaced by an always-true term). */
function splitBranch(branch: string): { terms: StateTerm[]; staticText: string } {
  const terms: StateTerm[] = [];
  const parts = branch.split("&").map((part) => {
    const m = TERM_PATTERN.exec(part.trim());
    const term = m ? stateTermOf(m[1], m[2], Number(m[3])) : null;
    if (!term) return part;
    terms.push({ ...term, threshold: Math.abs(Number(m![3])) });
    return "always==1";
  });
  return { terms, staticText: parts.join("&") };
}

/** True when a condition holds a race-state term this module times. */
export function hasTimedStateTerm(condition: string | null | undefined): boolean {
  return (condition ?? "").split("@").some((b) => splitBranch(b).terms.length > 0);
}

export interface PlacementGroup {
  index: number;
  condition: string | null | undefined;
  precondition: string | null | undefined;
  /** The group's resolved zone (prerequisite / chain clipping applied). */
  regions: ReadonlyArray<{ start: number; end: number }>;
}

export interface PlacementSample { meter: number; weight: number; groupIndex: number }

interface Branch {
  groupIndex: number;
  terms: { slot: number; test: (s: number) => boolean }[];
  regions: { start: number; end: number }[];
  random: boolean;
  /** Static-random branches only: the slot of its pending flag in the joint state. */
  flag: number;
}

function intersect(a: ReadonlyArray<{ start: number; end: number }>, b: ReadonlyArray<{ start: number; end: number }>): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  for (const x of a) for (const y of b) {
    const start = Math.max(x.start, y.start), end = Math.min(x.end, y.end);
    if (end > start) out.push({ start, end });
  }
  return out.sort((p, q) => p.start - q.start);
}

/** Length of `regions` inside [lo, hi), its first meter and its length midpoint (null when empty). */
function within(regions: ReadonlyArray<{ start: number; end: number }>, lo: number, hi: number): { length: number; first: number | null; mid: number | null } {
  let length = 0, first: number | null = null, acc = 0, mid: number | null = null;
  for (const r of regions) {
    const s = Math.max(r.start, lo), e = Math.min(r.end, hi);
    if (e > s) { length += e - s; if (first == null) first = s; }
  }
  if (length > 0) {
    for (const r of regions) {
      const s = Math.max(r.start, lo), e = Math.min(r.end, hi);
      if (e <= s) continue;
      if (acc + (e - s) >= length / 2) { mid = s + (length / 2 - acc); break; }
      acc += e - s;
    }
  }
  return { length, first, mid };
}

/**
 * First-hit placement of `groups` (the placed group first, then its alternatives in index order) over the baseline run.
 * Null when no group holds a timed state term or when the condition can never hold (callers fall back).
 */
export function dynamicPlacement(
  groups: ReadonlyArray<PlacementGroup>, course: Course, raceParams: Partial<RaceParameters>, style: RunningStyle,
  timeline: BaselineTimeline, finishTime: number, model: RaceStateModel = RACE_STATE_MODEL,
): PlacementSample[] | null {
  if (!groups.length || !hasTimedStateTerm(groups[0].condition)) return null;
  const horse = horseForStrategy(style);
  const processNames: string[] = [];
  const slotOf = (name: string) => { let i = processNames.indexOf(name); if (i < 0) { i = processNames.length; processNames.push(name); } return i; };
  const parsed: { groupIndex: number; terms: StateTerm[]; regions: { start: number; end: number }[]; random: boolean }[] = [];
  let cap = 2;
  for (const g of groups) {
    for (const text of (g.condition ?? "").split("@")) {
      const { terms, staticText } = splitBranch(text);
      let zone;
      try { zone = computeZones(course, staticText, g.precondition ?? null, horse, raceParams); } catch { continue; }
      const regions = intersect([...zone.regions], g.regions);
      if (!regions.length) continue;
      for (const t of terms) { slotOf(t.process); cap = Math.max(cap, (t.threshold ?? 0) + 2); }
      parsed.push({ groupIndex: g.index, terms, regions, random: zone.isRandom });
    }
  }
  if (!parsed.length) return null;
  const nProcesses = processNames.length;
  let flags = 0;
  const branches: Branch[] = parsed.map((p) => ({
    groupIndex: p.groupIndex, regions: p.regions, random: p.random, flag: p.random ? nProcesses + flags++ : -1,
    terms: p.terms.map((t) => ({ slot: slotOf(t.process), test: t.test })),
  }));
  const defs = processNames.map(processDef);
  // Elapsed / count values above the largest threshold in use (+2) behave alike: `cap` keeps the joint state small.

  type State = number[];
  const keyOf = (s: State) => s.join(",");
  const init: State = [...defs.map((d) => (d.kind === "episode" ? (d.startsOn ? 0 : OFF) : 0)), ...Array.from({ length: flags }, () => 1)];
  let dist = new Map<string, { s: State; p: number }>([[keyOf(init), { s: init, p: 1 }]]);

  const holds = (b: Branch, s: State) => b.terms.every((t) => t.test(s[t.slot]));
  const remaining = (b: Branch, lo: number) => within(b.regions, lo, Number.POSITIVE_INFINITY).length;
  const hits = new Map<string, { meter: number; weight: number; groupIndex: number }>();
  const addHit = (meter: number, groupIndex: number, p: number) => {
    const key = `${groupIndex}|${Math.floor(meter / ACTIVATION_SAMPLE_STEP_METERS)}`;
    const h = hits.get(key);
    if (h) { h.meter = (h.meter * h.weight + meter * p) / (h.weight + p); h.weight += p; } else hits.set(key, { meter, weight: p, groupIndex });
  };
  const finalCorner = CourseHelpers.finalCornerStart(course);
  const f = fieldShare(style, model);
  const contextAt = (meter: number): StepContext => {
    let phase = 0;
    for (let k = 3; k >= 1; k--) if (meter >= CourseHelpers.phaseStart(course, k)) { phase = k; break; }
    return { phase, afterFinalCorner: finalCorner != null && meter >= finalCorner, f };
  };
  const advance = (s: State, ctx: StepContext): { s: State; p: number }[] => {
    let out: { s: State; p: number }[] = [{ s: [...s], p: 1 }];
    defs.forEach((def, i) => {
      const rate = def.rate(ctx, model);
      const next: { s: State; p: number }[] = [];
      const push = (o: { s: State; p: number }, value: number, p: number) => {
        if (p <= 0) return;
        const ns = [...o.s]; ns[i] = value === OFF ? OFF : Math.min(value, cap); next.push({ s: ns, p: o.p * p });
      };
      for (const o of out) {
        const v = o.s[i];
        if (def.kind === "episode") {
          if (v === OFF) { push(o, 0, rate); push(o, OFF, 1 - rate); } else { const stay = def.stay!(model); push(o, v + 1, stay); push(o, OFF, 1 - stay); }
        } else if (def.kind === "event") {
          push(o, 1, rate); push(o, 0, 1 - rate);
        } else {
          push(o, v + 1, rate); push(o, v, 1 - rate);
        }
      }
      out = next;
    });
    return out;
  };

  const seconds = Math.ceil(finishTime);
  for (let k = 0; k < seconds && dist.size; k++) {
    const lo = baselineMeterAt(timeline, k), hi = k + 1 >= finishTime ? course.length : baselineMeterAt(timeline, k + 1);
    if (k > 0) {
      const ctx = contextAt(lo);
      const next = new Map<string, { s: State; p: number }>();
      for (const { s, p } of dist.values()) {
        for (const o of advance(s, ctx)) {
          const key = keyOf(o.s);
          const e = next.get(key);
          if (e) e.p += p * o.p; else next.set(key, { s: o.s, p: p * o.p });
        }
      }
      dist = next;
    }
    const carried = new Map<string, { s: State; p: number }>();
    const carry = (s: State, p: number) => { if (p <= 1e-12) return; const key = keyOf(s); const e = carried.get(key); if (e) e.p += p; else carried.set(key, { s, p }); };
    for (const { s, p } of dist.values()) {
      // Deterministic branches whose terms hold now: the first meter of their zone in this second.
      let best: { meter: number; groupIndex: number } | null = null;
      for (const b of branches) {
        if (b.random || !holds(b, s)) continue;
        const w = within(b.regions, lo, hi);
        if (w.first != null && (!best || w.first < best.meter || (w.first === best.meter && b.groupIndex < best.groupIndex))) best = { meter: w.first, groupIndex: b.groupIndex };
      }
      // Random-point branches still pending: their point falls in this second with probability length / remaining.
      let scenarios: { s: State; p: number; best: typeof best }[] = [{ s, p, best }];
      for (const b of branches) {
        if (!b.random || s[b.flag] !== 1) continue;
        const w = within(b.regions, lo, hi);
        if (!w.length || w.mid == null) continue;
        const q = Math.min(1, w.length / Math.max(1e-9, remaining(b, lo)));
        const expanded: typeof scenarios = [];
        for (const sc of scenarios) {
          const spent = [...sc.s]; spent[b.flag] = 0;
          const fires = holds(b, sc.s) && (!sc.best || w.mid < sc.best.meter);
          expanded.push({ s: spent, p: sc.p * q, best: fires ? { meter: w.mid, groupIndex: b.groupIndex } : sc.best });
          if (q < 1) expanded.push({ s: sc.s, p: sc.p * (1 - q), best: sc.best });
        }
        scenarios = expanded;
      }
      for (const sc of scenarios) {
        if (sc.best) addHit(sc.best.meter, sc.best.groupIndex, sc.p); else carry(sc.s, sc.p);
      }
    }
    dist = carried;
  }

  const fired = [...hits.values()].reduce((t, h) => t + h.weight, 0);
  if (fired <= 1e-9) return null;
  return [...hits.values()].map((h) => ({ meter: h.meter, weight: h.weight / fired, groupIndex: h.groupIndex })).sort((a, b) => a.meter - b.meter);
}
