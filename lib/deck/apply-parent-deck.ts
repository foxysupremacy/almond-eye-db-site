import { DECK_SIZE } from "./constants";
import type { DeckPreset } from "./types";
import { normalizeRentalSlot } from "./rental";

/**
 * Pads/truncates to DECK_SIZE, replaces parentDeckIds, merges chainChoices over existing parentChainChoices.
 * `rentalSlot` (when given) replaces the Parent Deck rental mark; omit it to keep the current mark.
 */
export function applyParentDeckToPreset(
  preset: DeckPreset,
  cardIds: readonly (number | null)[],
  chainChoices: Readonly<Record<string, number>>,
  rentalSlot?: number | null,
): DeckPreset {
  const parentDeckIds: (number | null)[] = Array.from(
    { length: DECK_SIZE },
    (_, i) => cardIds[i] ?? null,
  );
  return {
    ...preset,
    parentDeckIds,
    parentChainChoices: { ...preset.parentChainChoices, ...chainChoices },
    ...(rentalSlot !== undefined ? { parentRentalSlot: normalizeRentalSlot(rentalSlot) } : {}),
  };
}
