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

describe("computeZones - intrinsic track & environmental conditions", () => {
  test("is_tight_track gates tight vs wide racecourses", () => {
    // dummyCourse trackId is 10005 (Nakayama / wide), not in tight track list
    const wideRes = computeZones(dummyCourse, "is_tight_track==1");
    expect(wideRes.regions.length).toBe(0);

    const wideResNot = computeZones(dummyCourse, "is_tight_track==0");
    expect(wideResNot.regions.length).toBeGreaterThan(0);

    // Sapporo (10001) is a tight track
    const tightCourse = { ...dummyCourse, trackId: 10001 };
    const tightRes = computeZones(tightCourse, "is_tight_track==1");
    expect(tightRes.regions.length).toBeGreaterThan(0);
  });

  test("is_abroad gates domestic vs overseas racecourses", () => {
    // dummyCourse trackId is 10005 (domestic)
    const domesticAbroadRes = computeZones(dummyCourse, "is_abroad==1");
    expect(domesticAbroadRes.regions.length).toBe(0);

    const domesticDomesticRes = computeZones(dummyCourse, "is_abroad==0");
    expect(domesticDomesticRes.regions.length).toBeGreaterThan(0);

    // Longchamp (10201) is abroad
    const overseasCourse = { ...dummyCourse, trackId: 10201 };
    const overseasAbroadRes = computeZones(overseasCourse, "is_abroad==1");
    expect(overseasAbroadRes.regions.length).toBeGreaterThan(0);
  });

  test("is_dirtgrade gates NAR dirt racecourses", () => {
    // dummyCourse is Tokyo (10005, JRA turf)
    const jraDirtGradeRes = computeZones(dummyCourse, "is_dirtgrade==1");
    expect(jraDirtGradeRes.regions.length).toBe(0);

    // Ooi (10101) is NAR dirt grade
    const narCourse = { ...dummyCourse, trackId: 10101 };
    const narDirtGradeRes = computeZones(narCourse, "is_dirtgrade==1");
    expect(narDirtGradeRes.regions.length).toBeGreaterThan(0);
  });

  test("rotation handles straight courses (turn 4)", () => {
    const straightCourse = { ...dummyCourse, turn: 4 };
    const matchRes = computeZones(straightCourse, "rotation==4");
    expect(matchRes.regions.length).toBeGreaterThan(0);

    const mismatchRes = computeZones(straightCourse, "rotation==1");
    expect(mismatchRes.regions.length).toBe(0);
  });

  test("environmental conditions pass through when unset, and filter strictly when specified", () => {
    // Unset environmental conditions pass through
    const unsetSeason = computeZones(dummyCourse, "season==3");
    expect(unsetSeason.regions.length).toBeGreaterThan(0);

    // Matching specified season (3 = Autumn/Fall)
    const matchSeason = computeZones(dummyCourse, "season==3", null, undefined, { season: 3 });
    expect(matchSeason.regions.length).toBeGreaterThan(0);

    // Mismatched specified season (Spring 1 vs Autumn 3)
    const mismatchSeason = computeZones(dummyCourse, "season==3", null, undefined, { season: 1 });
    expect(mismatchSeason.regions.length).toBe(0);

    // Weather: sunny (1) vs rainy (3)
    const matchWeather = computeZones(dummyCourse, "weather==1", null, undefined, { weather: 1 });
    expect(matchWeather.regions.length).toBeGreaterThan(0);
    const mismatchWeather = computeZones(dummyCourse, "weather==1", null, undefined, { weather: 3 });
    expect(mismatchWeather.regions.length).toBe(0);

    // Ground condition: good (1) vs yielding (2)
    const matchGround = computeZones(dummyCourse, "ground_condition==1", null, undefined, { groundCondition: 1 });
    expect(matchGround.regions.length).toBeGreaterThan(0);
    const mismatchGround = computeZones(dummyCourse, "ground_condition==1", null, undefined, { groundCondition: 2 });
    expect(mismatchGround.regions.length).toBe(0);

    // Time: daytime (2) vs night (4)
    const matchTime = computeZones(dummyCourse, "time==2", null, undefined, { time: 2 });
    expect(matchTime.regions.length).toBeGreaterThan(0);
    const mismatchTime = computeZones(dummyCourse, "time==2", null, undefined, { time: 4 });
    expect(mismatchTime.regions.length).toBe(0);

    // Grade: G1 (100) vs G2 (200)
    const matchGrade = computeZones(dummyCourse, "grade==100", null, undefined, { grade: 100 });
    expect(matchGrade.regions.length).toBeGreaterThan(0);
    const mismatchGrade = computeZones(dummyCourse, "grade==100", null, undefined, { grade: 200 });
    expect(mismatchGrade.regions.length).toBe(0);
  });

  test("noDebuffs rule returns empty regions for banned skills and preserves unbanned skills", () => {
    // 201151 = Monopolize (独占力), a banned debuff
    const normalZones = computeZones(dummyCourse, "phase>=2", null, undefined, { skillId: "201151" });
    expect(normalZones.regions.length).toBeGreaterThan(0);

    const bannedZones = computeZones(dummyCourse, "phase>=2", null, undefined, { skillId: "201151", noDebuffs: true });
    expect(bannedZones.regions.length).toBe(0);

    // 110071 = Adventure of 564 (継承スキル ban)
    const bannedUnique = computeZones(dummyCourse, "phase>=2", null, undefined, { skillId: "110071", noDebuffs: true });
    expect(bannedUnique.regions.length).toBe(0);

    // 200011 = General speed skill (not banned)
    const unbannedZones = computeZones(dummyCourse, "phase>=2", null, undefined, { skillId: "200011", noDebuffs: true });
    expect(unbannedZones.regions.length).toBeGreaterThan(0);
  });
});
