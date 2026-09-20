"use client";

// Deck & Preset State:
// - Manages multiple Deck Presets (combo of Main Deck + Parent Deck + Target Race & Style).
// - Merged Target Profile = Venue + Course + Running Style + Racer Count.
// - Caches card skills from the data store.
// - Derives Main Deck skills and Parent Deck skills with duplicate highlighting.
// - Supplies unified global track/course geometry and derived distance/surface.
//
// Mutation semantics live in lib/deck/preset-reducer.ts (pure); this provider
// only wires it to React and adapts it to the useDeck() interface.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import {
  type CardIndexEntry,
  type CardSkills,
  type Racetrack,
  type RacetrackDetail,
  type CourseRow,
  flattenCourse,
} from "../lib/api";
import { initDataStore, type DataStore } from "../lib/data-store";
import type { Course } from "../lib/skill-engine/types";
import { type PvpEvent, getPvpEventById } from "../lib/pvp-events";
import { readJsonStorage, removeJsonStorage } from "../lib/persistence";

// Extracted Domain Modules
import {
  DECK_SIZE,
  CHAIN_CHOICES_STORAGE_KEY,
  DEFAULT_COURSE_ID,
} from "../lib/deck/constants";

import type {
  RunningStyle,
  DistanceType,
  SurfaceType,
  DeckPreset,
  DeckSkillGrant,
  DeckSkill,
  ParentDeckSkill,
  DeckContextValue,
} from "../lib/deck/types";

import {
  deriveSkillsForDeck,
  deriveMainSkillIdSet,
  deriveMainGrantsBySkillId,
  deriveParentSkills,
} from "../lib/deck/skill-resolver";
import { canPlaceCard } from "../lib/deck/card-constraints";
import { createDefaultPreset, DEFAULT_PRESET, loadStoredPresets, persistPresetsAndVisualizer } from "../lib/deck/preset-storage";
import {
  presetReducer,
  buildImportedPreset,
  type PresetListState,
} from "../lib/deck/preset-reducer";

import { DeckContext } from "../lib/deck/context";
import { DEFAULT_PARENTING_SETUP, type ParentingSetup } from "../lib/parenting-state";

