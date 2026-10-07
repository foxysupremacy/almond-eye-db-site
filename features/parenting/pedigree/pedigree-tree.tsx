"use client";

import type { AptitudeKey, LoopAncestorSlot, LoopUmaSlot, ParentingLoopConfig } from "@/lib/parenting/loop-planner";
import { APTITUDE_KEYS } from "@/lib/parenting/loop-planner";
import { aceGeneticTarget } from "@/lib/parenting/minmax";
import type { Course } from "@/lib/skill-engine/types";
import { PinkSparkPicker } from "../components/pink-spark-fields";
import { geneticStatus } from "../components/genetic-status";
import type { EditableFactorPlan, PedigreeModel } from "../hooks/use-pedigree-model";
import type { useAncestorNavigation } from "../hooks/use-ancestor-navigation";
import { AncestorNavTarget } from "./ancestor-nav-target";
import { AncestorTile } from "./ancestor-tile";
import { SLOT_LABEL, childSlots } from "./pedigree-slots";

export function SparkInput({ slot, goal, onChange }: {
  slot: LoopAncestorSlot;
  goal: NonNullable<ParentingLoopConfig["factorGoals"]>[LoopAncestorSlot];
  onChange: (goal: EditableFactorPlan) => void;
}) {
  return <div role="group" aria-label={`${SLOT_LABEL[slot]} pink spark input`} className="min-w-0 px-0.5 pt-1">
    <PinkSparkPicker label={SLOT_LABEL[slot]} value={goal?.pink as AptitudeKey | null | undefined} stars={goal?.pinkStars ?? undefined}
      onChange={(pink, pinkStars) => onChange({ ...(pink === undefined ? {} : { pink: pink as AptitudeKey | null }), ...(pinkStars === undefined ? {} : { pinkStars }) })} />
  </div>;
}

/** Connector from `parents` evenly spaced nodes down to twice as many children. */
function Connector({ parents, name }: { parents: number; name: string }) {
  const width = 1000;
  const paths: string[] = [];
  for (let i = 0; i < parents; i++) {
    const px = ((i + 0.5) / parents) * width;
    const left = ((2 * i + 0.5) / (parents * 2)) * width;
    const right = ((2 * i + 1.5) / (parents * 2)) * width;
    paths.push(`M${px} 0V8H${left}V16M${px} 8H${right}V16`);
  }
  return <svg data-pedigree-connector={name} aria-hidden="true" className="pointer-events-none block h-3 w-full text-emerald-700/50 dark:text-emerald-300/50" viewBox="0 0 1000 16" preserveAspectRatio="none">
    <path d={paths.join("")} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
  </svg>;
}

const ROWS: { slots: LoopUmaSlot[]; cols: string }[] = [
  { slots: ["p1", "p2"], cols: "grid-cols-2" },
  { slots: ["p1_gp1", "p1_gp2", "p2_gp1", "p2_gp2"], cols: "grid-cols-4" },
  { slots: (["p1", "p2"] as const).flatMap((p) => ([1, 2] as const).flatMap((gp) => ([1, 2] as const).map((g) => `${p}_gp${gp}_g${g}`))) as LoopUmaSlot[], cols: "grid-cols-8" },
];

export function PedigreeTree({ tier, model, navigation, course, runningStyle, onOpenSheet }: {
  tier: "phone" | "tablet";
  model: PedigreeModel;
  navigation: ReturnType<typeof useAncestorNavigation>;
  course?: Course | null;
  runningStyle?: number | null;
  onOpenSheet: (slot: LoopUmaSlot) => void;
}) {
  const aptitudeKeys: AptitudeKey[] = tier === "phone"
    ? Object.values(aceGeneticTarget(course, runningStyle)).filter(Boolean) as AptitudeKey[]
    : [...APTITUDE_KEYS];
  return <div data-pedigree-tier={tier}>
    {ROWS.map((row, index) => <div key={row.cols}>
      {index > 0 && <Connector parents={ROWS[index - 1].slots.length} name={index === 1 ? "parent-to-grandparent" : "grandparent-to-great-grandparent"} />}
      <div className={`grid ${row.cols} items-stretch gap-1`}>
        {row.slots.map((slot) => {
          const assessment = model.geneticAssessment(slot);
          const isGgp = slot.split("_").length === 3;
          const tile = <AncestorTile slot={slot} candidate={model.selectedCandidates[slot]} assessment={model.assessments[slot]}
            factorPlan={model.factorPlan(slot)} aptitudeKeys={aptitudeKeys} whiteTargetCount={model.whiteTargets(slot).length}
            genetic={assessment ? geneticStatus(assessment, model.minmaxContext) : undefined}
            childSparks={isGgp && tier === "phone" ? childSlots(slot).map((child) => model.factorPlan(child)) : undefined}
            tier={tier} onOpen={() => onOpenSheet(slot)} />;
          if (!(isGgp && tier === "tablet")) return <div key={slot} className="min-w-0">{tile}</div>;
          return <div key={slot} className="flex min-w-0 flex-col gap-1">
            {tile}
            {childSlots(slot).map((child) => <AncestorNavTarget key={child} slot={child} layout="tablet" navigation={navigation}>
              <SparkInput slot={child} goal={model.config.factorGoals?.[child] ?? {}} onChange={(goal) => model.setFactorGoal(child, goal)} />
            </AncestorNavTarget>)}
          </div>;
        })}
      </div>
    </div>)}
  </div>;
}
