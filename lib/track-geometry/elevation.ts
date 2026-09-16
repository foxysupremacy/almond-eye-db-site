import type { Course } from "../skill-engine/types";
import type { SlopeInfo } from "./types";
import { clamp } from "./interpolation";

export const DEFAULT_ELEVATION_EXAGGERATION = 4.5;
export const MIN_ELEVATION_EXAGGERATION = 1.0;
export const MAX_ELEVATION_EXAGGERATION = 6.0;

/**
 * Computes raw altitude in meters at any distance along the course
 * by accumulating slopes up to `distance`.
 */
export function getRawElevationAtDistance(course: Course | null, distance: number): number {
  if (!course || !course.slopes || course.slopes.length === 0) {
    return 0;
  }

  const dClamped = clamp(distance, 0, course.length);
  let elevation = 0;

  for (const s of course.slopes) {
    if (dClamped <= s.start) continue;
    const activeLength = Math.min(dClamped, s.end) - s.start;
    if (activeLength > 0) {
      // s.slope is in per-10000 units (e.g. 20000 = +2%)
      const grade = s.slope / 10000;
      elevation += (grade / 100) * activeLength;
    }
  }

  return elevation;
}

/**
 * Returns the exaggerated 3D Y coordinate at `distance`.
 */
export function getExaggeratedElevation(
  course: Course | null,
  distance: number,
  exaggeration = DEFAULT_ELEVATION_EXAGGERATION
): number {
  return getRawElevationAtDistance(course, distance) * exaggeration;
}

/**
 * Inspects slope condition at a specific distance along the track.
 */
export function getSlopeInfoAtDistance(course: Course | null, distance: number): SlopeInfo {
  if (!course || !course.slopes) {
    return {
      slope: 0,
      gradePercent: 0,
      gradeFormatted: "0.0%",
      isUp: false,
      isDown: false,
      isFlat: true,
    };
  }

  const d = clamp(distance, 0, course.length);
  const activeSlope = course.slopes.find((s) => d >= s.start && d <= s.end);

  if (!activeSlope || activeSlope.slope === 0) {
    return {
      slope: 0,
      gradePercent: 0,
      gradeFormatted: "Flat",
      isUp: false,
      isDown: false,
      isFlat: true,
    };
  }

  const gradePercent = activeSlope.slope / 10000;
  const isUp = gradePercent > 0;
  const isDown = gradePercent < 0;
  const gradeFormatted = `${isUp ? "+" : ""}${gradePercent.toFixed(1)}%`;

  return {
    slope: activeSlope.slope,
    gradePercent,
    gradeFormatted,
    isUp,
    isDown,
    isFlat: false,
  };
}
