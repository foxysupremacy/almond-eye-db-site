import { describe, expect, test } from "bun:test";
import { computeElevationProfile, getPixelElevation, getRawCumulativeElevation } from "./elevation-profile";
import type { Course } from "../skill-engine/types";

const course: Course = {
  id: 1,
  terrain: 1,
  turn: 1,
  distance: 3,
  inout: 1,
  length: 1000,
  corners: [],
  straights: [],
  slopes: [
    { start: 100, end: 300, slope: 20_000 },
    { start: 500, end: 700, slope: -10_000 },
  ],
};

describe("course elevation profile", () => {
  test("accumulates uphill and downhill slope segments", () => {
    expect(getRawCumulativeElevation(course, 0)).toBe(0);
    expect(getRawCumulativeElevation(course, 200)).toBe(2);
    expect(getRawCumulativeElevation(course, 600)).toBe(3);
    expect(getRawCumulativeElevation(course, 800)).toBe(2);
  });

  test("builds stable pixel bounds and maps elevations into the profile", () => {
    const profile = computeElevationProfile(course, course.length);
    expect(profile.minElev).toBe(0);
    expect(profile.maxElev).toBe(4);
    expect(profile.span).toBe(4);
    expect(getPixelElevation(course, 0, profile)).toBe(0);
    expect(getPixelElevation(course, 300, profile)).toBeGreaterThan(0);
  });

  test("returns a flat profile for courses without slopes", () => {
    const profile = computeElevationProfile({ ...course, slopes: [] }, course.length);
    expect(profile).toEqual({ minElev: 0, maxElev: 0, span: 0, scale: 0 });
    expect(getPixelElevation({ ...course, slopes: [] }, 100, profile)).toBe(0);
  });
});
