// Deck composition constraints shared by every card-picking entry point
// (CardPickerPopover, CardSkillsSheet, SkillPickerModal, deck store setters).

import type { CardIndexEntry } from "../api";

export type DeckSlots = (CardIndexEntry | null)[];

/**
 * Stable identity for the uma a support card belongs to. `charName` is the
 * canonical field on CardIndexEntry; nameEn/nameJp are fallbacks for data
 * that predates it.
 */
export function cardCharacterKey(card: CardIndexEntry): string {
  return (card.charName || card.nameEn || card.nameJp).trim().toLowerCase();
}

/**
 * Within ONE deck, a character may only appear via ONE distinct card (two
 * different cards of one uma — say Almond Eye Speed + Almond Eye Guts — may
 * not be equipped together). Main Deck and Parent Deck are independent: the
 * Main Deck never constrains what the Parent Deck may pick, and vice versa
 * (the Parent Deck trains P1/P2, a separate deck). Equipping the same card
 * in both decks is explicitly allowed ("Copy from Main").
 *
 * `slotIndex` is the slot being written to; its current occupant is ignored
 * so replacing a card never conflicts with itself.
 */
export function findCharConflict(
  slots: DeckSlots,
  slotIndex: number,
  card: CardIndexEntry,
): CardIndexEntry | null {
  const charKey = cardCharacterKey(card);
  if (!charKey) return null;
  for (let i = 0; i < slots.length; i++) {
    if (i === slotIndex) continue;
    const occupant = slots[i];
    if (occupant && occupant.id !== card.id && cardCharacterKey(occupant) === charKey) {
      return occupant;
    }
  }
  return null;
}

export function canPlaceCard(
  slots: DeckSlots,
  slotIndex: number,
  card: CardIndexEntry,
): boolean {
  return findCharConflict(slots, slotIndex, card) === null;
}
