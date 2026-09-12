"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { api, type SkillDetail } from "../lib/api";
import { useDeck } from "./store";
import { computeAllZones, horseForStrategy, type SkillZoneResult } from "../lib/skill-engine/zones";
import { conditionBranches, formatEffect } from "../lib/skill-engine/describe";
import { getSkillRarityStyle } from "../lib/skill-rarity";
import { ZONE_COLORS } from "../lib/track-render";
import SkillIcon from "./skill-icon";
import { evaluateSkillForTrack } from "../lib/skill-evaluator";
import { useBodyScrollLock } from "../lib/use-body-scroll-lock";
import {
  HighlightText,
  FormattedEffectBadges,
  TacticalTimingStrip,
} from "./highlighted-numbers";
import { StarRating } from "./icons";

interface SkillHoverCardProps {
  skillId: number;
  fallbackSkill?: {
    nameEn?: string;
    nameJp?: string;
    rarity?: number;
    iconId?: number | null;
  };
  cardName?: string;
  isParentMode?: boolean;
  children: React.ReactNode;
  className?: string;
}

// Module-level cache to avoid refetching skill details across multiple hovers
import { hexToRgba } from "./shared/color-utils";
import { splitStylePrefix } from "./shared/skill-badges";
import { ConditionChips } from "./shared/condition-chips";

const skillDetailCache = new Map<number, SkillDetail>();

