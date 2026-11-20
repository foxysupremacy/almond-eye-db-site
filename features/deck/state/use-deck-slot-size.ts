"use client";

import { useCallback, useSyncExternalStore } from "react";
import { subscribeLocalUpdates } from "@/lib/storage/persistence";
import {
  DECK_SLOT_SIZE_STORAGE_KEY,
  DEFAULT_DECK_SLOT_SIZE,
  loadDeckSlotSize,
  saveDeckSlotSize,
  type DeckSlotSize,
} from "@/lib/deck/slot-size-pref";

const subscribe = (onChange: () => void) => subscribeLocalUpdates(DECK_SLOT_SIZE_STORAGE_KEY, onChange);
// The server (and the hydration pass) render the default; the stored value takes over right after.
const getServerSnapshot = (): DeckSlotSize => DEFAULT_DECK_SLOT_SIZE;

/** The persisted deck slot size, kept in sync across both deck pickers and other tabs. */
export function useDeckSlotSize(): readonly [DeckSlotSize, (size: DeckSlotSize) => void] {
  const size = useSyncExternalStore(subscribe, loadDeckSlotSize, getServerSnapshot);
  const setSize = useCallback((next: DeckSlotSize) => saveDeckSlotSize(next), []);
  return [size, setSize] as const;
}
