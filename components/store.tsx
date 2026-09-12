"use client";

// Deck & Preset State:
// - Manages multiple Deck Presets (combo of Main Deck + Parent Deck + Target Race & Style).
// - Merged Target Profile = Venue + Course + Running Style + Racer Count.
// - Caches card skills from API.
// - Derives Main Deck skills and Parent Deck skills with duplicate highlighting.
// - Supplies unified global track/course geometry and derived distance/surface.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

// Extracted Domain Modules
import {
  DECK_SIZE,
  PRESETS_STORAGE_KEY,
  VISUALIZER_SAVE_KEY,
  CHAIN_CHOICES_STORAGE_KEY,
  DEFAULT_TRACK_ID,
  DEFAULT_COURSE_ID,
  RUNNING_STYLE_LABELS,
  RUNNING_STYLE_OPTIONS,
  DISTANCE_LABELS,
  SURFACE_LABELS,
} from "../lib/deck/constants";

import type {
  RunningStyle,
  DistanceType,
  SurfaceType,
  TrackInfo,
  DeckPreset,
  DeckSkillGrant,
  DeckSkill,
  ParentDeckSkill,
  DeckContextValue,
} from "../lib/deck/types";

import { getDefaultChoiceIndex } from "../lib/deck/event-choices";
import {
  createDefaultPreset,
  DEFAULT_PRESET,
  loadStoredPresets,
  persistPresetsAndVisualizer,
} from "../lib/deck/preset-storage";
import {
  deriveSkillsForDeck,
  deriveMainSkillIdSet,
  deriveMainGrantsBySkillId,
  deriveParentSkills,
} from "../lib/deck/skill-resolver";
import { canPlaceCard } from "../lib/deck/card-constraints";

const DeckContext = createContext<DeckContextValue | null>(null);

