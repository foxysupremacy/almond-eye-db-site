import { describe, expect, it } from "bun:test";
import { evaluateSkillForTrack } from "./evaluator";
import type { Course } from "../skill-engine/types";

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
});
