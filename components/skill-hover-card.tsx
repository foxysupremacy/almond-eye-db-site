"use client";

import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useId } from "react";
import { createPortal } from "react-dom";
import { api, type SkillDetail } from "../lib/api";
import { evaluateSkillForTrack } from "../lib/evaluator";
import { isSkillBanned, getPvpRaceParameters } from "../lib/pvp-events";
import { computeAllZones, horseForStrategy, type SkillZoneResult } from "../lib/skill-engine/zones";
import type { RaceParameters } from "../lib/skill-engine/types";
import type { RunningStyle } from "../lib/deck/types";
import type { VisualizerSkillOrigin } from "../lib/visualizer-skills";
import { useBodyScrollLock } from "../lib/use-body-scroll-lock";
import { useDeck } from "./store";
import { XIcon } from "./icons";
import { SkillDetailPanel } from "./track/skill-detail-inspector";

type InspectorMode = "preview" | "pinned";

export interface SkillInspectorTarget {
  key: string;
  skillId: number;
  anchor: HTMLElement;
  mode: InspectorMode;
  fallbackSkill?: { nameEn?: string; nameJp?: string; rarity?: number; iconId?: number | null };
  cardName?: string;
  cardId?: number | null;
  origins?: VisualizerSkillOrigin[];
  isParentMode?: boolean;
  runningStyle?: RunningStyle;
  raceParams?: Partial<RaceParameters>;
}

interface SkillInspectorContextValue {
  activeKey: string | null;
  preview: (target: Omit<SkillInspectorTarget, "mode">) => void;
  togglePinned: (target: Omit<SkillInspectorTarget, "mode">) => void;
  closePreview: (key: string) => void;
  close: (key?: string, restoreFocus?: boolean) => void;
}

const SkillInspectorContext = createContext<SkillInspectorContextValue | null>(null);
const skillDetailCache = new Map<number, SkillDetail>();

function useSkillInspector() {
  return useContext(SkillInspectorContext);
}

