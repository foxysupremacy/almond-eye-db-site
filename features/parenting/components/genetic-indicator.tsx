"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button } from "react-aria-components/Button";
import { AlertTriangleIcon, CheckIcon, ChevronDownIcon } from "@/app/common/ui/primitives/icons";
import { branchSourceSlots, factorPlan, type LoopAncestorSlot } from "@/lib/parenting/loop-planner";
import { aceGeneticTarget, suggestPinkReduction, type ParentingMinmaxContext, type SlotGeneticAssessment } from "@/lib/parenting/minmax";
import { ParentingPopover } from "./parenting-popover";
import { ancestorLabel } from "./ancestor-label";

function slotLabel(slot: string) { return slot.toUpperCase().replaceAll("_", " "); }

function GeneticDetails({ assessment, context, onNavigate }: { assessment: SlotGeneticAssessment; context: ParentingMinmaxContext; onNavigate?: (slot: LoopAncestorSlot) => void }) {
  const forecasts = assessment.forecasts.filter((forecast) => forecast.stars >= 6);
  const suggestions = useMemo(() => assessment.forecasts.map((forecast) => forecast.stars >= 6
    ? suggestPinkReduction(context, assessment.slot, forecast.aptitude) : null), [assessment, context]);
  const unknownSources = branchSourceSlots(assessment.slot).filter((slot) => !factorPlan(context.ancestors[slot], slot, context.config).known);
  const showSprintTradeoff = aceGeneticTarget(context.course, context.runningStyle).distance === "Sprint";
  function sourceRow(slot: LoopAncestorSlot | "target", detail?: ReactNode) {
    const name = slot === "target" ? context.target?.nameEn : context.ancestors[slot]?.name.trim();
    const label = slot === "target" ? { generation: "Trainee", location: "Target Uma" } : ancestorLabel(slot);
    const content = <>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-zinc-900 dark:text-zinc-100">{label.generation}{detail && <> {detail}</>}</span>
        <span className="mt-0.5 block text-[10px] text-zinc-500 dark:text-zinc-400">{name && <>{name} · </>}{label.location}</span>
      </span>
      {onNavigate && slot !== "target" && <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />}
    </>;
    return onNavigate && slot !== "target"
      ? <Button onPress={() => onNavigate(slot)} aria-label={`Go to ${label.generation}${name ? ` ${name}` : ""}, ${label.location}`} className="flex min-h-11 w-full items-center gap-2 rounded px-1 py-1 text-left outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-zinc-800">{content}</Button>
      : <div className="flex items-center gap-2 py-1">{content}</div>;
  }
  return <div className="space-y-2 text-xs">
    <h4 className="font-semibold">{ancestorLabel(assessment.slot).generation} · Genetic assessment</h4>
    <p className="text-zinc-500">{context.ancestors[assessment.slot]?.name && <>{context.ancestors[assessment.slot]?.name} · </>}{ancestorLabel(assessment.slot).location}</p>
    {assessment.useActual && <div className="border-b border-zinc-100 pb-2 dark:border-zinc-800">
      <p className="font-semibold">Use this trained Uma now</p>
      {assessment.actual.map((gene) => <p key={gene.aptitude} className="text-rose-700 dark:text-rose-300">{gene.aptitude} genetic present · {gene.stars}★</p>)}
      {!assessment.actual.length && <p>{assessment.actualKnown ? "No off-target genetics in evaluated groups." : "Imported factors unknown."}</p>}
      {assessment.actual.length > 0 && <p className="mt-1 text-zinc-500">Change run or retrain; donor changes cannot remove existing genetics.</p>}
    </div>}
    <p className="font-semibold">{assessment.useActual ? "If retrained with this pedigree" : "Planned training"}</p>
    {!forecasts.length && !unknownSources.length && assessment.forecasts.length > 0 && <p className="text-zinc-500">Pink totals below 6★.</p>}
    {assessment.mismatchedTargets.length > 0 && <p className="text-amber-700 dark:text-amber-300">Off-target selected genetics: {assessment.mismatchedTargets.join(" · ")}.</p>}
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {forecasts.map((forecast) => {
        const suggestion = suggestions[assessment.forecasts.indexOf(forecast)];
        const tradeoffs = suggestion?.aptitudeChanges.filter((change) => change.aptitude !== "Sprint" || showSprintTradeoff) ?? [];
        return <li key={forecast.aptitude} className="py-2 space-y-1">
          <p className="font-semibold">{forecast.aptitude} {forecast.stars}★ · {forecast.risk === "guaranteed" ? "Guaranteed genetics in this model" : "Frequent roll risk"}</p>
          <p className="text-zinc-500">From:</p>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {forecast.sources.filter((source) => source.stars > 0).map((source) => <li key={source.slot}>{sourceRow(source.slot, <>{forecast.aptitude} {source.stars}★{!source.known && <span className="font-normal text-zinc-500"> · unconfirmed</span>}</>)}</li>)}
          </ul>
          {suggestion && <div className="text-zinc-600 dark:text-zinc-400">
            <p className="mt-2 font-semibold">Reduce {forecast.aptitude} to {suggestion.totalStars}★:</p>
            <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
              {suggestion.changes.map((change) => <li key={change.slot}>{sourceRow(change.slot, <>{forecast.aptitude} {change.from}★ → {change.replacement ? `${change.replacement.pink} ${change.replacement.stars}★` : change.to ? `${change.to}★` : "No pink"}{change.retrain && <span className="font-normal text-zinc-500"> · change run / retrain</span>}</>)}</li>)}
            </ul>
            {tradeoffs.length > 0 && <>
              <p className="mt-2 font-semibold">Tradeoff:</p>
              <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
                {tradeoffs.map((change) => <li key={`${change.slot}:${change.aptitude}`}>{sourceRow(change.slot, <>{change.aptitude} {change.before} → {change.after}{change.required && ` · needs ${change.required}`}</>)}</li>)}
              </ul>
            </>}
            {suggestion.preservesAptitude && <p className="mt-1">Farm targets preserved.</p>}
            {suggestion.lostG1 > 0 && <p className="mt-1">{suggestion.lostG1} fewer schedulable G1s.</p>}
            {!suggestion.complete && <p className="mt-1 text-amber-700 dark:text-amber-300">Incomplete data; aptitude preservation unconfirmed.</p>}
          </div>}
        </li>;
      })}
    </ul>
    {unknownSources.length > 0 && <>
      <p className="text-zinc-500">Unknown donor factors:</p>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">{unknownSources.map((slot) => <li key={slot}>{sourceRow(slot, "Factors unknown")}</li>)}</ul>
    </>}
    <p className="text-[10px] text-zinc-500">GP = grandparent · GGP = great-grandparent · GGGP = great-great-grandparent. Left / right follows the tree below.{onNavigate && " Tap a row to find it."}</p>
    <p className="border-t border-zinc-100 pt-2 text-zinc-500 dark:border-zinc-800">Model: 6–11★ frequent · 12★+ guaranteed.</p>
  </div>;
}

