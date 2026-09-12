import { describe, expect, test } from "bun:test";
import {
  getSlotRecommendations,
  candidateToVeteran,
  isAptitudeExcluded,
} from "./compatibility";
import { getCareerG1Saddles, getCareerMustWinSaddles } from "./career-engine";
import { calculateAffinity, calculatePairAffinity } from "../affinity-engine";
import { getDeckAnalysis } from "./deck-analyzer";
import type { Course } from "../skill-engine/types";
import type { KyumaruVeteranItem } from "../kyumaru-types";
import rawCharactersData from "../data/characters.json";
import type { CharacterIndexEntry } from "../api";

const characters = rawCharactersData as CharacterIndexEntry[];
const charByCharId = new Map<number, CharacterIndexEntry>(characters.map((c) => [c.charId, c]));

const kyoto2200Course: Course = {
  id: 10001,
  trackId: 10008, // Kyoto
  terrain: 1,
  turn: 1,
  distance: 3, // medium
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

const TARGET_CHARA_ID = 1024; // Mayano Top Gun

const seiunSkyVeteran: KyumaruVeteranItem = {
  card_id: 102001, // Seiun Sky
  trained_chara_id: 10200101,
  name: "Seiun Sky",
  rank: 10,
  rarity: 3,
  speed: 1200,
  stamina: 800,
  power: 1000,
  guts: 600,
  wiz: 800,
  rank_score: 18000,
  win_saddle_id_array: [10, 11, 12],
  factor_info_array: [
    { factor_id: 103 }, // 3-star Speed (blue factor range 101..503)
  ],
  succession_chara_array: [],
};

const seiunSkySecondRun: KyumaruVeteranItem = {
  ...seiunSkyVeteran,
  trained_chara_id: 10200102,
  rank_score: 15000,
  win_saddle_id_array: [10],
};

describe("getSlotRecommendations — parent slots", () => {
  test("returns empty pools without a target trainee", () => {
    const res = getSlotRecommendations({ targetCharaId: null, veterans: [seiunSkyVeteran] });
    expect(res.owned).toHaveLength(0);
    expect(res.borrow).toHaveLength(0);
  });

  test("splits pools: veterans + untrained picks into owned, character templates into borrow", () => {
    const res = getSlotRecommendations({ targetCharaId: TARGET_CHARA_ID, veterans: [seiunSkyVeteran] });

    expect(res.owned.length).toBeGreaterThan(0);
    expect(res.borrow.length).toBeGreaterThan(0);
    for (const c of res.owned) {
      // Owned = imported veterans plus untrained roster picks, never borrow stubs
      expect(c.isUntrained ? c.isVeteran === false : c.isVeteran === true).toBe(true);
    }
    for (const c of res.borrow) expect(c.isVeteran).toBe(false);
    // A character with a veteran must not also appear as a borrow template
    expect(res.borrow.some((c) => c.charId === 1020)).toBe(false);
    // Untrained picks surface under "Your Umas" for every slot
    expect(res.owned.some((c) => c.isUntrained && (c.careerG1Count ?? 0) >= 0)).toBe(true);
  });

  test("ranks parent candidates by affinity with the trainee, excluding the trainee", () => {
    const res = getSlotRecommendations({ targetCharaId: TARGET_CHARA_ID });
    const all = [...res.owned, ...res.borrow];

    expect(all.length).toBeGreaterThan(0);
    expect(all.some((c) => c.charId === TARGET_CHARA_ID)).toBe(false);
    for (let i = 1; i < res.borrow.length; i++) {
      expect(res.borrow[i - 1].totalScore).toBeGreaterThanOrEqual(res.borrow[i].totalScore);
    }
  });

  test("veteran candidate carries full affinity score and factor metadata", () => {
    const res = getSlotRecommendations({ targetCharaId: TARGET_CHARA_ID, veterans: [seiunSkyVeteran] });
    const seiun = res.owned.find((c) => c.charId === 1020);
    expect(seiun).toBeDefined();
    expect(seiun!.runCount).toBe(1);
    expect(seiun!.blueStarsTotal).toBe(3);
    expect(seiun!.selfBlueFactor?.name).toBe("Speed");
    expect(seiun!.affinityScore).toBe(calculateAffinity(seiunSkyVeteran, TARGET_CHARA_ID).total);
  });

  test("deduplicates multiple runs of one character, keeping the best run primary", () => {
    const res = getSlotRecommendations({
      targetCharaId: TARGET_CHARA_ID,
      veterans: [seiunSkySecondRun, seiunSkyVeteran],
    });
    const seiun = res.owned.find((c) => c.charId === 1020);
    expect(seiun).toBeDefined();
    expect(seiun!.runCount).toBe(2);
    expect(seiun!.veteran?.trained_chara_id).toBe(10200101); // higher blue-star run wins
  });

  test("applies the unique-skill F-tier filter when a course is set, and no filter otherwise", () => {
    const filtered = getSlotRecommendations({
      targetCharaId: TARGET_CHARA_ID,
      course: kyoto2200Course,
      runningStyle: 1,
    });
    const unfiltered = getSlotRecommendations({ targetCharaId: TARGET_CHARA_ID });

    expect(
      unfiltered.owned.length + unfiltered.borrow.length
    ).toBeGreaterThanOrEqual(filtered.owned.length + filtered.borrow.length);

    for (const c of [...filtered.owned, ...filtered.borrow]) {
      expect(c.uniqueEval).toBeDefined();
      expect(c.uniqueEval!.tier).not.toBe("F");
      expect(c.uniqueEval!.category).not.toBe("dead_accel");
      expect(c.uniqueEval!.category).not.toBe("invalid");
    }
  });

  test("excludes characters with an equipped parent-deck support card", () => {
    const deckCharIds = getDeckAnalysis([30314]).equippedDeckCharIds; // Haru Urara SSR support card
    expect(deckCharIds.size).toBeGreaterThan(0);

    const res = getSlotRecommendations({
      targetCharaId: TARGET_CHARA_ID,
      supportCardIds: [30314],
    });
    for (const c of [...res.owned, ...res.borrow]) {
      expect(deckCharIds.has(c.charId)).toBe(false);
    }
  });

  test("respects excludedCharIds and limit", () => {
    const res = getSlotRecommendations({ targetCharaId: TARGET_CHARA_ID });
    const topBorrow = res.borrow[0];

    const withoutTop = getSlotRecommendations({
      targetCharaId: TARGET_CHARA_ID,
      excludedCharIds: [topBorrow.charId],
    });
    expect(withoutTop.borrow.some((c) => c.charId === topBorrow.charId)).toBe(false);

    const limited = getSlotRecommendations({ targetCharaId: TARGET_CHARA_ID, limit: 5 });
    expect(limited.borrow.length).toBeLessThanOrEqual(5);
    expect(limited.owned.length).toBeLessThanOrEqual(5);
  });
});

describe("getSlotRecommendations — grandparent slots (with branch parent)", () => {
  test("excludes the branch parent and scores candidates as trainee + branch-parent affinity", () => {
    const res = getSlotRecommendations({
      targetCharaId: TARGET_CHARA_ID,
      branchParent: seiunSkyVeteran,
      course: kyoto2200Course,
      runningStyle: 1,
    });
    const all = [...res.owned, ...res.borrow];

    expect(all.length).toBeGreaterThan(0);
    expect(all.some((c) => c.charId === 1020)).toBe(false); // branch parent excluded
    expect(all.some((c) => c.charId === TARGET_CHARA_ID)).toBe(false);

    for (let i = 1; i < res.borrow.length; i++) {
      expect(res.borrow[i - 1].totalScore).toBeGreaterThanOrEqual(res.borrow[i].totalScore);
    }

    const top = res.borrow[0];
    // Borrow templates score as potential veterans with their must-win career G1s
    const potential = {
      card_id: top.cardId,
      win_saddle_id_array: getCareerMustWinSaddles(top.charId),
    };
    const expected =
      calculateAffinity(potential, TARGET_CHARA_ID).total +
      calculatePairAffinity(potential, seiunSkyVeteran).total;
    expect(top.totalScore).toBe(expected);
    expect(top.pairScore).toBeGreaterThan(0);
  });

  test("veteran candidates include shared G1 wins with the branch parent in the pair score", () => {
    const specialWeekVet: KyumaruVeteranItem = {
      card_id: 100101, // Special Week
      trained_chara_id: 10010101,
      name: "Special Week",
      rank: 10,
      rarity: 3,
      speed: 1100,
      stamina: 800,
      power: 900,
      guts: 600,
      wiz: 700,
      rank_score: 16000,
      win_saddle_id_array: [10, 12], // G1 saddle IDs
      factor_info_array: [],
      succession_chara_array: [],
    };

    const sharedG1Vet: KyumaruVeteranItem = {
      card_id: 100201, // Silence Suzuka
      trained_chara_id: 10020101,
      name: "Silence Suzuka",
      rank: 10,
      rarity: 3,
      speed: 1150,
      stamina: 700,
      power: 950,
      guts: 550,
      wiz: 750,
      rank_score: 15500,
      win_saddle_id_array: [10, 11],
      factor_info_array: [],
      succession_chara_array: [],
    };

    const res = getSlotRecommendations({
      targetCharaId: TARGET_CHARA_ID,
      branchParent: specialWeekVet,
      veterans: [sharedG1Vet],
      limit: 500,
    });
    const suzuka = res.owned.find((c) => c.charId === 1002);
    expect(suzuka).toBeDefined();
    expect(suzuka!.pairScore).toBe(calculatePairAffinity(sharedG1Vet, specialWeekVet).total);
    expect(suzuka!.reasons.join(" ")).toContain("Shared G1");
  });
});

describe("candidateToVeteran", () => {
  test("passes through veterans and synthesizes a stub for templates", () => {
    const res = getSlotRecommendations({
      targetCharaId: TARGET_CHARA_ID,
      veterans: [seiunSkyVeteran],
    });
    const vetCandidate = res.owned.find((c) => c.charId === 1020)!;
    const templateCandidate = res.borrow[0];

    expect(candidateToVeteran(vetCandidate).card_id).toBe(seiunSkyVeteran.card_id);

    // Friend-borrow stubs carry the must-win career G1s (a borrowed Uma has those wins)
    const stub = candidateToVeteran(templateCandidate);
    expect(stub.card_id).toBe(templateCandidate.cardId);
    expect(stub.win_saddle_id_array).toEqual(getCareerMustWinSaddles(templateCandidate.charId));
  });

  test("untrained picks carry their full career G1 saddle set", () => {
    const res = getSlotRecommendations({ targetCharaId: TARGET_CHARA_ID, limit: 500 });
    const untrained = res.owned.find((c) => c.isUntrained && (c.careerG1Count ?? 0) > 0)!;

    const stub = candidateToVeteran(untrained);
    expect(stub.win_saddle_id_array).toEqual(getCareerG1Saddles(untrained.charId));
    expect(stub.win_saddle_id_array!.length).toBe(untrained.careerG1Count);
  });
});

describe("untrained picks — career schedule scoring", () => {
  test("scores untrained candidates as potential veterans (career G1 wins count)", () => {
    const res = getSlotRecommendations({ targetCharaId: TARGET_CHARA_ID, limit: 500 });
    // Special Week (1001): career G1s incl. Arima Kinen; has relation data with the target
    const specialWeek = res.owned.find((c) => c.charId === 1001 && c.isUntrained);
    expect(specialWeek).toBeDefined();

    const potential = {
      card_id: specialWeek!.cardId,
      win_saddle_id_array: getCareerG1Saddles(1001),
    };
    expect(specialWeek!.affinityScore).toBe(calculateAffinity(potential, TARGET_CHARA_ID).total);
    expect(specialWeek!.totalScore).toBe(specialWeek!.affinityScore);
  });

  test("a career G1 shared with the branch parent boosts the pair score", () => {
    // Seiun Sky's wins include saddle 10 (Arima Kinen); Special Week's career ends there too.
    const res = getSlotRecommendations({
      targetCharaId: TARGET_CHARA_ID,
      branchParent: seiunSkyVeteran,
      limit: 500,
    });
    const specialWeek = res.owned.find((c) => c.charId === 1001 && c.isUntrained);
    expect(specialWeek).toBeDefined();
    expect(specialWeek!.pairScore).toBe(
      calculatePairAffinity(
        { card_id: specialWeek!.cardId, win_saddle_id_array: getCareerG1Saddles(1001) },
        seiunSkyVeteran
      ).total
    );
    expect(specialWeek!.reasons.join(" ")).toContain("Shared G1s w/ Branch");
  });

  test("surface career/track fit in the reasons", () => {
    const res = getSlotRecommendations({
      targetCharaId: TARGET_CHARA_ID,
      course: kyoto2200Course, // Kyoto 2200m — Takarazuka Kinen territory
      runningStyle: 2,
      limit: 500,
    });
    // Characters whose career includes a Kyoto-medium G1 (e.g. Takarazuka Kinen)
    // surface a concrete "Career G1: <race>" reason
    const withFit = res.owned.filter((c) =>
      c.reasons.some((r) => r.startsWith("Career G1:"))
    );
    expect(withFit.length).toBeGreaterThan(0);
    expect(withFit.every((c) => c.isUntrained)).toBe(true);
  });

  test("aptitude gate drops untrained picks that cannot win the selected course", () => {
    // Aston Machan (1087): Medium aptitude G — unpatchable, cannot win Kyoto 2200
    const machan = charByCharId.get(1087)!;
    expect(machan.aptitude[4]).toBe("G");
    expect(isAptitudeExcluded(machan, kyoto2200Course, 1)).toBe(true);
    // No course selected → no gate
    expect(isAptitudeExcluded(machan, null, 1)).toBe(false);

    const filtered = getSlotRecommendations({
      targetCharaId: TARGET_CHARA_ID,
      course: kyoto2200Course,
      runningStyle: 1,
      limit: 500,
    });
    expect(filtered.owned.some((c) => c.charId === 1087)).toBe(false);

    // Without a course the same character is recommendable again
    const unfiltered = getSlotRecommendations({ targetCharaId: TARGET_CHARA_ID, limit: 500 });
    expect(unfiltered.owned.some((c) => c.charId === 1087)).toBe(true);
  });

  test("style aptitude gate drops untrained picks unable to run the selected style", () => {
    // Admire Groove (1118): Front (Runner) aptitude G
    const groove = charByCharId.get(1118)!;
    expect(groove.aptitude[6]).toBe("G");
    expect(isAptitudeExcluded(groove, kyoto2200Course, 1)).toBe(true);
    expect(isAptitudeExcluded(groove, kyoto2200Course, 4)).toBe(false);

    const filtered = getSlotRecommendations({
      targetCharaId: TARGET_CHARA_ID,
      course: kyoto2200Course,
      runningStyle: 1,
      limit: 500,
    });
    expect(filtered.owned.some((c) => c.charId === 1118)).toBe(false);
  });
});
