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

  test("distance_type falls back to the length rule: a 1400 m course with no stored bucket is Sprint", () => {
    const sprint: Course = { ...dummyCourse, length: 1400, distance: 0, phases: [
      { id: 0, start: 0, end: 233 }, { id: 1, start: 233, end: 933 }, { id: 2, start: 933, end: 1167 }, { id: 3, start: 1167, end: 1400 },
    ], corners: [], slopes: [], straights: [] };
    expect(computeZones(sprint, "distance_type==1").regions.length).toBeGreaterThan(0);
    expect(computeZones(sprint, "distance_type==2").regions.length).toBe(0);
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

  test("is_tight_track reads the per-course mdb flag when the course carries it (step 4b)", () => {
    // Nakayama inner courses are tight in the mdb although the track is wide; Ooi (a dirt track) is not.
    expect(computeZones({ ...dummyCourse, trackId: 10005, tightTrack: 1 }, "is_tight_track==1").regions.length).toBeGreaterThan(0);
    expect(computeZones({ ...dummyCourse, trackId: 10101, tightTrack: 0 }, "is_tight_track==1").regions.length).toBe(0);
    expect(computeZones({ ...dummyCourse, trackId: 10101, tightTrack: 0 }, "is_tight_track==0").regions.length).toBeGreaterThan(0);
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

  test("generic zone computation does not apply PVP no-debuff policy", () => {
    const withoutRule = computeZones(dummyCourse, "phase>=2", null, undefined, {
      skillId: "201151",
      noDebuffs: false,
    });
    const withRule = computeZones(dummyCourse, "phase>=2", null, undefined, {
      skillId: "201151",
      noDebuffs: true,
    });

    expect(withRule.regions.length).toBeGreaterThan(0);
    expect(withRule.regions).toEqual(withoutRule.regions);
  });
});

describe("custom race condition filtering", () => {
  for (const [condition, key] of [["season", "season"], ["weather", "weather"], ["ground_condition", "groundCondition"], ["time", "time"]] as const) {
    test(`${condition} respects fixed values and unrestricted null`, () => {
      expect(computeZones(dummyCourse, `${condition}==2`, null, undefined, { [key]: 2 }).regions.length).toBeGreaterThan(0);
      expect(computeZones(dummyCourse, `${condition}==2`, null, undefined, { [key]: 1 }).regions).toHaveLength(0);
      expect(computeZones(dummyCourse, `${condition}==2`, null, undefined, { [key]: null }).regions.length).toBeGreaterThan(0);
    });
  }
});

// Four corners, numbered 1-4 in race order (corner==N picks corners[len + N - 5]).
const fourCorners: Course = {
  ...dummyCourse,
  corners: [
    { start: 200, end: 400, number: 1 },
    { start: 600, end: 800, number: 2 },
    { start: 1400, end: 1600, number: 3 },
    { start: 1800, end: 2000, number: 4 },
  ],
};
const spans = (regions: { start: number; end: number }[]) => regions.map((r) => [r.start, r.end]);

describe("computeZones - corner!=N", () => {
  test("corner!=3 is every region except corner 3", () => {
    expect(spans(computeZones(fourCorners, "corner!=3").regions)).toEqual([[0, 1400], [1600, 2400]]);
  });
  test("corner!=4 on a one-corner course excludes that corner", () => {
    expect(spans(computeZones(dummyCourse, "corner!=4").regions)).toEqual([[0, 1400], [1875, 2400]]);
  });
  test("corner!=N for a corner the course does not have is the whole course", () => {
    expect(spans(computeZones(dummyCourse, "corner!=1").regions)).toEqual([[0, 2400]]);
  });
  test("corner!=0 still means \"in any corner\"", () => {
    expect(spans(computeZones(fourCorners, "corner!=0").regions)).toEqual([[200, 400], [600, 800], [1400, 1600], [1800, 2000]]);
  });
  test("combines with other conditions", () => {
    expect(spans(computeZones(fourCorners, "distance_rate>=50&distance_rate<=70&corner!=3").regions)).toEqual([[1200, 1400], [1600, 1680]]);
  });
});

describe("computeZones - simulation-only pass-throughs", () => {
  test("activate_count_param_skill>=N never zeroes a zone", () => {
    expect(spans(computeZones(dummyCourse, "activate_count_param_skill>=7").regions)).toEqual([[0, 2400]]);
    expect(spans(computeZones(dummyCourse, "phase==1&activate_count_param_skill>=7").regions)).toEqual([[400, 1600]]);
  });
  test("activate_count_param_skill is random-sampled like the other own-activation counts (R31)", () => {
    expect(computeZones(dummyCourse, "phase==1&activate_count_param_skill>=7").isRandom).toBe(true);
    expect(computeZones(dummyCourse, "phase==1&activate_count_heal>=1").isRandom).toBe(true);
  });
  test("random_lot_shared==N never zeroes a zone", () => {
    expect(spans(computeZones(dummyCourse, "random_lot_shared==30").regions)).toEqual([[0, 2400]]);
  });
});

describe("computeZones - popularity", () => {
  test("popularity is a pass-through in every band (R32: met for any Uma)", () => {
    for (const cond of ["popularity>=4", "popularity==1", "popularity<=3", "popularity>3", "popularity!=1"]) {
      expect({ cond, n: computeZones(dummyCourse, cond).regions.length }).toEqual({ cond, n: 1 });
    }
  });
});

describe("computeZones - phase boundary frame (step 5b, Mejiro Dober 100591)", () => {
  // Hanshin 2400 (10907) shape: corner 3 ends and the final corner starts exactly where phase 1 ends.
  const hanshin: Course = {
    ...dummyCourse,
    corners: [{ start: 370, end: 560, number: 1 }, { start: 560, end: 750, number: 2 }, { start: 1250, end: 1600, number: 3 }, { start: 1600, end: 1927, number: 4 }],
    straights: [{ start: 0, end: 370, frontType: 1 }, { start: 750, end: 1250, frontType: 2 }, { start: 1927, end: 2400, frontType: 1 }],
  };
  test("phase==1 & is_finalcorner==1 holds in the boundary frame when the final corner starts where phase 1 ends", () => {
    // The game (mechanics doc §phase) checks skills
    // before it updates the phase, so the frame that enters the final corner still counts as phase 1.
    const res = computeZones(hanshin, "phase==1&corner!=0&is_finalcorner==1");
    expect(res.regions).toHaveLength(1);
    expect(res.regions[0].start).toBe(1600);
    expect(res.regions[0].end).toBeGreaterThan(1600);
    expect(res.regions[0].end).toBeLessThanOrEqual(1601);
    expect(res.isRandom).toBe(false);
  });
  test("the same holds through phase<=1 / phase<2 / phase!=2", () => {
    for (const cond of ["phase<=1&is_finalcorner==1", "phase<2&is_finalcorner==1", "phase!=2&phase!=3&is_finalcorner==1"]) {
      const res = computeZones(hanshin, cond);
      expect({ cond, start: res.regions[0]?.start }).toEqual({ cond, start: 1600 });
    }
  });
  test("phase spans are unchanged when the boundary frame is not the only point left", () => {
    expect(spans(computeZones(hanshin, "phase==1").regions)).toEqual([[400, 1600]]);
    expect(spans(computeZones(hanshin, "phase<=1").regions)).toEqual([[0, 1600]]);
    expect(spans(computeZones(hanshin, "phase<2").regions)).toEqual([[0, 1600]]);
    expect(spans(computeZones(hanshin, "phase!=1").regions)).toEqual([[0, 400], [1600, 2400]]);
    expect(spans(computeZones(hanshin, "phase==1&corner!=0").regions)).toEqual([[400, 560], [560, 750], [1250, 1600]]);
    expect(spans(computeZones(hanshin, "phase==3").regions)).toEqual([[2000, 2400]]);
  });
  test("a later phase still never reaches back into an earlier one", () => {
    expect(computeZones(hanshin, "phase==2&is_finalcorner==0").regions).toHaveLength(0);
  });
});
