import { describe, expect, it, test } from "bun:test";
import { evaluateSkillForTrack } from "./evaluator";
import type { Course } from "../skill-engine/types";
import type { SkillDetailInput } from "./types";

function mockCourse(partial: Partial<Course>): Course {
  return {
    id: 1,
    terrain: 1,
    turn: 1,
    distance: 2,
    inout: 0,
    length: 2000,
    corners: [],
    straights: [],
    slopes: [],
    ...partial,
  };
}

// Mock Kyoto 2200m Outer course
const KYOTO_2200M: Course = {
  id: 10808,
  terrain: 1, // turf
  turn: 1, // right
  distance: 3, // medium
  inout: 3, // outer
  length: 2200,
  spurtStart: { meters: 1467 },
  corners: [
    { start: 400, end: 600, number: 1 },
    { start: 600, end: 800, number: 2 },
    { start: 1300, end: 1550, number: 3 },
    { start: 1550, end: 1797, number: 4 },
  ],
  straights: [
    { start: 0, end: 400, frontType: 1 },
    { start: 800, end: 1300, frontType: 2 },
    { start: 1797, end: 2200, frontType: 1 },
  ],
  slopes: [
    { start: 1050, end: 1375, slope: 10000 },
    { start: 1375, end: 1525, slope: -20000 },
  ],
};

