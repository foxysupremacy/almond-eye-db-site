import { describe, it, expect } from "bun:test";
import { isSkillObtainableFromCards, getAllParentWhiteSkills } from "./skill-effects";
import { getCharactersGrantingSkill } from "./data/skill-grants";
import type { CharacterIndexEntry } from "./api";

describe("Skill Effects & Exclusivity", () => {
  it("isSkillObtainableFromCards returns true when skill is in card skill set and false otherwise", () => {
    const cardSkillIdSet = new Set<number>([20001, 20002, 30001]);
    expect(isSkillObtainableFromCards(20001, cardSkillIdSet)).toBe(true);
    expect(isSkillObtainableFromCards(100101, cardSkillIdSet)).toBe(false);
  });

  it("getCharactersGrantingSkill matches characters by uniqueSkillId or evolvedSkills", () => {
    const mockCharacters: CharacterIndexEntry[] = [
      {
        id: 100101,
        charId: 1001,
        nameEn: "Special Week",
        nameJp: "スペシャルウィーク",
        rarity: 3,
        uniqueSkillId: 100101,
        evolvedSkills: [200101, 200102],
      } as any,
      {
        id: 100201,
        charId: 1002,
        nameEn: "Silence Suzuka",
        nameJp: "サイレンススズカ",
        rarity: 3,
        uniqueSkillId: 100201,
        evolvedSkills: [],
      } as any,
    ];

    const speMatches = getCharactersGrantingSkill(100101, mockCharacters);
    expect(speMatches.length).toBe(1);
    expect(speMatches[0].character.nameEn).toBe("Special Week");
    expect(speMatches[0].uniqueSkillId).toBe(100101);

    const suzukaMatches = getCharactersGrantingSkill(100201, mockCharacters);
    expect(suzukaMatches.length).toBe(1);
    expect(suzukaMatches[0].character.nameEn).toBe("Silence Suzuka");

    const nonExistent = getCharactersGrantingSkill(999999, mockCharacters);
    expect(nonExistent.length).toBe(0);
  });

  it("getAllParentWhiteSkills extracts unique, innate, awakening (gold converted to white), event, and factor skills", () => {
    const mockCharacter: CharacterIndexEntry = {
      id: 100101,
      charId: 1001,
      nameEn: "Special Week",
      nameJp: "スペシャルウィーク",
      rarity: 3,
      uniqueSkillId: 100011,
      innateSkills: [200512],
      awakeningSkills: [200014], // 200014 is Gold (Clockwise Demon) -> converts to 200011 (Right Turns ◎)
      eventSkills: [200472],
    } as any;

    const mockVeteran = {
      factor_info_array: [{ factor_id: 200562 }],
    };

    const skills = getAllParentWhiteSkills(mockCharacter, mockVeteran as any);
    expect(skills.length).toBeGreaterThan(3);

    // Unique present
    expect(skills.some((s: any) => s.skillId === 100011 && s.source === "unique")).toBe(true);

    // Innate present
    expect(skills.some((s: any) => s.skillId === 200512 && s.source === "innate")).toBe(true);

    // Awakening present and gold converted
    const clockwiseWhite = skills.find((s: any) => s.skillId === 200011 && s.source === "awakening");
    expect(clockwiseWhite).toBeDefined();
    expect(clockwiseWhite?.originalGoldNameEn).toBe("Clockwise Demon");

    // Event present
    expect(skills.some((s: any) => s.skillId === 200472 && s.source === "event")).toBe(true);

    // Factor present
    expect(skills.some((s: any) => s.skillId === 200562 && s.source === "factor")).toBe(true);
  });
});
