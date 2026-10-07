"use client";

import { useId } from "react";
import { Button } from "react-aria-components/Button";
import type { AptitudeKey, BranchAssessment, LoopCandidate, LoopUmaSlot } from "@/lib/parenting/loop-planner";
import { StatusRankIcon } from "@/app/common/ui/primitives/status-icons";
import { GENETIC_TONE_CLASS } from "../components/genetic-status";
import { AlertTriangleIcon, CheckIcon } from "@/app/common/ui/primitives/icons";
import { SHORT, projectionDisplayGrade } from "../components/aptitude-controls";
import { ancestorTitle } from "../components/ancestor-label";
import type { EditableFactorPlan } from "../hooks/use-pedigree-model";
import { AncestorPortrait } from "./ancestor-portrait";
import { slotGeneration } from "./pedigree-slots";

const PORTRAIT = {
  phone: { parent: "h-14 w-14", grandparent: "h-11 w-11", "great-grandparent": "h-9 w-9" },
  tablet: { parent: "h-16 w-16", grandparent: "h-[3.25rem] w-[3.25rem]", "great-grandparent": "h-9 w-9" },
} as const;
const GRADE_GROUPS: { keys: readonly AptitudeKey[]; cols: string }[] = [
  { keys: ["Turf", "Dirt"], cols: "grid-cols-2" },
  { keys: ["Sprint", "Mile", "Medium", "Long"], cols: "grid-cols-4" },
  { keys: ["Runner", "Leader", "Betweener", "Chaser"], cols: "grid-cols-4" },
];

function PinkChip({ plan, compact }: { plan: EditableFactorPlan; compact?: boolean }) {
  const stars = plan.pink ? plan.pinkStars ?? 3 : 0;
  return <span className="inline-flex min-w-0 items-center justify-center gap-0.5 rounded-md bg-pink-50/80 px-1 text-[10px] font-bold text-pink-800 dark:bg-pink-950/40 dark:text-pink-200">
    {!compact && <span className="truncate">{plan.pink ? SHORT[plan.pink] : plan.pink === null ? "None" : "—"}</span>}
    <span aria-hidden="true" className="leading-none">{[1, 2, 3].map((s) => <span key={s} className={s <= stars ? "text-pink-600 dark:text-pink-400" : "text-zinc-300 dark:text-zinc-600"}>★</span>)}</span>
  </span>;
}

export function AncestorTile({ slot, candidate, assessment, factorPlan, aptitudeKeys, whiteTargetCount, genetic, childSparks, tier = "phone", onOpen }: {
  slot: LoopUmaSlot; candidate: LoopCandidate | null; assessment: BranchAssessment; factorPlan: EditableFactorPlan;
  aptitudeKeys: AptitudeKey[]; whiteTargetCount: number; genetic?: { text: string; tone: keyof typeof GENETIC_TONE_CLASS; alert: boolean };
  childSparks?: EditableFactorPlan[]; tier?: "phone" | "tablet"; onOpen: () => void;
}) {
  const generation = slotGeneration(slot) as keyof typeof PORTRAIT.phone;
  const deep = generation === "great-grandparent";
  const GeneticIcon = genetic?.alert ? AlertTriangleIcon : CheckIcon;
  const summaryId = useId();
  const grades = deep || aptitudeKeys.length === 0 ? [] : aptitudeKeys.map((key) => `${key} ${projectionDisplayGrade(assessment.projections.find((p) => p.aptitude === key)!)}`);
  const pink = factorPlan.pink ? `Pink ${factorPlan.pink} ${factorPlan.pinkStars ?? 3}★` : factorPlan.pink === null ? "No pink" : "Pink not set";
  const summary = [
    candidate?.name ?? (deep ? null : "Empty"),
    ...grades,
    pink,
    generation === "parent" ? `${whiteTargetCount} white targets` : null,
    genetic?.text,
    deep && childSparks ? `${childSparks.filter((plan) => plan.pink).length} of ${childSparks.length} deepest sparks set` : null,
  ].filter(Boolean).join(", ");
  const gradeCell = (key: AptitudeKey) => {
    const grade = projectionDisplayGrade(assessment.projections.find((p) => p.aptitude === key)!);
    return <span key={key} data-tile-grade={key} className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-zinc-500 dark:text-zinc-400">
      {SHORT[key]}{grade === "?" ? <span className="text-zinc-400">?</span> : <StatusRankIcon grade={grade} className="h-3.5 w-3.5 object-contain" />}
    </span>;
  };
  return <Button onPress={onOpen} aria-describedby={summaryId} aria-label={`Edit ${ancestorTitle(slot)}${candidate ? `: ${candidate.name}` : ""}`} data-ancestor-tile={generation}
    className="group/avatar flex min-h-10 min-w-10 w-full flex-col items-center gap-1 rounded-xl border border-zinc-200/90 bg-white/95 px-1 pb-1.5 pt-3 text-center shadow-2xs outline-none transition-colors duration-150 ease-out-quart hover:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-zinc-800/80 dark:bg-zinc-900/95">
    <AncestorPortrait candidate={candidate} className={PORTRAIT[tier][generation]} emptyLabel="Add" />
    <span id={summaryId} className="sr-only">{summary}</span>
    {!deep && candidate && <span className={`w-full line-clamp-2 break-words font-semibold text-zinc-900 dark:text-zinc-100 ${generation === "parent" ? "text-xs" : "text-[10px]"}`}>{candidate.name}</span>}
    {!deep && aptitudeKeys.length > 0 && (tier === "tablet"
      ? <span className="flex w-full flex-col gap-0.5">
        {GRADE_GROUPS.map((group) => {
          const keys = group.keys.filter((key) => aptitudeKeys.includes(key));
          return keys.length > 0 && <span key={group.cols + group.keys[0]} data-tile-grade-group={group.keys[0]} className={`grid ${group.cols} justify-items-center gap-0.5`}>{keys.map(gradeCell)}</span>;
        })}
      </span>
      : <span className="flex w-full flex-wrap justify-center gap-0.5">{aptitudeKeys.map(gradeCell)}</span>)}
    <span className="flex items-center gap-1">
      <PinkChip plan={factorPlan} compact={deep} />
      {genetic && <GeneticIcon className={`h-3.5 w-3.5 shrink-0 ${GENETIC_TONE_CLASS[genetic.tone]}`} />}
    </span>
    {generation === "parent" && <span className="text-[10px] text-violet-600 dark:text-violet-300">○ {whiteTargetCount || "—"} white</span>}
    {deep && childSparks && <span aria-hidden="true" className="flex gap-0.5 text-[8px] leading-none">
      {childSparks.map((plan, index) => <span key={index} data-child-spark={plan.pink ? "set" : "unset"} className={plan.pink ? "text-pink-500" : "text-zinc-300 dark:text-zinc-600"}>{plan.pink ? "●" : "○"}</span>)}
    </span>}
  </Button>;
}
