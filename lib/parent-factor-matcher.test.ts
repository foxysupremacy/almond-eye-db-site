import { describe, it, expect } from "bun:test";
import {
  isRankInParentRange,
  evaluateVeteranTargetFactors,
  extractActiveParentTargetSkills,
} from "./parent-factor-matcher";
import type { KyumaruVeteranItem } from "./kyumaru-types";
import type { ParentDeckSkill } from "./deck/types";

describe("parent-factor-matcher", () => {
  describe("isRankInParentRange", () => {
    it("identifies ranks in UF to UC9 range", () => {
      // UG9 (rank 28) - below UF
      expect(isRankInParentRange(28, 23500)).toBe(false);

      // UF (rank 29, score 23900) - start of range
      expect(isRankInParentRange(29, 23900)).toBe(true);

      // UE (rank 39, score 28800) - mid range
      expect(isRankInParentRange(39, 28800)).toBe(true);

      // UD (rank 49, score 34400) - mid range
      expect(isRankInParentRange(49, 34400)).toBe(true);

      // UC (rank 59, score 40700) - mid range
      expect(isRankInParentRange(59, 40700)).toBe(true);

      // UC9 (rank 68, score 47500) - end of range
      expect(isRankInParentRange(68, 47500)).toBe(true);

      // UB (rank 69, score 47600) - above UC9
      expect(isRankInParentRange(69, 47600)).toBe(false);
    });

    it("falls back to rank_score when rank is 0 or undefined", () => {
      expect(isRankInParentRange(0, 23900)).toBe(true);
      expect(isRankInParentRange(undefined, 46000)).toBe(true);
      expect(isRankInParentRange(0, 20000)).toBe(false);
      expect(isRankInParentRange(0, 50000)).toBe(false);
    });
  });

  describe("evaluateVeteranTargetFactors", () => {
    it("returns 0 matches when active target skill map is empty", () => {
      const veteran = {
        card_id: 100101,
        factor_info_array: [{ factor_id: 200512 }],
      };
      const result = evaluateVeteranTargetFactors(veteran, new Map());
      expect(result.count).toBe(0);
      expect(result.matchedSkills).toHaveLength(0);
    });

    it("detects matching factors on self and succession parents across 3 generations", () => {
      // 200512 is Homestretch Haste (末脚)
      // 200332 is Corner Adept ○ (コーナー巧者○)
      const targetSkillMap = new Map<number, ParentDeckSkill>();
      targetSkillMap.set(200512, {
        id: 200512,
        nameEn: "Homestretch Haste",
        nameJp: "末脚",
        descEn: "Speed up in final stretch",
        rarity: 1,
        source: "hint",
        cardId: 1,
        cardName: "Special Week",
        isDuplicateInMain: false,
        parentDuplicateCount: 1,
        isUniqueToParent: true,
      });
      targetSkillMap.set(200332, {
        id: 200332,
        nameEn: "Corner Adept ○",
        nameJp: "コーナー巧者○",
        descEn: "Better cornering",
        rarity: 1,
        source: "hint",
        cardId: 2,
        cardName: "Tokai Teio",
        isDuplicateInMain: false,
        parentDuplicateCount: 1,
        isUniqueToParent: true,
      });

      const veteran = {
        card_id: 100101,
        // Self has Homestretch Haste 2★ (200512)
        factor_info_array: [{ factor_id: 200512 }],
        succession_chara_array: [
          {
            position_id: 10,
            card_id: 100201,
            // Parent 1 has Corner Adept 3★ (2003303)
            factor_info_array: [{ factor_id: 2003303 }],
          },
          {
            position_id: 20,
            card_id: 100301,
            // Parent 2 also has Homestretch Haste 1★ (200511)
            factor_info_array: [{ factor_id: 200511 }],
          },
        ],
      };

      const result = evaluateVeteranTargetFactors(veteran, targetSkillMap);
      expect(result.count).toBe(2);
      expect(result.matchedSkills).toHaveLength(2);

      const homestretch = result.matchedSkills.find((s) => s.skillId === 200512);
      expect(homestretch).toBeDefined();
      expect(homestretch?.maxStars).toBe(2);
      expect(homestretch?.occurrences).toHaveLength(2); // Self and Parent 2

      const cornerAdept = result.matchedSkills.find((s) => s.skillId === 200332);
      expect(cornerAdept).toBeDefined();
      expect(cornerAdept?.maxStars).toBe(3);
      expect(cornerAdept?.occurrences).toHaveLength(1); // Parent 1
    });
  });
});
