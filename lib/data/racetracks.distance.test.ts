import { describe, expect, test } from "bun:test";
import { loadRacetracks } from "./registry";
import { flattenCourse } from "../api/course-format";
import { computeZones } from "../skill-engine/zones";
import { distanceCategoryForLength } from "../skill-engine/distance-category";

const tracks = await loadRacetracks();
const rows = tracks.flatMap((t) => t.courses.map((c) => ({ trackId: t.id, row: c })));

describe("distanceCategoryForLength", () => {
  test("Sprint <= 1400, Mile <= 1800, Medium <= 2400, Long above", () => {
    expect([1000, 1200, 1300, 1400, 1401, 1600, 1800, 1801, 2000, 2400, 2401, 2500, 3600].map(distanceCategoryForLength))
      .toEqual([1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]);
  });
});

describe("racetracks.json distance category (game rule, not GameTora's)", () => {
  test("covers all 138 courses", () => expect(rows.length).toBe(138));

  test("every course's distance equals the length rule", () => {
    const wrong = rows
      .filter(({ row }) => row.distance !== distanceCategoryForLength(row.length))
      .map(({ row }) => `${row.id} (${row.length} m): ${row.distance}`);
    expect(wrong).toEqual([]);
  });

  test("Tokyo 1400 (10601) is Sprint and a distance_type==1 skill fires there", () => {
    const hit = rows.find(({ row }) => row.id === 10601)!;
    const course = { ...flattenCourse(hit.row), trackId: hit.trackId };
    expect(course.distance).toBe(1);
    expect(computeZones(course, "distance_type==1").regions.length).toBeGreaterThan(0);
    expect(computeZones(course, "distance_type==2").regions.length).toBe(0);
  });
});

describe("racetracks.json course flags from the mdb (engine step 4b)", () => {
  test("every course carries tightTrack (72 tight, matching race_course_set.tight_track)", () => {
    expect(rows.every(({ row }) => row.tightTrack === 0 || row.tightTrack === 1)).toBe(true);
    expect(rows.filter(({ row }) => row.tightTrack === 1).length).toBe(72);
    // Spot checks: Nakayama inner turf 2500 is tight, Ooi and Tokyo are not.
    const flag = (id: number) => rows.find(({ row }) => row.id === id)!.row.tightTrack;
    expect([flag(10506), flag(11103), flag(10606), flag(10101)]).toEqual([1, 0, 0, 1]);
  });

  test("run-up only on Santa Anita 11619 (50 m) and Del Mar 11707 (60 m), and flattenCourse carries it", () => {
    expect(rows.filter(({ row }) => row.runUp).map(({ row }) => [row.id, row.runUp])).toEqual([[11619, 50], [11707, 60]]);
    expect(flattenCourse(rows.find(({ row }) => row.id === 11619)!.row).runUp).toBe(50);
  });
});
