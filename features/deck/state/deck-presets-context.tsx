"use client";

import { createContext, useContext } from "react";
import type { DeckPreset } from "@/lib/deck/types";

export interface DeckPresetsContextValue {
  presets: DeckPreset[];
  activePreset: DeckPreset;
  activePresetId: string;
  setActivePresetId: (id: string) => void;
  addPreset: (name?: string) => string;
  duplicatePreset: (id: string) => string;
  updatePresetName: (id: string, name: string) => void;
  deletePreset: (id: string) => void;
  reorderPresets: (fromIndex: number, toIndex: number) => void;
  importPreset: (presetData: Partial<DeckPreset>, asNewPreset: boolean, customName?: string) => string;
}

export const DeckPresetsContext = createContext<DeckPresetsContextValue | null>(null);

export function useDeckPresets(): DeckPresetsContextValue {
  const ctx = useContext(DeckPresetsContext);
  if (!ctx) throw new Error("useDeckPresets must be used within a DeckProvider");
  return ctx;
}
