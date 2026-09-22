import { STYLE_EXPECTED_RANKS } from "./constants";
import type { RunningStyle } from "../deck/types";

export interface RankOverlapResult {
  hasOrderCondition: boolean;
  minRank: number;
  maxRank: number;
  expMin: number;
  expMax: number;
  overlapRanks: number;
  positionOverlap: number;
}

/**
 * Calculate the position overlap fraction (0-1) between the parsed rank window
 * and the expected running style envelope.
 */
export function calculateStyleRankOverlap(
  conditionStr: string,
  runningStyle: RunningStyle,
  racerCount: number
): RankOverlapResult {
  const { minRank, maxRank, hasOrderCondition } = parseRankRequirements(conditionStr, racerCount);
  const [expMin, expMax] = STYLE_EXPECTED_RANKS[runningStyle] ?? [1, racerCount];
  if (!hasOrderCondition) {
    return {
      hasOrderCondition: false,
      minRank,
      maxRank,
      expMin,
      expMax,
      overlapRanks: expMax - expMin + 1,
      positionOverlap: 1.0,
    };
  }

  const overlapRanks = Math.max(0, Math.min(maxRank, expMax) - Math.max(minRank, expMin) + 1);
  const positionOverlap = overlapRanks / (expMax - expMin + 1);
  return {
    hasOrderCondition: true,
    minRank,
    maxRank,
    expMin,
    expMax,
    overlapRanks,
    positionOverlap,
  };
}

/**
 * Parse required ranks from a raw condition string.
 */
export function parseRankRequirements(
  conditionStr: string,
  racerCount: number
): { minRank: number; maxRank: number; hasOrderCondition: boolean } {
  let minRank = 1;
  let maxRank = racerCount;
  let hasOrderCondition = false;

  // order == X (all matches — OR conditions like "order==1@order==3" widen the window to the union)
  const eqMatches = [...conditionStr.matchAll(/order==(\d+)/g)].map((m) => parseInt(m[1], 10));
  if (eqMatches.length > 0) {
    minRank = Math.max(minRank, Math.min(...eqMatches));
    maxRank = Math.min(maxRank, Math.max(...eqMatches));
    hasOrderCondition = true;
  }

  // order <= X
  const lteM = /order<=(\d+)/.exec(conditionStr);
  if (lteM) {
    maxRank = Math.min(maxRank, parseInt(lteM[1], 10));
    hasOrderCondition = true;
  }

  // order >= X
  const gteM = /order>=(\d+)/.exec(conditionStr);
  if (gteM) {
    minRank = Math.max(minRank, parseInt(gteM[1], 10));
    hasOrderCondition = true;
  }

  // order_rate <= X (e.g. order_rate<=50)
  const rateLteM = /order_rate<=(\d+)/.exec(conditionStr);
  if (rateLteM) {
    const pct = parseInt(rateLteM[1], 10);
    maxRank = Math.min(maxRank, Math.max(1, Math.round((pct / 100) * racerCount)));
    hasOrderCondition = true;
  }

  // order_rate >= X (e.g. order_rate>=50)
  const rateGteM = /order_rate>=(\d+)/.exec(conditionStr);
  if (rateGteM) {
    const pct = parseInt(rateGteM[1], 10);
    minRank = Math.max(minRank, Math.min(racerCount, Math.ceil((pct / 100) * racerCount)));
    hasOrderCondition = true;
  }

  // order_rate_inXX — "within the top XX%" (e.g. order_rate_in20 == order_rate<=20)
  const rateInM = /order_rate_in(\d+)/.exec(conditionStr);
  if (rateInM) {
    const pct = parseInt(rateInM[1], 10);
    maxRank = Math.min(maxRank, Math.max(1, Math.round((pct / 100) * racerCount)));
    hasOrderCondition = true;
  }

  // order_rate_outXX — "outside the top XX%" (e.g. order_rate_out40 == order_rate>=40)
  const rateOutM = /order_rate_out(\d+)/.exec(conditionStr);
  if (rateOutM) {
    const pct = parseInt(rateOutM[1], 10);
    minRank = Math.max(minRank, Math.min(racerCount, Math.ceil((pct / 100) * racerCount)));
    hasOrderCondition = true;
  }

  return { minRank, maxRank, hasOrderCondition };
}
