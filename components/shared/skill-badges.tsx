import React from "react";
import { getSkillRarityStyle } from "../../lib/skill-rarity";
import { getCardImageUrl, getCharacterImageUrl } from "../../lib/data/registry";
import { AlertTriangleIcon, SparklesIcon, StarIcon } from "../icons";
import { Badge, BadgeGroup, badgeClassName, type BadgeSize } from "./badge";

export type SkillBadgeDensity = "compact" | "standard";

/** Small support-card portrait used wherever a textual card provenance label would be redundant. */
export function CardSourceIcon({ cardId, cardName, className = "h-5 w-5" }: { cardId?: number | null; cardName?: string; className?: string }) {
  if (!cardId) return null;
  return (
    <img
      src={getCardImageUrl(cardId, "portrait")}
      alt={cardName ? `${cardName} card` : "Support card"}
      title={cardName || "Support card"}
      loading="lazy"
      className={`shrink-0 rounded-none object-contain border border-zinc-200/80 bg-zinc-50 dark:border-zinc-700/80 dark:bg-zinc-800 ${className}`}
    />
  );
}

export interface SkillSourceIconSource {
  /** Support cards use their square portrait; lineage skills use the Uma stand. */
  kind: "card" | "character";
  cardId?: number | null;
  charId?: number | null;
  name: string;
  label?: string;
}

/**
 * Canonical compact provenance renderer for skill rows.
 *
 * A source is visual metadata, not a second run of prose: support grants show
 * their card portrait and inherited Uma grants show that Uma's character stand.
 * Names stay available through native tooltips, while duplicate sources simply
 * expand into more icons.
 */
export function SkillSourceIcons({
  sources,
  className = "",
  iconClassName = "h-5 w-5",
}: {
  sources: SkillSourceIconSource[];
  className?: string;
  iconClassName?: string;
}) {
  const uniqueSources = sources.filter((source, index) => {
    const key = `${source.kind}:${source.cardId ?? ""}:${source.charId ?? ""}:${source.name}`;
    return sources.findIndex((candidate) => `${candidate.kind}:${candidate.cardId ?? ""}:${candidate.charId ?? ""}:${candidate.name}` === key) === index;
  });
  if (uniqueSources.length === 0) return null;

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {uniqueSources.map((source) => {
        if (!source.cardId) return null;
        const title = source.label ? `${source.label}: ${source.name}` : source.name;
        const src = source.kind === "character"
          ? getCharacterImageUrl(source.charId ?? 0, source.cardId, "01")
          : getCardImageUrl(source.cardId, "portrait");
        return (
          <img
            key={`${source.kind}-${source.cardId}-${source.name}`}
            src={src}
            alt={`${source.name} ${source.kind === "character" ? "Uma" : "card"}`}
            title={title}
            loading="lazy"
            className={`shrink-0 rounded-none object-contain border border-zinc-200/80 bg-zinc-50 dark:border-zinc-700/80 dark:bg-zinc-800 ${iconClassName}`}
          />
        );
      })}
    </span>
  );
}

const DENSITY_SIZE: Record<SkillBadgeDensity, BadgeSize> = {
  compact: "compact",
  standard: "standard",
};

function badgeSize(density: SkillBadgeDensity): BadgeSize {
  return DENSITY_SIZE[density];
}

/** Unique-skill tier chip colors (S+ → F), shared by picker rows and pedigree slots. */
export const TIER_CHIP_CLASSES: Record<string, string> = {
  "S+": "bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-400/50",
  S: "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-400/50",
  A: "bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-400/50",
  B: "bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border-sky-400/50",
  C: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700",
  D: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500 border-zinc-300 dark:border-zinc-700",
  F: "bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border-red-400/50",
};

export interface RarityBadgeProps {
  rarity?: number;
  size?: "xs" | "sm";
  density?: SkillBadgeDensity;
  fullWidth?: boolean;
  className?: string;
}

export function RarityBadge({ rarity, size = "xs", density, fullWidth = false, className = "" }: RarityBadgeProps) {
  const meta = getSkillRarityStyle(rarity);
  const badgeSizeValue = density ? badgeSize(density) : size === "xs" ? "compact" : "standard";

  return (
    <Badge size={badgeSizeValue} uppercase fullWidth={fullWidth} className={`font-bold ${meta.badgeClass} ${className}`}>
      {meta.badgeLabel}
    </Badge>
  );
}

