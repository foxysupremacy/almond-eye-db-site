"use client";

import { useEffect, useState, type Dispatch } from "react";
import { readJsonStorage, removeJsonStorage } from "@/lib/storage/persistence";
import { CHAIN_CHOICES_STORAGE_KEY } from "@/lib/deck/constants";
import { loadStoredPresets } from "@/lib/deck/preset-storage";
import type { PresetListAction, PresetListState } from "@/lib/deck/preset-reducer";

/** Restore saved presets and perform the one-time legacy chain-choice migration. */
export function usePresetHydration(dispatch: Dispatch<PresetListAction>): boolean {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadStoredPresets();
    const legacyChoices = readJsonStorage<Record<string, number>>(CHAIN_CHOICES_STORAGE_KEY);

    if (loaded) {
      if (legacyChoices) {
        loaded.presets = loaded.presets.map((preset) =>
          preset.id === loaded.activeId
            ? { ...preset, mainChainChoices: { ...legacyChoices, ...preset.mainChainChoices } }
            : preset,
        );
      }
      dispatch({ type: "hydrate", state: loaded });
    } else if (legacyChoices) {
      dispatch({
        type: "updateActivePreset",
        update: (preset) => ({
          ...preset,
          mainChainChoices: { ...legacyChoices, ...preset.mainChainChoices },
        }),
      });
    }

    if (legacyChoices) removeJsonStorage(CHAIN_CHOICES_STORAGE_KEY);
    setHasHydrated(true);
  }, [dispatch]);

  return hasHydrated;
}
