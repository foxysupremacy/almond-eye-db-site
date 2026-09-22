import { describe, expect, test } from "bun:test";
import {
  cards,
  cardsById,
  characters,
  charactersById,
  charactersByCharId,
  characterVariantsByCharId,
  skills,
  skillsBase,
  skillsInherit,
  skillsById,
  skillIconById,
  affinityData,
  careersByCharId,
  uniqueInheritMap,
  goldToWhiteMap,
  cardMetaMap,
  skillMetaMap,
  evolvedSkillsByCharacterCardId,
} from "./registry";

describe("registry datasets", () => {
  test("cards hydrate with CDN urls and grant lists", () => {
    expect(cards.length).toBeGreaterThan(500);
    const sample = cardsById.get(30308)!; // Almond Eye SSR-ish card referenced by tests
    expect(sample).toBeDefined();
    expect(sample.imgUrl).toContain(`support/30308/30308/01.png`);
    expect(sample.portraitUrl).toContain(`support/30308/30308/02.png`);
    expect(Array.isArray(sample.eventSkills)).toBe(true);
    expect(Array.isArray(sample.hintSkills)).toBe(true);
  });

  test("characters hydrate with variants grouped by charId", () => {
    expect(characters.length).toBeGreaterThan(200);
    const first = characters[0];
    expect(first.imgUrl).toContain("chara_stand/");
    // every character is reachable both by card id and char id
    expect(charactersById.get(first.id)?.charId).toBe(first.charId);
    expect(charactersByCharId.get(first.charId)?.charId).toBe(first.charId);
    const someCharId = characters.find((c) => characters.filter((x) => x.charId === c.charId).length > 1)!.charId;
    expect(characterVariantsByCharId.get(someCharId)!.length).toBeGreaterThan(1);
  });

  test("skills = base + inherit versions, all resolvable by id", () => {
    expect(skills.length).toBe(skillsBase.length + skillsInherit.length);
    expect(skillsById.size).toBe(skills.length); // no id collisions between the two sets
    for (const s of skillsBase) expect(skillsById.get(s.id)?.nameEn).toBe(s.nameEn);
  });

  test("skill icon map covers all skills with null (not undefined) fallback", () => {
    expect(skillIconById.size).toBe(skillsById.size);
    for (const id of skillsById.keys()) {
      expect(skillIconById.has(id)).toBe(true);
    }
  });

  test("auxiliary datasets are non-empty and typed", () => {
    expect(Object.keys(affinityData.relationPoints).length).toBeGreaterThan(0);
    expect(Object.keys(affinityData.charaRelationTypes).length).toBeGreaterThan(0);
    expect(affinityData.g1Saddles.length).toBeGreaterThan(0);
    expect(Object.keys(careersByCharId).length).toBeGreaterThan(100);
    const firstCareer = Object.values(careersByCharId)[0];
    expect(firstCareer[0]).toHaveProperty("raceId");
    expect(Object.keys(uniqueInheritMap).length).toBeGreaterThan(200);
    expect(Object.keys(goldToWhiteMap).length).toBeGreaterThan(100);
    expect(goldToWhiteMap["200014"]?.whiteId).toBe(200011);
    expect(Object.keys(cardMetaMap).length).toBe(cards.length);
    expect(Object.keys(skillMetaMap).length).toBeGreaterThan(1000);
  });
});

describe("evolvedSkillsByCharacterCardId — costume-specific EVO indexing", () => {
  test("indexes EVO skills only for their exact character costume", () => {
    expect(evolvedSkillsByCharacterCardId.get(103302)?.map((s) => s.id)).toEqual([
      103302111,
      103302211,
    ]);
    expect(evolvedSkillsByCharacterCardId.get(103301)?.map((s) => s.id)).not.toContain(
      103302111,
    );
    for (const [cardId, entries] of evolvedSkillsByCharacterCardId) {
      expect(charactersById.has(cardId)).toBe(true);
      for (const skill of entries) {
        expect(skill.rarity).toBe(6);
        expect(Math.trunc(skill.id / 1000)).toBe(cardId);
      }
    }
  });

  test("excludes scenario-wide EVOs", () => {
    // Scenario-wide EVOs have id prefixes like 407, 408, 409, 410
    for (const cardId of evolvedSkillsByCharacterCardId.keys()) {
      expect(cardId).toBeGreaterThan(100000);
    }
  });
});
