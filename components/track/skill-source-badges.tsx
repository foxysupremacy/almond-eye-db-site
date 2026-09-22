"use client";

import type { VisualizerSkillOrigin } from "../../lib/visualizer-skills";

const AVAILABILITY_LABEL = {
  deck: "Deck",
  owned: "Trainee Unique",
  candidate: "EVO candidate",
  guaranteed: "Guaranteed inheritance",
  possible: "Possible inheritance",
} as const;

const AVAILABILITY_CLASS = {
  deck: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  owned: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200",
  candidate: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
  guaranteed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  possible: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
} as const;

interface SkillSourceBadgesProps {
  origins: VisualizerSkillOrigin[];
  compact?: boolean;
}

export function SkillSourceBadges({ origins, compact = false }: SkillSourceBadgesProps) {
  if (!origins || origins.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {origins.map((origin, idx) => {
        const badgeClass =
          AVAILABILITY_CLASS[origin.availability] ??
          "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
        const availText = AVAILABILITY_LABEL[origin.availability] ?? origin.availability;

        if (compact) {
          return (
            <span
              key={idx}
              className="inline-flex min-w-0 max-w-full items-center gap-1 text-[10px]"
              title={`${availText}: ${origin.label}`}
            >
              <span
                className={`flex-none rounded px-1 py-0.2 text-[8px] font-bold uppercase tracking-wide ${badgeClass}`}
              >
                {availText}
              </span>
              <span className="truncate font-medium text-zinc-600 dark:text-zinc-400">
                {origin.label}
              </span>
              {idx < origins.length - 1 && (
                <span className="flex-none text-zinc-300 dark:text-zinc-700">·</span>
              )}
            </span>
          );
        }

        return (
          <div
            key={idx}
            className="flex items-center gap-1.5 rounded-md border border-zinc-200/80 bg-zinc-50/50 px-2 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-800/40"
          >
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${badgeClass}`}
            >
              {availText}
            </span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {origin.label}
            </span>
            {origin.slotLabel && (
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                ({origin.slotLabel})
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
