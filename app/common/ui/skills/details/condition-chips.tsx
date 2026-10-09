import React from "react";
import { conditionBranches } from "@/lib/skill-engine/describe";
import type { AssumedClause } from "@/lib/skill-rating/types";

export interface ConditionChipsProps {
  branches: string[][];
  needsBranches?: string[][] | null;
  className?: string;
  condition?: string | null;
  precondition?: string | null;
  assumptions?: AssumedClause[];
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
      {needs.length > 0 && (
        <div className="mb-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Needs:
          </span>
          {needs.map((chips, bi) => (
            <div key={bi} className="condition-branch mt-0.5 flex flex-wrap items-center gap-1">
              {bi > 0 && (
                <span className="mr-0.5 text-[10px] font-semibold uppercase text-zinc-400 dark:text-zinc-500">
                  OR
                </span>
              )}
              {chips.map(renderChip)}
            </div>
          ))}
        </div>
      )}
      {renderedBranches.map((chips, bi) => (
        <div key={bi} className="condition-branch flex flex-wrap items-center gap-1">
          {bi > 0 && (
            <span className="mr-0.5 text-[10px] font-semibold uppercase text-zinc-400 dark:text-zinc-500">
              OR
            </span>
          )}
          {chips.map(renderChip)}
        </div>
      ))}
    </div>
  );
}
