import type { RunningStyle, DistanceType, SurfaceType } from "./types";

export const DECK_SIZE = 6;
export const PRESETS_STORAGE_KEY = "presets.v2";
export const ACTIVE_PRESET_STORAGE_KEY = "almondeye_active_preset_id";
export const VISUALIZER_SAVE_KEY = "visualizer.v1";
export const CHAIN_CHOICES_STORAGE_KEY = "chain_choices.v1";

export const DEFAULT_TRACK_ID = 10006; // Tokyo
export const DEFAULT_COURSE_ID = 10606; // 2400m Turf

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
