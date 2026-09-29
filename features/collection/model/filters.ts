import type { CardTypeKey } from "./types";

export interface FilterableCard {
  nameEn?: string | null;
  nameJp?: string | null;
  titleEn?: string | null;
  charName?: string | null;
  type?: string | null;
  rarity: number;
}

export interface FilterableCharacter {
  nameEn?: string | null;
  nameJp?: string | null;
  titleEn?: string | null;
  titleJp?: string | null;
  rarity: number;
}

export function filterCollectionCards<T extends FilterableCard>(
  cards: readonly T[],
  query: string,
  cardType: CardTypeKey,
  cardRarity: number | "all",
): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  return cards.filter((card) => {
    if (normalizedQuery) {
      const searchableText = [card.nameEn, card.nameJp, card.titleEn, card.charName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!searchableText.includes(normalizedQuery)) return false;
    }

    if (
      cardType !== "all" &&
      card.type !== cardType &&
      !(cardType === "intelligence" && card.type === "wit")
    ) {
      return false;
    }
    return cardRarity === "all" || card.rarity === cardRarity;
  });
}

export function filterCollectionCharacters<T extends FilterableCharacter>(
  characters: readonly T[],
  query: string,
  characterRarity: number | "all",
): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  return characters.filter((character) => {
    if (normalizedQuery) {
      const searchableText = [character.nameEn, character.nameJp, character.titleEn, character.titleJp]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!searchableText.includes(normalizedQuery)) return false;
    }
    return characterRarity === "all" || character.rarity === characterRarity;
  });
}
