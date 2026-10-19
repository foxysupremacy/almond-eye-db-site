import React from "react";
import { conditionBranches } from "@/lib/skill-engine/describe";
import type { AssumedClause } from "@/lib/skill-rating/types";
import type { SkillEffectScalingResolution } from "@/lib/skill-scaling";
import { SpecialValueDetails } from "./special-value-details";

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
  const normalizedClause = (clause: string) => clause.replace(/\s/g, "");
  const isPositionClause = (clause: string) => /^(?:order|order_rate)(?:==|!=|<|<=|>|>=)\d+$/.test(normalizedClause(clause));
  const sourceBranches = (raw: string | null | undefined, fallback: string[][], source: AssumedClause["source"]) => {
    const sourceAssumptions = assumptions.filter((entry) => entry.source === source);
    if (!raw || sourceAssumptions.length === 0) {
      return fallback.map((branch) => branch.map((text) => ({ text, assumption: undefined as AssumedClause | undefined })));
    }

    // Normally every assumed predicate is shown separately so its tooltip stays
    // exact. A pair of assumed order/order_rate bounds is the exception: those
    // predicates form one rank interval, so rendering them separately reports
    // the two un-intersected ranges instead of the actual requirement.
    return raw.split("@").map((branch) => {
      const clauses = branch.split("&").map((clause) => clause.trim()).filter(Boolean);
      const positionIndices = clauses.flatMap((clause, index) => isPositionClause(clause) ? [index] : []);
      const positionAssumptions = positionIndices.map((index) => sourceAssumptions.find(
        (entry) => normalizedClause(entry.clause) === normalizedClause(clauses[index]),
      ));
      const mergeAssumedPositionRange = positionIndices.length > 1 && positionAssumptions.every(Boolean);
      const mergedPositionText = mergeAssumedPositionRange
        ? conditionBranches(positionIndices.map((index) => clauses[index]).join("&"), racerCount).branches.flat().join(" and ")
        : "";
      const mergedPositionAssumption = mergeAssumedPositionRange
        ? {
            ...positionAssumptions[0]!,
            clause: positionIndices.map((index) => clauses[index]).join("&"),
            description: "Conditional on occupying the required race-position range",
          }
        : undefined;

      return clauses.flatMap((clause, index) => {
        if (mergeAssumedPositionRange && positionIndices.includes(index)) {
          return index === positionIndices[0]
            ? [{ text: mergedPositionText || clause, assumption: mergedPositionAssumption }]
            : [];
        }
        const assumption = sourceAssumptions.find((entry) => normalizedClause(entry.clause) === normalizedClause(clause));
        return [{ text: conditionBranches(clause, racerCount).branches.flat().join(" and ") || clause, assumption }];
      });
    });
  };
  const renderedBranches = sourceBranches(condition, branches, "condition");
  const needs = sourceBranches(precondition, needsBranches ?? [], "precondition");
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
      {(needs.length > 0 || scalingNeeds.some(item => item.status !== "unchanged")) && (
        <div className="mb-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Activation requirements:
          </span>
          {needs.map(renderBranch)}
          <SpecialValueDetails resolutions={scalingNeeds} selectedUma={selectedUma} />
        </div>
      )}
      {renderedBranches.length > 0 && <div className="mt-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Activation timing:</span>
        {renderedBranches.map(renderBranch)}
      </div>}
    </div>
  );
}
