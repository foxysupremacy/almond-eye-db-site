import type { DeckPreset } from "./types";
import {
  DECK_SIZE,
  DEFAULT_TRACK_ID,
  DEFAULT_COURSE_ID,
  PRESETS_STORAGE_KEY,
  ACTIVE_PRESET_STORAGE_KEY,
  VISUALIZER_SAVE_KEY,
} from "./constants";
import { cleanChoices } from "./event-choices";
import { DEFAULT_PARENTING_SETUP, type ParentingSetup } from "../parenting-state";

export function createDefaultPreset(id: string, name: string): DeckPreset {
  return {
    id,
    name,
    mainDeckIds: Array(DECK_SIZE).fill(null),
    parentDeckIds: Array(DECK_SIZE).fill(null),
    trackInfo: {
      trackId: DEFAULT_TRACK_ID,
      courseId: DEFAULT_COURSE_ID,
      runningStyle: null,
      racerCount: 12,
      pvpEventId: null,
    },
    parentingSetup: { ...DEFAULT_PARENTING_SETUP },
  };
}

export const DEFAULT_PRESET = createDefaultPreset("default-1", "Default Build");

export function loadStoredPresets(): { presets: DeckPreset[]; activeId: string } | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const rawPresets = window.localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!rawPresets) return null;
    const parsed = JSON.parse(rawPresets);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    let legacyParenting: ParentingSetup | null = null;
    try {
      const rawLegacy = window.localStorage.getItem("almondeye_parenting_setup");
      if (rawLegacy) {
        legacyParenting = JSON.parse(rawLegacy);
      }
    } catch {
      // ignore
    }

    const cleaned: DeckPreset[] = parsed.map((p, idx) => ({
      id: typeof p.id === "string" ? p.id : `preset-${idx + 1}-${Date.now()}`,
      name: typeof p.name === "string" && p.name.trim() ? p.name : `Preset ${idx + 1}`,
      mainDeckIds: Array.isArray(p.mainDeckIds)
        ? p.mainDeckIds.slice(0, DECK_SIZE).map((x: unknown) => (typeof x === "number" ? x : null))
        : Array(DECK_SIZE).fill(null),
      parentDeckIds: Array.isArray(p.parentDeckIds)
        ? p.parentDeckIds.slice(0, DECK_SIZE).map((x: unknown) => (typeof x === "number" ? x : null))
        : Array(DECK_SIZE).fill(null),
      trackInfo: {
        trackId: typeof p.trackInfo?.trackId === "number" ? p.trackInfo.trackId : DEFAULT_TRACK_ID,
        courseId: typeof p.trackInfo?.courseId === "number" ? p.trackInfo.courseId : DEFAULT_COURSE_ID,
        runningStyle: [1, 2, 3, 4, 5].includes(p.trackInfo?.runningStyle) ? p.trackInfo.runningStyle : null,
        racerCount: typeof p.trackInfo?.racerCount === "number" ? p.trackInfo.racerCount : 12,
        pvpEventId: typeof p.trackInfo?.pvpEventId === "string" ? p.trackInfo.pvpEventId : null,
      },
      mainChainChoices: cleanChoices(p.mainChainChoices),
      parentChainChoices: cleanChoices(p.parentChainChoices),
      parentingSetup: p.parentingSetup
        ? {
            targetCharaId: p.parentingSetup.targetCharaId ?? null,
            targetCharaCardId: p.parentingSetup.targetCharaCardId ?? null,
            parent1: p.parentingSetup.parent1 ?? null,
            parent2: p.parentingSetup.parent2 ?? null,
            p1IsBorrow: p.parentingSetup.p1IsBorrow ?? false,
            p2IsBorrow: p.parentingSetup.p2IsBorrow ?? true,
            gpOverrides: p.parentingSetup.gpOverrides ?? {},
            supportCardIds: Array.isArray(p.parentingSetup.supportCardIds)
              ? p.parentingSetup.supportCardIds
              : [null, null, null, null, null, null],
          }
        : idx === 0 && legacyParenting
        ? {
            targetCharaId: legacyParenting.targetCharaId ?? null,
            targetCharaCardId: legacyParenting.targetCharaCardId ?? null,
            parent1: legacyParenting.parent1 ?? null,
            parent2: legacyParenting.parent2 ?? null,
            p1IsBorrow: legacyParenting.p1IsBorrow ?? false,
            p2IsBorrow: legacyParenting.p2IsBorrow ?? true,
            gpOverrides: legacyParenting.gpOverrides ?? {},
            supportCardIds: Array.isArray(legacyParenting.supportCardIds)
              ? legacyParenting.supportCardIds
              : [null, null, null, null, null, null],
          }
        : { ...DEFAULT_PARENTING_SETUP },
    }));

    if (cleaned.length > 0) {
      const savedActiveId = window.localStorage.getItem(ACTIVE_PRESET_STORAGE_KEY);
      const activeId =
        savedActiveId && cleaned.some((p) => p.id === savedActiveId)
          ? savedActiveId
          : cleaned[0].id;
      return { presets: cleaned, activeId };
    }
  } catch {
    /* ignore storage errors */
  }
  return null;
}

export function persistPresetsAndVisualizer(presets: DeckPreset[], activePreset: DeckPreset): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
    window.localStorage.setItem(ACTIVE_PRESET_STORAGE_KEY, activePreset.id);
    if (activePreset.parentingSetup) {
      window.localStorage.setItem("almondeye_parenting_setup", JSON.stringify(activePreset.parentingSetup));
    }
    window.localStorage.setItem(
      VISUALIZER_SAVE_KEY,
      JSON.stringify({
        trackId: activePreset.trackInfo.trackId,
        courseId: activePreset.trackInfo.courseId,
        racerCount: activePreset.trackInfo.racerCount,
      }),
    );
  } catch {
    /* ignore storage errors */
  }
}