export interface SourceBadgeProps {
  source: "hint" | "event" | "unique" | "factor" | string;
  label?: string;
  density?: SkillBadgeDensity;
  fullWidth?: boolean;
  className?: string;
}

export function SourceBadge({ source, label, density = "standard", fullWidth = false, className = "" }: SourceBadgeProps) {
  const size = badgeSize(density);
  const shared = `font-bold tracking-wide ${className}`;
  switch (source) {
    case "event":
      return (
        <Badge size={size} uppercase tone="violet" fullWidth={fullWidth} className={shared}>
          {label ?? "Card Event"}
        </Badge>
      );
    case "hint":
      return (
        <Badge size={size} uppercase tone="emerald" fullWidth={fullWidth} className={shared}>
          {label ?? "Card Hint"}
        </Badge>
      );
    case "unique":
      return (
        <Badge size={size} uppercase tone="amber" fullWidth={fullWidth} className={shared}>
          {label ?? "Parent Unique"}
        </Badge>
      );
    case "factor":
      return (
        <Badge size={size} uppercase tone="sky" fullWidth={fullWidth} className={shared}>
          {label ?? "Bloodline Factor"}
        </Badge>
      );
    default:
      return null;
  }
}

export type SkillIndicatorKind =
  | "banned"
  | "unique-target"
  | "no-activation"
  | "in-main-deck"
  | "inherit-only"
  | "evolved-inherit"
  | "evolution-available"
  | "unselected-choice";

export interface SkillIndicatorDescriptor {
  kind: SkillIndicatorKind;
  label?: string;
  title?: string;
}

export interface SkillIndicatorProps extends SkillIndicatorDescriptor {
  density?: SkillBadgeDensity;
  className?: string;
}

const INDICATOR_DEFAULTS: Record<SkillIndicatorKind, { label: string; className: string; Icon?: React.ComponentType<{ className?: string }> }> = {
  banned: { label: "Banned", className: "bg-rose-600 text-white border-rose-600 shadow-xs" },
  "unique-target": { label: "Unique Target", className: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80", Icon: StarIcon },
  "no-activation": { label: "No Activation", className: "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800", Icon: AlertTriangleIcon },
  "in-main-deck": { label: "In Main Deck", className: "bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-100 border-amber-400 dark:border-amber-700", Icon: AlertTriangleIcon },
  "inherit-only": { label: "Inherit Only", className: "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/80" },
  "evolved-inherit": { label: "Evolved Inherit", className: "bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-800", Icon: SparklesIcon },
  "evolution-available": { label: "Evol Available", className: "bg-violet-100 dark:bg-violet-950/70 text-violet-800 dark:text-violet-200 border-violet-300 dark:border-violet-800", Icon: SparklesIcon },
  "unselected-choice": { label: "Unselected Choice", className: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700" },
};

export function SkillIndicator({ kind, label, title, density = "compact", className = "" }: SkillIndicatorProps) {
  const config = INDICATOR_DEFAULTS[kind];
  const Icon = config.Icon;
  return (
    <Badge
      title={title}
      size={badgeSize(density)}
      uppercase
      icon={Icon ? <Icon className="h-full w-full" /> : undefined}
      className={`font-bold ${config.className} ${className}`}
    >
      {label ?? config.label}
    </Badge>
  );
}

export function SkillIndicatorGroup({ indicators, density = "compact", className = "" }: { indicators: SkillIndicatorDescriptor[]; density?: SkillBadgeDensity; className?: string }) {
  if (indicators.length === 0) return null;
  return <BadgeGroup className={className}>{indicators.map((indicator) => <SkillIndicator key={`${indicator.kind}-${indicator.label ?? ""}`} {...indicator} density={density} />)}</BadgeGroup>;
}

/** Shared interactive trigger styles for the duplicate-card popover. */
export function duplicateSkillBadgeClass(variant: "amber" | "sky", density: SkillBadgeDensity = "compact") {
  const color = variant === "amber"
    ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25"
    : "bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/40";
  return `${badgeClassName({ size: badgeSize(density) })} font-bold tracking-wide transition-colors cursor-pointer shadow-2xs ${color}`;
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
  return <Badge size="compact" tone="neutral" className={`px-1 font-semibold ${className}`}>{style}</Badge>;
}
