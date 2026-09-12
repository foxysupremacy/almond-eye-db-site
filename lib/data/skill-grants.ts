// Card/character -> skill grant indexers.
//
// Pure queries over the registry datasets (which cards/characters grant a
// given skill). They take the dataset as parameters so they stay testable
// and independent of the registry singleton.

import type { CardIndexEntry, CharacterIndexEntry, SkillDetail } from "./types";

export interface GrantingCardInfo {
  card: CardIndexEntry;
  source: "event" | "hint";
  eventName?: string;
  choiceIndex?: number;
  choiceText?: string;
  isChain?: boolean;
}

/**
 * Retrieve all support cards that grant a specific skill, including whether it's
 * an event skill (with event/choice details) or a hint skill.
 */
export function getCardsGrantingSkill(
  skillId: number,
  allCards: CardIndexEntry[]
): GrantingCardInfo[] {
  const results: GrantingCardInfo[] = [];

  for (const card of allCards) {
    // Check Event Skills
    if (card.eventSkills && card.eventSkills.includes(skillId)) {
      let matchedEventName: string | undefined;
      let matchedChoiceIndex: number | undefined;
      let matchedChoiceText: string | undefined;
      let isChain = false;

      if (card.eventDetails) {
        for (const ev of card.eventDetails) {
          if (ev.choices) {
            for (const ch of ev.choices) {
              if (ch.skillIds && ch.skillIds.includes(skillId)) {
                matchedEventName = ev.nameEn || ev.nameJp;
                matchedChoiceIndex = ch.index;
                matchedChoiceText = ch.textEn || ch.textJp;
                isChain = ev.eventType === "chain";
                break;
              }
            }
          }
          if (matchedEventName) break;
        }
      }

      results.push({
        card,
        source: "event",
        eventName: matchedEventName,
        choiceIndex: matchedChoiceIndex,
        choiceText: matchedChoiceText,
        isChain,
      });
    }

    // Check Hint Skills
    if (card.hintSkills && card.hintSkills.includes(skillId)) {
      results.push({
        card,
        source: "hint",
      });
    }
  }

  // Sort by rarity desc, then release desc, then name
  return results.sort((a, b) => {
    if (b.card.rarity !== a.card.rarity) return b.card.rarity - a.card.rarity;
    const relA = a.card.release || "";
    const relB = b.card.release || "";
    if (relB !== relA) return relB.localeCompare(relA);
    return (a.card.nameEn || "").localeCompare(b.card.nameEn || "");
  });
}

export interface GrantingCharacterInfo {
  character: CharacterIndexEntry;
  uniqueSkillId: number;
}

/**
 * Retrieve all characters that have a specific unique skill (or its inherited white counterpart).
 */
export function getCharactersGrantingSkill(
  skillId: number,
  characters: CharacterIndexEntry[],
  allSkillsMap?: Map<number, SkillDetail>
): GrantingCharacterInfo[] {
  const targetSkill = allSkillsMap?.get(skillId);
  const targetName = targetSkill?.nameEn || targetSkill?.nameJp;

  return characters
    .filter((c) => {
      if (!c.uniqueSkillId) return false;
      if (c.uniqueSkillId === skillId) return true;
      if (c.uniqueSkillId - 90000 === skillId || c.uniqueSkillId - 99000 === skillId) return true;
      if (targetName && allSkillsMap) {
        const charSkill = allSkillsMap.get(c.uniqueSkillId);
        if (charSkill && (charSkill.nameEn === targetName || charSkill.nameJp === targetName)) {
          return true;
        }
      }
      return false;
    })
    .map((c) => ({
      character: c,
      uniqueSkillId: c.uniqueSkillId!,
    }));
}

