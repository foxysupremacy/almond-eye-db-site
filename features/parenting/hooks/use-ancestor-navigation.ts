"use client";

import { useEffect, useRef, useState } from "react";
import type { LoopAncestorSlot, LoopUmaSlot } from "@/lib/parenting/loop-planner";
import type { PedigreeTier } from "./use-pedigree-tier";

export type Layout = "desktop" | "tablet" | "phone";

/** Only GGP opens a sheet; P/GP cards and GGGP chips are inline on the tree at every tier. */
export function useAncestorNavigation({ tier, openSlot, closeSheet }: { tier: PedigreeTier; openSlot: (slot: LoopUmaSlot) => void; closeSheet: () => void }) {
  const elements = useRef(new Map<string, HTMLDivElement>());
  const sequence = useRef(0);
  const [destination, setDestination] = useState<{ slot: LoopAncestorSlot; layout: Layout; sequence: number } | null>(null);
  const [highlight, setHighlight] = useState<typeof destination>(null);

  useEffect(() => {
    if (!destination) return;
    // Let the popover close and, on phone, the sheet mount before moving focus.
    let frame = 0;
    let attempts = 0;
    const attempt = () => {
      const element = elements.current.get(`${destination.layout}:${destination.slot}`);
      if (!element) {
        if (++attempts < 10) frame = requestAnimationFrame(attempt);
        return;
      }
      element.focus({ preventScroll: true });
      element.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
      setHighlight(destination);
    };
    frame = requestAnimationFrame(attempt);
    return () => cancelAnimationFrame(frame);
  }, [destination]);

  useEffect(() => {
    if (!highlight) return;
    const timer = window.setTimeout(() => setHighlight(null), 1200);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  return {
    navigate(slot: LoopAncestorSlot) {
      const depth = slot.split("_").length;
      if (tier === "desktop") return setDestination({ slot, layout: "desktop", sequence: ++sequence.current });
      if (depth === 3) return openSlot(slot as LoopUmaSlot);
      // P/GP cards and GGGP chips are inline on the tree; the GGP sheet may cover them, so close it first (the focus retry covers the unmount).
      closeSheet();
      return setDestination({ slot, layout: tier, sequence: ++sequence.current });
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
