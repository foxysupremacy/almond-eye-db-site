"use client";

import { ToggleButton, ToggleButtonGroup } from "react-aria-components/ToggleButtonGroup";
import type { RankingMetric } from "@/lib/rankings";

export const SCORE_OPTIONS: { id: RankingMetric; label: string }[] = [
  { id: "average", label: "Average" },
  { id: "best", label: "Best case" },
];

/** Average / Best case segmented control (single selection → radiogroup semantics), same pattern as StyleTabs. */
export function ScoreSwitch({ value, onChange }: { value: RankingMetric; onChange(metric: RankingMetric): void }) {
  return (
    <ToggleButtonGroup
      aria-label="Score"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={new Set([value])}
      onSelectionChange={(keys) => {
        const next = [...keys][0];
        if (next === "average" || next === "best") onChange(next);
      }}
      className="inline-flex min-w-max items-center gap-1 rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700"
    >
      {SCORE_OPTIONS.map((option) => (
        <ToggleButton
          key={option.id}
          id={option.id}
          className="inline-flex min-h-11 items-center justify-center rounded-md px-3 text-xs font-semibold text-zinc-600 outline-none transition-colors duration-150 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-500/70 data-[selected]:bg-emerald-800 data-[selected]:text-white md:min-h-8 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:data-[selected]:bg-emerald-700"
        >
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
