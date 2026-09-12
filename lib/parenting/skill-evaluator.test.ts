import { describe, expect, test } from "bun:test";
import { evaluateUniqueSkill, runningStyleToNum } from "./skill-evaluator";
import type { Course } from "../skill-engine/types";

const kyoto2200Course: Course = {
  id: 10001,
  terrain: 1,
  turn: 1,
  distance: 3,
  inout: 2,
  length: 2200,
  spurtStart: { meters: 1467 },
  slopes: [],
  corners: [
    { start: 400, end: 650 },
    { start: 650, end: 900 },
    { start: 1300, end: 1750 },
    { start: 1750, end: 1900 },
  ],
  straights: [
    { start: 0, end: 400, frontType: 1 },
    { start: 900, end: 1300, frontType: 2 },
    { start: 1900, end: 2200, frontType: 3 },
  ],
};

describe("evaluateUniqueSkill — style/position mismatch filter", () => {
  // Almond Eye's unique: clean S with Runner, rank-trapped for Chaser
  // (its strict rank window never overlaps a Chaser's expected 5th–9th place).
  const ALMOND_EYE_UNIQUE = 101291;

  test("a unique whose rank window is unreachable under the trainee style is F (rank_invalid)", () => {
    const asRunner = evaluateUniqueSkill(ALMOND_EYE_UNIQUE, kyoto2200Course, 1);
    expect(asRunner.tier).toBe("S");
    expect(asRunner.category).toBe("current_speed");

    const asChaser = evaluateUniqueSkill(ALMOND_EYE_UNIQUE, kyoto2200Course, 4);
    expect(asChaser.tier).toBe("F");
    expect(asChaser.category).toBe("rank_invalid");
    expect(asChaser.badge).toBe("Rank Trap");
  });

  test("an explicitly style-gated unique cannot trigger under another style", () => {
    // Fortune Favors the Fast carries running_style==1: the zone engine gates
    // activation to Runner, so evaluating as Chaser yields an empty zone (F).
    const asChaser = evaluateUniqueSkill(200531, kyoto2200Course, 4);
    expect(asChaser.tier).toBe("F");
    expect(asChaser.category).toBe("invalid");
  });

  test("course-geometry dead accel still filters independently of style", () => {
    const asRunner = evaluateUniqueSkill(200531, kyoto2200Course, 1);
    expect(asRunner.tier).toBe("F");
    expect(asRunner.category).toBe("dead_accel");
  });

  test("unknown target style evaluates best-of-4 and does not style-filter", () => {
    // Previously the evaluator silently defaulted to Runner and F-filtered
    // every non-Runner unique; now the best result across strategies wins.
    const unknown = evaluateUniqueSkill(ALMOND_EYE_UNIQUE, kyoto2200Course, null);
    expect(unknown.tier).toBe("S");
    expect(unknown.category).toBe("current_speed");

    const asRunner = evaluateUniqueSkill(ALMOND_EYE_UNIQUE, kyoto2200Course, 1);
    expect(unknown.tier).toBe(asRunner.tier);
  });
});

describe("runningStyleToNum", () => {
  test("normalizes numbers, strings, and passes unknown values through as undefined", () => {
    expect(runningStyleToNum(3)).toBe(3);
    expect(runningStyleToNum("betweener")).toBe(3);
    expect(runningStyleToNum("oikomi")).toBe(4);
    expect(runningStyleToNum(null)).toBe(undefined);
    expect(runningStyleToNum(undefined)).toBe(undefined);
  });
});
