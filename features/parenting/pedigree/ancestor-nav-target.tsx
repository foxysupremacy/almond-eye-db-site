"use client";

import type { ReactNode, Ref } from "react";
import type { LoopAncestorSlot } from "@/lib/parenting/loop-planner";
import { ancestorLabel } from "../components/ancestor-label";
import type { Layout as NavLayout } from "../hooks/use-ancestor-navigation";

export interface AncestorNavigationTarget {
  targetProps(slot: LoopAncestorSlot, layout: NavLayout): {
    ref: Ref<HTMLDivElement>;
    tabIndex: number;
    "data-ancestor-slot": string;
    "data-ancestor-layout": string;
    className: string;
  };
  highlightKey(slot: LoopAncestorSlot, layout: NavLayout): number | null;
}

/** Focusable, labelled navigation destination with the transient amber highlight. */
export function AncestorNavTarget({ slot, layout, navigation, className, children }: {
  slot: LoopAncestorSlot;
  layout: NavLayout;
  navigation: AncestorNavigationTarget;
  className?: string;
  children: ReactNode;
}) {
  const highlightKey = navigation.highlightKey(slot, layout);
  const label = ancestorLabel(slot);
  const props = navigation.targetProps(slot, layout);
  return <div {...props} className={className ? `${props.className} ${className}` : props.className} aria-label={`${label.generation}, ${label.location}`}>
    {children}
    {highlightKey !== null && <span key={highlightKey} aria-hidden="true" className="pointer-events-none absolute -inset-1 z-30 rounded-lg bg-amber-400/10 ring-2 ring-amber-500 animate-ancestor-highlight motion-reduce:animate-none" />}
  </div>;
}
