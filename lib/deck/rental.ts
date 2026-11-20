// Rental slot: every career may borrow one MLB support card from another
// player. The borrowed card grants the same skills as an owned copy; its slot
// position does not change output. Each deck marks at most one slot as the
// rental; the card in it counts as MLB whether or not the user owns it.

import { DECK_SIZE } from "./constants";
import type { DeckPreset } from "./types";

export type DeckKind = "main" | "parent";

/** Limit break of a borrowed card (rentals are always MLB). */
export const RENTAL_LIMIT_BREAK = 4;

const FIELD = { main: "mainRentalSlot", parent: "parentRentalSlot" } as const;

/** Validates a stored/decoded rental index; anything but 0…DECK_SIZE-1 is "none". */
export function normalizeRentalSlot(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw < DECK_SIZE ? raw : null;
}

export function rentalSlotOf(preset: Pick<DeckPreset, "mainRentalSlot" | "parentRentalSlot">, deck: DeckKind): number | null {
  return normalizeRentalSlot(preset[FIELD[deck]]);
}

export function isRentalSlot(
  preset: Pick<DeckPreset, "mainRentalSlot" | "parentRentalSlot">,
  deck: DeckKind,
  slotIndex: number,
): boolean {
  return rentalSlotOf(preset, deck) === slotIndex;
}

/** Marks `slotIndex` as the deck's rental (moving any previous mark); null unmarks. */
export function setRentalSlot(preset: DeckPreset, deck: DeckKind, slotIndex: number | null): DeckPreset {
  if (slotIndex !== null && normalizeRentalSlot(slotIndex) === null) return preset;
  return { ...preset, [FIELD[deck]]: slotIndex };
}

/** MLB for the rental slot; otherwise the owned limit break (null = unowned). */
export function effectiveLimitBreak(
  slotIndex: number,
  rentalSlot: number | null,
  ownedLimitBreak: number | null,
): number | null {
  return slotIndex === rentalSlot ? RENTAL_LIMIT_BREAK : ownedLimitBreak;
}

/**
 * The deck's rental mark after picking a card into `slotIndex`: picking as a
 * rental marks that slot; picking an owned card into the rental slot clears it.
 */
export function rentalSlotAfterPick(
  currentRental: number | null,
  slotIndex: number,
  asRental: boolean,
): number | null {
  if (asRental) return slotIndex;
  return currentRental === slotIndex ? null : currentRental;
}
