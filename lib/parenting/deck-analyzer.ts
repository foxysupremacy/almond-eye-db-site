import type { CharacterIndexEntry } from "../api";
import rawCardsData from "../data/cards.json";
import rawCharactersData from "../data/characters.json";
import type { DeckAnalysis } from "./types";

const rawCardsMap = new Map<number, any>((rawCardsData as any[]).map((c) => [c.id, c]));
const charactersList = rawCharactersData as CharacterIndexEntry[];

export function getDeckAnalysis(supportCardIds?: (number | null)[]): DeckAnalysis {
  const equippedDeckCharNames = new Set<string>();
  const equippedDeckCharIds = new Set<number>();
  const equippedDeckSkillIds = new Set<number>();

  if (!supportCardIds || supportCardIds.length === 0) {
    return { equippedDeckCharNames, equippedDeckCharIds, equippedDeckSkillIds };
  }

  for (const cardId of supportCardIds) {
    if (!cardId) continue;
    const card = rawCardsMap.get(cardId);
    if (!card) continue;

    if (card.charName) {
      equippedDeckCharNames.add(card.charName.toLowerCase().trim());
      const chara = charactersList.find(
        (c) =>
          c.nameEn.toLowerCase().trim() === card.charName.toLowerCase().trim() ||
          card.nameEn.toLowerCase().includes(c.nameEn.toLowerCase().trim())
      );
      if (chara) equippedDeckCharIds.add(chara.charId);
    }
    if (card.hintSkills) {
      for (const sId of card.hintSkills) equippedDeckSkillIds.add(Number(sId));
    }
    if (card.eventSkills) {
      for (const sId of card.eventSkills) equippedDeckSkillIds.add(Number(sId));
    }
  }

  return { equippedDeckCharNames, equippedDeckCharIds, equippedDeckSkillIds };
}
