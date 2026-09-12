import React from "react";
import { getSkillRarityStyle } from "../../lib/skill-rarity";

export interface RarityBadgeProps {
  rarity?: number;
  size?: "xs" | "sm";
  className?: string;
}

export function RarityBadge({ rarity, size = "xs", className = "" }: RarityBadgeProps) {
  const meta = getSkillRarityStyle(rarity);
  const sizeClasses = size === "xs" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]";

  return (
    <span
      className={`rounded font-bold uppercase tracking-wider ${sizeClasses} ${meta.badgeClass} ${className}`}
    >
      {meta.badgeLabel}
    </span>
  );
}

export interface SourceBadgeProps {
  source: "hint" | "event" | "unique" | "factor" | string;
  className?: string;
}

export function SourceBadge({ source, className = "" }: SourceBadgeProps) {
  switch (source) {
    case "event":
      return (
        <span
          className={`rounded bg-violet-100 dark:bg-violet-950/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800/80 ${className}`}
        >
          Card Event
        </span>
      );
    case "hint":
      return (
        <span
          className={`rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 ${className}`}
        >
          Card Hint
        </span>
      );
    case "unique":
      return (
        <span
          className={`rounded bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 ${className}`}
        >
          Parent Unique
        </span>
      );
    case "factor":
      return (
        <span
          className={`rounded bg-sky-100 dark:bg-sky-950/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700 ${className}`}
        >
          Bloodline Factor
        </span>
      );
    default:
      return null;
  }
}

/**
 * Some skill descriptions lead with a qualifier ("Leader・…", "Medium・…").
 * Peel it into a small badge so the qualifier reads as a tag, not a run-on.
 */
export function splitStylePrefix(desc: string | undefined): { style: string | null; text: string } {
  const m = /^([A-Za-z]+)・(.+)$/.exec(desc ?? "");
  if (m) {
    return { style: m[1], text: m[2] };
  }
  return { style: null, text: desc ?? "" };
}

export function StylePrefixBadge({ style, className = "" }: { style: string; className?: string }) {
  return (
    <span
      className={`rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.2 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 ${className}`}
    >
      {style}
    </span>
  );
}
