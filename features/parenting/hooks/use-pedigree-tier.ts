"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

export type PedigreeTier = "phone" | "tablet" | "desktop";

export function tierForWidth(px: number): PedigreeTier { return px < 600 ? "phone" : px < 960 ? "tablet" : "desktop"; }

/**
 * Container-width tier. The initial state is a viewport-based seed (window.innerWidth); the layout
 * effect then corrects it from the container width before paint. Assumes client-only mounting
 * (ParentingLoopOptimizer only renders after parenting-view's client-side loading spinner).
 */
export function usePedigreeTier(ref: RefObject<HTMLElement | null>, initial: PedigreeTier = "desktop"): PedigreeTier {
  const [tier, setTier] = useState<PedigreeTier>(() => typeof window !== "undefined" && window.innerWidth > 0 ? tierForWidth(window.innerWidth) : initial);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    // 0 px (hidden / unlaid-out / test DOM) deliberately keeps the last tier.
    const update = (width: number) => { if (width > 0) setTier(tierForWidth(width)); };
    update(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => update((entry.target as HTMLElement).getBoundingClientRect().width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return tier;
}
