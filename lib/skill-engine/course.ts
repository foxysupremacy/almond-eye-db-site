// Course geometry helpers. Adapted from uma-tools/uma-skill-tools/CourseData.ts
// to the flat DB course shape (corners/slopes carry `end`, not `length`).

import { Region } from "./region";
import type { Course } from "./types";

export type Phase = 0 | 1 | 2 | 3;

/**
 * Step 5b: the phase boundary frame. The game checks skill conditions BEFORE it updates the Uma's phase (mechanics doc
 * §phase: "phase==1&corner==0 can activate if the uma exits a corner and enters the late-race on the same frame"), and the
 * umasim results agree (Mejiro Dober on Hanshin 2400, umasim-skills.test.ts).
 * So "phase <= N" still holds in the first frame past the end of phase N. Upper phase bounds are therefore extended by
 * this much (less than one frame at race speed, so any point in it is the boundary frame). computeZones keeps only the
 * boundary-frame regions that are not attached to the zone computed without it, so it only changes zones that could not
 * otherwise reach that point (Mejiro Dober 100591 on Hanshin 2400: the final corner starts exactly where phase 1 ends).
 */
export const PHASE_BOUNDARY_FRAME_M = 1;

export const CourseHelpers = {
  // Validates a phase number; throws on out-of-range. (Not an `asserts`
  // function — call sites pass `number` from the parser, and phaseStart/phaseEnd
  // below accept `number` too.)
  assertIsPhase(phase: number): void {
    if (phase !== 0 && phase !== 1 && phase !== 2 && phase !== 3) {
      throw new Error(`bad phase ${phase}`);
    }
  },

  isSortedByStart(arr: readonly { start: number }[]) {
    return arr.every((b, i) => i === 0 || b.start > arr[i - 1].start);
  },

  sortedCorners(course: Course) {
    const c = course.corners.slice();
    if (!this.isSortedByStart(c)) c.sort((a, b) => a.start - b.start);
    return c;
  },

  finalCornerStart(course: Course): number | null {
    const corners = this.sortedCorners(course);
    if (corners.length === 0) return null;
    return corners[corners.length - 1].start;
  },

  lastStraight(course: Course): Region | null {
    if (course.straights.length === 0) return null;
    const s = course.straights[course.straights.length - 1];
    return new Region(s.start, s.end);
  },

  // Phases: prefer the course's explicit phases[] when present, else fall back
  // to the 1/6 · 2/3 · 5/6 formula (the same fallback the visualizer uses).
  phaseStart(course: Course, phase: number): number {
    if (phase !== 0 && phase !== 1 && phase !== 2 && phase !== 3) {
      throw new Error(`bad phase ${phase}`);
    }
    if (course.phases && course.phases.length) {
      const p = course.phases.find((x) => x.id === phase);
      if (p) return p.start;
    }
    switch (phase) {
      case 0:
        return 0;
      case 1:
        return (course.length * 1) / 6;
      case 2:
        return (course.length * 2) / 3;
      case 3:
        return (course.length * 5) / 6;
    }
  },

  /** An upper phase bound plus the boundary frame (none at the finish line). */
  phaseUpper(course: Course, bound: number): number {
    return bound >= course.length ? bound : Math.min(course.length, bound + PHASE_BOUNDARY_FRAME_M);
  },

  phaseEnd(course: Course, phase: number): number {
    if (phase !== 0 && phase !== 1 && phase !== 2 && phase !== 3) {
      throw new Error(`bad phase ${phase}`);
    }
    if (course.phases && course.phases.length) {
      const p = course.phases.find((x) => x.id === phase);
      if (p) return p.end;
    }
    switch (phase) {
      case 0:
        return (course.length * 1) / 6;
      case 1:
        return (course.length * 2) / 3;
      case 2:
        return (course.length * 5) / 6;
      case 3:
        return course.length;
    }
  },
};