export function DeckProvider({ children }: { children: ReactNode }) {
  const [presetState, setPresetState] = useState<{ presets: DeckPreset[]; activeId: string }>({
    presets: [DEFAULT_PRESET],
    activeId: DEFAULT_PRESET.id,
  });
  const [hasHydrated, setHasHydrated] = useState(false);

  // Restore saved presets from localStorage after initial hydration
  useEffect(() => {
    const loaded = loadStoredPresets();
    if (loaded) {
      setPresetState(loaded);
    }
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

  const pending = useMemo(() => new Set<number>(), []);

  // Preset operations
  const setActivePresetId = useCallback((id: string) => {
    setPresetState((prev) => ({ ...prev, activeId: id }));
  }, []);

  const addPreset = useCallback((name?: string) => {
    const id = `preset-${Date.now()}`;
    const newName = name?.trim() || `Preset ${presetState.presets.length + 1}`;
    const newPreset = createDefaultPreset(id, newName);
    setPresetState((prev) => ({
      presets: [...prev.presets, newPreset],
      activeId: id,
    }));
    return id;
  }, [presetState.presets.length]);

  const duplicatePreset = useCallback(
    (id: string) => {
      const src = presetState.presets.find((p) => p.id === id);
      if (!src) return "";
      const newId = `preset-${Date.now()}`;
      const clone: DeckPreset = {
        ...src,
        id: newId,
        name: `${src.name} (Copy)`,
        mainDeckIds: [...src.mainDeckIds],
        parentDeckIds: [...src.parentDeckIds],
        trackInfo: { ...src.trackInfo },
        mainChainChoices: src.mainChainChoices ? { ...src.mainChainChoices } : undefined,
        parentChainChoices: src.parentChainChoices ? { ...src.parentChainChoices } : undefined,
      };
      setPresetState((prev) => ({
        presets: [...prev.presets, clone],
        activeId: newId,
      }));
      return newId;
    },
    [presetState.presets],
  );

  const updatePresetName = useCallback((id: string, name: string) => {
    setPresetState((prev) => ({
      ...prev,
      presets: prev.presets.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)),
    }));
  }, []);

  const deletePreset = useCallback((id: string) => {
    setPresetState((prev) => {
      if (prev.presets.length <= 1) return prev;
      const remaining = prev.presets.filter((p) => p.id !== id);
      const newActiveId = prev.activeId === id ? remaining[0].id : prev.activeId;
      return { presets: remaining, activeId: newActiveId };
    });
  }, []);

  const reorderPresets = useCallback((fromIndex: number, toIndex: number) => {
    setPresetState((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.presets.length || toIndex < 0 || toIndex >= prev.presets.length) {
        return prev;
      }
      const next = [...prev.presets];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...prev, presets: next };
    });
  }, []);

  const importPreset = useCallback((presetData: Partial<DeckPreset>, asNewPreset: boolean, customName?: string): string => {
    const finalName = customName?.trim() || presetData.name?.trim() || "Shared Build";
    if (asNewPreset) {
      const newId = `preset-${Date.now()}`;
      const newPreset: DeckPreset = {
        id: newId,
        name: finalName,
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
      setPresetState((prev) => ({
        presets: [...prev.presets, newPreset],
        activeId: newId,
      }));
      return newId;
    } else {
      setPresetState((prev) => ({
        ...prev,
        presets: prev.presets.map((p) => {
          if (p.id !== prev.activeId) return p;
          return {
            ...p,
            name: customName?.trim() || p.name,
            mainDeckIds: presetData.mainDeckIds?.slice(0, DECK_SIZE) ?? p.mainDeckIds,
            parentDeckIds: presetData.parentDeckIds?.slice(0, DECK_SIZE) ?? p.parentDeckIds,
            trackInfo: {
              trackId: presetData.trackInfo?.trackId ?? p.trackInfo.trackId,
              courseId: presetData.trackInfo?.courseId ?? p.trackInfo.courseId,
              runningStyle: presetData.trackInfo?.runningStyle !== undefined ? presetData.trackInfo.runningStyle : p.trackInfo.runningStyle,
              racerCount: presetData.trackInfo?.racerCount ?? p.trackInfo.racerCount,
              pvpEventId: presetData.trackInfo?.pvpEventId ?? p.trackInfo.pvpEventId,
            },
            mainChainChoices: presetData.mainChainChoices ? { ...presetData.mainChainChoices } : p.mainChainChoices,
            parentChainChoices: presetData.parentChainChoices ? { ...presetData.parentChainChoices } : p.parentChainChoices,
          };
        }),
      }));
      return presetState.activeId;
    }
  }, [presetState.activeId]);

  // Card modifications
  // Character-identity constraint: within each deck, two different cards of
  // the same uma may never coexist. Main and Parent decks are independent —
  // the setters are the single choke point every picking UI funnels through.
  const setMainCard = useCallback((slotIndex: number, card: CardIndexEntry | null) => {
    if (card && !canPlaceCard(mainSlots, slotIndex, card)) return;
    setPresetState((prev) => ({
      ...prev,
      presets: prev.presets.map((p) => {
        if (p.id !== prev.activeId) return p;
        const nextIds = [...p.mainDeckIds];
        nextIds[slotIndex] = card?.id ?? null;
        return { ...p, mainDeckIds: nextIds };
      }),
    }));
  }, [mainSlots]);

  const clearMain = useCallback(() => {
    setPresetState((prev) => ({
      ...prev,
      presets: prev.presets.map((p) =>
        p.id === prev.activeId ? { ...p, mainDeckIds: Array(DECK_SIZE).fill(null) } : p,
      ),
    }));
  }, []);

  const setParentCard = useCallback((slotIndex: number, card: CardIndexEntry | null) => {
    if (card && !canPlaceCard(parentSlots, slotIndex, card)) return;
    setPresetState((prev) => ({
      ...prev,
      presets: prev.presets.map((p) => {
        if (p.id !== prev.activeId) return p;
        const nextIds = [...p.parentDeckIds];
        nextIds[slotIndex] = card?.id ?? null;
        return { ...p, parentDeckIds: nextIds };
      }),
    }));
  }, [parentSlots]);

  const clearParent = useCallback(() => {
    setPresetState((prev) => ({
      ...prev,
      presets: prev.presets.map((p) =>
        p.id === prev.activeId ? { ...p, parentDeckIds: Array(DECK_SIZE).fill(null) } : p,
      ),
    }));
  }, []);

  const copyMainToParent = useCallback(() => {
    setPresetState((prev) => ({
      ...prev,
      presets: prev.presets.map((p) =>
        p.id === prev.activeId
          ? {
              ...p,
              parentDeckIds: [...p.mainDeckIds],
              parentChainChoices: p.mainChainChoices ? { ...p.mainChainChoices } : p.parentChainChoices,
            }
          : p,
      ),
    }));
  }, []);

  // Target Track & Course Actions
  const setTrackId = useCallback(
    (newTrackId: number) => {
      const d = trackDetailsCache[newTrackId];
      const firstCourseId = d?.courses[0]?.id ?? DEFAULT_COURSE_ID;
      setPresetState((prev) => ({
        ...prev,
        presets: prev.presets.map((p) =>
          p.id === prev.activeId
            ? {
                ...p,
                trackInfo: {
                  ...p.trackInfo,
                  trackId: newTrackId,
                  courseId: firstCourseId,
                },
              }
            : p,
        ),
      }));
    },
    [trackDetailsCache],
  );

  const setCourseId = useCallback((newCourseId: number) => {
    setPresetState((prev) => ({
      ...prev,
      presets: prev.presets.map((p) =>
        p.id === prev.activeId
          ? {
              ...p,
              trackInfo: { ...p.trackInfo, courseId: newCourseId },
            }
          : p,
      ),
    }));
  }, []);

  const setRunningStyle = useCallback((style: RunningStyle | null) => {
    setPresetState((prev) => ({
      ...prev,
      presets: prev.presets.map((p) =>
        p.id === prev.activeId
          ? {
              ...p,
              trackInfo: { ...p.trackInfo, runningStyle: style },
            }
          : p,
      ),
    }));
  }, []);

  const setRacerCount = useCallback((count: number) => {
    const clamped = Math.min(18, Math.max(9, Math.round(count)));
    setPresetState((prev) => ({
      ...prev,
      presets: prev.presets.map((p) =>
        p.id === prev.activeId
          ? {
              ...p,
              trackInfo: { ...p.trackInfo, racerCount: clamped },
            }
          : p,
      ),
    }));
  }, []);

  const applyPvpPreset = useCallback((event: PvpEvent) => {
    setPresetState((prev) => ({
      ...prev,
      presets: prev.presets.map((p) =>
        p.id === prev.activeId
          ? {
              ...p,
              trackInfo: {
                ...p.trackInfo,
                trackId: event.trackId,
                courseId: event.courseId,
                racerCount: event.racerCount,
                pvpEventId: event.id,
              },
            }
          : p,
      ),
    }));
  }, []);

  const clearPvpPreset = useCallback(() => {
    setPresetState((prev) => ({
      ...prev,
      presets: prev.presets.map((p) =>
        p.id === prev.activeId
          ? {
              ...p,
              trackInfo: {
                ...p.trackInfo,
                pvpEventId: null,
              },
            }
          : p,
      ),
    }));
  }, []);

  const setChainChoice = useCallback(
    (mode: "main" | "parent", cardId: number, eventId: number, choiceIndex: number) => {
      const key = `${cardId}:${eventId}`;
      setPresetState((prev) => ({
        ...prev,
        presets: prev.presets.map((p) => {
          if (p.id !== prev.activeId) return p;
          if (mode === "main") {
            const current = p.mainChainChoices ?? {};
            return {
              ...p,
              mainChainChoices: { ...current, [key]: choiceIndex },
            };
          } else {
            const current = p.parentChainChoices ?? {};
            return {
              ...p,
              parentChainChoices: { ...current, [key]: choiceIndex },
            };
          }
        }),
      }));

      // Persist to standalone CHAIN_CHOICES_STORAGE_KEY as well
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          const raw = window.localStorage.getItem(CHAIN_CHOICES_STORAGE_KEY);
          const map = raw ? JSON.parse(raw) : {};
          map[key] = choiceIndex;
          window.localStorage.setItem(CHAIN_CHOICES_STORAGE_KEY, JSON.stringify(map));
        }
      } catch {
        /* ignore storage errors */
      }
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
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          const raw = window.localStorage.getItem(CHAIN_CHOICES_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (typeof parsed?.[key] === "number") {
              return parsed[key];
            }
          }
        }
      } catch {
        /* ignore storage errors */
      }
      return defaultChoiceIndex;
    },
    [activePreset.mainChainChoices, activePreset.parentChainChoices],
  );

  const resetCardChainChoices = useCallback(
    (mode: "main" | "parent", cardId: number) => {
      const prefix = `${cardId}:`;
      setPresetState((prev) => ({
        ...prev,
        presets: prev.presets.map((p) => {
          if (p.id !== prev.activeId) return p;
          if (mode === "main") {
            const current = { ...(p.mainChainChoices ?? {}) };
            for (const key of Object.keys(current)) {
              if (key.startsWith(prefix)) delete current[key];
            }
            return { ...p, mainChainChoices: current };
          } else {
            const current = { ...(p.parentChainChoices ?? {}) };
            for (const key of Object.keys(current)) {
              if (key.startsWith(prefix)) delete current[key];
            }
            return { ...p, parentChainChoices: current };
          }
        }),
      }));

      try {
        if (typeof window !== "undefined" && window.localStorage) {
          const raw = window.localStorage.getItem(CHAIN_CHOICES_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            let changed = false;
            for (const key of Object.keys(parsed)) {
              if (key.startsWith(prefix)) {
                delete parsed[key];
                changed = true;
              }
            }
            if (changed) {
              window.localStorage.setItem(CHAIN_CHOICES_STORAGE_KEY, JSON.stringify(parsed));
            }
          }
        }
      } catch {
        /* ignore storage errors */
      }
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

      slots: mainSlots,
      mainSlots,
      setCard: setMainCard,
      setMainCard,
      clear: clearMain,
      clearMain,
      skills: mainSkills,
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

      allCards: index,
      skillsByCard,
      pendingSkillCards: pending,
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
      index,
      skillsByCard,
      pending,
      loading,
    ],
  );

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

export function useDeck(): DeckContextValue {
  const ctx = useContext(DeckContext);
  if (!ctx) throw new Error("useDeck must be used within <DeckProvider>");
  return ctx;
}
