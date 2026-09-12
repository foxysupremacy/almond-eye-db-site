"use client";

import React from "react";
import SkillIcon from "./skill-icon";
import { SkillHoverCard } from "./skill-hover-card";

export type SkillItemSize = "xs" | "sm" | "md" | "lg";

export interface SkillItemData {
  id?: number | string;
  iconId?: number | string | null;
  nameEn: string;
  nameJp?: string | null;
  cardName?: string;
  rarity?: number;
  descEn?: string;
}

export interface SkillItemProps {
  skill: SkillItemData;
  size?: SkillItemSize;
  isBanned?: boolean;
  interactive?: boolean;
  isParentMode?: boolean;
  showExternalIcon?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  onClick?: () => void;
}

const SIZE_CONFIGS: Record<
  SkillItemSize,
  {
    iconClass: string;
    gapClass: string;
    titleClass: string;
    subtitleClass: string;
    externalIconClass: string;
  }
> = {
  xs: {
    iconClass: "h-3.5 w-3.5 sm:h-4 sm:w-4",
    gapClass: "gap-1.5",
    titleClass: "text-[10px] font-semibold leading-tight",
    subtitleClass: "text-[8px] leading-tight mt-0.5",
    externalIconClass: "text-[8px]",
  },
  sm: {
    iconClass: "h-5 w-5 sm:h-6 sm:w-6",
    gapClass: "gap-2",
    titleClass: "text-xs font-semibold leading-tight",
    subtitleClass: "text-[10px] sm:text-[11px] leading-tight mt-0.5",
    externalIconClass: "text-[9px]",
  },
  md: {
    iconClass: "h-6 w-6 sm:h-7 sm:w-7",
    gapClass: "gap-2.5",
    titleClass: "text-sm font-semibold leading-snug",
    subtitleClass: "text-xs leading-tight mt-0.5",
    externalIconClass: "text-[10px]",
  },
  lg: {
    iconClass: "h-10 w-10 sm:h-11 sm:w-11",
    gapClass: "gap-3",
    titleClass: "text-base font-semibold leading-tight",
    subtitleClass: "text-xs leading-tight mt-0.5",
    externalIconClass: "text-xs",
  },
};

export function SkillItem({
  skill,
  size = "md",
  isBanned = false,
  interactive,
  isParentMode = false,
  showExternalIcon,
  leading,
  trailing,
  children,
  className = "",
  titleClassName = "",
  subtitleClassName = "",
  onClick,
}: SkillItemProps) {
  const config = SIZE_CONFIGS[size];
  const numId = skill.id !== undefined && skill.id !== null ? Number(skill.id) : null;
  const parsedIconId =
    skill.iconId !== undefined && skill.iconId !== null
      ? isNaN(Number(skill.iconId))
        ? null
        : Number(skill.iconId)
      : null;
  const canHover = (interactive ?? (numId !== null && !isNaN(numId) && numId > 0)) && numId !== null && !isNaN(numId) && numId > 0;
  const hasExternalIcon = showExternalIcon ?? (canHover && (size === "md" || size === "lg"));

  // Primary English title styling
  const titleColor = isBanned
    ? "line-through text-zinc-500 dark:text-zinc-400"
    : canHover
    ? "text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors"
    : "text-zinc-900 dark:text-zinc-100";

  // Secondary Japanese subtitle styling (always stacked directly below English, never side-by-side)
  const subtitleColor = isBanned
    ? "line-through text-zinc-400 dark:text-zinc-600 font-normal"
    : "text-zinc-400 dark:text-zinc-500 font-normal";

  const coreContent = (
    <div className={`flex items-center ${config.gapClass} min-w-0 ${isBanned ? "opacity-60" : ""}`}>
      {leading && <div className="flex-none flex items-center">{leading}</div>}

      {/* SkillIcon vertically centered against 2-line title block */}
      <SkillIcon
        iconId={parsedIconId}
        name={skill.nameEn}
        className={`${config.iconClass} object-contain flex-none drop-shadow-2xs`}
      />

      {/* Stacked Bilingual Text Container */}
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <div className="flex items-center gap-1 min-w-0">
          <span className={`${config.titleClass} ${titleColor} truncate ${titleClassName}`}>
            {skill.nameEn || skill.nameJp}
          </span>
          {hasExternalIcon && (
            <span
              className={`${config.externalIconClass} text-zinc-400 dark:text-zinc-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity flex-none`}
            >
              ↗
            </span>
          )}
        </div>

        {skill.nameJp && (
          <p className={`${config.subtitleClass} ${subtitleColor} truncate ${subtitleClassName}`}>
            {skill.nameJp}
          </p>
        )}
      </div>
    </div>
  );

  const interactiveTrigger = canHover ? (
    <SkillHoverCard
      skillId={numId!}
      fallbackSkill={{
        nameEn: skill.nameEn,
        nameJp: skill.nameJp ?? undefined,
        rarity: skill.rarity,
        iconId: parsedIconId,
      }}
      cardName={skill.cardName}
      isParentMode={isParentMode}
      className="group inline-flex items-center min-w-0 cursor-pointer"
    >
      {coreContent}
    </SkillHoverCard>
  ) : onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center min-w-0 text-left cursor-pointer w-full"
    >
      {coreContent}
    </button>
  ) : (
    coreContent
  );

  if (!trailing && !children) {
    return <div className={`min-w-0 ${className}`}>{interactiveTrigger}</div>;
  }

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">{interactiveTrigger}</div>
        {trailing && <div className="flex-none flex items-center gap-1.5">{trailing}</div>}
      </div>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

export default SkillItem;
