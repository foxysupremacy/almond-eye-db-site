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
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  type CardIndexEntry,
  type CardSkills,
  type Racetrack,
  type RacetrackDetail,
  type CourseRow,
  flattenCourse,
} from "../lib/api";
import {
  initDataStore,
  type DataStore,
  type EventSkillMetadata,
  type CardEventDetail,
} from "../lib/data-store";
import type { Course } from "../lib/skill-engine/types";
import { getInheritableSkillForGold } from "../lib/skill-rarity";

const DECK_SIZE = 6;
const PRESETS_STORAGE_KEY = "presets.v2";
const VISUALIZER_SAVE_KEY = "visualizer.v1";
export const CHAIN_CHOICES_STORAGE_KEY = "chain_choices.v1";

/** 1: Runner, 2: Leader, 3: Betweener, 4: Chaser, 5: Runaway */
export type RunningStyle = 1 | 2 | 3 | 4 | 5;

/** 1: Sprint, 2: Mile, 3: Medium, 4: Long */
export type DistanceType = 1 | 2 | 3 | 4;

/** 1: Turf, 2: Dirt */
export type SurfaceType = 1 | 2;

export const RUNNING_STYLE_LABELS: Record<RunningStyle, string> = {
  1: "Runner",
  2: "Leader",
  3: "Betweener",
  4: "Chaser",
  5: "Runaway",
};

export const RUNNING_STYLE_OPTIONS: { value: RunningStyle | null; label: string }[] = [
  { value: null, label: "Any style" },
  { value: 1, label: "Runner" },
  { value: 2, label: "Leader" },
  { value: 3, label: "Betweener" },
  { value: 4, label: "Chaser" },
];

export const DISTANCE_LABELS: Record<DistanceType, string> = {
  1: "Sprint (1000-1400m)",
  2: "Mile (1600m)",
  3: "Medium (2000-2400m)",
  4: "Long (2500m+)",
};

export const SURFACE_LABELS: Record<SurfaceType, string> = {
  1: "Turf",
  2: "Dirt",
};

export interface TrackInfo {
  trackId: number;
  courseId: number;
  runningStyle: RunningStyle | null;
  racerCount: number;
}

export function getDefaultChoiceIndex(
  eventDetail: CardEventDetail,
  skillRarityLookup?: (id: number) => number,
): number {
  if (!eventDetail.choices || eventDetail.choices.length <= 1) return 1;

  let bestIndex = 1;
  let bestScore = -1;

  for (const ch of eventDetail.choices) {
    let score = 0;
    for (const sid of ch.skillIds) {
      const rarity = skillRarityLookup ? skillRarityLookup(sid) : (sid >= 200000 ? 1 : 1);
      score += rarity === 2 ? 10 : 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = ch.index;
    }
  }

  return bestIndex;
}

export interface DeckPreset {
  id: string;
  name: string;
  mainDeckIds: (number | null)[];
  parentDeckIds: (number | null)[];
  trackInfo: TrackInfo;
  mainChainChoices?: Record<string, number>;
  parentChainChoices?: Record<string, number>;
}

export interface DeckSkillGrant {
  cardId: number;
  cardName: string;
  source: "event" | "hint";
  eventMeta?: EventSkillMetadata;
  originalGoldSkill?: {
    id: number;
    nameEn: string;
    nameJp: string;
  };
}

export interface DeckSkill {
  id: number;
  nameJp: string;
  nameEn: string;
  descEn?: string;
  rarity: number;
  source: "event" | "hint";
  cardId: number;
  cardName: string;
  iconId?: number | null;
  eventMeta?: EventSkillMetadata;
  grants?: DeckSkillGrant[];
}

export interface ParentDeckSkill extends DeckSkill {
  isDuplicateInMain: boolean;
  mainCardGrants?: DeckSkillGrant[];
  parentDuplicateCount: number;
  isUniqueToParent: boolean;
  originalGoldSkill?: {
    id: number;
    nameEn: string;
    nameJp: string;
  };
}

interface DeckContextValue {
  // Presets
  presets: DeckPreset[];
  activePresetId: string;
  activePreset: DeckPreset;
  setActivePresetId: (id: string) => void;
  addPreset: (name?: string) => string;
  duplicatePreset: (id: string) => string;
  updatePresetName: (id: string, name: string) => void;
  deletePreset: (id: string) => void;
  reorderPresets: (fromIndex: number, toIndex: number) => void;

  // Chain choices
  setChainChoice: (mode: "main" | "parent", cardId: number, eventId: number, choiceIndex: number) => void;
  getChainChoice: (mode: "main" | "parent", cardId: number, eventId: number, defaultChoiceIndex?: number) => number;
  resetCardChainChoices: (mode: "main" | "parent", cardId: number) => void;

