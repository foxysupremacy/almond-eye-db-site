// Tab chunk loaders shared by the lazy() tab components in app/page.tsx and the
// prefetch triggers (idle after first paint, nav hover/focus/touch). Each loader
// is memoized, so a prefetched tab mounts without showing its Suspense fallback.

import { loadCharacterEvolutions } from "@/lib/data/registry";
import { initDataStore } from "@/lib/api";
import type { AppShellRoute } from "@/app/tabs";

function once<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (!pending) {
      const attempt = load();
      pending = attempt;
      // A failed chunk fetch (offline, deploy swap) may be retried on next use.
      attempt.catch(() => {
        if (pending === attempt) pending = null;
      });
    }
    return pending;
  };
}

export const loadParentingTab = once(() =>
  import("../features/parenting").then((m) => ({ default: m.ParentingFeature })),
);

export const loadVisualizerTab = once(() =>
  import("../features/visualizer").then((m) => ({ default: m.VisualizerFeature })),
);

// Rankings build their candidate list synchronously from the evolutions dataset,
// so the tab only resolves once that deferred chunk is in memory too.
export const loadRankingsTab = once(() =>
  Promise.all([import("@/features/rankings"), loadCharacterEvolutions()]).then(([m]) => ({
    default: m.RankingsFeature,
  })),
);

export const loadVeteransTab = once(() =>
  import("../features/veterans").then((m) => ({ default: m.VeteransFeature })),
);

export const loadStaminaTab = once(() =>
  import("@/features/stamina").then((m) => ({ default: m.StaminaFeature })),
);

const TAB_LOADERS: Partial<Record<AppShellRoute, () => Promise<unknown>>> = {
  parenting: loadParentingTab,
  visualizer: loadVisualizerTab,
  rankings: loadRankingsTab,
  veterans: loadVeteransTab,
  stamina: loadStaminaTab,
};

/** Start loading a tab's chunk (no-op for tabs bundled with the shell). Never throws. */
export function preloadTab(route: AppShellRoute): void {
  TAB_LOADERS[route]?.().catch(() => {
    // The lazy() mount retries and surfaces the error; prefetch stays silent.
  });
}

/** Core tabs fetched in the background once the shell has painted. */
const IDLE_PRELOAD_ORDER: AppShellRoute[] = ["parenting", "visualizer"];

/**
 * Prefetch the next-most-used tabs once the core deck data has loaded and the
 * browser is idle, so prefetching never competes with the first paint.
 * Returns a cancel function for effect cleanup.
 */
export function scheduleIdleTabPreload(): () => void {
  if (typeof window === "undefined") return () => {};
  let cancelled = false;
  let cancelIdle: (() => void) | null = null;
  const run = () => {
    if (cancelled) return;
    for (const route of IDLE_PRELOAD_ORDER) preloadTab(route);
  };
  initDataStore().then(() => {
    if (cancelled) return;
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(run, { timeout: 4000 });
      cancelIdle = () => window.cancelIdleCallback(handle);
    } else {
      const handle = window.setTimeout(run, 1500);
      cancelIdle = () => window.clearTimeout(handle);
    }
  }, () => {
    // The deck surfaces data errors itself; skip prefetching.
  });
  return () => {
    cancelled = true;
    cancelIdle?.();
  };
}
