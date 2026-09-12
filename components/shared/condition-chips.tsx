import React from "react";

export interface ConditionChipsProps {
  branches: string[][];
  needsBranches?: string[][] | null;
  tint: string;
  muted?: boolean;
  className?: string;
}

/**
 * Renders condition chips separated by AND, with @ branches on new lines,
 * and precondition "Needs" chips on top in a neutral tone.
 */
export function ConditionChips({
  branches,
  needsBranches,
  tint,
  muted = false,
  className = "",
}: ConditionChipsProps) {
  const needs = needsBranches && needsBranches.length > 0 ? needsBranches : null;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {needs && (
        <div className="mb-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Needs:
          </span>
          {needs.map((chips, bi) => (
            <div key={bi} className="mt-0.5 flex flex-wrap items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 flex-none rounded-sm border border-zinc-300 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-700" />
              {bi > 0 && (
                <span className="mr-0.5 text-[10px] font-semibold uppercase text-zinc-400 dark:text-zinc-500">
                  or
                </span>
              )}
              {chips.map((chip, ci) => (
                <span
                  key={ci}
                  className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-800 px-1.5 py-0.5 text-[11px] leading-4 text-zinc-600 dark:text-zinc-300"
                >
                  {chip}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
      {branches.map((chips, bi) => (
        <div key={bi} className="flex flex-wrap items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 flex-none rounded-sm border"
            style={{
              background: tint,
              borderColor: muted ? "#71717a" : "#a1a1aa",
            }}
          />
          {bi > 0 && (
            <span className="mr-0.5 text-[10px] font-semibold uppercase text-zinc-400 dark:text-zinc-500">
              or
            </span>
          )}
          {chips.map((chip, ci) => (
            <span
              key={ci}
              className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 px-1.5 py-0.5 text-[11px] leading-4 text-zinc-700 dark:text-zinc-300"
            >
              {chip}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