export function DeckProvider({ children }: { children: ReactNode }) {
  const [presetState, dispatch] = useReducer(presetReducer, {
    presets: [DEFAULT_PRESET],
    activeId: DEFAULT_PRESET.id,
  } satisfies PresetListState);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Restore saved presets from localStorage after initial hydration.
  // Legacy one-time migration: chain choices used to also live in a
  // standalone chain_choices.v1 map — fold it into the active preset, then
  // retire the key (chain choices are single-sourced in the preset now).
  useEffect(() => {
    const loaded = loadStoredPresets();
    const legacyChoices = readJsonStorage<Record<string, number>>(CHAIN_CHOICES_STORAGE_KEY);
    if (loaded) {
      if (legacyChoices) {
        loaded.presets = loaded.presets.map((p) =>
          p.id === loaded.activeId
            ? { ...p, mainChainChoices: { ...legacyChoices, ...p.mainChainChoices } }
            : p
        );
      }
      dispatch({ type: "hydrate", state: loaded });
    } else if (legacyChoices) {
      dispatch({
        type: "updateActivePreset",
        update: (p) => ({ ...p, mainChainChoices: { ...legacyChoices, ...p.mainChainChoices } }),
      });
    }
    if (legacyChoices) removeJsonStorage(CHAIN_CHOICES_STORAGE_KEY);
    setHasHydrated(true);
  }, []);

  const [dataStore, setDataStore] = useState<DataStore | null>(null);
  const [index, setIndex] = useState<CardIndexEntry[] | null>(null);
  const [tracks, setTracks] = useState<Racetrack[] | null>(null);
  const [trackDetailsCache, setTrackDetailsCache] = useState<Record<number, RacetrackDetail | null>>({});

  // Initialize data store once on mount
  useEffect(() => {
    initDataStore().then((store) => {
      setDataStore(store);
      setIndex(store.cards);
      setTracks(
        store.racetracks.map((t) => ({
          id: t.id,
          nameJa: t.nameJa,
          nameEn: t.nameEn,
          courseCount: t.courseCount,
        })),
      );
      const cache: Record<number, RacetrackDetail | null> = {};
      for (const t of store.racetracks) {
        cache[t.id] = t;
      }
      setTrackDetailsCache(cache);
    });
  }, []);

  const activePreset = useMemo<DeckPreset>(() => {
    const found = presetState.presets.find((p) => p.id === presetState.activeId);
    return found ?? presetState.presets[0] ?? createDefaultPreset("fallback", "Default Build");
  }, [presetState.presets, presetState.activeId]);

  const activeTrackId = activePreset.trackInfo.trackId;
  const activeCourseId = activePreset.trackInfo.courseId;
  const activeTrackDetail = trackDetailsCache[activeTrackId] ?? null;

  // Active course row within venue
  const activeCourseRow = useMemo<CourseRow | null>(() => {
    if (!activeTrackDetail) return null;
    const found = activeTrackDetail.courses.find((c) => c.id === activeCourseId);
    return found ?? activeTrackDetail.courses[0] ?? null;
  }, [activeTrackDetail, activeCourseId]);

  // Flattened course geometry for skill engine
  const course = useMemo<Course | null>(() => {
    return activeCourseRow ? flattenCourse(activeCourseRow) : null;
  }, [activeCourseRow]);

  // Derived Distance & Surface from active course
  const distance = useMemo<DistanceType | null>(() => {
    return activeCourseRow ? (activeCourseRow.distance as DistanceType) : null;
  }, [activeCourseRow]);

  const surface = useMemo<SurfaceType | null>(() => {
    return activeCourseRow ? (activeCourseRow.terrain as SurfaceType) : null;
  }, [activeCourseRow]);

  const activePvpEventId = activePreset.trackInfo.pvpEventId ?? null;
  const activePvpEvent = useMemo(() => getPvpEventById(activePvpEventId), [activePvpEventId]);

  // Persist presets and visualizer state once hydrated
  useEffect(() => {
    if (!hasHydrated) return;
    persistPresetsAndVisualizer(presetState.presets, activePreset);
  }, [hasHydrated, presetState.presets, activePreset]);

  // Hydrate Main Deck slots from index
  const mainSlots = useMemo<(CardIndexEntry | null)[]>(() => {
    if (!index) return Array(DECK_SIZE).fill(null);
    return activePreset.mainDeckIds.map((id) => (id == null ? null : index.find((c) => c.id === id) ?? null));
  }, [index, activePreset.mainDeckIds]);

  // Hydrate Parent Deck slots from index
  const parentSlots = useMemo<(CardIndexEntry | null)[]>(() => {
    if (!index) return Array(DECK_SIZE).fill(null);
    return activePreset.parentDeckIds.map((id) => (id == null ? null : index.find((c) => c.id === id) ?? null));
  }, [index, activePreset.parentDeckIds]);

  // Derive skills synchronously from dataStore for cards in both decks
  const skillsByCard = useMemo<Record<number, CardSkills | null>>(() => {
    if (!dataStore) return {};
    const map: Record<number, CardSkills | null> = {};
    const cardsToCheck = [...mainSlots, ...parentSlots];
    cardsToCheck.forEach((card) => {
      if (!card) return;
      map[card.id] = dataStore.getCardSkills(card.id);
    });
    return map;
  }, [dataStore, mainSlots, parentSlots]);

  // Preset CRUD (reducer actions, ids minted at the call site)
  const setActivePresetId = useCallback((id: string) => {
    dispatch({ type: "setActiveId", id });
  }, []);

  const addPreset = useCallback((name?: string) => {
    const id = `preset-${Date.now()}`;
    dispatch({ type: "addPreset", id, name });
    return id;
  }, []);

  const duplicatePreset = useCallback((id: string) => {
    const newId = `preset-${Date.now()}`;
    dispatch({ type: "duplicatePreset", id, newId });
    return newId;
  }, []);

  const updatePresetName = useCallback((id: string, name: string) => {
    dispatch({ type: "updatePresetName", id, name });
  }, []);

  const deletePreset = useCallback((id: string) => {
    dispatch({ type: "deletePreset", id });
  }, []);

  const reorderPresets = useCallback((fromIndex: number, toIndex: number) => {
    dispatch({ type: "reorderPresets", fromIndex, toIndex });
  }, []);

  const importPreset = useCallback((presetData: Partial<DeckPreset>, asNewPreset: boolean, customName?: string): string => {
    const finalName = customName?.trim() || presetData.name?.trim() || "Shared Build";
    if (asNewPreset) {
      const newId = `preset-${Date.now()}`;
      dispatch({ type: "importAsNew", preset: buildImportedPreset(newId, finalName, presetData) });
      return newId;
    }
    dispatch({ type: "importOverwrite", presetData, customName });
    return presetState.activeId;
  }, [presetState.activeId]);

  // Card modifications
  // Character-identity constraint: within each deck, two different cards of
  // the same uma may never coexist. Main and Parent decks are independent —
  // the setters are the single choke point every picking UI funnels through.
  const setMainCard = useCallback((slotIndex: number, card: CardIndexEntry | null) => {
    if (card && !canPlaceCard(mainSlots, slotIndex, card)) return;
    dispatch({
      type: "updateActivePreset",
      update: (p) => {
        const nextIds = [...p.mainDeckIds];
        nextIds[slotIndex] = card?.id ?? null;
        return { ...p, mainDeckIds: nextIds };
      },
    });
  }, [mainSlots]);

  const clearMain = useCallback(() => {
    dispatch({
      type: "updateActivePreset",
      update: (p) => ({ ...p, mainDeckIds: Array(DECK_SIZE).fill(null) }),
    });
  }, []);

  const setParentCard = useCallback((slotIndex: number, card: CardIndexEntry | null) => {
    if (card && !canPlaceCard(parentSlots, slotIndex, card)) return;
    dispatch({
      type: "updateActivePreset",
      update: (p) => {
        const nextIds = [...p.parentDeckIds];
        nextIds[slotIndex] = card?.id ?? null;
        return { ...p, parentDeckIds: nextIds };
      },
    });
  }, [parentSlots]);

  const clearParent = useCallback(() => {
    dispatch({
      type: "updateActivePreset",
      update: (p) => ({ ...p, parentDeckIds: Array(DECK_SIZE).fill(null) }),
    });
  }, []);

  const copyMainToParent = useCallback(() => {
    dispatch({
      type: "updateActivePreset",
      update: (p) => ({
        ...p,
        parentDeckIds: [...p.mainDeckIds],
        parentChainChoices: p.mainChainChoices ? { ...p.mainChainChoices } : p.parentChainChoices,
      }),
    });
  }, []);

  // Target Track & Course Actions
  const setTrackId = useCallback(
    (newTrackId: number) => {
      const d = trackDetailsCache[newTrackId];
      const firstCourseId = d?.courses[0]?.id ?? DEFAULT_COURSE_ID;
      dispatch({
        type: "updateActivePreset",
        update: (p) => ({
          ...p,
          trackInfo: { ...p.trackInfo, trackId: newTrackId, courseId: firstCourseId },
        }),
      });
    },
    [trackDetailsCache],
  );

  const setCourseId = useCallback((newCourseId: number) => {
    dispatch({
      type: "updateActivePreset",
      update: (p) => ({
        ...p,
        trackInfo: { ...p.trackInfo, courseId: newCourseId },
      }),
    });
  }, []);

  const setRunningStyle = useCallback((style: RunningStyle | null) => {
    dispatch({
      type: "updateActivePreset",
      update: (p) => ({
        ...p,
        trackInfo: { ...p.trackInfo, runningStyle: style },
      }),
    });
  }, []);

  const setRacerCount = useCallback((count: number) => {
    const clamped = Math.min(18, Math.max(9, Math.round(count)));
    dispatch({
      type: "updateActivePreset",
      update: (p) => ({
        ...p,
        trackInfo: { ...p.trackInfo, racerCount: clamped },
      }),
    });
  }, []);

  const applyPvpPreset = useCallback((event: PvpEvent) => {
    dispatch({
      type: "updateActivePreset",
      update: (p) => ({
        ...p,
        trackInfo: {
          ...p.trackInfo,
          trackId: event.trackId,
          courseId: event.courseId,
          racerCount: event.racerCount,
          pvpEventId: event.id,
        },
      }),
    });
  }, []);

  const clearPvpPreset = useCallback(() => {
    dispatch({
      type: "updateActivePreset",
      update: (p) => ({
        ...p,
        trackInfo: { ...p.trackInfo, pvpEventId: null },
      }),
    });
  }, []);

  // Chain choices are single-sourced in the active preset.
  const setChainChoice = useCallback(
    (mode: "main" | "parent", cardId: number, eventId: number, choiceIndex: number) => {
      const key = `${cardId}:${eventId}`;
      dispatch({
        type: "updateActivePreset",
        update: (p) => {
          if (mode === "main") {
            return { ...p, mainChainChoices: { ...(p.mainChainChoices ?? {}), [key]: choiceIndex } };
          }
          return { ...p, parentChainChoices: { ...(p.parentChainChoices ?? {}), [key]: choiceIndex } };
        },
      });
    },
    [],
  );

  const getChainChoice = useCallback(
    (mode: "main" | "parent", cardId: number, eventId: number, defaultChoiceIndex = 1) => {
      const key = `${cardId}:${eventId}`;
      const choices = mode === "main" ? activePreset.mainChainChoices : activePreset.parentChainChoices;
      if (choices && typeof choices[key] === "number") {
        return choices[key];
      }
      if (choices && typeof choices[String(cardId)] === "number") {
        return choices[String(cardId)];
      }
      return defaultChoiceIndex;
    },
    [activePreset.mainChainChoices, activePreset.parentChainChoices],
  );

  const resetCardChainChoices = useCallback(
    (mode: "main" | "parent", cardId: number) => {
      const prefix = `${cardId}:`;
      dispatch({
        type: "updateActivePreset",
        update: (p) => {
          if (mode === "main") {
            const current = { ...(p.mainChainChoices ?? {}) };
            for (const key of Object.keys(current)) {
              if (key.startsWith(prefix)) delete current[key];
            }
            return { ...p, mainChainChoices: current };
          }
          const current = { ...(p.parentChainChoices ?? {}) };
          for (const key of Object.keys(current)) {
            if (key.startsWith(prefix)) delete current[key];
          }
          return { ...p, parentChainChoices: current };
        },
      });
    },
    [],
  );

  // Parenting setup for active preset
  const parentingSetup = useMemo<ParentingSetup>(() => {
    return activePreset.parentingSetup ?? DEFAULT_PARENTING_SETUP;
  }, [activePreset.parentingSetup]);

  const setParentingSetup = useCallback(
    (updater: ParentingSetup | ((prev: ParentingSetup) => ParentingSetup)) => {
      dispatch({
        type: "updateActivePreset",
        update: (p) => {
          const current = p.parentingSetup ?? DEFAULT_PARENTING_SETUP;
          const next = typeof updater === "function" ? updater(current) : updater;
          return { ...p, parentingSetup: next };
        },
      });
    },
    [],
  );

  // Skill derivation using pure extracted modules
  const mainSkills = useMemo<DeckSkill[]>(
    () => deriveSkillsForDeck(mainSlots, false, skillsByCard, activePreset.mainChainChoices),
    [mainSlots, skillsByCard, activePreset.mainChainChoices],
  );

  const mainSkillIdSet = useMemo<Set<number>>(
    () => deriveMainSkillIdSet(mainSkills),
    [mainSkills],
  );

  const rawParentSkills = useMemo<DeckSkill[]>(
    () => deriveSkillsForDeck(parentSlots, true, skillsByCard, activePreset.parentChainChoices),
    [parentSlots, skillsByCard, activePreset.parentChainChoices],
  );

  const mainGrantsBySkillId = useMemo<Map<number, DeckSkillGrant[]>>(
    () => deriveMainGrantsBySkillId(mainSkills),
    [mainSkills],
  );

  const parentSkills = useMemo<ParentDeckSkill[]>(
    () => deriveParentSkills(rawParentSkills, mainSkillIdSet, mainGrantsBySkillId),
    [rawParentSkills, mainSkillIdSet, mainGrantsBySkillId],
  );

  const loading = !dataStore || !index;

  const value = useMemo<DeckContextValue>(
    () => ({
      presets: presetState.presets,
      activePresetId: presetState.activeId,
      activePreset,
      setActivePresetId,
      addPreset,
      duplicatePreset,
      updatePresetName,
      deletePreset,
      reorderPresets,
      importPreset,

      setChainChoice,
      getChainChoice,
      resetCardChainChoices,

      mainSlots,
      setMainCard,
      clearMain,
      mainSkills,
      mainSkillIdSet,

      parentSlots,
      setParentCard,
      clearParent,
      copyMainToParent,
      parentSkills,

      tracks,
      trackId: activeTrackId,
      setTrackId,
      trackDetail: activeTrackDetail,
      courseId: activeCourseId,
      setCourseId,
      activeCourseRow,
      course,
      distance,
      surface,

      runningStyle: activePreset.trackInfo.runningStyle,
      setRunningStyle,
      racerCount: activePreset.trackInfo.racerCount,
      setRacerCount,

      activePvpEventId,
      activePvpEvent,
      applyPvpPreset,
      clearPvpPreset,

      parentingSetup,
      setParentingSetup,

      allCards: index,
      skillsByCard,
      loading,
    }),
    [
      presetState.presets,
      presetState.activeId,
      activePreset,
      setActivePresetId,
      addPreset,
      duplicatePreset,
      updatePresetName,
      deletePreset,
      reorderPresets,
      importPreset,
      setChainChoice,
      getChainChoice,
      resetCardChainChoices,
      mainSlots,
      setMainCard,
      clearMain,
      mainSkills,
      mainSkillIdSet,
      parentSlots,
      setParentCard,
      clearParent,
      copyMainToParent,
      parentSkills,
      tracks,
      activeTrackId,
      setTrackId,
      activeTrackDetail,
      activeCourseId,
      setCourseId,
      activeCourseRow,
      course,
      distance,
      surface,
      setRunningStyle,
      setRacerCount,
      activePvpEventId,
      activePvpEvent,
      applyPvpPreset,
      clearPvpPreset,
      parentingSetup,
      setParentingSetup,
      index,
      skillsByCard,
      loading,
    ],
  );

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

export { useDeck } from "../lib/deck/context";
