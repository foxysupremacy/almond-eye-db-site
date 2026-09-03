import { describe, expect, test } from "bun:test";
import { computeZones } from "./zones";
import type { Course } from "./types";

const dummyCourse: Course = {
  id: 10001,
  terrain: 1,
  turn: 1,
  distance: 3,
  inout: 0,
  length: 2400,
  trackId: 10005, // Tokyo
  phases: [
    { id: 0, start: 0, end: 400 },
    { id: 1, start: 400, end: 1600 },
    { id: 2, start: 1600, end: 2000 },
    { id: 3, start: 2000, end: 2400 },
  ],
  corners: [{ start: 1400, end: 1875, number: 4 }],
  slopes: [
    { start: 500, end: 700, slope: 1.5 },
    { start: 1700, end: 1900, slope: -1.2 },
  ],
  straights: [
    { start: 0, end: 400, frontType: 2 },
    { start: 800, end: 1200, frontType: 2 },
    { start: 1875, end: 2400, frontType: 1 },
  ],
};

describe("computeZones - activation count conditions", () => {
  test("activate_count_middle>=3 activates only in phase 1 (Middle Leg)", () => {
    const res = computeZones(dummyCourse, "activate_count_middle>=3");
    expect(res.regions).toEqual([
      { start: 400, end: 1600 } as any,
    ]);
    expect(res.regions).toEqual([{ start: 400, end: 1600 } as any]);
    expect(res.isRandom).toBe(true);
  });

  test("activate_count_start>=3 activates only in phase 0 (Early Leg)", () => {
    const res = computeZones(dummyCourse, "activate_count_start>=3");
    expect(res.regions).toEqual([
      { start: 0, end: 400 } as any,
    ]);
    expect(res.regions).toEqual([{ start: 0, end: 400 } as any]);
    expect(res.isRandom).toBe(true);
  });

  test("activate_count_end_after>=3 activates in late race (phase 2 & 3)", () => {
    const res = computeZones(dummyCourse, "activate_count_end_after>=3");
    expect(res.regions).toEqual([
      { start: 1600, end: 2400 } as any,
    ]);
    expect(res.regions).toEqual([{ start: 1600, end: 2400 } as any]);
    expect(res.isRandom).toBe(true);
  });

  test("activate_count_later_half>=2 activates in second half of course", () => {
    const res = computeZones(dummyCourse, "activate_count_later_half>=2");
    expect(res.regions).toEqual([
      { start: 1200, end: 2400 } as any,
    ]);
    expect(res.regions).toEqual([{ start: 1200, end: 2400 } as any]);
    expect(res.isRandom).toBe(true);
  });

  test("activate_count_middle==7 preserves outer phase and straight conditions", () => {
    const res = computeZones(
      dummyCourse,
      "is_last_straight==1&phase>=2&activate_count_middle==7",
    );
    expect(res.regions).toEqual([
      { start: 1875, end: 2400 } as any,
    ]);
    expect(res.regions).toEqual([{ start: 1875, end: 2400 } as any]);
  });
});

describe("computeZones - course gating (track_id & is_basis_distance)", () => {
  test("track_id matches Tokyo (10005) and zeroes out Nakayama (10006)", () => {
    const match = computeZones(dummyCourse, "track_id==10005");
    expect(match.regions.length > 0).toBe(true);

    const noMatch = computeZones(dummyCourse, "track_id==10006");
    expect(noMatch.regions.length).toBe(0);
  });

  test("is_basis_distance==1 matches 2400m (core) and is_basis_distance==0 zeroes out", () => {
    const coreMatch = computeZones(dummyCourse, "is_basis_distance==1");
    expect(coreMatch.regions.length > 0).toBe(true);

    const nonCoreMatch = computeZones(dummyCourse, "is_basis_distance==0");
    expect(nonCoreMatch.regions.length).toBe(0);
  });
});

describe("computeZones - spatial and phase straight randoms", () => {
  test("phase_first_half_straight_random==1 activates on straights in first half of phase 1", () => {
    // phase 1 is 400..1600; first half is 400..1000; straights in that range: 800..1200 intersected with 400..1000 -> 800..1000
    const res = computeZones(dummyCourse, "phase_first_half_straight_random==1");
    expect(res.regions).toEqual([{ start: 800, end: 1000 } as any]);
  });

  test("phase_latter_half_straight_random==1 activates on straights in second half of phase 1", () => {
    // phase 1 is 400..1600; second half is 1000..1600; straights in that range: 800..1200 intersected with 1000..1600 -> 1000..1200
    const res = computeZones(dummyCourse, "phase_latter_half_straight_random==1");
    expect(res.regions).toEqual([{ start: 1000, end: 1200 } as any]);
  });

  test("down_slope_random_later_half==1 activates on downhills in 2nd half of track", () => {
    // track is 2400m; 2nd half is 1200..2400; downhill slope is 1700..1900
    const res = computeZones(dummyCourse, "down_slope_random_later_half==1");
    expect(res.regions).toEqual([{ start: 1700, end: 1900 } as any]);
  });

  test("run_at_full_speed_random==1 activates within last spurt section", () => {
    const res = computeZones(dummyCourse, "run_at_full_speed_random==1");
    expect(res.regions.length > 0).toBe(true);
    expect(res.regions[0].start >= 1400).toBe(true);
    expect(res.isRandom).toBe(true);
  });
});

describe("computeZones - furlong and accumulatetime", () => {
  test("furlong==1 represents [200m, 400m]", () => {
    const res = computeZones(dummyCourse, "furlong==1");
    expect(res.regions).toEqual([{ start: 200, end: 400 } as any]);
  });

  test("furlong==3 represents [600m, 800m]", () => {
    const res = computeZones(dummyCourse, "furlong==3");
    expect(res.regions).toEqual([{ start: 600, end: 800 } as any]);
  });

  test("accumulatetime>=5 clips the first 100m (5s * 20m/s)", () => {
    const res = computeZones(dummyCourse, "accumulatetime>=5");
    expect(res.regions).toEqual([{ start: 100, end: 2400 } as any]);
  });

  test("accumulatetime>=10 clips the first 200m (10s * 20m/s)", () => {
    const res = computeZones(dummyCourse, "accumulatetime>=10");
    expect(res.regions).toEqual([{ start: 200, end: 2400 } as any]);
  });
});
