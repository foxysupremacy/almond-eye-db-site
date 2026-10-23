"use client";

import { createContext, useContext } from "react";
import type {
  CourseRow,
  Racetrack,
  RacetrackDetail,
} from "@/lib/api";
import type { CustomRaceConditions } from "@/lib/deck/race-conditions";
import type { Course, RaceParameters } from "@/lib/skill-engine/types";
import type {
  DistanceType,
  RunningStyle,
  SurfaceType,
} from "@/lib/deck/types";
import type { PvpEvent } from "@/lib/pvp/events";
import type {
  PvpRaceFitAssistance,
  PvpRecommendedRace,
} from "@/lib/data/types";

export interface DeckTrackContextValue {
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

  setCustomRaceConditions: (conditions: Partial<CustomRaceConditions>) => void;
  selectCustomTrack: () => void;

  // PvP Event Presets
  activePvpEventId: string | null;
  activePvpEvent: PvpEvent | null;
  activeRaceParameters: Partial<RaceParameters>;
  applyPvpPreset: (event: PvpEvent) => void;
  clearPvpPreset: () => void;
  masterChallengeEvents: PvpRaceFitAssistance[];
  pvpRecommendationEvents: PvpRaceFitAssistance[];
  activeMasterChallengeEvent: PvpRaceFitAssistance | null;
  activeMasterChallengeRace: PvpRecommendedRace | null;
  selectMasterChallengeRace: (eventId: number, eventSubId: number) => boolean;
  clearMasterChallenge: () => void;
  racetrackDetails: RacetrackDetail[];
  loading: boolean;
}

export const DeckTrackContext = createContext<DeckTrackContextValue | null>(null);

export function useDeckTrack(): DeckTrackContextValue {
  const ctx = useContext(DeckTrackContext);
  if (!ctx) throw new Error("useDeckTrack must be used within a DeckProvider");
  return ctx;
}
