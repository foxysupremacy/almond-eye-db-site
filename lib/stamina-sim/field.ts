import type { RunningStyle } from "../deck/types";

/**
 * Spec §6 field model: one simulated uma and a generic field. Whether "the pacemaker is too far ahead", "an uma is
 * nearby" or "a same-strategy rival exists" is a per-check probability, not a multi-uma simulation. The doc gives the
 * entry conditions; these numbers are the builder's choice (spec §10) and are provisional.
 *
 * - racers 12: the Rankings default racer count.
 * - pChaseNeeded (per position-keep check; front runners: not first among their strategy -> overtake mode; others:
 *   further than the max distance from the pacemaker -> pace up mode):
 *     1 Runner 0.35: a 12-uma field usually has 1-3 front runners, so she trails another runner about a third of the time.
 *     2 Leader 0.25: the 3 m .. 5xCourseFactor m band is wide, so she is outside it on either side only sometimes.
 *     3 Betweener 0.35, 4 Chaser 0.35: their band is only 0.5xCourseFactor m wide, so she is often outside it.
 *     5 Runaway 0.2: oonige usually leads alone; trailing another oonige is uncommon.
 * - pTooClose (per check; front runners: first but within 4.5 m / 17.5 m (oonige) of the uma behind -> speed up mode;
 *   others: closer than the min distance -> pace down mode): 0.1 for every style, fitted in Task 7 (below).
 * - pNearbyRival 0.5: mid-race packs are common in 12 umas, so about half the checks find an uma close by (compete
 *   before spurt) or a behind-strategy uma eating into the lead (secure lead).
 * - pSameStyleFrontRunner 0.5: with ~1-2 front runners per 12-uma field, another one is within 10 m about half the time.
 * - pDuelPartner 0.5: on the final straight a 12-uma field usually has a rival alongside about half the time (Task 5).
 * - leadDeficitMax 5 m: entering overtake mode she trails the strategy leader by up to ~2 lengths (checks every 2 s
 *   keep the deficit small); the doc's 10 m / 27.5 m exit lead is added on top.
 *
 * Task 7 calibration (60 saved Kyoto 2200 Champions Meeting races, lib/stamina-sim/validation.test.ts):
 * - pTooClose 0.3/0.25/0.35/0.35/0.4 -> 0.1 for every style. Real HP drain from the start to L/6 matches the bare model
 *   (median sim - real -2 HP, n 407); with the old values pace down (x0.6 HP) fired so often that the simulated drain was
 *   30 HP short (median of 8-seed means), and 0.1 brings it to -13 HP. Pace down still occurs, just less often.
 * - pNearbyRival kept at 0.5. Under R4 (competition HP per second) sections 11-16 drained 115 HP more than real (median,
 *   n 442); ruling R8 (HP once per activation) brings that to -1 HP with this value unchanged.
 */
export interface GenericField {
  racers: number;
  pChaseNeeded: Record<RunningStyle, number>;
  pTooClose: Record<RunningStyle, number>;
  pNearbyRival: number;
  pSameStyleFrontRunner: number;
  pDuelPartner: number;
  leadDeficitMax: number;
}

export const GENERIC_FIELD: GenericField = {
  racers: 12,
  pChaseNeeded: { 1: 0.35, 2: 0.25, 3: 0.35, 4: 0.35, 5: 0.2 },
  pTooClose: { 1: 0.1, 2: 0.1, 3: 0.1, 4: 0.1, 5: 0.1 },
  pNearbyRival: 0.5,
  pSameStyleFrontRunner: 0.5,
  pDuelPartner: 0.5,
  leadDeficitMax: 5,
};