  // Main Deck
  slots: (CardIndexEntry | null)[];
  mainSlots: (CardIndexEntry | null)[];
  setCard: (index: number, card: CardIndexEntry | null) => void;
  setMainCard: (index: number, card: CardIndexEntry | null) => void;
  clear: () => void;
  clearMain: () => void;
  skills: DeckSkill[];
  mainSkills: DeckSkill[];
  mainSkillIdSet: Set<number>;

  // Parent Deck
  parentSlots: (CardIndexEntry | null)[];
  setParentCard: (index: number, card: CardIndexEntry | null) => void;
  clearParent: () => void;
  copyMainToParent: () => void;
  parentSkills: ParentDeckSkill[];

  // Global Unified Target Race & Course
  tracks: Racetrack[] | null;
  trackId: number;
  setTrackId: (id: number) => void;
  trackDetail: RacetrackDetail | null;
  courseId: number;
  setCourseId: (id: number) => void;
  activeCourseRow: CourseRow | null;
  course: Course | null;
  distance: DistanceType | null;
  surface: SurfaceType | null;

  runningStyle: RunningStyle | null;
  setRunningStyle: (s: RunningStyle | null) => void;
  racerCount: number;
  setRacerCount: (c: number) => void;

  // Loading & Card Index
  allCards: CardIndexEntry[] | null;
  skillsByCard: Record<number, CardSkills | null>;
  pendingSkillCards: Set<number>;
  loading: boolean;
}

const DeckContext = createContext<DeckContextValue | null>(null);

const DEFAULT_TRACK_ID = 10006; // Tokyo
const DEFAULT_COURSE_ID = 10606; // 2400m Turf

function createDefaultPreset(id: string, name: string): DeckPreset {
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
    },
  };
}

function cleanChoices(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const res: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k === "string" && typeof v === "number" && Number.isFinite(v)) {
      res[k] = v;
    }
  }
  return Object.keys(res).length > 0 ? res : undefined;
}

const DEFAULT_PRESET = createDefaultPreset("default-1", "Default Build");

