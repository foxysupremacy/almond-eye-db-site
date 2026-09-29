import type { SkillEffectCategory } from "@/lib/skills/effects";

export interface EffectCategoryMeta {
  id: SkillEffectCategory;
  label: string;
  badge: string;
  dotColor: string;
  description: string;
}

/** Presentation tokens for skill effect categories; classification stays in lib. */
export const EFFECT_CATEGORIES: EffectCategoryMeta[] = [
  { id: "target_speed", label: "Target Speed", badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800", dotColor: "bg-amber-500", description: "Raises top speed ceiling during the race" },
  { id: "current_speed", label: "Current Speed", badge: "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800", dotColor: "bg-rose-500", description: "Instantly modifies speed without waiting for acceleration" },
  { id: "acceleration", label: "Acceleration", badge: "bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border-orange-200 dark:border-orange-800", dotColor: "bg-orange-500", description: "Accelerates faster up to target speed (spurt / start)" },
  { id: "zenkai_acceleration", label: "Zenkai Spurt Acceleration", badge: "bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border-teal-200 dark:border-teal-800", dotColor: "bg-teal-500", description: "Special acceleration effect during Zenkai Spurt" },
  { id: "heal", label: "Recovery (Heal)", badge: "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800", dotColor: "bg-blue-500", description: "Restores stamina percentage to sustain top speed longer" },
  { id: "debuff", label: "Debuff", badge: "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800", dotColor: "bg-purple-500", description: "Drains stamina, slows down opponents, or delays start" },
  { id: "passive", label: "Passive (Green)", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800", dotColor: "bg-emerald-500", description: "Conditional flat stat additions (Speed, Stamina, Power, Guts, Wit)" },
  { id: "other", label: "Other", badge: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700", dotColor: "bg-zinc-400", description: "Lane repositioning, clairvoyance/field of view, etc." },
];

export const EFFECT_CATEGORY_MAP = new Map<SkillEffectCategory, EffectCategoryMeta>(
  EFFECT_CATEGORIES.map((category) => [category.id, category]),
);
