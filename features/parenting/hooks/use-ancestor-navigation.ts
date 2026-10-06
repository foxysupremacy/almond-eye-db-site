"use client";

import { useEffect, useRef, useState } from "react";
import type { LoopAncestorSlot } from "@/lib/parenting/loop-planner";
import type { PedigreeBranch } from "../components/pedigree-branch-tabs";

type Layout = "desktop" | "mobile";

/** Each layout renders its own tree; navigate only to the visible copy. */
export function useAncestorNavigation(setMobileBranch: (branch: PedigreeBranch) => void) {
  const elements = useRef(new Map<string, HTMLDivElement>());
  const sequence = useRef(0);
  const [destination, setDestination] = useState<{ slot: LoopAncestorSlot; layout: Layout; sequence: number } | null>(null);
  const [highlight, setHighlight] = useState<typeof destination>(null);

  useEffect(() => {
    if (!destination) return;
    // Let the popover close and the mobile branch mount before moving focus.
    const frame = requestAnimationFrame(() => {
      const element = elements.current.get(`${destination.layout}:${destination.slot}`);
      if (!element) return;
      element.focus({ preventScroll: true });
      element.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
      setHighlight(destination);
    });
    return () => cancelAnimationFrame(frame);
  }, [destination]);

  useEffect(() => {
    if (!highlight) return;
    const timer = window.setTimeout(() => setHighlight(null), 1200);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  return {
    navigate(slot: LoopAncestorSlot) {
      const layout: Layout = window.matchMedia("(min-width: 64rem)").matches ? "desktop" : "mobile";
      if (layout === "mobile") setMobileBranch(slot.startsWith("p1") ? "p1" : "p2");
      setDestination({ slot, layout, sequence: ++sequence.current });
    },
    targetProps(slot: LoopAncestorSlot, layout: Layout) {
      return {
        ref: (element: HTMLDivElement | null) => {
          const key = `${layout}:${slot}`;
          if (element) elements.current.set(key, element);
          else elements.current.delete(key);
        },
        tabIndex: -1,
        "data-ancestor-slot": slot,
        "data-ancestor-layout": layout,
        className: "relative min-w-0 scroll-m-6 rounded-lg outline-none",
      };
    },
    highlightKey(slot: LoopAncestorSlot, layout: Layout) {
      return highlight?.slot === slot && highlight.layout === layout ? highlight.sequence : null;
    },
  };
}
