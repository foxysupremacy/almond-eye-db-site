import { readJsonStorage, writeJsonStorage } from "@/lib/storage/persistence";
import type { RankingMetric } from "@/lib/rankings";

export type StyleTab = "all" | 1 | 2 | 3 | 4;
export interface RankingsPrefs { styleTab: StyleTab; score: RankingMetric }

export const RANKINGS_PREFS_KEY = "rankings.v1";
const VALID: readonly StyleTab[] = ["all", 1, 2, 3, 4];
const VALID_SCORES: readonly RankingMetric[] = ["average", "best"];

function readRaw(): { styleTab?: unknown; score?: unknown } | null {
  const raw = readJsonStorage<{ styleTab?: unknown; score?: unknown }>(RANKINGS_PREFS_KEY);
  return raw && typeof raw === "object" ? raw : null;
}

/** The stored style tab, or null when nothing valid has been saved yet. */
export function readStoredStyleTab(): StyleTab | null {
  const tab = readRaw()?.styleTab;
  return VALID.includes(tab as StyleTab) ? (tab as StyleTab) : null;
}

/** The stored score metric, or null when nothing valid has been saved yet. */
export function readStoredScore(): RankingMetric | null {
  const score = readRaw()?.score;
  return VALID_SCORES.includes(score as RankingMetric) ? (score as RankingMetric) : null;
}

export function loadRankingsPrefs(): RankingsPrefs {
  return { styleTab: readStoredStyleTab() ?? "all", score: readStoredScore() ?? "average" };
}

/**
 * Saves the given prefs, keeping the other stored (valid) value. A field that was never chosen stays unset, so the
 * view can still default the style tab to the header's running style.
 */
export function saveRankingsPrefs(patch: Partial<RankingsPrefs>): void {
  const next: Partial<RankingsPrefs> = {};
  const styleTab = patch.styleTab ?? readStoredStyleTab();
  if (styleTab != null) next.styleTab = styleTab;
  const score = patch.score ?? readStoredScore();
  if (score != null) next.score = score;
  writeJsonStorage(RANKINGS_PREFS_KEY, next);
}
