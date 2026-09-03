// Course geometry helpers. Adapted from uma-tools/uma-skill-tools/CourseData.ts
// to the flat DB course shape (corners/slopes carry `end`, not `length`).

import { Region } from "./region";
import type { Course } from "./types";

export type Phase = 0 | 1 | 2 | 3;

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
