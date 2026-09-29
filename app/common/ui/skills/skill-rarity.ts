import { getRarityCategory } from "@/lib/skills/rarity";

export interface RarityStyleMeta {
  key: "white" | "gold" | "unique" | "evolved";
  label: string;
  badgeLabel: string;
  badgeClass: string;
  borderClass: string;
  bgClass?: string;
}

/** Shared presentation tokens for skill rarity surfaces and badges. */
export const RARITY_STYLES: Record<"white" | "gold" | "unique" | "evolved", RarityStyleMeta> = {
  white: {
    key: "white",
    label: "White",
    badgeLabel: "White",
    badgeClass: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700",
    borderClass: "border-zinc-200/90 dark:border-zinc-800",
    bgClass: "bg-white dark:bg-zinc-900",
  },
  gold: {
    key: "gold",
    label: "Gold",
    badgeLabel: "Gold",
    badgeClass: "bg-amber-200/90 dark:bg-amber-950 text-amber-950 dark:text-amber-100 font-bold border border-amber-400/80 dark:border-amber-700",
    borderClass: "border-amber-300 dark:border-amber-700/80 shadow-xs",
    bgClass: "skill-surface-gold",
  },
  unique: {
    key: "unique",
    label: "Unique",
    badgeLabel: "Unique",
    badgeClass: "bg-pink-100 dark:bg-pink-950 text-pink-950 dark:text-pink-100 font-bold border border-pink-300 dark:border-pink-700/80",
    borderClass: "border-pink-300/80 dark:border-pink-700/80 shadow-xs",
    bgClass: "skill-surface-unique",
  },
  evolved: {
    key: "evolved",
    label: "Evolved",
    badgeLabel: "Evo",
    badgeClass: "bg-purple-100 dark:bg-purple-950 text-purple-950 dark:text-purple-100 font-bold border border-purple-300 dark:border-purple-700/80",
    borderClass: "border-purple-300/80 dark:border-purple-700/80 shadow-xs",
    bgClass: "skill-surface-evolved",
  },
};

export function getSkillRarityStyle(rarity?: number): RarityStyleMeta {
  return RARITY_STYLES[getRarityCategory(rarity)];
}

/** Support-card rarity chips shared by feature screens. */
export const RARITY_META: Record<number, { label: string; chip: string }> = {
  1: { label: "R", chip: "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300" },
  2: { label: "SR", chip: "bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200" },
  3: { label: "SSR", chip: "bg-amber-200/90 dark:bg-amber-950 text-amber-950 dark:text-amber-100 font-bold border border-amber-400/80 dark:border-amber-700" },
};
