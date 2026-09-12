// Pure reducer over the preset list — every deck/track/pvp mutation funnels
// through here so the update semantics live in one testable place, free of
// React. components/store.tsx wires this with useReducer and adapts it to the
// useDeck() API.

import type { DeckPreset } from "./types";
import { DECK_SIZE, DEFAULT_TRACK_ID, DEFAULT_COURSE_ID } from "./constants";
import { createDefaultPreset } from "./preset-storage";

export interface PresetListState {
  presets: DeckPreset[];
  activeId: string;
}

export type PresetListAction =
  | { type: "hydrate"; state: PresetListState }
  | { type: "setActiveId"; id: string }
  | { type: "addPreset"; id: string; name?: string }
  | { type: "duplicatePreset"; id: string; newId: string }
  | { type: "updatePresetName"; id: string; name: string }
  | { type: "deletePreset"; id: string }
  | { type: "reorderPresets"; fromIndex: number; toIndex: number }
  | { type: "importAsNew"; preset: DeckPreset }
  | { type: "importOverwrite"; presetData: Partial<DeckPreset>; customName?: string }
  /** The single choke point for every edit of the active preset. */
  | { type: "updateActivePreset"; update: (p: DeckPreset) => DeckPreset };

/** Map over presets, replacing only the active one. */
export function mapActivePreset(
  state: PresetListState,
  update: (p: DeckPreset) => DeckPreset
): PresetListState {
  return {
    ...state,
    presets: state.presets.map((p) => (p.id === state.activeId ? update(p) : p)),
  };
}

export function presetReducer(state: PresetListState, action: PresetListAction): PresetListState {
  switch (action.type) {
    case "hydrate":
      return action.state;

    case "setActiveId":
      return { ...state, activeId: action.id };

    case "addPreset": {
      const name =
        action.name?.trim() || `Preset ${state.presets.length + 1}`;
      return {
        presets: [...state.presets, createDefaultPreset(action.id, name)],
        activeId: action.id,
      };
    }

    case "duplicatePreset": {
      const src = state.presets.find((p) => p.id === action.id);
      if (!src) return state;
      const clone: DeckPreset = {
        ...src,
        id: action.newId,
        name: `${src.name} (Copy)`,
        mainDeckIds: [...src.mainDeckIds],
        parentDeckIds: [...src.parentDeckIds],
        trackInfo: { ...src.trackInfo },
        mainChainChoices: src.mainChainChoices ? { ...src.mainChainChoices } : undefined,
        parentChainChoices: src.parentChainChoices ? { ...src.parentChainChoices } : undefined,
      };
      return {
        presets: [...state.presets, clone],
        activeId: action.newId,
      };
    }

    case "updatePresetName":
      return {
        ...state,
        presets: state.presets.map((p) =>
          p.id === action.id ? { ...p, name: action.name.trim() || p.name } : p
        ),
      };

    case "deletePreset": {
      if (state.presets.length <= 1) return state;
      const remaining = state.presets.filter((p) => p.id !== action.id);
      return {
        presets: remaining,
        activeId: state.activeId === action.id ? remaining[0].id : state.activeId,
      };
    }

    case "reorderPresets": {
      const { fromIndex, toIndex } = action;
      if (fromIndex < 0 || fromIndex >= state.presets.length || toIndex < 0 || toIndex >= state.presets.length) {
        return state;
      }
      const next = [...state.presets];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...state, presets: next };
    }

    case "importAsNew":
      return {
        presets: [...state.presets, action.preset],
        activeId: action.preset.id,
      };

    case "importOverwrite": {
      const { presetData, customName } = action;
      return mapActivePreset(state, (p) => ({
        ...p,
        name: customName?.trim() || p.name,
        mainDeckIds: presetData.mainDeckIds?.slice(0, DECK_SIZE) ?? p.mainDeckIds,
        parentDeckIds: presetData.parentDeckIds?.slice(0, DECK_SIZE) ?? p.parentDeckIds,
        trackInfo: {
          trackId: presetData.trackInfo?.trackId ?? p.trackInfo.trackId,
          courseId: presetData.trackInfo?.courseId ?? p.trackInfo.courseId,
          runningStyle:
            presetData.trackInfo?.runningStyle !== undefined
              ? presetData.trackInfo.runningStyle
              : p.trackInfo.runningStyle,
          racerCount: presetData.trackInfo?.racerCount ?? p.trackInfo.racerCount,
          pvpEventId: presetData.trackInfo?.pvpEventId ?? p.trackInfo.pvpEventId,
        },
        mainChainChoices: presetData.mainChainChoices ? { ...presetData.mainChainChoices } : p.mainChainChoices,
        parentChainChoices: presetData.parentChainChoices ? { ...presetData.parentChainChoices } : p.parentChainChoices,
      }));
    }

    case "updateActivePreset":
      return mapActivePreset(state, action.update);
  }
}

/** Build a full DeckPreset from shared/import data (import-as-new path). */
export function buildImportedPreset(
  id: string,
  name: string,
  presetData: Partial<DeckPreset>
): DeckPreset {
  return {
    id,
    name,
    mainDeckIds: presetData.mainDeckIds?.slice(0, DECK_SIZE) ?? Array(DECK_SIZE).fill(null),
    parentDeckIds: presetData.parentDeckIds?.slice(0, DECK_SIZE) ?? Array(DECK_SIZE).fill(null),
    trackInfo: {
      trackId: presetData.trackInfo?.trackId ?? DEFAULT_TRACK_ID,
      courseId: presetData.trackInfo?.courseId ?? DEFAULT_COURSE_ID,
      runningStyle: presetData.trackInfo?.runningStyle ?? null,
      racerCount: presetData.trackInfo?.racerCount ?? 12,
      pvpEventId: presetData.trackInfo?.pvpEventId ?? null,
    },
    mainChainChoices: presetData.mainChainChoices ? { ...presetData.mainChainChoices } : undefined,
    parentChainChoices: presetData.parentChainChoices ? { ...presetData.parentChainChoices } : undefined,
  };
}
