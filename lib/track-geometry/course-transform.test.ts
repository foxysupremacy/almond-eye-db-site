import { describe, expect, it } from "bun:test";
import courseShapesJson from "../data/course-shapes.json";
import { transformCourseSpline, interpolateCoursePoint } from "./course-transform";
import type { Course } from "../skill-engine/types";
import type { CompactShapeEntry } from "./types";

const shapes = courseShapesJson as unknown as Record<string, CompactShapeEntry>;

describe("Course Transform & Alignment Engine", () => {
  it("aligns Left-handed courses (Tokyo) with final straight running left-to-right (+X) into finish on bottom-right", () => {
    const shape = shapes["10606"] || shapes["10404"] || shapes["10101"];
    const mockCourse: Course = {
      id: 10606,
      terrain: 1,
      turn: 2, // Left-handed
      distance: 3,
      inout: 0,
      length: 2400,
      corners: [],
      straights: [],
      slopes: [],
    };

    const res = transformCourseSpline(shape, mockCourse, 800, 500);

    expect(res.isLeftHanded).toBe(true);
    expect(res.points.length).toBe(shape.points.length);

    // Final straight tangent at finish line should point right (+X)
    const finishPt = res.points[res.points.length - 1];
    expect(finishPt.tangentX).toBeGreaterThan(0.9);
    expect(Math.abs(finishPt.tangentY)).toBeLessThan(0.1);

    // Bounds should fit inside the canvas
    expect(res.bounds.minX).toBeGreaterThanOrEqual(50);
    expect(res.bounds.maxX).toBeLessThanOrEqual(750);
    expect(res.bounds.maxY).toBeGreaterThan(res.bounds.minY);
  });

  it("aligns Right-handed courses (Nakayama) with final straight running right-to-left (-X) into finish on bottom-left", () => {
    const shape = shapes["10504"] || shapes["10101"];
    const mockCourse: Course = {
      id: 10504,
      terrain: 1,
      turn: 1, // Right-handed
      distance: 3,
      inout: 0,
      length: 2000,
      corners: [],
      straights: [],
      slopes: [],
    };

    const res = transformCourseSpline(shape, mockCourse, 800, 500);

    expect(res.isLeftHanded).toBe(false);

    // Final straight tangent at finish line should point left (-X)
    const finishPt = res.points[res.points.length - 1];
    expect(finishPt.tangentX).toBeLessThan(-0.9);
    expect(Math.abs(finishPt.tangentY)).toBeLessThan(0.1);

    // Final straight should be near the bottom
    expect(finishPt.y).toBeGreaterThan(350);
  });

  it("interpolates intermediate point accurately with orthogonal normal", () => {
    const shape = shapes["10101"];
    const mockCourse: Course = {
      id: 10101,
      terrain: 1,
      turn: 1,
      distance: 1,
      inout: 0,
      length: 1200,
      corners: [],
      straights: [],
      slopes: [],
    };

    const res = transformCourseSpline(shape, mockCourse, 800, 500);
    const midPt = interpolateCoursePoint(res.points, 1200, 600);

    expect(midPt.distance).toBe(600);
    expect(midPt.x).toBeGreaterThan(0);
    expect(midPt.y).toBeGreaterThan(0);

    // Tangent and normal dot product should be approximately 0
    const dot = midPt.tangentX * midPt.normalX + midPt.tangentY * midPt.normalY;
    expect(Math.abs(dot)).toBeLessThan(0.01);
  });
});
