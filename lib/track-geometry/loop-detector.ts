import type { LoopBounds } from "./types";

/**
 * Detects whether a course curve loops back on itself (multi-lap tracks like
 * 2500m Arima Kinen or 3600m Stayers Stakes).
 *
 * Scans between 35% and 95% of total points to find the closest point to start.
 * If distance < 12 units, marks that index as completion of Loop 1.
 */
export function detectLoopSplitRatio(points: [number, number][]): number | null {
  if (!points || points.length < 10) return null;

  const startPoint = points[0];
  const startSearchIndex = Math.floor(points.length * 0.35);
  const endSearchIndex = Math.floor(points.length * 0.95);
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = startSearchIndex; i <= endSearchIndex; i++) {
    const pt = points[i];
    const dist = Math.hypot(pt[0] - startPoint[0], pt[1] - startPoint[1]);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestIndex = i;
    }
  }

  if (bestIndex === -1 || bestDistance > 12) {
    return null;
  }

  return bestIndex / (points.length - 1);
}

/**
 * Derives loop bounds given total course distance and detected split ratio.
 */
export function getLoopBounds(totalDistance: number, loopSplitRatio: number | null): LoopBounds {
  if (loopSplitRatio == null || loopSplitRatio <= 0 || loopSplitRatio >= 1) {
    return {
      hasLoop: false,
      loopSplitRatio: null,
      loopSplitDistance: null,
    };
  }

  return {
    hasLoop: true,
    loopSplitRatio,
    loopSplitDistance: Math.round(loopSplitRatio * totalDistance),
  };
}

/**
 * Determines whether a given meter distance belongs to Lap 1 or Lap 2.
 */
export function getLoopPass(
  meter: number,
  totalDistance: number,
  loopSplitRatio: number | null
): 1 | 2 {
  if (loopSplitRatio == null) return 1;
  const splitMeter = loopSplitRatio * totalDistance;
  return meter >= splitMeter ? 2 : 1;
}
