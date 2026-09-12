import { describe, expect, test } from "bun:test";
import {
  getCharaIdFromCardId,
  getRelationTypesForChara,
  sumSharedRelationPoints,
  countSharedG1Wins,
  calculateAffinity,
  calculatePairAffinity,
  calculateLineageAffinity,
  getCompatibilityRating,
} from "./affinity-engine";

describe("Affinity Engine", () => {
  test("getCharaIdFromCardId parses 6-digit card IDs", () => {
    expect(getCharaIdFromCardId(100101)).toBe(1001);
    expect(getCharaIdFromCardId(100201)).toBe(1002);
    expect(getCharaIdFromCardId(102701)).toBe(1027);
  });

  test("getRelationTypesForChara retrieves non-empty relation sets for known characters", () => {
    const specialWeekRel = getRelationTypesForChara(1001);
    const silenceSuzukaRel = getRelationTypesForChara(1002);

    expect(specialWeekRel.size).toBeGreaterThan(0);
    expect(silenceSuzukaRel.size).toBeGreaterThan(0);

    const shared = sumSharedRelationPoints(specialWeekRel, silenceSuzukaRel);
    expect(shared).toBeGreaterThan(0);
  });

  test("countSharedG1Wins accurately filters G1 races and counts intersection", () => {
    // 10 is Arima Kinen (G1), 11 is Japan Cup (G1), 999 is non-G1 dummy
    const winsA = [10, 11, 12, 999];
    const winsB = [10, 12, 13, 999];

    // Saddle 10 and 12 are G1s. 999 is not in g1Saddles.
    const sharedCount = countSharedG1Wins(winsA, winsB);
    expect(sharedCount).toBe(2);
  });

  test("calculatePairAffinity computes base relation points and G1 bonuses", () => {
    const p1 = { card_id: 100101, win_saddle_id_array: [10, 11] };
    const p2 = { card_id: 100201, win_saddle_id_array: [10, 12] };

    const pair = calculatePairAffinity(p1, p2);
    expect(pair.base).toBeGreaterThan(0);
    expect(pair.sharedG1Count).toBe(1); // saddle 10 shared
    expect(pair.raceBonus).toBe(3); // 1 * 3
    expect(pair.total).toBe(pair.base + 3);
  });

  test("calculateAffinity zeroes out duplicate grandparent identical to target trainee", () => {
    const targetCharaId = 1001; // Special Week

    // Veteran with GP1 as Special Week (1001) and GP2 as Silence Suzuka (1002)
    const veteran = {
      card_id: 100301, // Tokai Teio
      win_saddle_id_array: [10],
      succession_chara_array: [
        { position_id: 10, card_id: 100101, win_saddle_id_array: [10] }, // Matching target trainee
        { position_id: 20, card_id: 100201, win_saddle_id_array: [10] },
      ],
    };

    const res = calculateAffinity(veteran, targetCharaId);
    expect(res.gp1Points).toBe(0); // GP1 matches target, must be 0
    expect(res.parentPoints).toBeGreaterThan(0);
    expect(res.total).toBeGreaterThan(0);
  });

  test("getCompatibilityRating correctly classifies ◎, ◯, △ thresholds", () => {
    expect(getCompatibilityRating(160).rating).toBe("double_circle");
    expect(getCompatibilityRating(151).rating).toBe("double_circle");
    expect(getCompatibilityRating(150).rating).toBe("circle");
    expect(getCompatibilityRating(51).rating).toBe("circle");
    expect(getCompatibilityRating(50).rating).toBe("triangle");
    expect(getCompatibilityRating(10).rating).toBe("triangle");
  });
});
