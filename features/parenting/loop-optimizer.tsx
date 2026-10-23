"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CharacterIndexEntry } from "@/lib/data/types";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";
import type { LoopAncestorSlot, LoopUmaSlot } from "@/lib/parenting/loop-planner";
import { type ParentingSetup } from "@/lib/parenting/state";
import type { Course } from "@/lib/skill-engine/types";
import { useAncestorNavigation } from "./hooks/use-ancestor-navigation";
import { usePedigreeTier, type PedigreeTier } from "./hooks/use-pedigree-tier";
import { AncestorSheet } from "./pedigree/ancestor-sheet";
import { usePedigreeModel } from "./hooks/use-pedigree-model";
import { ParentPedigreeCanvas } from "./pedigree/parent-pedigree-canvas";

export { AncestorCard, AutoFitPedigreeTree, ParentPedigreeCanvas } from "./pedigree/parent-pedigree-canvas";

interface Props {
  target: CharacterIndexEntry | null;
  veterans: KyumaruVeteranItem[];
  roster: CharacterIndexEntry[];
  setup: ParentingSetup;
  targetStage: ReactNode;
  course?: Course | null;
  runningStyle?: number | null;
  /** Test override; normally measured from the container width. */
  tier?: PedigreeTier;
  onOpenPicker: (slot: LoopAncestorSlot) => void;
  updateSetup: (updater: (prev: ParentingSetup) => ParentingSetup) => void;
}

export function ParentingLoopOptimizer(props: Props) {
  const containerRef = useRef<HTMLElement>(null);
  const measuredTier = usePedigreeTier(containerRef);
  const tier = props.tier ?? measuredTier;
  const [sheetSlot, setSheetSlot] = useState<LoopUmaSlot | null>(null);
  useEffect(() => { if (tier === "desktop") setSheetSlot(null); }, [tier]);
  const ancestorNavigation = useAncestorNavigation({ tier, openSlot: setSheetSlot, closeSheet: () => setSheetSlot(null) });
  const model = usePedigreeModel(props);

  return (
    <section ref={containerRef} className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Parent Planning</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Set pink sparks below each branch to support its planned aptitude, G1 farming and white genetics.
          </p>
        </div>
      </header>
      {props.targetStage && <div>{props.targetStage}</div>}
      {!props.target ? (
        <p className="text-sm text-zinc-500">Select a target Uma to build the pedigree.</p>
      ) : (
        <>
          <div className="border-t border-zinc-100 pt-3 text-xs dark:border-zinc-800" aria-live="polite">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              Ace genetics: {[model.minmax.target.surface, model.minmax.target.distance, model.minmax.target.style].filter(Boolean).join(" · ") || "Select a course and style"}
            </p>
          </div>

          <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800 space-y-3">
            <ParentPedigreeCanvas
              model={model}
              navigation={ancestorNavigation}
              tier={tier}
              onOpenPicker={props.onOpenPicker}
            />
          </div>
          {sheetSlot && (
            <AncestorSheet
              slot={sheetSlot}
              tier={tier === "desktop" ? "tablet" : tier}
              model={model}
              navigation={ancestorNavigation}
              onNavigate={setSheetSlot}
              onChooseUma={(slot) => props.onOpenPicker(slot)}
              onClose={() => setSheetSlot(null)}
            />
          )}
        </>
      )}
    </section>
  );
}
