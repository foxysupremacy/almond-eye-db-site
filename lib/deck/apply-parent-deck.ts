import { DECK_SIZE } from "./constants";
import type { DeckPreset } from "./types";

/** Pads/truncates to DECK_SIZE, replaces parentDeckIds, merges chainChoices over existing parentChainChoices. */
export function applyParentDeckToPreset(
  preset: DeckPreset,
  cardIds: readonly (number | null)[],
  chainChoices: Readonly<Record<string, number>>,
): DeckPreset {
  const parentDeckIds: (number | null)[] = Array.from(
    { length: DECK_SIZE },
    (_, i) => cardIds[i] ?? null,
  );
  return {
    ...preset,
    parentDeckIds,
    parentChainChoices: { ...preset.parentChainChoices, ...chainChoices },
  };
}