export function DeckProvider({ children }: { children: ReactNode }) {
  const [presetState, setPresetState] = useState<{ presets: DeckPreset[]; activeId: string }>({
    presets: [DEFAULT_PRESET],
    activeId: DEFAULT_PRESET.id,
  });
  const [hasHydrated, setHasHydrated] = useState(false);

  // Restore saved presets from localStorage after initial hydration
  useEffect(() => {
    try {
      const rawPresets = window.localStorage.getItem(PRESETS_STORAGE_KEY);
      if (rawPresets) {
        const parsed = JSON.parse(rawPresets);
        if (Array.isArray(parsed) && parsed.length > 0) {
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
            },
            mainChainChoices: cleanChoices(p.mainChainChoices),
            parentChainChoices: cleanChoices(p.parentChainChoices),
          }));
          if (cleaned.length > 0) {
            setPresetState({ presets: cleaned, activeId: cleaned[0].id });
          }
        }
      }
    } catch {
      /* ignore storage errors */
    } finally {
      setHasHydrated(true);
    }
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

  // Persist presets and visualizer state once hydrated
  useEffect(() => {
    if (!hasHydrated) return;
    try {
      window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presetState.presets));
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

  // Card modifications
  const setMainCard = useCallback((slotIndex: number, card: CardIndexEntry | null) => {
    setPresetState((prev) => ({
      ...prev,
      presets: prev.presets.map((p) => {
        if (p.id !== prev.activeId) return p;
        const nextIds = [...p.mainDeckIds];
        nextIds[slotIndex] = card?.id ?? null;
        return { ...p, mainDeckIds: nextIds };
      }),
    }));
  }, []);

  const clearMain = useCallback(() => {
    setPresetState((prev) => ({
      ...prev,
      presets: prev.presets.map((p) =>
        p.id === prev.activeId ? { ...p, mainDeckIds: Array(DECK_SIZE).fill(null) } : p,
      ),
    }));
  }, []);

  const setParentCard = useCallback((slotIndex: number, card: CardIndexEntry | null) => {
    setPresetState((prev) => ({
      ...prev,
      presets: prev.presets.map((p) => {
        if (p.id !== prev.activeId) return p;
        const nextIds = [...p.parentDeckIds];
        nextIds[slotIndex] = card?.id ?? null;
        return { ...p, parentDeckIds: nextIds };
      }),
    }));
  }, []);

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

  // Skill derivation
  const deriveSkills = useCallback(
    (slotsArr: (CardIndexEntry | null)[], isParentDeck = false): DeckSkill[] => {
      const byId = new Map<number, DeckSkill>();
      const chainChoicesMap = isParentDeck ? activePreset.parentChainChoices : activePreset.mainChainChoices;

      slotsArr.forEach((card) => {
        if (!card) return;
        const cs = skillsByCard[card.id];
        if (!cs) return;
        const cardName = card.nameEn || card.nameJp;

        const push = (
          s: CardSkills["eventSkills"][number],
          source: "event" | "hint",
          originalGoldSkill?: { id: number; nameEn: string; nameJp: string },
        ) => {
          const grant: DeckSkillGrant = {
            cardId: card.id,
            cardName,
            source,
            eventMeta: s.eventMeta,
            originalGoldSkill,
          };
          const existing = byId.get(s.id);
          if (!existing) {
            byId.set(s.id, {
              id: s.id,
              nameJp: s.nameJp,
              nameEn: s.nameEn,
              descEn: s.descEn,
              rarity: s.rarity,
              source,
              cardId: card.id,
              cardName,
              iconId: s.iconId,
              eventMeta: s.eventMeta,
              grants: [grant],
            });
          } else {
            if (!existing.grants?.some((g) => g.cardId === card.id && g.source === source)) {
              existing.grants = [...(existing.grants ?? []), grant];
            }
          }
        };

        // Hints are always inheritable White skills
        cs.hintSkills.forEach((s) => push(s, "hint"));

        // Events: Filter by user's chosen branch (or default optimal choice)
        cs.eventSkills.forEach((s) => {
          if (s.eventMeta && card.eventDetails) {
            const evDetail = card.eventDetails.find((ev) => ev.eventId === s.eventMeta!.eventId);
            if (evDetail && evDetail.choices && evDetail.choices.length > 1) {
              const choiceKey = `${card.id}:${s.eventMeta.eventId}`;
              const selectedChoice =
                chainChoicesMap?.[choiceKey] ??
                getDefaultChoiceIndex(
                  evDetail,
                  (id) => skillsByCard[card.id]?.eventSkills.find((sk) => sk.id === id)?.rarity ?? 1,
                );
              if (s.eventMeta.choiceIndex !== selectedChoice) {
                return; // User/default choice excludes this skill
              }
            }
          }

          if (isParentDeck && s.rarity === 2) {
            const mapped = getInheritableSkillForGold(s.id);
            if (!mapped) return; // Skip uninheritable gold skills with no white counterpart
            push(
              {
                id: mapped.whiteId,
                nameEn: mapped.whiteNameEn,
                nameJp: mapped.whiteNameJp,
                descEn: s.descEn,
                rarity: 1,
                isRCard: s.isRCard,
                iconId: s.iconId,
                eventMeta: s.eventMeta,
              },
              "event",
              { id: s.id, nameEn: s.nameEn, nameJp: s.nameJp },
            );
          } else {
            push(s, "event");
          }
        });
      });
      return [...byId.values()].sort((a, b) => a.nameEn.localeCompare(b.nameEn));
    },
    [skillsByCard, activePreset.mainChainChoices, activePreset.parentChainChoices],
  );

  const mainSkills = useMemo<DeckSkill[]>(() => deriveSkills(mainSlots, false), [deriveSkills, mainSlots]);
  const mainSkillIdSet = useMemo<Set<number>>(() => {
    const set = new Set<number>();
    mainSkills.forEach((s) => {
      set.add(s.id);
      // If main deck has a gold skill, also mark its base white skill as covered
      if (s.rarity === 2) {
        const mapped = getInheritableSkillForGold(s.id);
        if (mapped) set.add(mapped.whiteId);
      }
    });
    return set;
  }, [mainSkills]);

  const rawParentSkills = useMemo<DeckSkill[]>(() => deriveSkills(parentSlots, true), [deriveSkills, parentSlots]);

  const mainGrantsBySkillId = useMemo<Map<number, DeckSkillGrant[]>>(() => {
    const map = new Map<number, DeckSkillGrant[]>();
    mainSkills.forEach((s) => {
      if (s.grants) {
        map.set(s.id, s.grants);
        if (s.rarity === 2) {
          const mapped = getInheritableSkillForGold(s.id);
          if (mapped && !map.has(mapped.whiteId)) {
            map.set(mapped.whiteId, s.grants);
          }
        }
      }
    });
    return map;
  }, [mainSkills]);

  const parentSkills = useMemo<ParentDeckSkill[]>(() => {
    return rawParentSkills.map((s) => {
      const isDuplicateInMain = mainSkillIdSet.has(s.id);
      const mainCardGrants = mainGrantsBySkillId.get(s.id);
      const parentDuplicateCount = s.grants?.length ?? 1;
      const isUniqueToParent = !isDuplicateInMain;
      const originalGoldSkill = s.grants?.find((g) => g.originalGoldSkill)?.originalGoldSkill;

      return {
        ...s,
        isDuplicateInMain,
        mainCardGrants,
        parentDuplicateCount,
        isUniqueToParent,
        originalGoldSkill,
      };
    });
  }, [rawParentSkills, mainSkillIdSet, mainGrantsBySkillId]);

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

export { DECK_SIZE };
