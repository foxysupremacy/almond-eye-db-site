"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { api, type SkillDetail } from "../lib/api";
import { useDeck } from "./store";
import { computeAllZones, horseForStrategy, type SkillZoneResult } from "../lib/skill-engine/zones";
import { conditionBranches, formatEffect } from "../lib/skill-engine/describe";
import { getSkillRarityStyle } from "../lib/skill-rarity";
import { ZONE_COLORS } from "../lib/track-render";
import SkillIcon from "./skill-icon";

interface SkillHoverCardProps {
  skillId: number;
  fallbackSkill?: {
    nameEn?: string;
    nameJp?: string;
    rarity?: number;
    iconId?: number | null;
  };
  cardName?: string;
  children: React.ReactNode;
  className?: string;
}

// Module-level cache to avoid refetching skill details across multiple hovers
const skillDetailCache = new Map<number, SkillDetail>();

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function splitStylePrefix(desc: string | undefined): { style: string | null; text: string } {
  const m = /^([A-Za-z]+)・(.+)$/.exec(desc ?? "");
  if (m) {
    return { style: m[1], text: m[2] };
  }
  return { style: null, text: desc ?? "" };
}

function ConditionChips({
  branches,
  needsBranches,
  tint,
}: {
  branches: string[][];
  needsBranches: string[][] | null;
  tint: string;
}) {
  const needs = needsBranches && needsBranches.length > 0 ? needsBranches : null;

  return (
    <div className="flex flex-col gap-1">
      {needs && (
        <div className="mb-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Needs:</span>
          {needs.map((chips, bi) => (
            <div key={bi} className="mt-0.5 flex flex-wrap items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 flex-none rounded-sm border border-zinc-300 bg-zinc-200" />
              {bi > 0 && (
                <span className="mr-0.5 text-[10px] font-semibold uppercase text-zinc-400">or</span>
              )}
              {chips.map((chip, ci) => (
                <span
                  key={ci}
                  className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] leading-4 text-zinc-600 font-medium"
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
            className="inline-block h-2.5 w-2.5 flex-none rounded-sm border border-zinc-300"
            style={{ background: tint }}
          />
          {bi > 0 && (
            <span className="mr-0.5 text-[10px] font-semibold uppercase text-zinc-400">or</span>
          )}
          {chips.map((chip, ci) => (
            <span
              key={ci}
              className="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] leading-4 text-zinc-700 font-medium shadow-2xs"
            >
              {chip}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkillHoverCard({
  skillId,
  fallbackSkill,
  cardName,
  children,
  className = "",
}: SkillHoverCardProps) {
  const { course, racerCount, runningStyle } = useDeck();
  const [isOpen, setIsOpen] = useState(false);
  const [detail, setDetail] = useState<SkillDetail | null>(() => skillDetailCache.get(skillId) ?? null);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const triggerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 340;
    const popoverHeight = 280;

    let left = rect.left;
    // Keep popover inside horizontal screen bounds
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    if (left < 16) {
      left = 16;
    }

    let top = rect.bottom + 8;
    // If popover goes off the bottom of the viewport, position it above
    if (top + popoverHeight > window.innerHeight - 16) {
      top = Math.max(16, rect.top - popoverHeight - 8);
    }

    setCoords({ top, left });
  }, []);

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
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 120);
  }, []);

  // Update position on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    function handleScrollOrResize() {
      updatePosition();
    }
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Escape key closes popover
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

  const rarity = detail?.rarity ?? fallbackSkill?.rarity ?? 1;
  const rarityMeta = getSkillRarityStyle(rarity);
  const nameEn = detail?.nameEn || fallbackSkill?.nameEn || `Skill #${skillId}`;
  const nameJp = detail?.nameJp || fallbackSkill?.nameJp || "";
  const iconId = detail?.iconId ?? fallbackSkill?.iconId;
  const { style, text } = splitStylePrefix(detail?.descEn);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        className={`inline-block ${className}`}
      >
        {children}
      </span>

      {isOpen && (
        <div
          ref={popoverRef}
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
          style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
          className="fixed z-[150] w-[340px] max-h-[85vh] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left"
          role="tooltip"
        >
          {/* Header: Skill Name + JP + Rarity */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 pb-2">
            <SkillIcon iconId={iconId} name={nameEn} className="h-5 w-5 rounded object-contain flex-none" />
            <span className="text-sm font-bold text-zinc-900">{nameEn}</span>
            {nameJp && <span className="text-xs text-zinc-400 font-normal">{nameJp}</span>}
            <span
              className={`ml-auto rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${rarityMeta.badgeClass}`}
            >
              {rarityMeta.badgeLabel}
            </span>
          </div>

          {/* From source & card origin */}
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="text-zinc-400 font-medium">From:</span>
            <span className="rounded bg-violet-100 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wide text-violet-700 border border-violet-200/80">
              event
            </span>
            {cardName && <span className="font-semibold text-zinc-700">{cardName}</span>}
          </div>

          {/* Description */}
          {detail?.descEn && (
            <div className="mt-1.5 flex flex-wrap items-start gap-1.5 text-xs leading-relaxed text-zinc-600">
              {style && (
                <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium leading-4 text-zinc-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" aria-hidden="true" />
                  {style}
                </span>
              )}
              <span className="min-w-0 flex-1">{text}</span>
            </div>
          )}

          {/* Condition Groups & Calculated Effect */}
          {loading && !detail ? (
            <p className="mt-3 text-xs text-zinc-400 italic">Loading calculated stats…</p>
          ) : detail?.conditionGroups && detail.conditionGroups.length > 0 ? (
            <div className="mt-2.5 flex flex-col gap-2 border-t border-zinc-100 pt-2">
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
                  <div key={gi} className="rounded-lg border border-zinc-200/80 bg-[#fbfaf8] p-2 text-xs">
                    {/* Trigger header */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span
                        className="inline-block h-3 w-3 flex-none rounded-sm border border-zinc-300"
                        style={{ background: tint }}
                      />
                      <span className="font-bold text-zinc-800 text-[11px]">T{gi + 1}</span>
                      {z && (
                        <span className="text-[10px] text-zinc-500 font-medium">
                          {z.isRandom ? "random" : "deterministic"}
                        </span>
                      )}
                      {wins ? (
                        <span className="text-[10px] font-semibold text-emerald-700 font-mono">
                          {wins}
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-400 italic">No trigger on active course</span>
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

                    {/* Calculated Effect Line */}
                    {effectLine && (
                      <div className="mt-2">
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900 shadow-2xs">
                          {effectLine}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
