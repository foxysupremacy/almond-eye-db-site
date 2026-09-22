import React from "react";

export type BadgeSize = "compact" | "standard" | "comfortable";
export type BadgeTone =
  | "neutral"
  | "emerald"
  | "sky"
  | "blue"
  | "indigo"
  | "violet"
  | "purple"
  | "pink"
  | "amber"
  | "rose";
export type BadgeEmphasis = "soft" | "solid" | "outline";

const SIZE_CLASSES: Record<BadgeSize, string> = {
  compact: "h-5 px-1.5 text-[9px]",
  standard: "h-6 px-2 text-[10px]",
  comfortable: "h-7 px-2.5 text-[11px]",
};

const ICON_SIZE_CLASSES: Record<BadgeSize, string> = {
  compact: "h-3 w-3",
  standard: "h-3.5 w-3.5",
  comfortable: "h-4 w-4",
};

const SOFT_TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
  emerald: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80",
  sky: "bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700",
  blue: "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  indigo: "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/80",
  violet: "bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 border-violet-200/80 dark:border-violet-800/80",
  purple: "bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-800",
  pink: "bg-pink-100 dark:bg-pink-950/70 text-pink-800 dark:text-pink-300 border-pink-300 dark:border-pink-800",
  amber: "bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-100 border-amber-400 dark:border-amber-700",
  rose: "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800",
};

const SOLID_TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-zinc-700 text-white border-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:border-zinc-200",
  emerald: "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-400 dark:text-emerald-950 dark:border-emerald-400",
  sky: "bg-sky-600 text-white border-sky-600 dark:bg-sky-400 dark:text-sky-950 dark:border-sky-400",
  blue: "bg-blue-600 text-white border-blue-600 dark:bg-blue-400 dark:text-blue-950 dark:border-blue-400",
  indigo: "bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-400 dark:text-indigo-950 dark:border-indigo-400",
  violet: "bg-violet-600 text-white border-violet-600 dark:bg-violet-400 dark:text-violet-950 dark:border-violet-400",
  purple: "bg-purple-600 text-white border-purple-600 dark:bg-purple-400 dark:text-purple-950 dark:border-purple-400",
  pink: "bg-pink-600 text-white border-pink-600 dark:bg-pink-400 dark:text-pink-950 dark:border-pink-400",
  amber: "bg-amber-500 text-amber-950 border-amber-500 dark:bg-amber-300 dark:text-amber-950 dark:border-amber-300",
  rose: "bg-rose-600 text-white border-rose-600 dark:bg-rose-400 dark:text-rose-950 dark:border-rose-400",
};

const OUTLINE_TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-transparent text-zinc-600 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700",
  emerald: "bg-transparent text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700",
  sky: "bg-transparent text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700",
  blue: "bg-transparent text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
  indigo: "bg-transparent text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700",
  violet: "bg-transparent text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700",
  purple: "bg-transparent text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700",
  pink: "bg-transparent text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-700",
  amber: "bg-transparent text-amber-800 dark:text-amber-300 border-amber-400 dark:border-amber-700",
  rose: "bg-transparent text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700",
};

export interface BadgeClassNameOptions {
  size?: BadgeSize;
  tone?: BadgeTone;
  emphasis?: BadgeEmphasis;
  uppercase?: boolean;
  fullWidth?: boolean;
}

export function badgeClassName({
  size = "standard",
  tone,
  emphasis = "soft",
  uppercase = false,
  fullWidth = false,
}: BadgeClassNameOptions = {}) {
  const toneClasses = tone
    ? emphasis === "solid"
      ? SOLID_TONE_CLASSES[tone]
      : emphasis === "outline"
        ? OUTLINE_TONE_CLASSES[tone]
        : SOFT_TONE_CLASSES[tone]
    : "";

  return [
    "inline-flex items-center justify-center gap-1 rounded-md border font-semibold leading-none whitespace-nowrap shrink-0",
    SIZE_CLASSES[size],
    toneClasses,
    uppercase ? "uppercase tracking-wider" : "",
    fullWidth ? "w-full" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, BadgeClassNameOptions {
  icon?: React.ReactNode;
}

export function Badge({
  children,
  icon,
  className = "",
  size = "standard",
  tone,
  emphasis = "soft",
  uppercase = false,
  fullWidth = false,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`${badgeClassName({ size, tone, emphasis, uppercase, fullWidth })} ${className}`}
      {...props}
    >
      {icon && <span className={`inline-flex flex-none ${ICON_SIZE_CLASSES[size]}`}>{icon}</span>}
      {children}
    </span>
  );
}

export function BadgeGroup({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`} {...props}>
      {children}
    </div>
  );
}
