import { describe, it, expect } from "bun:test";
import {
  isSkillMatchingFilter,
  recommendCardsForParent,
  doesSkillFireOnCourse,
  cardMetaMap,
  skillMetaMap,
} from "./recommendation-engine";
import type { Course } from "./skill-engine/types";

describe("recommendation-engine", () => {
  it("correctly filters skills by running style", () => {
    // 200531: Fortune Favors the Fast (Runner skill) -> styles: [1]
    const runnerCheck = isSkillMatchingFilter(200531, 1, null, null);
    expect(runnerCheck.matches).toBe(true);
    expect(runnerCheck.isSpecialized).toBe(true);

    const leaderCheck = isSkillMatchingFilter(200531, 2, null, null);
    expect(leaderCheck.matches).toBe(false);

    // Runaway (5) should inherit Runner (1) skills
    const runawayCheck = isSkillMatchingFilter(200531, 5, null, null);
    expect(runawayCheck.matches).toBe(true);
  });

  it("correctly filters skills by distance and surface", () => {
    // 200681: Ruler of Mile -> distances: [2]
    const mileCheck = isSkillMatchingFilter(200681, null, 2, null);
    expect(mileCheck.matches).toBe(true);
    expect(mileCheck.isSpecialized).toBe(true);

    const mediumCheck = isSkillMatchingFilter(200681, null, 3, null);
    expect(mediumCheck.matches).toBe(false);
  });

  it("recommends cards and excludes skills already in main deck", () => {
    // Empty main deck: cards should be recommended
    const recsNoMain = recommendCardsForParent({
      mainDeckSkillIds: new Set(),
      style: 1, // Runner
      distance: 2, // Mile
      surface: 1, // Turf
      limit: 5,
    });
    expect(recsNoMain.length).toBeGreaterThan(0);
    const topCard = recsNoMain[0];
    expect(topCard.totalNewCount).toBeGreaterThan(0);

    // If main deck already has all skills from topCard
    const mainDeckSkills = new Set(topCard.newMatchingSkills.map((s) => s.id));
    const recsWithMain = recommendCardsForParent({
      mainDeckSkillIds: mainDeckSkills,
      style: 1,
      distance: 2,
      surface: 1,
      limit: 5,
    });

    // Top card should have fewer or 0 new matching skills now
    const topCardAfter = recsWithMain.find((r) => r.cardId === topCard.cardId);
    if (topCardAfter) {
      expect(topCardAfter.totalNewCount).toBeLessThan(topCard.totalNewCount);
    }
  });

  it("skips cards that are already equipped in the parent deck", () => {
    const recs = recommendCardsForParent({
      mainDeckSkillIds: new Set(),
      equippedParentCardIds: [],
      limit: 5,
    });
    const firstCardId = recs[0].cardId;

    const recsAfterEquipping = recommendCardsForParent({
      mainDeckSkillIds: new Set(),
      equippedParentCardIds: [firstCardId],
      limit: 5,
    });

    expect(recsAfterEquipping.some((r) => r.cardId === firstCardId)).toBe(false);
  });

  it("boosts skills that activate on specific course geometry", () => {
    const tokyoCourse = {
      id: 10606,
      trackId: 10006,
      distance: 3 as const,
      terrain: 1 as const,
      turn: 2 as const,
      length: 2400,
      inout: 0,
      corners: [{ start: 400, end: 700 }, { start: 1600, end: 1900 }],
      straights: [{ start: 0, end: 400, frontType: 1 }, { start: 1900, end: 2400, frontType: 2 }],
      slopes: [],
    };

    const recs = recommendCardsForParent({
      mainDeckSkillIds: new Set(),
      course: tokyoCourse as any,
      style: 2, // Leader
      limit: 5,
    });

    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].score).toBeGreaterThan(0);
  });

  it("maps Gold event skills to White skills in parent recommendations", () => {
    // 30153 ([Gentle Moon]) has event Summer Gale (200184), which maps to Summer Girl ◎ (200181)
    const recs = recommendCardsForParent({
      mainDeckSkillIds: new Set(),
      limit: 600,
    });

    const card = recs.find((r) => r.cardId === 30153);
    expect(Boolean(card)).toBe(true);
    // Should NOT contain Summer Gale (200184) directly
    expect(card!.newMatchingSkills.some((s) => s.id === 200184)).toBe(false);

    // Should contain the mapped white skill with originalGoldName (Hachimi: Verdant Wind)
    const mapped = card!.newMatchingSkills.find((s) => s.id === 200181);
    expect(Boolean(mapped)).toBe(true);
    expect(mapped!.originalGoldName).toBe("Verdant Wind");
    expect(mapped!.rarity).toBe(1);

    // All skills recommended for parent should be White skills (rarity === 1)
    const allWhite = card!.newMatchingSkills.every((s) => s.rarity === 1);
    expect(allWhite).toBe(true);
  });

  it("correctly excludes mapped Gold skills when Main Deck already has the White skill", () => {
    // 200181 = Summer Girl ◎ (mapped from Summer Gale)
    const recsWithSummerInMain = recommendCardsForParent({
      mainDeckSkillIds: new Set([200181]),
      limit: 600,
    });

    const card = recsWithSummerInMain.find((r) => r.cardId === 30153);
    expect(Boolean(card)).toBe(true);
    expect(card!.newMatchingSkills.some((s) => s.id === 200181)).toBe(false);
    expect(card!.newMatchingSkills.some((s) => s.id === 200184)).toBe(false);
  });

  it("attaches event metadata to skills for Almond Eye (card 30308)", () => {
    const recs = recommendCardsForParent({
      mainDeckSkillIds: new Set(),
      limit: 600,
    });

    const almondEye = recs.find((r) => r.cardId === 30308);
    expect(Boolean(almondEye)).toBe(true);

    // Event 1311 has Choice 2 (200021, Left Turns ◎) which is new
    const event1311Skills = almondEye!.newMatchingSkills.filter(
      (s) => s.eventMeta?.eventId === 1311,
    );
    expect(event1311Skills.length).toBeGreaterThan(0);

    const match = event1311Skills[0];
    expect(Boolean(match.eventMeta)).toBe(true);
    expect(match.eventMeta!.eventNameJp).toBe("鳴り響け！エモーション");
    expect(match.eventMeta!.totalChoices).toBe(2);
    expect(match.eventMeta!.choiceIndex).toBe(2);
    expect(match.eventMeta!.choiceTextJp).toBe("キンキンに冷えたタオルハンカチ");
    expect(match.isRecommendedChoice).toBe(true);

    expect(almondEye!.totalNewCount).toBe(almondEye!.newHintCount + almondEye!.newEventCount);
  });

  it("resolves mutually exclusive event choices and prevents score inflation", () => {
    // Inject a test card with a 2-choice event where both choices have matching skills
    // 200531: Fortune Favors the Fast (Runner skill) -> score ~ 2.0 (specialized)
    // 200681: Ruler of Mile (Mile skill) -> score ~ 0.5 (generic when distance is null)
    const testCardId = 99999;
    cardMetaMap[testCardId] = {
      hints: [],
      events: [200531, 200681],
      nameEn: "Test Card Branching",
      nameJp: "テストカード",
      rarity: 3,
      type: "speed",
      urlName: "99999-test-card",
      eventDetails: [
        {
          eventId: 8888,
          nameEn: "Crossroads of Destiny",
          nameJp: "運命の分岐路",
          choices: [
            {
              index: 1,
              textEn: "Focus on Runner strategy",
              textJp: "逃げ作戦を磨く",
              skillIds: [200531],
            },
            {
              index: 2,
              textEn: "Focus on Mile racing",
              textJp: "マイル戦を磨く",
              skillIds: [200681],
            },
          ],
        },
      ],
    };

    try {
      const recs = recommendCardsForParent({
        mainDeckSkillIds: new Set(),
        style: 1, // Runner (makes 200531 specialized with score 2, 200681 generic with score 0.5)
        limit: 600,
      });

      const testCard = recs.find((r) => r.cardId === testCardId);
      expect(Boolean(testCard)).toBe(true);

      // Both candidate skills should be present for user inspection
      expect(testCard!.newMatchingSkills.length).toBe(2);

      // Both skills should be marked with choiceConflict: true (mapped white IDs: 200532 & 200682)
      const s1 = testCard!.newMatchingSkills.find((s) => s.id === 200532)!;
      const s2 = testCard!.newMatchingSkills.find((s) => s.id === 200682)!;
      expect(Boolean(s1)).toBe(true);
      expect(Boolean(s2)).toBe(true);
      expect(s1.choiceConflict).toBe(true);
      expect(s2.choiceConflict).toBe(true);

      // Higher-scoring branch (Choice 1) is marked as recommended
      expect(s1.isRecommendedChoice).toBe(true);
      // Lower-scoring branch (Choice 2) is marked as alternative
      expect(s2.isRecommendedChoice).toBe(false);

      // Card score must equal the BEST choice score (2.0), NOT the sum of both (2.5)!
      expect(testCard!.score).toBe(2.0);

      // Realistic event count is 1 (only the single choice obtainable in a run)
      expect(testCard!.newEventCount).toBe(1);
      expect(testCard!.totalNewCount).toBe(1);
    } finally {
      delete cardMetaMap[testCardId];
    }
  });

  it("boosts or demotes skills based on raceParams (pvp conditions)", () => {
    const testSkillId = 999999;
    const testCardId = 999999;
    (skillMetaMap as any)[testSkillId] = {
      nameEn: "Autumn Specialist",
      nameJp: "秋ウマ娘",
      rarity: 1,
      styles: [],
      distances: [],
      surfaces: [],
      isGeneric: true,
      conditions: [{ condition: "season==3" }],
    };
    (cardMetaMap as any)[testCardId] = {
      nameEn: "Test Autumn Card",
      nameJp: "テストカード",
      rarity: 3,
      type: "speed",
      hints: [testSkillId],
      events: [],
    };

    const course: Course = {
      id: 10001,
      terrain: 1,
      turn: 1,
      distance: 3,
      inout: 0,
      length: 2000,
      corners: [],
      slopes: [],
      straights: [],
    };

    try {
      // 1. Without raceParams (unset), passes through -> firesOnCourse is true
      expect(doesSkillFireOnCourse(testSkillId, course, null)).toBe(true);

      // 2. With matching raceParams (season: 3 = Autumn) -> firesOnCourse is true
      expect(doesSkillFireOnCourse(testSkillId, course, null, { season: 3 })).toBe(true);

      // 3. With non-matching raceParams (season: 1 = Spring) -> firesOnCourse is false
      expect(doesSkillFireOnCourse(testSkillId, course, null, { season: 1 })).toBe(false);

      // 4. In recommendCardsForParent, matching season gives bonus (score higher) than non-matching
      const recsAutumn = recommendCardsForParent({
        mainDeckSkillIds: new Set(),
        course,
        raceParams: { season: 3 },
        limit: 1000,
      });
      const autumnCard = recsAutumn.find((r) => r.cardId === testCardId);
      expect(Boolean(autumnCard)).toBe(true);
      expect(autumnCard?.newMatchingSkills[0].firesOnCourse).toBe(true);

      const recsSpring = recommendCardsForParent({
        mainDeckSkillIds: new Set(),
        course,
        raceParams: { season: 1 },
        limit: 1000,
      });
      const springCard = recsSpring.find((r) => r.cardId === testCardId);
      expect(Boolean(springCard)).toBe(true);
      expect(springCard?.newMatchingSkills[0].firesOnCourse).toBe(false);
      expect((autumnCard?.score ?? 0) > (springCard?.score ?? 0)).toBe(true);
    } finally {
      delete (skillMetaMap as any)[testSkillId];
      delete (cardMetaMap as any)[testCardId];
    }
  });

  it("prioritizes Valid Fastest Accel skills over Dead Accel skills", () => {
    const fastestAccelSkillId = 888001;
    const deadAccelSkillId = 888002;
    const cardFastestId = 888101;
    const cardDeadId = 888102;

    const KYOTO_2200M: Course = {
      id: 10808,
      terrain: 1,
      turn: 1,
      distance: 3,
      inout: 3,
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

    // Fastest Accel: late-race corner (1467m is inside corner 3 [1300-1550], so fires immediately at 1467m)
    (skillMetaMap as any)[fastestAccelSkillId] = {
      nameEn: "Angling Test",
      nameJp: "アングリングテスト",
      rarity: 1,
      styles: [1],
      distances: [3],
      surfaces: [1],
      isGeneric: false,
      conditions: [{ condition: "phase>=2&corner!=0&order==1", base_time: 24000, effects: [{ type: 31, value: 2000 }] }],
    };

    // Dead Accel: final straight (1797m-2200m, +330m after spurtStart 1467m)
    (skillMetaMap as any)[deadAccelSkillId] = {
      nameEn: "Dead Accel Test",
      nameJp: "無効加速テスト",
      rarity: 1,
      styles: [1],
      distances: [3],
      surfaces: [1],
      isGeneric: false,
      conditions: [{ condition: "is_last_straight==1", base_time: 24000, effects: [{ type: 31, value: 2000 }] }],
    };

    (cardMetaMap as any)[cardFastestId] = {
      nameEn: "Fastest Accel Parent Card",
      nameJp: "最速加速親カード",
      rarity: 3,
      type: "speed",
      hints: [fastestAccelSkillId],
      events: [],
    };

    (cardMetaMap as any)[cardDeadId] = {
      nameEn: "Dead Accel Parent Card",
      nameJp: "無効加速親カード",
      rarity: 3,
      type: "speed",
      hints: [deadAccelSkillId],
      events: [],
    };

    try {
      const recs = recommendCardsForParent({
        mainDeckSkillIds: new Set(),
        course: KYOTO_2200M,
        style: 1, // Runner
        limit: 1000,
      });

      const cardFastest = recs.find((r) => r.cardId === cardFastestId);
      const cardDead = recs.find((r) => r.cardId === cardDeadId);

      expect(Boolean(cardFastest)).toBe(true);
      expect(Boolean(cardDead)).toBe(true);

      // Card with fastest accel must score dramatically higher than card with dead accel
      expect(cardFastest!.score).toBeGreaterThan(cardDead!.score);

      // Verify tactical metadata is attached
      const fastestSkill = cardFastest!.newMatchingSkills.find((s) => s.id === fastestAccelSkillId);
      expect(Boolean(fastestSkill)).toBe(true);
      expect(fastestSkill!.tacticalCategory).toBe("fastest_accel");
      expect(fastestSkill!.evalTier).toBe("S");
      expect(fastestSkill!.evalStars).toBe(5);

      const deadSkill = cardDead!.newMatchingSkills.find((s) => s.id === deadAccelSkillId);
      expect(Boolean(deadSkill)).toBe(true);
      expect(deadSkill!.tacticalCategory).toBe("dead_accel");
      expect(deadSkill!.evalTier).toBe("F");
    } finally {
      delete (skillMetaMap as any)[fastestAccelSkillId];
      delete (skillMetaMap as any)[deadAccelSkillId];
      delete (cardMetaMap as any)[cardFastestId];
      delete (cardMetaMap as any)[cardDeadId];
    }
  });

  it("penalizes cards with running style traps", () => {
    const betweenerOnlySkillId = 888003;
    const testCardId = 888103;

    (skillMetaMap as any)[betweenerOnlySkillId] = {
      nameEn: "Betweener Secret",
      nameJp: "差し秘術",
      rarity: 1,
      styles: [], // Unfiltered in meta styles to simulate a skill that condition-requires Betweener (3)
      distances: [],
      surfaces: [],
      isGeneric: true,
      conditions: [{ condition: "phase>=1&running_style==3" }],
    };

    (cardMetaMap as any)[testCardId] = {
      nameEn: "Trap Parent Card",
      nameJp: "罠親カード",
      rarity: 3,
      type: "speed",
      hints: [betweenerOnlySkillId],
      events: [],
    };

    const course: Course = {
      id: 10001,
      terrain: 1,
      turn: 1,
      distance: 3,
      inout: 0,
      length: 2000,
      corners: [],
      slopes: [],
      straights: [],
    };

    try {
      // Evaluating for Runner (1) with Betweener requirement should trigger style trap penalty (-12)
      const recs = recommendCardsForParent({
        mainDeckSkillIds: new Set(),
        course,
        style: 1, // Runner
        limit: 1000,
      });

      const trapCard = recs.find((r) => r.cardId === testCardId);
      expect(Boolean(trapCard)).toBe(true);
      // Score should be heavily penalized (negative score)
      expect(trapCard!.score).toBeLessThan(0);
    } finally {
      delete (skillMetaMap as any)[betweenerOnlySkillId];
      delete (cardMetaMap as any)[testCardId];
    }
  });

  it("returns up to 16 cards when requested for the View More option", () => {
    const recs = recommendCardsForParent({
      mainDeckSkillIds: new Set(),
      style: 1,
      limit: 16,
    });

    expect(recs.length).toBeGreaterThan(4);
    expect(recs.length <= 16).toBe(true);
  });

  it("penalizes and marks banned debuff skills with BANNED badge when noDebuffs is active", () => {
    const testCardId = 999998;
    const debuffSkillId = 201152; // 束縛 (Binding Chains), banned debuff

    const course: Course = {
      id: 11203,
      terrain: 1,
      turn: 1,
      distance: 3,
      inout: 0,
      length: 2400,
      corners: [],
      slopes: [],
      straights: [],
    };

    (cardMetaMap as any)[testCardId] = {
      nameEn: "Debuff Test Card",
      nameJp: "デバフテスト",
      rarity: 3,
      type: "speed",
      hints: [debuffSkillId],
      events: [],
    };

    try {
      // Normal race params: skill is not banned
      const normalRecs = recommendCardsForParent({
        mainDeckSkillIds: new Set(),
        course,
        style: 3, // Betweener
        limit: 1000,
        raceParams: { noDebuffs: false },
      });
      const normalCard = normalRecs.find((r) => r.cardId === testCardId);
      expect(Boolean(normalCard)).toBe(true);
      const normalSkill = normalCard!.newMatchingSkills.find((s) => s.id === debuffSkillId);
      expect(normalSkill?.tacticalLabel).not.toBe("BANNED");

      // No Debuffs race params: skill is banned
      const bannedRecs = recommendCardsForParent({
        mainDeckSkillIds: new Set(),
        course,
        style: 3, // Betweener
        limit: 1000,
        raceParams: { noDebuffs: true },
      });
      const bannedCard = bannedRecs.find((r) => r.cardId === testCardId);
      expect(Boolean(bannedCard)).toBe(true);
      const bannedSkill = bannedCard!.newMatchingSkills.find((s) => s.id === debuffSkillId);
      expect(bannedSkill?.tacticalLabel).toBe("BANNED");
      expect(bannedSkill?.firesOnCourse).toBe(false);
      expect(bannedCard!.score).toBeLessThan(0);
    } finally {
      delete (cardMetaMap as any)[testCardId];
    }
  });
});