export function SkillInspectorProvider({ children }: { children: React.ReactNode }) {
  const { course, racerCount, runningStyle: deckRunningStyle, activePvpEvent } = useDeck();
  const [active, setActive] = useState<SkillInspectorTarget | null>(null);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [coords, setCoords] = useState({ top: 16, left: 16, originX: "left" as "left" | "right" });
  const panelRef = useRef<HTMLDivElement>(null);
  const deckRaceParams = useMemo(() => getPvpRaceParameters(activePvpEvent), [activePvpEvent]);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useBodyScrollLock(Boolean(active && active.mode === "pinned" && isMobile));

  const close = useCallback((key?: string, restoreFocus = false) => {
    setActive((current) => {
      if (!current || (key && current.key !== key)) return current;
      if (restoreFocus) current.anchor.focus({ preventScroll: true });
      return null;
    });
  }, []);
  const preview = useCallback((target: Omit<SkillInspectorTarget, "mode">) => setActive({ ...target, mode: "preview" }), []);
  const togglePinned = useCallback((target: Omit<SkillInspectorTarget, "mode">) => {
    setActive((current) => current?.key === target.key && current.mode === "pinned" ? null : { ...target, mode: "pinned" });
  }, []);
  const closePreview = useCallback((key: string) => {
    setActive((current) => current?.key === key && current.mode === "preview" ? null : current);
  }, []);

  useEffect(() => {
    if (!active) {
      setDetail(null);
      setLoading(false);
      return;
    }
    const cached = skillDetailCache.get(active.skillId);
    if (cached) {
      setDetail(cached);
      setLoading(false);
      return;
    }
    let alive = true;
    setDetail(null);
    setLoading(true);
    api.skill(active.skillId)
      .then((next) => {
        skillDetailCache.set(active.skillId, next);
        if (alive) setDetail(next);
      })
      .catch(() => alive && setDetail(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [active?.skillId]);

  const effectiveRunningStyle = active?.runningStyle ?? deckRunningStyle;
  const effectiveRaceParams = active?.raceParams ?? deckRaceParams;
  const styleHorse = useMemo(() => effectiveRunningStyle ? horseForStrategy(effectiveRunningStyle) : undefined, [effectiveRunningStyle]);
  const zones: SkillZoneResult[] | null = useMemo(() => {
    if (!detail) return null;
    const groups = (detail.conditionGroups ?? []).map((group) => ({ condition: group.condition ?? "", precondition: group.precondition ?? null }));
    return course ? computeAllZones(course, groups, styleHorse, effectiveRaceParams) : [];
  }, [detail, course, styleHorse, effectiveRaceParams]);
  const evaluation = useMemo(() => {
    if (!detail) return null;
    return evaluateSkillForTrack(detail, course, effectiveRunningStyle, racerCount, Boolean(active?.isParentMode), zones ?? [], effectiveRaceParams);
  }, [detail, course, effectiveRunningStyle, racerCount, active?.isParentMode, zones, effectiveRaceParams]);

  const updatePosition = useCallback(() => {
    if (!active || isMobile) return;
    const rect = active.anchor.getBoundingClientRect();
    const width = 420;
    const height = panelRef.current?.getBoundingClientRect().height ?? 480;
    let left = rect.right + 8;
    let originX: "left" | "right" = "left";
    if (left + width > window.innerWidth - 16) {
      left = rect.left - width - 8;
      originX = "right";
    }
    left = Math.max(16, Math.min(left, window.innerWidth - width - 16));
    const top = Math.min(Math.max(rect.top + rect.height / 2 - height / 2, 16), Math.max(16, window.innerHeight - height - 16));
    setCoords({ top, left, originX });
  }, [active, isMobile]);

  useLayoutEffect(() => { updatePosition(); }, [updatePosition, detail, loading, evaluation]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(undefined, active.mode === "pinned");
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (active.anchor.contains(target) || panelRef.current?.contains(target)) return;
      close();
    };
    const onViewportChange = () => updatePosition();
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [active, close, updatePosition]);

  const value = useMemo<SkillInspectorContextValue>(() => ({ activeKey: active?.key ?? null, preview, togglePinned, closePreview, close }), [active?.key, preview, togglePinned, closePreview, close]);
  const inspector = (cardName?: string, cardId?: number | null) => (
    <SkillDetailPanel
      skillDetail={detail}
      skillLoading={loading}
      selectedSkill={active?.origins ? { origins: active.origins } : null}
      selectedSkillId={active?.skillId ?? null}
      zones={zones}
      course={course}
      racerCount={racerCount}
      evaluation={evaluation}
      cardName={cardName}
      cardId={cardId}
      isBanned={Boolean(active && isSkillBanned(active.skillId, activePvpEvent))}
    />
  );
  const panel = active && typeof document !== "undefined" && createPortal(
    isMobile ? (
      <div className="fixed inset-0 z-[400] flex items-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200 ease-out-quart" onPointerDown={(event) => { if (event.target === event.currentTarget) close(); }}>
        <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Skill details" className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom-4 duration-[250ms] ease-out-expo dark:bg-zinc-900">
          <button type="button" onClick={() => close(undefined, true)} aria-label="Close skill details" className="absolute right-5 top-5 z-10 grid h-9 w-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"><XIcon className="h-4 w-4" /></button>
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          {inspector(active.cardName, active.cardId)}
        </div>
      </div>
    ) : (
      <div ref={panelRef} role={active.mode === "pinned" ? "dialog" : "tooltip"} aria-label="Skill details" style={{ top: coords.top, left: coords.left, transformOrigin: `${coords.originX} center` }} className={`fixed z-[400] w-[420px] max-h-[85vh] overflow-y-auto text-left animate-in fade-in zoom-in-95 duration-200 ease-out-expo ${active.mode === "preview" ? "pointer-events-none" : "pointer-events-auto"}`}>
        {active.mode === "pinned" && <button type="button" onClick={() => close(undefined, true)} aria-label="Close skill details" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"><XIcon className="h-4 w-4" /></button>}
        {inspector(active.cardName, active.cardId)}
      </div>
    ), document.body,
  );

  return <SkillInspectorContext.Provider value={value}>{children}{panel}</SkillInspectorContext.Provider>;
}

export interface SkillHoverCardProps {
  skillId: number;
  fallbackSkill?: SkillInspectorTarget["fallbackSkill"];
  cardName?: string;
  cardId?: number | null;
  origins?: VisualizerSkillOrigin[];
  isParentMode?: boolean;
  runningStyle?: RunningStyle;
  raceParams?: Partial<RaceParameters>;
  /** Use when children already expose a native button (avoids nested controls). */
  interactiveChild?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** API-compatible trigger backed by the one application-level inspector. */
export function SkillHoverCard({ skillId, fallbackSkill, cardName, cardId, origins, isParentMode = false, runningStyle, raceParams, interactiveChild = false, children, className = "" }: SkillHoverCardProps) {
  const inspector = useSkillInspector();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const triggerKey = useId();
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimers = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    hoverTimer.current = null;
    leaveTimer.current = null;
  }, []);
  useEffect(() => clearTimers, [clearTimers]);
  const target = useCallback(() => triggerRef.current ? ({ key: triggerKey, skillId, anchor: triggerRef.current, fallbackSkill, cardName, cardId, origins, isParentMode, runningStyle, raceParams }) : null, [triggerKey, skillId, fallbackSkill, cardName, cardId, origins, isParentMode, runningStyle, raceParams]);
  const preview = () => { const next = target(); if (next) inspector?.preview(next); };
  const togglePinned = () => { const next = target(); if (next) inspector?.togglePinned(next); };

  return (
    <span ref={triggerRef} role={interactiveChild ? undefined : "button"} tabIndex={interactiveChild ? undefined : 0} aria-haspopup={interactiveChild ? undefined : "dialog"} aria-expanded={interactiveChild ? undefined : inspector?.activeKey === triggerKey} aria-label={interactiveChild ? undefined : `Inspect ${fallbackSkill?.nameEn || fallbackSkill?.nameJp || `skill ${skillId}`}`}
      onPointerEnter={(event) => {
        if (!inspector || event.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
        clearTimers();
        hoverTimer.current = setTimeout(preview, 350);
      }}
      onPointerLeave={() => {
        if (!inspector) return;
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        leaveTimer.current = setTimeout(() => inspector.closePreview(triggerKey), 120);
      }}
      onClick={(event) => { event.stopPropagation(); clearTimers(); togglePinned(); }}
      onKeyDown={(event) => {
        if (interactiveChild) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        clearTimers();
        togglePinned();
      }}
      className={`inline-block cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600 ${className}`}
    >{children}</span>
  );
}

export default SkillHoverCard;