describe("skill-evaluator", () => {
  it("evaluates each Peerless Heroine trigger independently, including Zenkai acceleration", () => {
    const peerlessHeroine = {
      id: 101291,
      nameEn: "Peerless Heroine",
      rarity: 5,
      conditionGroups: [
        {
          condition: "phase==1&corner!=0&order_rate<=50&ground_type==1",
          base_time: 30000,
          effects: [{ type: 22, value: 4500 }],
        },
        {
          condition: "is_activate_other_skill_detail==1&run_at_full_speed_random==1&order<=3&distance_type==3",
          base_time: 20000,
          effects: [{ type: 48, value: 4000 }],
        },
      ],
    };
    const zones = [
      { isRandom: false, regions: [{ start: 1000, end: 1417 }], earliestFire: null },
      { isRandom: true, regions: [{ start: 1600, end: 2400 }], earliestFire: 1000 },
    ];

    const result = evaluateSkillForTrack(peerlessHeroine, mockCourse({ length: 2400, distance: 3, spurtStart: { meters: 1600 } }), 2, 9, false, zones);

    expect(result.triggerEvaluations).toHaveLength(2);
    expect(result.triggerEvaluations?.[0].evaluation?.category).toBe("current_speed");
    expect(result.triggerEvaluations?.[1].evaluation?.category).toBe("zenkai_accel");
    expect(result.triggerEvaluations?.[1].evaluation?.verdictSummary).toContain("Zenkai Spurt Acceleration");
    expect(result.score).toBeGreaterThan(100);
    expect(result.specialEffects.some((effect) => effect.id === "multi_stage_synergy")).toBe(true);
  });

  it("uses the best active path for alternative triggers instead of adding mutually exclusive scores", () => {
    const alternativeSkill = {
      id: 999980,
      conditionGroups: [
        {
          condition: "phase==1",
          base_time: 30000,
          effects: [{ type: 22, value: 4500 }],
        },
        {
          condition: "phase>=2",
          base_time: 20000,
          effects: [{ type: 22, value: 4500 }],
        },
      ],
    };

    const result = evaluateSkillForTrack(
      alternativeSkill,
      mockCourse({ length: 2400, spurtStart: { meters: 1600 } }),
      2,
      9,
      false,
      [
        { isRandom: false, regions: [{ start: 1000, end: 1200 }], earliestFire: null },
        { isRandom: false, regions: [{ start: 1700, end: 1900 }], earliestFire: null },
      ],
    );

    const triggerScores = result.triggerEvaluations?.flatMap((entry) =>
      entry.evaluation ? [entry.evaluation.score] : [],
    ) ?? [];
    expect(triggerScores).toHaveLength(2);
    expect(result.score).toBe(Math.max(...triggerScores));
    expect(result.specialEffects.some((effect) => effect.id === "multi_stage_synergy")).toBe(false);
    expect(result.verdictSummary).toContain("alternative activation paths");
  });

  it("ignores inactive trigger paths when aggregating the final verdict", () => {
    const chainedSkill = {
      id: 999979,
      conditionGroups: [
        {
          condition: "phase==1",
          base_time: 30000,
          effects: [{ type: 22, value: 4500 }],
        },
        {
          condition: "is_activate_other_skill_detail==1&phase>=2",
          base_time: 20000,
          effects: [{ type: 48, value: 4000 }],
        },
      ],
    };

    const result = evaluateSkillForTrack(
      chainedSkill,
      mockCourse({ length: 2400, spurtStart: { meters: 1600 } }),
      2,
      9,
      false,
      [
        { isRandom: false, regions: [{ start: 1000, end: 1200 }], earliestFire: null },
        { isRandom: false, regions: [], earliestFire: null },
      ],
    );

    expect(result.triggerEvaluations?.[1].evaluation).toBeNull();
    expect(result.score).toBe(result.triggerEvaluations?.[0].evaluation?.score);
  });

  it("evaluates Seiun Sky (Angling) on Runner as Valid Fastest Accel", () => {
    const anglingSkill = {
      id: 100201,
      nameEn: "Angling×Scheming",
      rarity: 5,
      conditionGroups: [
        {
          condition: "phase>=2&corner!=0&order==1",
          base_time: 24000,
          effects: [{ type: 31, value: 2000 }],
        },
      ],
    };

    // On Kyoto 2200m, corner 3 spans 1300-1550m, so late race (1467m) triggers immediately at 1467m
    const zones = [{ isRandom: false, regions: [{ start: 1467, end: 1550 }], earliestFire: null }];

    const result = evaluateSkillForTrack(
      anglingSkill,
      KYOTO_2200M,
      1, // Runner
      9,
      false,
      zones
    );

    expect(result.category).toBe("fastest_accel");
    expect(result.stars).toBe(5);
    expect(result.tier).toBe("S");
    expect(result.specialEffects.some((e) => e.id === "fastest_accel_dynamic")).toBe(true);
    expect(result.specialEffects.some((e) => e.id === "rank_mismatch")).toBe(false);
  });

  it("detects Rank Trap when Seiun Sky is equipped on Betweener", () => {
    const anglingSkill = {
      id: 100201,
      nameEn: "Angling×Scheming",
      rarity: 5,
      conditionGroups: [
        {
          condition: "phase>=2&corner!=0&order==1",
          base_time: 24000,
          effects: [{ type: 31, value: 2000 }],
        },
      ],
    };

    const zones = [{ isRandom: false, regions: [{ start: 1467, end: 1550 }], earliestFire: null }];

    const result = evaluateSkillForTrack(
      anglingSkill,
      KYOTO_2200M,
      3, // Betweener (expected ranks: 4-7)
      9,
      false,
      zones
    );

    expect(result.specialEffects.some((e) => e.id === "rank_mismatch")).toBe(true);
  });

  it("flags Weak Position Match when the rank window barely overlaps the style envelope", () => {
    const rankSixSkill = {
      id: 999994,
      nameEn: "Sixth Place Speed",
      rarity: 2,
      conditionGroups: [
        {
          condition: "phase>=2&corner!=0&order==6",
          base_time: 24000,
          effects: [{ type: 27, value: 1500 }],
        },
      ],
    };

    const zones = [{ isRandom: false, regions: [{ start: 1467, end: 1550 }], earliestFire: null }];

    // order==6 vs Betweener [4,7]: overlap 1/4 = 25% → warning, not a hard trap
    const result = evaluateSkillForTrack(rankSixSkill, KYOTO_2200M, 3, 9, false, zones);
    const weak = result.specialEffects.find((e) => e.id === "rank_weak");
    expect(weak?.type).toBe("warning");
    expect(result.positionOverlap).toBe(0.25);
    expect(result.specialEffects.some((e) => e.id === "rank_mismatch")).toBe(false);
  });

  it("flags Partial Position Match at 50% envelope coverage", () => {
    const doberLikeSkill = {
      id: 999993,
      nameEn: "Dober-like Window",
      rarity: 2,
      conditionGroups: [
        {
          condition: "phase>=2&corner!=0&order_rate>=50&order_rate<=70",
          base_time: 24000,
          effects: [{ type: 27, value: 1500 }],
        },
      ],
    };

    const zones = [{ isRandom: false, regions: [{ start: 1467, end: 1550 }], earliestFire: null }];

    // Ranks 5–6 vs Betweener [4,7]: overlap 2/4 = 50% → info-level note
    const result = evaluateSkillForTrack(doberLikeSkill, KYOTO_2200M, 3, 9, false, zones);
    const weak = result.specialEffects.find((e) => e.id === "rank_weak");
    expect(weak?.type).toBe("info");
    expect(result.positionOverlap).toBe(0.5);
    expect(result.specialEffects.some((e) => e.id === "rank_mismatch")).toBe(false);
  });

  it("widens the Chaser envelope to 4th–9th (current game version)", () => {
    const zones = [{ isRandom: false, regions: [{ start: 1467, end: 1550 }], earliestFire: null }];

    // order==4 vs the NEW Chaser envelope [4,9]: no longer a hard trap
    const rankFourSkill = {
      id: 999992,
      nameEn: "Fourth Place Accel",
      rarity: 2,
      conditionGroups: [
        {
          condition: "phase>=2&corner!=0&order==4",
          base_time: 24000,
          effects: [{ type: 31, value: 2000 }],
        },
      ],
    };
    const asChaser = evaluateSkillForTrack(rankFourSkill, KYOTO_2200M, 4, 9, false, zones);
    expect(asChaser.specialEffects.some((e) => e.id === "rank_mismatch")).toBe(false);
    expect(Math.abs((asChaser.positionOverlap ?? 0) - 1 / 6)).toBeLessThan(1e-9);

    // order==1 still cannot overlap [4,9]
    const rankOneSkill = {
      id: 999991,
      nameEn: "First Place Accel",
      rarity: 2,
      conditionGroups: [
        {
          condition: "phase>=2&corner!=0&order==1",
          base_time: 24000,
          effects: [{ type: 31, value: 2000 }],
        },
      ],
    };
    const trapped = evaluateSkillForTrack(rankOneSkill, KYOTO_2200M, 4, 9, false, zones);
    expect(trapped.specialEffects.some((e) => e.id === "rank_mismatch")).toBe(true);
  });

  it("detects Carry-Over (終盤接続) for mid-race speed skills on Kyoto downhill", () => {
    const downhillSkill = {
      id: 110591,
      nameEn: "Alt Dober Unique",
      rarity: 5,
      conditionGroups: [
        {
          condition: "distance_rate>=60&slope==2&phase==1&order_rate>=40&order_rate<=80",
          base_time: 30000, // 6.6s at 2200m -> ~132m travelled
          effects: [{ type: 27, value: 1500 }],
        },
      ],
    };

    // Downhill starts at 1375m; ends at 1525m; late race starts at 1467m
    // Triggers at 1375m, duration ~132m -> covers through 1507m past 1467m!
    const zones = [{ isRandom: false, regions: [{ start: 1375, end: 1466 }], earliestFire: null }];

    const result = evaluateSkillForTrack(
      downhillSkill,
      KYOTO_2200M,
      3, // Betweener
      9,
      false,
      zones
    );

    expect(result.category).toBe("carry_over");
    expect(result.stars >= 4).toBe(true);
    expect(result.timingAnalysis.connectsToLateRace).toBe(true);
    expect(result.specialEffects.some((e) => e.id === "carry_over_dynamic")).toBe(true);
    expect(result.specialEffects.some((e) => e.id === "downhill_synergy")).toBe(true);
  });

  it("detects Dead Accel when acceleration fires on final straight after top speed is reached", () => {
    const finalStraightAccel = {
      id: 999999,
      nameEn: "Late Straight Accel",
      rarity: 2,
      conditionGroups: [
        {
          condition: "is_last_straight==1",
          base_time: 24000,
          effects: [{ type: 31, value: 2000 }],
        },
      ],
    };

    // Final straight starts at 1797m, 330m after spurt at 1467m
    const zones = [{ isRandom: false, regions: [{ start: 1797, end: 2200 }], earliestFire: null }];

    const result = evaluateSkillForTrack(
      finalStraightAccel,
      KYOTO_2200M,
      2, // Leader
      9,
      false,
      zones
    );

    expect(result.category).toBe("dead_accel");
    expect(result.stars).toBe(1);
    expect(result.tier).toBe("F");
    expect(result.specialEffects.some((e) => e.id === "dead_accel_dynamic")).toBe(true);
  });

  it("reclassifies pre-spurt mid-race accel as Position Accel (tier B) for every style", () => {
    const midRaceAccel = {
      id: 999997,
      nameEn: "Mid-Race Position Accel",
      rarity: 2,
      conditionGroups: [
        {
          condition: "phase==1&corner!=0",
          base_time: 24000,
          effects: [{ type: 31, value: 2000 }],
        },
      ],
    };

    // Mid-race: 1100m is after the 1/6 mark (366.7m) and 367m before the spurt line
    const zones = [{ isRandom: false, regions: [{ start: 1100, end: 1300 }], earliestFire: null }];

    for (const style of [1, 2, 3, 4] as const) {
      const result = evaluateSkillForTrack(midRaceAccel, KYOTO_2200M, style, 9, false, zones);
      expect(result.category).toBe("position_accel");
      expect(result.tier).toBe("B");
      expect(result.stars).toBe(3);
      expect(result.specialEffects.some((e) => e.id === "position_accel_dynamic")).toBe(true);
    }
  });

  it("classifies by the best accel window across groups (early group must not sink a spurt-perfect group)", () => {
    const hybridAccel = {
      id: 999996,
      nameEn: "Hybrid Accel",
      rarity: 2,
      conditionGroups: [
        {
          condition: "phase==1&corner!=0",
          base_time: 24000,
          effects: [{ type: 31, value: 2000 }],
        },
        {
          condition: "phase>=2&corner!=0",
          base_time: 24000,
          effects: [{ type: 31, value: 2000 }],
        },
      ],
    };

    const zones = [
      { isRandom: false, regions: [{ start: 1100, end: 1300 }], earliestFire: null },
      { isRandom: false, regions: [{ start: 1467, end: 1550 }], earliestFire: null },
    ];

    // Previously the earliest group (1100m) dragged the whole skill into Dead Accel F
    const result = evaluateSkillForTrack(hybridAccel, KYOTO_2200M, 1, 9, false, zones);
    expect(result.category).toBe("fastest_accel");
    expect(result.tier).toBe("S");
  });

  it("keeps Dead Accel F for accel firing before the mid-race (1/6 mark)", () => {
    const earlyAccel = {
      id: 999995,
      nameEn: "Early Race Accel",
      rarity: 2,
      conditionGroups: [
        {
          condition: "phase==0",
          base_time: 24000,
          effects: [{ type: 31, value: 2000 }],
        },
      ],
    };

    // 300m is before the 1/6 mark (366.7m on 2200m)
    const zones = [{ isRandom: false, regions: [{ start: 300, end: 360 }], earliestFire: null }];

    const result = evaluateSkillForTrack(earlyAccel, KYOTO_2200M, 1, 9, false, zones);
    expect(result.category).toBe("dead_accel");
    expect(result.tier).toBe("F");
  });

  it("detects Delayed Accel when acceleration triggers 80m late", () => {
    const finalCornerAccel = {
      id: 999998,
      nameEn: "Final Corner Accel",
      rarity: 2,
      conditionGroups: [
        {
          condition: "is_finalcorner==1",
          base_time: 24000,
          effects: [{ type: 31, value: 2000 }],
        },
      ],
    };

    // Final corner is Corner 4 (1550m), which is 83m after spurt start (1467m)
    const zones = [{ isRandom: false, regions: [{ start: 1550, end: 1797 }], earliestFire: null }];

    const result = evaluateSkillForTrack(
      finalCornerAccel,
      KYOTO_2200M,
      2,
      9,
      false,
      zones
    );

    expect(result.category).toBe("delayed_accel");
    expect(result.stars).toBe(3);
    expect(result.specialEffects.some((e) => e.id === "delayed_accel_dynamic")).toBe(true);
  });

  it("flags Instant Current Speed for type 21/22 skills", () => {
    const almondEyeMidSpeed = {
      id: 101291,
      nameEn: "Peerless Heroine",
      rarity: 5,
      conditionGroups: [
        {
          condition: "phase==1&corner!=0&order_rate<=50",
          base_time: 18000,
          effects: [{ type: 22, value: 2500 }],
        },
      ],
    };

    const zones = [{ isRandom: false, regions: [{ start: 400, end: 800 }], earliestFire: null }];

    const result = evaluateSkillForTrack(
      almondEyeMidSpeed,
      KYOTO_2200M,
      1, // Runner
      9,
      false,
      zones
    );

    expect(result.specialEffects.some((e) => e.id === "current_speed_dynamic")).toBe(true);
  });

  it("transforms Gold skills in Parent Deck mode to inherit White skill factor metadata", () => {
    // Arc Maestro (id: 200351)
    const goldSkill = {
      id: 200351,
      nameEn: "Arc Maestro",
      rarity: 2,
      conditionGroups: [
        {
          condition: "corner!=0",
          base_time: 0,
          effects: [{ type: 9, value: 550 }],
        },
      ],
    };

    const zones = [{ isRandom: false, regions: [{ start: 400, end: 800 }], earliestFire: null }];

    const result = evaluateSkillForTrack(
      goldSkill,
      KYOTO_2200M,
      2,
      9,
      true, // isParentMode = true!
      zones
    );

    expect(result.parentMeta?.isParentMode).toBe(true);
    expect(result.parentMeta?.isGoldTransformed).toBe(true);
    expect(result.parentMeta?.inheritedWhiteNameEn).toBe("Corner Recovery ○");
  });

  it("evaluates multi-group skills (Ring-a-Link) without false rank trap and awards multi-stage synergy", () => {
    // Ring-a-Link (id: 101431) — Victoire Pisa
    const pisaSkill = {
      id: 101431,
      nameEn: "Ring-a-Link",
      rarity: 5,
      conditionGroups: [
        {
          precondition: "distance_rate>=16&distance_rate<=18&order_rate>=50",
          condition: "running_style==3&phase_laterhalf==1",
          base_time: 50000,
          effects: [{ type: 22, value: 3500 }],
        },
        {
          precondition: null,
          condition: "is_activate_other_skill_detail==1&distance_type==3&is_last_straight_onetime==1&order_rate<=50",
          base_time: 50000,
          effects: [{ type: 22, value: 1500 }],
        },
      ],
    };

    const TOKYO_2400M = mockCourse({
      id: 10606,
      terrain: 1,
      turn: 2,
      distance: 3,
      length: 2400,
      spurtStart: { meters: 1600 },
    });

    const zones = [
      { isRandom: false, regions: [{ start: 1000, end: 1600 }], earliestFire: 384 },
      { isRandom: false, regions: [{ start: 1875, end: 1885 }], earliestFire: 1000 },
    ];

    const result = evaluateSkillForTrack(pisaSkill, TOKYO_2400M, 3, 9, false, zones);

    expect(result.tier).toBe("S");
    expect(result.stars).toBe(5);
    expect(result.score).toBeGreaterThanOrEqual(95);
    expect(result.category).toBe("current_speed");
    expect(result.positionOverlap).toBeGreaterThanOrEqual(0.5);
    expect(result.specialEffects.some((e) => e.id === "rank_weak" || e.id === "rank_mismatch")).toBe(false);
    expect(result.specialEffects.some((e) => e.id === "multi_stage_synergy")).toBe(true);
  });

  it("applies phase-aware velocity (18 m/s early, 20.5 m/s mid, 26 m/s late) for durationMeters", () => {
    const TOKYO_2400M = mockCourse({
      id: 10606,
      length: 2400,
      spurtStart: { meters: 1600 },
    });

    // Late-race speed skill at 1800m
    const lateSpeedSkill = {
      id: 999901,
      conditionGroups: [
        {
          condition: "phase>=2",
          base_time: 30000, // 3s * 2.4 = 7.2s
          effects: [{ type: 27, value: 1500 }],
        },
      ],
    };
    const lateResult = evaluateSkillForTrack(lateSpeedSkill, TOKYO_2400M, 2, 9, false, [
      { isRandom: false, regions: [{ start: 1800, end: 2400 }], earliestFire: null },
    ]);
    // 7.2s * 26.0 m/s = 187.2m
    expect(lateResult.timingAnalysis.durationMeters).toBeCloseTo(187.2, 1);

    // Mid-race speed skill at 800m
    const midSpeedSkill = {
      id: 999902,
      conditionGroups: [
        {
          condition: "phase==1",
          base_time: 30000, // 7.2s
          effects: [{ type: 27, value: 1500 }],
        },
      ],
    };
    const midResult = evaluateSkillForTrack(midSpeedSkill, TOKYO_2400M, 2, 9, false, [
      { isRandom: false, regions: [{ start: 800, end: 1200 }], earliestFire: null },
    ]);
    // 7.2s * 20.5 m/s = 147.6m
    expect(midResult.timingAnalysis.durationMeters).toBeCloseTo(147.6, 1);
  });

  it("scales recovery skill impact based on course distance (Stamina Safety on long vs Low Demand on sprint)", () => {
    const healSkill = {
      id: 200492,
      conditionGroups: [
        {
          condition: "corner!=0",
          base_time: 0,
          effects: [{ type: 9, value: 150 }],
        },
      ],
    };

    const longCourse = mockCourse({ length: 2400, distance: 3, spurtStart: { meters: 1600 } });
    const longResult = evaluateSkillForTrack(healSkill, longCourse, 2, 9, false, [
      { isRandom: false, regions: [{ start: 1600, end: 2400 }], earliestFire: null },
    ]);
    expect(longResult.tier).toBe("S");
    expect(longResult.stars).toBe(5);
    expect(longResult.score).toBeGreaterThanOrEqual(88);
    expect(longResult.specialEffects.some((e) => e.badge === "Stamina Safety")).toBe(true);

    const sprintCourse = mockCourse({ length: 1200, distance: 1, spurtStart: { meters: 800 } });
    const sprintResult = evaluateSkillForTrack(healSkill, sprintCourse, 2, 9, false, [
      { isRandom: false, regions: [{ start: 800, end: 1200 }], earliestFire: null },
    ]);
    expect(sprintResult.tier).toBe("C");
    expect(sprintResult.stars).toBe(2);
    expect(sprintResult.score).toBe(60);
    expect(sprintResult.specialEffects.some((e) => e.badge === "Low Stamina Demand")).toBe(true);
  });

  it("applies style-aware phase weighting for Early Speed (Runner Tier S vs Betweener Tier C)", () => {
    const earlySpeedSkill = {
      id: 201101,
      conditionGroups: [
        {
          condition: "phase==0",
          base_time: 30000,
          effects: [{ type: 27, value: 1500 }],
        },
      ],
    };
    const course = mockCourse({ length: 2400, distance: 3, spurtStart: { meters: 1600 } });
    const zones = [{ isRandom: false, regions: [{ start: 100, end: 300 }], earliestFire: null }];

    // Runner (1)
    const runnerRes = evaluateSkillForTrack(earlySpeedSkill, course, 1, 9, false, zones);
    expect(runnerRes.category).toBe("early_speed");
    expect(runnerRes.tier).toBe("S");
    expect(runnerRes.stars).toBe(5);
    expect(runnerRes.score).toBe(90);

    // Betweener (3)
    const betweenerRes = evaluateSkillForTrack(earlySpeedSkill, course, 3, 9, false, zones);
    expect(betweenerRes.category).toBe("early_speed");
    expect(betweenerRes.tier).toBe("C");
    expect(betweenerRes.stars).toBe(2);
    expect(betweenerRes.score).toBe(65);
  });

  it("applies style-aware phase weighting for Late Speed (Betweener/Chaser Tier S vs Runner Tier B)", () => {
    const lateSpeedSkill = {
      id: 200362,
      conditionGroups: [
        {
          condition: "is_lastspurt==1",
          base_time: 30000,
          effects: [{ type: 27, value: 1500 }],
        },
      ],
    };
    const course = mockCourse({ length: 2400, distance: 3, spurtStart: { meters: 1600 } });
    const zones = [{ isRandom: false, regions: [{ start: 1875, end: 2400 }], earliestFire: null }];

    // Runner (1)
    const runnerRes = evaluateSkillForTrack(lateSpeedSkill, course, 1, 9, false, zones);
    expect(runnerRes.category).toBe("late_speed");
    expect(runnerRes.tier).toBe("B");
    expect(runnerRes.stars).toBe(3);
    expect(runnerRes.score).toBe(75);

    // Betweener (3)
    const betweenerRes = evaluateSkillForTrack(lateSpeedSkill, course, 3, 9, false, zones);
    expect(betweenerRes.category).toBe("late_speed");
    expect(betweenerRes.tier).toBe("S");
    expect(betweenerRes.stars).toBe(5);
    expect(runnerRes.score).toBeLessThan(betweenerRes.score);
    expect(betweenerRes.score).toBe(92);

    // Chaser (4)
    const chaserRes = evaluateSkillForTrack(lateSpeedSkill, course, 4, 9, false, zones);
    expect(chaserRes.category).toBe("late_speed");
    expect(chaserRes.tier).toBe("S");
    expect(chaserRes.score).toBe(95);
  });

  it("auto-detects style profile for style-gated skills when runningStyle is undefined", () => {
    const runnerGatedEarlySkill = {
      id: 200021,
      conditionGroups: [
        {
          condition: "running_style==1&phase==0",
          base_time: 30000,
          effects: [{ type: 27, value: 1500 }],
        },
      ],
    };
    const course = mockCourse({ length: 2400, distance: 3, spurtStart: { meters: 1600 } });
    const zones = [{ isRandom: false, regions: [{ start: 100, end: 300 }], earliestFire: null }];

    // Evaluated with runningStyle = undefined -> should auto-detect Runner profile
    const res = evaluateSkillForTrack(runnerGatedEarlySkill, course, undefined, 9, false, zones);
    expect(res.category).toBe("early_speed");
    expect(res.tier).toBe("S");
    expect(res.stars).toBe(5);
    expect(res.score).toBe(90);
  });

  it("flags Fires during Acceleration and High Stamina Demand badges on relevant late speed conditions", () => {
    const accelZoneSpeedSkill = {
      id: 201321,
      conditionGroups: [
        {
          condition: "phase==2",
          base_time: 30000,
          effects: [{ type: 27, value: 3500 }],
        },
      ],
    };
    // On 2400m track: spurt starts at 1600m, accel phase ends at 1730m.
    // Trigger at 1625m is inside the accel window.
    const course = mockCourse({ length: 2400, distance: 3, spurtStart: { meters: 1600 } });
    const zones = [{ isRandom: false, regions: [{ start: 1625, end: 1700 }], earliestFire: null }];

    const res = evaluateSkillForTrack(accelZoneSpeedSkill, course, 2, 9, false, zones);
    expect(res.category).toBe("late_speed");
    expect(res.specialEffects.some((e) => e.badge === "Fires during Acceleration")).toBe(true);
    expect(res.specialEffects.some((e) => e.badge === "High Stamina Demand")).toBe(true);
  });

  test("ParisLongchamp 2400m geometry: Straight accel at 1617m (+17m from spurt) classifies as Valid Fastest Accel", () => {
    const straightAccelSkill: SkillDetailInput = {
      id: 999101,
      nameEn: "Fausse Ligne Droite Accel",
      conditionGroups: [
        {
          condition: "is_last_straight==1",
          base_time: 9000,
          effects: [{ type: 31, value: 4000 }],
        },
      ],
    };
    // Longchamp 2400m: spurt at 1600m, Fausse Ligne Droite starts at 1617m (+17m)
    const longchampCourse = mockCourse({ length: 2400, distance: 3, spurtStart: { meters: 1600 } });
    const zones = [{ isRandom: false, regions: [{ start: 1617, end: 1867 }], earliestFire: null }];

    const res = evaluateSkillForTrack(straightAccelSkill, longchampCourse, 3, 9, false, zones);
    expect(res.category).toBe("fastest_accel");
    expect(res.tier).toBe("S");
    expect(res.score).toBeGreaterThanOrEqual(94);
    expect(res.specialEffects.some((e) => e.badge === "Optimal Accel")).toBe(true);
  });

  test("Tokyo 2400m geometry: Straight accel at 1875m (+275m from spurt) classifies as Dead Accel", () => {
    const straightAccelSkill: SkillDetailInput = {
      id: 999102,
      nameEn: "Tokyo Final Straight Accel",
      conditionGroups: [
        {
          condition: "is_last_straight==1",
          base_time: 9000,
          effects: [{ type: 31, value: 4000 }],
        },
      ],
    };
    // Tokyo 2400m: spurt at 1600m, final straight starts at 1875m (+275m)
    const tokyoCourse = mockCourse({ length: 2400, distance: 3, spurtStart: { meters: 1600 } });
    const zones = [{ isRandom: false, regions: [{ start: 1875, end: 2400 }], earliestFire: null }];

    const res = evaluateSkillForTrack(straightAccelSkill, tokyoCourse, 3, 9, false, zones);
    expect(res.category).toBe("dead_accel");
    expect(res.tier).toBe("F");
    expect(res.score).toBeLessThanOrEqual(15);
    expect(res.specialEffects.some((e) => e.badge === "Dead Accel")).toBe(true);
  });

  test("Heavy Turf Stamina Penalty triggers when courseLength >= 2400m and ground is Bad or Heavy", () => {
    const lateSpeedSkill: SkillDetailInput = {
      id: 999103,
      nameEn: "Longchamp Late Speed",
      conditionGroups: [
        {
          condition: "phase>=2",
          base_time: 30000,
          effects: [{ type: 27, value: 3500 }],
        },
      ],
    };
    const course = mockCourse({ length: 2400, distance: 3, spurtStart: { meters: 1600 } });
    const zones = [{ isRandom: false, regions: [{ start: 1800, end: 2400 }], earliestFire: null }];

    const res = evaluateSkillForTrack(lateSpeedSkill, course, 2, 9, false, zones, { groundCondition: "Bad" });
    expect(res.specialEffects.some((e) => e.badge === "Heavy Turf Stamina Penalty")).toBe(true);
  });
});
