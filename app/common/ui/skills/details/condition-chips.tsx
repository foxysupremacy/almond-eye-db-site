import React from "react";
import { conditionBranches } from "@/lib/skill-engine/describe";
import type { AssumedClause } from "@/lib/skill-rating/types";
import type { SkillEffectScalingResolution } from "@/lib/skill-scaling";
import { FAN_LOVE_MAX_THRESHOLD, SKILL_SCALING_LABELS } from "@/lib/skill-scaling";

export interface ConditionChipsProps {
  branches: string[][];
  needsBranches?: string[][] | null;
  className?: string;
  condition?: string | null;
  precondition?: string | null;
  assumptions?: AssumedClause[];
  scalingNeeds?: SkillEffectScalingResolution[];
  selectedUma?: string;
  racerCount?: number;
}

/**
 * Renders condition chips separated by AND, with @ branches on new lines,
 * and precondition "Needs" chips on top in a neutral tone.
 */
export function ConditionChips({
  branches,
  needsBranches,
  className = "",
  condition,
  precondition,
  assumptions = [],
  scalingNeeds = [],
  selectedUma,
  racerCount,
}: ConditionChipsProps) {
  // Render assumed clauses individually: the normal formatter consolidates
  // rank ranges, which would otherwise obscure the exact assumed predicate.
  const sourceBranches = (raw: string | null | undefined, fallback: string[][], source: AssumedClause["source"]) =>
    raw && assumptions.some((entry) => entry.source === source)
      ? raw.split("@").map((branch) => branch.split("&").filter(Boolean).map((clause) => {
          const assumption = assumptions.find((entry) => entry.source === source && entry.clause.replace(/\s/g, "") === clause.replace(/\s/g, ""));
          return { text: conditionBranches(clause, racerCount).branches.flat().join(" and ") || clause, assumption };
        }))
      : fallback.map((branch) => branch.map((text) => ({ text, assumption: undefined as AssumedClause | undefined })));
  const renderedBranches = sourceBranches(condition, branches, "condition");
  const needs = sourceBranches(precondition, needsBranches ?? [], "precondition");
  const scalingByCode = [...new Map(scalingNeeds.filter(item => item.status !== "unchanged")
    .map(item => [item.code, item])).values()];
  const assumedScalingInputs = (code: number): string[] | null => {
    if (code === 11) return ["4+ Final Leg corner overtakes (Assumed)"];
    if (code === 30) return [`${selectedUma ?? "Selected Uma"}’s Fan Love: ${FAN_LOVE_MAX_THRESHOLD.toLocaleString("de-DE")}+ (Assumed)`];
    if (code === 34) return ["20 m+ behind first place (Assumed)"];
    if (code === 35) return ["Arima Kinen course and 146,738+ fans (Assumed)"];
    return null;
  };
  const renderBranch = (chips: Array<{ text: string; assumption?: AssumedClause }>, bi: number) => (
    <div key={bi} className="condition-branch mt-0.5 flex flex-wrap items-center gap-1.5">
      {bi > 0 && <span className="text-[10px] font-semibold uppercase text-zinc-400">OR</span>}
      {chips.map((chip, index) => <React.Fragment key={index}>
        {index > 0 && <span className="text-[9px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">AND</span>}
        {renderChip(chip, index)}
      </React.Fragment>)}
    </div>
  );
  const renderChip = (chip: { text: string; assumption?: AssumedClause }, index: number) => (
    <span key={index}
      title={chip.assumption ? `Assumed: ${chip.assumption.clause}. ${chip.assumption.description}` : undefined}
      className={`rounded border px-1.5 py-0.5 text-[11px] leading-4 ${chip.assumption
        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
        : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"}`}>
      {chip.text}{chip.assumption && <span className="ml-1 text-[9px] font-semibold uppercase">assumed</span>}
    </span>
  );

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {(needs.length > 0 || scalingByCode.length > 0) && (
        <div className="mb-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Activation requirements:
          </span>
          {needs.map(renderBranch)}
          {scalingByCode.map((item) => (
            <div key={`scale-${item.code}`} className="mt-2 rounded-md border border-violet-200/80 bg-violet-50/70 px-2.5 py-2 dark:border-violet-800/70 dark:bg-violet-950/20">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold text-violet-900 dark:text-violet-200">
                  {SKILL_SCALING_LABELS[item.code] ?? `Effect scaling ${item.code}`}
                </span>
                {item.status !== "resolved" && <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${item.status === "assumed" ? "bg-amber-200 text-amber-950 dark:bg-amber-900/70 dark:text-amber-100" : "bg-rose-200 text-rose-950 dark:bg-rose-900/70 dark:text-rose-100"}`}>
                  {item.status}
                </span>}
              </div>
              {item.reason && <p className="mt-1 text-[11px] leading-4 text-zinc-700 dark:text-zinc-300">
                {item.status === "assumed"
                  ? item.code === 30 ? "Using the maximum effect value because Fan Love data is unavailable." : `Using the maximum effect value: ${item.reason}.`
                  : item.reason}
              </p>}
              {((item.status === "assumed" ? assumedScalingInputs(item.code) : null) ?? item.needs ?? ["The formula and its runtime inputs have not been verified."]).length > 0 && <p className="mt-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">{item.status === "assumed" && assumedScalingInputs(item.code) ? "Assumed scaling inputs:" : "Inputs needed to calculate the race-specific value:"}</p>}
              {(() => {
                const assumedInputs = item.status === "assumed" ? assumedScalingInputs(item.code) : null;
                const inputs = assumedInputs ?? item.needs ?? ["The formula and its runtime inputs have not been verified."];
                return inputs.length > 0 ? <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[11px] leading-4 text-zinc-700 dark:text-zinc-300">
                  {inputs.map((need) => <li key={need}>{need}</li>)}
                </ul> : null;
              })()}
            </div>
          ))}
        </div>
      )}
      {renderedBranches.length > 0 && <div className="mt-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Activation timing:</span>
        {renderedBranches.map(renderBranch)}
      </div>}
    </div>
  );
}