export function SkillHoverCard({
  skillId,
  fallbackSkill,
  cardName,
  isParentMode = false,
  children,
  className = "",
}: SkillHoverCardProps) {
  const { course, racerCount, runningStyle } = useDeck();
  const [isOpen, setIsOpen] = useState(false);
  const [detail, setDetail] = useState<SkillDetail | null>(() => skillDetailCache.get(skillId) ?? null);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; originX: "left" | "right" }>({
    top: 0,
    left: 0,
    originX: "left",
  });
  const [isMobile, setIsMobile] = useState(false);
  const [isHoveringPopover, setIsHoveringPopover] = useState(false);

  // Lock body scroll if mobile sheet is open, or if desktop popover is actively hovered
  useBodyScrollLock((isMobile && isOpen) || (!isMobile && isOpen && isHoveringPopover));

  const triggerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Detect mobile viewport
  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth < 768);
    }
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const styleHorse = useMemo(
    () => (runningStyle ? horseForStrategy(runningStyle) : undefined),
    [runningStyle],
  );

  // Fetch skill details on demand
  const loadDetail = useCallback(async () => {
    if (skillDetailCache.has(skillId)) {
      setDetail(skillDetailCache.get(skillId)!);
      return;
    }
    setLoading(true);
    try {
      const data = await api.skill(skillId);
      skillDetailCache.set(skillId, data);
      setDetail(data);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [skillId]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || isMobile) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 340;
    const popoverHeight = popoverRef.current?.getBoundingClientRect().height ?? 300;

    // Place the popover beside the trigger: right side preferred, flip left when out of room
    let left = rect.right + 8;
    let originX: "left" | "right" = "left"; // scale from the edge nearest the trigger
    if (left + popoverWidth > window.innerWidth - 16) {
      left = rect.left - popoverWidth - 8;
      originX = "right";
    }
    if (left < 16) {
      left = 16;
    }

    // Vertically center the popover on the trigger, clamped to the viewport
    let top = rect.top + rect.height / 2 - popoverHeight / 2;
    top = Math.min(Math.max(top, 16), window.innerHeight - popoverHeight - 16);

    setCoords({ top, left, originX });
  }, [isMobile]);

  // Re-measure once the popover has rendered (initial mount and after detail loads)
  useLayoutEffect(() => {
    if (!isOpen || isMobile) return;
    updatePosition();
  }, [isOpen, detail, loading, isMobile, updatePosition]);

  const handleOpen = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    updatePosition();
    setIsOpen(true);
    loadDetail();
  }, [updatePosition, loadDetail]);

  const handleClose = useCallback(() => {
    if (isMobile) return; // on mobile, explicit dismiss only
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      setIsHoveringPopover(false);
    }, 120);
  }, [isMobile]);

  const handleToggle = useCallback(() => {
    if (isOpen) {
      setIsOpen(false);
      setIsHoveringPopover(false);
    } else {
      handleOpen();
    }
  }, [isOpen, handleOpen]);

  // Update position on scroll/resize while open
  useEffect(() => {
    if (!isOpen || isMobile) return;
    function handleScrollOrResize() {
      updatePosition();
    }
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, isMobile, updatePosition]);

  // Escape key closes popover/drawer
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Compute zones if detail is loaded
  const zones: SkillZoneResult[] = useMemo(() => {
    if (!detail) return [];
    const groups = (detail.conditionGroups ?? []).map((g) => ({
      condition: g.condition ?? "",
      precondition: g.precondition ?? null,
    }));
    if (course) return computeAllZones(course, groups, styleHorse);
    return [];
  }, [detail, course, styleHorse]);

  const evaluation = useMemo(() => {
    if (!detail) return null;
    return evaluateSkillForTrack(
      detail,
      course,
      runningStyle,
      racerCount,
      isParentMode,
      zones
    );
  }, [detail, course, runningStyle, racerCount, isParentMode, zones]);

  const rarity = detail?.rarity ?? fallbackSkill?.rarity ?? 1;
  const rarityMeta = getSkillRarityStyle(rarity);
  const nameEn = detail?.nameEn || fallbackSkill?.nameEn || `Skill #${skillId}`;
  const nameJp = detail?.nameJp || fallbackSkill?.nameJp || "";
  const iconId = detail?.iconId ?? fallbackSkill?.iconId;
  const { style, text } = splitStylePrefix(detail?.descEn);

  const content = (
    <>
      {/* Header: Skill Name + JP + Rarity */}
      <div className="flex items-start justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <SkillIcon iconId={iconId} name={nameEn} className="h-5 w-5 object-contain flex-none" />
          <div className="min-w-0">
            <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{nameEn}</span>
            {nameJp && <span className="block text-xs text-zinc-400 dark:text-zinc-500 font-normal truncate">{nameJp}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-none">
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${rarityMeta.badgeClass}`}
          >
            {rarityMeta.badgeLabel}
          </span>
          {isMobile && (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
              aria-label="Close"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* From source & card origin */}
      <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="text-zinc-400 dark:text-zinc-500 font-medium">From:</span>
        <span className="rounded bg-violet-100 dark:bg-violet-950/80 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800">
          event
        </span>
        {cardName && <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate">{cardName}</span>}
      </div>

      {/* Description */}
      {detail?.descEn && (
        <div className="mt-2 flex flex-wrap items-start gap-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
          {style && (
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium leading-4 text-zinc-600 dark:text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" aria-hidden="true" />
              {style}
            </span>
          )}
          <span className="min-w-0 flex-1">{text}</span>
        </div>
      )}

      {/* Tactical Rating & Verdict Banner */}
      {evaluation && (
        <div className="mt-2.5 rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/90 p-2.5 shadow-2xs">
          {/* Top row: Star rating + Category Badge */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
            <div className="flex items-center gap-1.5">
              <StarRating stars={evaluation.stars} starClassName="h-3 w-3" />
              <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 ml-0.5">
                {evaluation.tier} Tier
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] border shadow-2xs ${evaluation.primaryBadge.badgeClass}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${evaluation.primaryBadge.dotColor}`} />
              {evaluation.primaryBadge.label}
            </span>
          </div>

          {/* Verdict summary with highlighted numbers */}
          <p className="text-[11px] leading-relaxed font-medium text-zinc-700 dark:text-zinc-200">
            <HighlightText text={evaluation.verdictSummary} />
          </p>

          {/* Compact 3-box Highlighted Numbers Strip */}
          <TacticalTimingStrip evaluation={evaluation} />

          {/* Special Dynamics Pills */}
          {evaluation.specialEffects.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {evaluation.specialEffects.map((eff) => (
                <span
                  key={eff.id}
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold border ${
                    eff.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                      : eff.type === "warning"
                      ? "bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                      : eff.type === "error"
                      ? "bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700"
                      : "bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                  }`}
                  title={eff.description}
                >
                  <span>{eff.badge}</span>
                  {eff.meters && <span className="opacity-80 font-mono font-bold">{eff.meters}</span>}
                </span>
              ))}
            </div>
          )}

          {/* Parent Mode factor notification */}
          {evaluation.parentMeta?.isGoldTransformed && (
            <div className="mt-1.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-amber-600 dark:text-amber-400">Parent Factor:</span>{" "}
              Inherits as{" "}
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {evaluation.parentMeta.inheritedWhiteNameEn}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Condition Groups & Calculated Effect */}
      {loading && !detail ? (
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500 italic">Loading calculated stats…</p>
      ) : detail?.conditionGroups && detail.conditionGroups.length > 0 ? (
        <div className="mt-2.5 flex flex-col gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-2">
          {detail.conditionGroups.map((g, gi) => {
            const z = zones[gi];
            const wins =
              z && z.regions.length
                ? z.regions.map((r) => `${Math.round(r.start)}-${Math.round(r.end)}m`).join(", ")
                : null;
            const branches = conditionBranches(g.condition ?? "", racerCount).branches;
            const needsBranches = g.precondition
              ? conditionBranches(g.precondition, racerCount).branches
              : null;
            const effectLine = formatEffect(
              (g.effects as Array<{ type: number; value: number }> | undefined) ?? [],
              g.base_time,
              course?.length ?? 1800,
            );
            const tint = hexToRgba(ZONE_COLORS[gi % ZONE_COLORS.length], 0.35);

            return (
              <div key={gi} className="rounded-lg border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 text-xs shadow-2xs">
                {/* Trigger header */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className="inline-block h-3 w-3 flex-none rounded-sm border border-zinc-300 dark:border-zinc-700"
                    style={{ background: tint }}
                  />
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 text-[11px]">T{gi + 1}</span>
                  {z && (
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                      {z.isRandom ? "random" : "deterministic"}
                    </span>
                  )}
                  {wins ? (
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                      {wins}
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">No trigger on active course</span>
                  )}
                </div>

                {/* Condition branches */}
                <div className="mt-1">
                  <ConditionChips
                    branches={branches}
                    needsBranches={needsBranches}
                    tint={tint}
                  />
                </div>

                {/* Highlighted Calculated Effect Badges */}
                <div className="mt-2">
                  <FormattedEffectBadges
                    effects={(g.effects as Array<{ type: number; value: number }>) ?? []}
                    baseTime={g.base_time}
                    courseLength={course?.length ?? 1800}
                  />
                  {!g.effects?.length && effectLine && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 dark:border-emerald-600/60 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-xs font-semibold text-emerald-900 dark:text-emerald-300 shadow-2xs">
                      {effectLine}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        onClick={(e) => {
          if (isMobile) {
            e.stopPropagation();
            handleToggle();
          }
        }}
        className={`inline-block cursor-pointer ${className}`}
      >
        {children}
      </span>

      {isOpen && (
        isMobile ? (
          /* Mobile slide-up Bottom Sheet */
          <div
            className="fixed inset-0 z-[190] flex items-end justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200 ease-out-quart touch-none overscroll-none"
            onClick={() => {
              setIsOpen(false);
              setIsHoveringPopover(false);
            }}
            role="dialog"
            aria-modal="true"
          >
            <div
              ref={popoverRef}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-[65dvh] max-h-[92dvh] overflow-y-auto overscroll-contain touch-pan-y rounded-t-2xl border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-[250ms] ease-out-expo text-left"
            >
              {/* Drag Indicator Handle */}
              <div className="mx-auto -mt-1 mb-3 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              {content}
            </div>
          </div>
        ) : (
          /* Desktop floating popover */
          <div
            ref={popoverRef}
            onMouseEnter={() => {
              setIsHoveringPopover(true);
              handleOpen();
            }}
            onMouseLeave={() => {
              setIsHoveringPopover(false);
              handleClose();
            }}
            onWheel={(e) => e.stopPropagation()}
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transformOrigin: `${coords.originX} center`,
            }}
            className="fixed z-[150] w-[340px] max-h-[85vh] overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 shadow-2xl dark:shadow-zinc-950/60 animate-in fade-in zoom-in-95 duration-200 ease-out-expo text-left"
            role="tooltip"
          >
            {content}
          </div>
        )
      )}
    </>
  );
}

export default SkillHoverCard;
