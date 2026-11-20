// Deck slot size preference (`deck_slot_size.v1`): "compact" shows one row of
// face-cropped tiles; "large" keeps the full card art with inline controls.
// Shared by Main and Parent Deck. Pure persistence — the React adapter lives
// in features/deck/state/use-deck-slot-size.ts.

import { notifyLocalUpdate, readJsonStorage, writeJsonStorage } from "@/lib/storage/persistence";

export type DeckSlotSize = "compact" | "large";

export const DECK_SLOT_SIZE_STORAGE_KEY = "deck_slot_size.v1";
export const DEFAULT_DECK_SLOT_SIZE: DeckSlotSize = "compact";

/** Validate an untrusted stored value. */
export function parseDeckSlotSize(value: unknown): DeckSlotSize {
  return value === "compact" || value === "large" ? value : DEFAULT_DECK_SLOT_SIZE;
}

export function loadDeckSlotSize(): DeckSlotSize {
  return parseDeckSlotSize(readJsonStorage<unknown>(DECK_SLOT_SIZE_STORAGE_KEY));
}

/** Persist and notify same-tab listeners (other tabs get the storage event). */
export function saveDeckSlotSize(size: DeckSlotSize): void {
  writeJsonStorage(DECK_SLOT_SIZE_STORAGE_KEY, size);
  notifyLocalUpdate(DECK_SLOT_SIZE_STORAGE_KEY);
}
