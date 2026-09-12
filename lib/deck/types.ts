import type {
  CardIndexEntry,
  CardSkills,
  Racetrack,
  RacetrackDetail,
  CourseRow,
} from "../api";
import type { EventSkillMetadata } from "../data-store";
import type { Course } from "../skill-engine/types";
import type { PvpEvent } from "../pvp-events";

/** 1: Runner, 2: Leader, 3: Betweener, 4: Chaser, 5: Runaway */
export type RunningStyle = 1 | 2 | 3 | 4 | 5;

/** 1: Sprint, 2: Mile, 3: Medium, 4: Long */
export type DistanceType = 1 | 2 | 3 | 4;

/** 1: Turf, 2: Dirt */
export type SurfaceType = 1 | 2;

export interface TrackInfo {
  trackId: number;
  courseId: number;
  runningStyle: RunningStyle | null;
  racerCount: number;
  pvpEventId?: string | null;
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

export interface DeckContextValue {
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
  importPreset: (presetData: Partial<DeckPreset>, asNewPreset: boolean, customName?: string) => string;

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

  // PvP Event Presets
  activePvpEventId: string | null;
  activePvpEvent: PvpEvent | null;
  applyPvpPreset: (event: PvpEvent) => void;
  clearPvpPreset: () => void;

  allCards: CardIndexEntry[] | null;
  skillsByCard: Record<number, CardSkills | null>;
  pendingSkillCards: Set<number>;
  loading: boolean;
}
