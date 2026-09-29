import type { Course } from "../skill-engine/types";

export interface ElevationProfile {
  minElev: number;
  maxElev: number;
  span: number;
  scale: number;
}

/** Compute cumulative course elevation at a distance using the game's slope units. */
export function getRawCumulativeElevation(course: Course, distance: number): number {
  if (!course.slopes?.length) return 0;

  let elevation = 0;
  for (const slope of course.slopes) {
    if (distance <= slope.start) continue;
    const activeLength = Math.min(distance, slope.end) - slope.start;
    if (activeLength > 0) {
      const grade = slope.slope / 10_000;
      elevation += (grade / 100) * activeLength;
    }
  }
  return elevation;
}

/** Build the elevation bounds and the display scale used by the course map. */
export function computeElevationProfile(course: Course, totalDistance: number): ElevationProfile {
  if (!course.slopes?.length) {
    return { minElev: 0, maxElev: 0, span: 0, scale: 0 };
  }

  let minElev = Infinity;
  let maxElev = -Infinity;
  const sampleCount = 100;

  for (let i = 0; i <= sampleCount; i++) {
    const distance = (i / sampleCount) * totalDistance;
    const elevation = getRawCumulativeElevation(course, distance);
    minElev = Math.min(minElev, elevation);
    maxElev = Math.max(maxElev, elevation);
  }

  for (const slope of course.slopes) {
    const startElevation = getRawCumulativeElevation(course, slope.start);
    const endElevation = getRawCumulativeElevation(course, slope.end);
    minElev = Math.min(minElev, startElevation, endElevation);
    maxElev = Math.max(maxElev, startElevation, endElevation);
  }

  const span = Math.max(0, maxElev - minElev);
  const scale = span > 0.1 ? Math.min(28, Math.max(12, span * 4)) / span : 0;
  return { minElev, maxElev, span, scale };
}

/** Convert cumulative elevation to the non-negative pixel offset used by the renderer. */
export function getPixelElevation(course: Course, distance: number, profile: ElevationProfile): number {
  if (profile.span <= 0.1 || profile.scale <= 0) return 0;
  return Math.max(0, (getRawCumulativeElevation(course, distance) - profile.minElev) * profile.scale);
}