export function GeneticIndicator({ assessment, context, onNavigate }: { assessment: SlotGeneticAssessment; context: ParentingMinmaxContext; onNavigate?: (slot: LoopAncestorSlot) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const guaranteed = assessment.forecasts.filter((entry) => entry.risk === "guaranteed").length;
  const frequent = assessment.forecasts.filter((entry) => entry.risk === "frequent").length;
  const unknown = assessment.forecasts.some((entry) => entry.risk === "unknown");
  const warning = assessment.actual.length > 0 || guaranteed + frequent > 0 || assessment.mismatchedTargets.length > 0;
  const active = assessment.forecasts.length > 0;
  const completeTarget = Object.values(aceGeneticTarget(context.course, context.runningStyle)).every(Boolean);
  const goodPlanning = completeTarget && active && !warning && !unknown && (!assessment.useActual || assessment.actualKnown);
  const text = assessment.actual.length ? `${assessment.actual.length} unwanted genetics present`
    : guaranteed ? `${guaranteed} guaranteed ${assessment.useActual ? "retrain" : "genetic"} risks`
    : frequent ? `${frequent} frequent ${assessment.useActual ? "retrain" : "genetic"} risks`
    : assessment.mismatchedTargets.length ? "Off-target genetic selected"
    : !active ? "Select course / style"
    : assessment.useActual && !assessment.actualKnown ? "Imported genetics unknown"
    : unknown ? assessment.useActual && assessment.actualKnown ? "No off-target genetics · retrain data incomplete" : "Genetic data incomplete"
    : goodPlanning ? "Good genetic planning" : "Select course / style";
  const StatusIcon = warning || unknown || !active || assessment.useActual && !assessment.actualKnown ? AlertTriangleIcon : CheckIcon;
  return <ParentingPopover
    isOpen={isOpen}
    onOpenChange={setIsOpen}
    label={`${slotLabel(assessment.slot)} genetics: ${text}`}
    className={`mt-2 flex min-h-7 w-full min-w-0 items-center justify-center gap-1 border-t border-zinc-100 px-1 py-1 text-[10px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-zinc-800 ${warning ? "text-amber-800 dark:text-amber-300" : goodPlanning ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`}
    trigger={<><StatusIcon className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 truncate">{text}</span></>}
  ><GeneticDetails assessment={assessment} context={context} onNavigate={onNavigate ? (slot) => { setIsOpen(false); onNavigate(slot); } : undefined} /></ParentingPopover>;
}
