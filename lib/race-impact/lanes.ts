import type { Course } from "../skill-engine/types";
import type { RunningStyle } from "../deck/types";

/**
 * Corner lane loss for the reference horse (engine step 4b; model rewritten for R33).
 *
 * Loss rule (mechanics §Course Distance to World Transform): running off the inner fence on a corner covers extra
 * world distance, so the course distance gained per frame shrinks. We treat each course corner as a quarter turn (a
 * lap has corners 1-4, mechanics §Course Events): a corner of length L on the fence has radius 2L/pi, so a horse `lane`
 * metres out covers (1 + lane x (pi/2) / L) times the distance, i.e. loses step x (pi/2) x lane / L metres per frame.
 *
 * Lane model (our own deterministic expected-lane model, built from the mechanics doc's lane rules):
 * - start: one horse lane out (mechanics §Lane: initial lane = horse index x horse lane; 11.25 m / 18 = 0.625 m);
 * - early and mid race (§Normal Mode rule 4, "current lane - 0.05 if not blocked"): the horse drifts towards the
 *   fence, but traffic keeps it off the rail. We model the expected lane as relaxing exponentially towards a settled
 *   traffic lane (`earlyLane` in the early race, `midLane` in the mid race) with time constant `earlySeconds`;
 * - late race, before the extra move lane is set (§Overtake Mode: candidates sit one horse lane beside the target):
 *   overtaking pushes the horse out, so the expected lane relaxes towards one horse lane with time constant
 *   `lateSeconds` (outwards only);
 * - extra move lane (§Extra Move Lane): fixed on entering the final corner (or the final straight, when that comes
 *   first) at clamp(lane / 0.1 course widths, 0, 1) x 0.5 course widths + a random term = min(5 x lane, 5.625 m) +
 *   `extraLaneNoise` (the random term's mean). The horse then moves out to it with the §Lane Change Speed shape: the
 *   lateral speed ramps by `rampAccel` m/s per second up to `speedScale` x (0.3 + 0.001 x Power) m/s.
 *
 * The free parameters are fitted to umasim's numeric results (the `lanestat` harness output: mean lane per 25 m over
 * 40 seeds, style 2, on 21 courses; committed as fixtures/lanestat/lanestat-classic.json) and checked against the
 * classic baseline finish times (fixtures/umasim). Fit residuals are recorded in r33-r34-report.md. The model is
 * deterministic and has no running-style dependence (the lane data covers style 2 only).
 */

export const HORSE_LANE_METERS = 11.25 / 18;
const FRAMES_PER_SECOND = 15;
/** Extra move lane cap: 0.5 course widths (mechanics §Extra Move Lane). */
const EXTRA_LANE_CAP_METERS = 0.5 * 11.25;

export interface LaneModel {
  /** Settled early-race expected lane (m). Fitted to umasim lanestat (mean lane per 25 m). */
  earlyLane: number;
  /** Settled mid-race expected lane (m). Fitted to umasim lanestat (mean lane per 25 m). */
  midLane: number;
  /** Early/mid-race relaxation time constant (s). Fitted to umasim lanestat. */
  earlySeconds: number;
  /** Late-race outward relaxation time constant (s) towards one horse lane. Fitted to umasim lanestat. */
  lateSeconds: number;
  /** Mean of the extra-move-lane random term (m). Fitted to umasim lanestat (extra lane - 5 x lane at the corner). */
  extraLaneNoise: number;
  /** Lateral speed ramp (m/s per second) when moving out to the extra lane. Fitted to umasim lanestat. */
  rampAccel: number;
  /** Lateral speed cap = speedScale x (0.3 + 0.001 x Power) m/s (doc shape). Fitted to umasim lanestat. */
  speedScale: number;
}

/** The fitted lane model (see the header; residuals in r33-r34-report.md). Read-only in production. */
export const LANE_MODEL: LaneModel = {
  earlyLane: 0.316,
  midLane: 0.193,
  earlySeconds: 2.98,
  lateSeconds: 10.05,
  extraLaneNoise: 0.024,
  rampAccel: 2.17,
  speedScale: 0.248,
};

export interface LaneGeometry {
  corners: { start: number; end: number }[];
  /** Where the extra move lane is fixed: the final corner start, or the final straight start when that is earlier. */
  extraLaneAt: number;
}

/** Lane geometry of a course; null for a straight-only course (no corner, no loss). */
export function laneGeometryFor(course: Pick<Course, "corners" | "straights"> | null | undefined): LaneGeometry | null {
  const corners = (course?.corners ?? []).map(({ start, end }) => ({ start, end })).sort((a, b) => a.start - b.start);
  if (!corners.length) return null;
  const finalCorner = corners[corners.length - 1].start;
  const straights = course?.straights ?? [];
  const finalStraight = straights.length ? Math.max(...straights.map((s) => s.start)) : Number.POSITIVE_INFINITY;
  return { corners, extraLaneAt: Math.min(finalCorner, finalStraight) };
}

/** Progress lost (m) on a frame that covers `step` metres inside a corner of `cornerLength` metres (quarter turn). */
export function cornerLossMeters(step: number, lane: number, cornerLength: number): number {
  return cornerLength > 0 ? (step * (Math.PI / 2) * lane) / cornerLength : 0;
}

/** The corner containing `meter` (bounds inclusive), or null. */
export function cornerAt(geometry: LaneGeometry, meter: number): { start: number; end: number } | null {
  for (const c of geometry.corners) if (meter >= c.start && meter <= c.end) return c;
  return null;
}

/** Extra move lane (m) set at the final corner from the lane there (mechanics §Extra Move Lane, plus the fitted noise mean). */
export function extraMoveLane(lane: number, model: LaneModel = LANE_MODEL): number {
  return Math.min(5 * lane, EXTRA_LANE_CAP_METERS) + model.extraLaneNoise;
}

/**
 * Expected lane (m) at the start of each frame, for a run whose frame-start positions are `frameMeters` (frame 0 is
 * the race start, run-up included; 15 frames per second). Deterministic.
 */
export function expectedLaneByFrame(
  geometry: LaneGeometry, frameMeters: ArrayLike<number>, courseLength: number, _style: RunningStyle | null | undefined, power: number,
  model: LaneModel = LANE_MODEL,
): Float64Array {
  const frames = frameMeters.length;
  const out = new Float64Array(frames);
  const dt = 1 / FRAMES_PER_SECOND;
  const midStart = courseLength / 6, lateStart = (courseLength * 2) / 3;
  const speedCap = model.speedScale * (0.3 + 0.001 * power);
  const earlyKeep = Math.exp(-dt / model.earlySeconds), lateKeep = Math.exp(-dt / model.lateSeconds);
  let lane = HORSE_LANE_METERS, extra = -1, lateral = 0;
  for (let i = 0; i < frames; i++) {
    out[i] = lane;
    const meter = i + 1 < frames ? frameMeters[i + 1] : courseLength;
    if (extra < 0 && meter >= geometry.extraLaneAt) extra = extraMoveLane(lane, model);
    if (extra >= 0) {
      if (lane < extra) {
        lateral = Math.min(lateral + model.rampAccel * dt, speedCap);
        lane = Math.min(extra, lane + lateral * dt);
      }
    } else if (frameMeters[i] >= lateStart) {
      if (lane < HORSE_LANE_METERS) lane = HORSE_LANE_METERS + (lane - HORSE_LANE_METERS) * lateKeep;
    } else {
      const settled = frameMeters[i] >= midStart ? model.midLane : model.earlyLane;
      lane = settled + (lane - settled) * earlyKeep;
    }
  }
  return out;
}
