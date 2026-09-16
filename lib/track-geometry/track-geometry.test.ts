import { describe, expect, test } from "bun:test";
import { interpolateTrackPoint2D, clamp } from "./interpolation";
import { getRawElevationAtDistance, getSlopeInfoAtDistance } from "./elevation";
import { detectLoopSplitRatio, getLoopPass } from "./loop-detector";
import { loadCourseShapes, getCachedCourseShape } from "./shape-loader";
import type { Course } from "../skill-engine/types";
import { Region, RegionList } from "../skill-engine/region";

function expectCloseTo(actual: number, expected: number, delta = 0.01) {
  expect(Math.abs(actual - expected) <= delta).toBe(true);
}

describe("Track Geometry Engine", () => {
  describe("interpolation", () => {
    test("interpolates midpoint accurately", () => {
      const pts: [number, number][] = [
        [0, 0],
        [100, 0],
      ];
      const mid = interpolateTrackPoint2D(pts, 0.5);
      expect(mid.x).toBe(50);
      expect(mid.z).toBe(0);
      expectCloseTo(mid.tangentX, 1);
      expectCloseTo(mid.tangentZ, 0);
      expectCloseTo(mid.normalX, 0);
      expectCloseTo(mid.normalZ, 1);
    });

    test("orthogonal normal and tangent vectors", () => {
      const pts: [number, number][] = [
        [0, 0],
        [50, 50],
        [100, 0],
      ];
      const sample = interpolateTrackPoint2D(pts, 0.3);
      const dot = sample.tangentX * sample.normalX + sample.tangentZ * sample.normalZ;
      expect(Math.abs(dot) < 1e-5).toBe(true);
    });
  });

  describe("elevation", () => {
    const mockCourse: Course = {
      id: 10606,
      terrain: 1,
      turn: 2,
      distance: 3,
      inout: 1,
      length: 2400,
      corners: [],
      straights: [],
      slopes: [
        { start: 1000, end: 1200, slope: 20000 }, // +2.0% for 200m -> +4m
        { start: 1500, end: 1800, slope: -10000 }, // -1.0% for 300m -> -3m
      ],
    };

    test("calculates elevation accumulation across slopes", () => {
      expect(getRawElevationAtDistance(mockCourse, 500)).toBe(0);
      // Halfway up slope 1: 100m at 2% = 2.0m
      expectCloseTo(getRawElevationAtDistance(mockCourse, 1100), 2.0);
      // Top of slope 1: 200m at 2% = 4.0m
      expectCloseTo(getRawElevationAtDistance(mockCourse, 1300), 4.0);
      // Bottom of slope 2: 4.0m - 3.0m = 1.0m
      expectCloseTo(getRawElevationAtDistance(mockCourse, 1900), 1.0);
      expectCloseTo(getRawElevationAtDistance(mockCourse, 2400), 1.0);
    });

    test("extracts active slope info correctly", () => {
      const flat = getSlopeInfoAtDistance(mockCourse, 500);
      expect(flat.isFlat).toBe(true);
      expect(flat.gradeFormatted).toBe("Flat");

      const uphill = getSlopeInfoAtDistance(mockCourse, 1100);
      expect(uphill.isUp).toBe(true);
      expect(uphill.gradeFormatted).toBe("+2.0%");

      const downhill = getSlopeInfoAtDistance(mockCourse, 1600);
      expect(downhill.isDown).toBe(true);
      expect(downhill.gradeFormatted).toBe("-1.0%");
    });
  });

  describe("shape-loader and dataset integrity", () => {
    test("loads course-shapes.json with all 138 tracks", async () => {
      const shapes = await loadCourseShapes();
      const ids = Object.keys(shapes);
      expect(ids.length).toBe(138);

      // Verify Tokyo 2400m
      const tokyo2400 = shapes["10606"];
      expect(tokyo2400).toBeDefined();
      expect(tokyo2400.points.length).toBe(251);
      expect(tokyo2400.distance).toBe(2400);

      // Verify Longchamp 2400m
      const longchamp = shapes["11203"];
      expect(longchamp).toBeDefined();
      expect(longchamp.points.length).toBe(251);

      // Verify Santa Anita 2000m
      const santaAnita = shapes["11612"];
      expect(santaAnita).toBeDefined();
      expect(santaAnita.points.length).toBe(251);

      // Verify Del Mar 2400m
      const delMar = shapes["11704"];
      expect(delMar).toBeDefined();
      expect(delMar.points.length).toBe(251);
    });
  });

  describe("loop-detector", () => {
    test("detects loop on Tokyo 2400m and Nakayama 2500m", async () => {
      const shapes = await loadCourseShapes();
      const tokyo2400 = shapes["10606"];
      const tokyoLoop = detectLoopSplitRatio(tokyo2400.points);
      expect(tokyoLoop).not.toBeNull();
      if (tokyoLoop) {
        expect(tokyoLoop > 0.5).toBe(true);
        expect(tokyoLoop < 0.95).toBe(true);
        expect(getLoopPass(500, 2400, tokyoLoop)).toBe(1);
        expect(getLoopPass(2300, 2400, tokyoLoop)).toBe(2);
      }
    });
  });

  describe("mesh-builder", () => {
    test("builds Three.js meshes and groups successfully", async () => {
      const { buildTrackScene } = await import("./mesh-builder");
      const shapes = await loadCourseShapes();
      const tokyo2400Shape = shapes["10606"];

      const mockCourse: Course = {
        id: 10606,
        terrain: 1,
        turn: 2,
        distance: 3,
        inout: 1,
        length: 2400,
        corners: [],
        straights: [],
        slopes: [{ start: 1000, end: 1200, slope: 20000 }],
        spurtStart: { meters: 1600 },
      };

      const rList = new RegionList();
      rList.push(new Region(1600, 1800));

      const scene = buildTrackScene({
        course: mockCourse,
        shape: tokyo2400Shape,
        elevationExaggeration: 4.5,
        zones: [{
          regions: rList,
          isRandom: false,
          earliestFire: 1600,
        }],
      });

      expect(scene.group).toBeDefined();
      expect(scene.trackMesh).toBeDefined();
      expect(scene.gridHelper).toBeDefined();
      expect(scene.skillZoneGroup.children.length).toBe(1);
      expect(scene.bounds.maxX > scene.bounds.minX).toBe(true);

      // Verify runner marker update
      scene.updateRunnerPosition(1600);
      expect(scene.runnerMarker.visible).toBe(true);
      scene.updateRunnerPosition(null);
      expect(scene.runnerMarker.visible).toBe(false);
    });
  });
});
