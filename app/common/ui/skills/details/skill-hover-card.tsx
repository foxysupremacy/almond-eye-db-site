"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useId } from "react";
import { useButton } from "react-aria/useButton";
import { Popover } from "react-aria-components/Popover";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { AppDialog } from "@/app/common/ui/controls/app-dialog";
import { api, type SkillDetail } from "@/lib/api";
import { useRaceImpactProfile } from "@/app/common/hooks/use-race-impact-profile";
import { evaluateSkillForTrack } from "@/lib/evaluator";
import { isSkillBanned } from "@/lib/pvp/events";
import { horseForStrategy, type SkillZoneResult } from "@/lib/skill-engine/zones";
import { computePvpSkillZones } from "@/lib/pvp/skill-zones";
import type { RaceParameters } from "@/lib/skill-engine/types";
import type { RunningStyle } from "@/lib/deck/types";
import type { VisualizerSkillOrigin } from "@/lib/visualizer/skills";
import { XIcon } from "@/app/common/ui/primitives/icons";
import { SkillDetailPanel } from "@/app/common/ui/skills/details/skill-detail-panel";
import { useSkillInspectorPosition } from "@/app/common/ui/skills/details/skill-inspector-position";
import type { Course } from "@/lib/skill-engine/types";
import type { PvpEvent } from "@/lib/pvp/events";

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
  cancelPreviewClose: () => void;
  close: (key?: string) => void;
}

const SkillInspectorContext = createContext<SkillInspectorContextValue | null>(null);
const skillDetailCache = new Map<number, SkillDetail>();

function useSkillInspector() {
  return useContext(SkillInspectorContext);
}

function DesktopSkillInspectorPopover({
  active,
  onOpenChange,
  children,
}: {
  active: SkillInspectorTarget;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const triggerRef = useMemo(() => ({ current: active.anchor }), [active.anchor]);
  const [popoverElement, setPopoverElement] = useState<HTMLElement | null>(null);
  const { positioned, side } = useSkillInspectorPosition(active.anchor, popoverElement);

  return (
    <Popover
      ref={setPopoverElement}
      triggerRef={triggerRef}
      isOpen
      onOpenChange={onOpenChange}
      shouldUpdatePosition={false}
      shouldSkipAnimation
      isNonModal={active.mode === "preview"}
      aria-label="Skill details"
      aria-hidden={active.mode === "preview" || undefined}
      inert={active.mode === "preview" || undefined}
      data-inspector-placement={side}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        maxHeight: "calc(100dvh - 32px)",
        "--trigger-width": "0px",
      } as React.CSSProperties}
      className={`outline-none z-[400] w-[420px] max-w-[calc(100vw-32px)] overflow-y-auto overscroll-contain [overflow-anchor:none] text-left ${positioned ? "visible" : "invisible"} ${active.mode === "preview" ? "pointer-events-none" : "pointer-events-auto"}`}
    >
      <div className="skill-inspector-content animate-in fade-in zoom-in-95 duration-200 ease-out-expo" style={{ transformOrigin: side === "right" ? "left center" : "right center" }}>
        {active.mode === "pinned" && <AppButton variant="quiet" iconOnly onPress={() => onOpenChange(false)} aria-label="Close skill details" className="absolute right-3 top-3 z-10"><XIcon className="h-4 w-4" /></AppButton>}
        {children}
      </div>
    </Popover>
  );
}

export interface SkillInspectorContext {
  course: Course | null;
  racerCount: number;
  runningStyle: RunningStyle | null;
  activePvpEvent: PvpEvent | null;
  raceParams: Partial<RaceParameters>;
}

export function SkillInspectorProvider({ children, course, racerCount, runningStyle: deckRunningStyle, activePvpEvent, raceParams }: React.PropsWithChildren<SkillInspectorContext>) {
  const [active, setActive] = useState<SkillInspectorTarget | null>(null);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const previewCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deckRaceParams = raceParams;
  const [raceImpactProfile] = useRaceImpactProfile();
  const effectiveRunningStyle = active?.runningStyle ?? deckRunningStyle;
  const effectiveRaceParams = active?.raceParams ?? deckRaceParams;

  const cancelPreviewClose = useCallback(() => {
    if (previewCloseTimer.current) clearTimeout(previewCloseTimer.current);
    previewCloseTimer.current = null;
  }, []);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const close = useCallback((key?: string) => {
    cancelPreviewClose();
    setActive((current) => {
      if (!current || (key && current.key !== key)) return current;
      return null;
    });
  }, [cancelPreviewClose]);
  const preview = useCallback((target: Omit<SkillInspectorTarget, "mode">) => {
    cancelPreviewClose();
    if (window.innerWidth < 768) return;
    setActive((current) => current?.key === target.key && current.mode === "pinned" ? current : { ...target, mode: "preview" });
  }, [cancelPreviewClose]);
  const togglePinned = useCallback((target: Omit<SkillInspectorTarget, "mode">) => {
    cancelPreviewClose();
    setActive((current) => current?.key === target.key && current.mode === "pinned" ? null : { ...target, mode: "pinned" });
  }, [cancelPreviewClose]);
  const closePreview = useCallback((key: string) => {
    cancelPreviewClose();
    previewCloseTimer.current = setTimeout(() => {
      previewCloseTimer.current = null;
      setActive((current) => current?.key === key && current.mode === "preview" ? null : current);
    }, 120);
  }, [cancelPreviewClose]);
  useEffect(() => cancelPreviewClose, [cancelPreviewClose]);

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

  const styleHorse = useMemo(() => effectiveRunningStyle ? horseForStrategy(effectiveRunningStyle) : undefined, [effectiveRunningStyle]);
  const zones: SkillZoneResult[] | null = useMemo(() => {
    if (!detail) return null;
    const groups = (detail.conditionGroups ?? []).map((group) => ({ condition: group.condition ?? "", precondition: group.precondition ?? null }));
    return course
      ? computePvpSkillZones(course, groups, styleHorse, { ...effectiveRaceParams, skillId: String(active?.skillId) })
      : [];
  }, [detail, course, styleHorse, effectiveRaceParams, active?.skillId]);
  const evaluation = useMemo(() => {
    if (!detail) return null;
    return evaluateSkillForTrack(detail, course, effectiveRunningStyle, racerCount, Boolean(active?.isParentMode), zones ?? [], effectiveRaceParams, { raceImpactProfile });
  }, [detail, course, effectiveRunningStyle, racerCount, active?.isParentMode, zones, effectiveRaceParams, raceImpactProfile]);

  const value = useMemo<SkillInspectorContextValue>(() => ({ activeKey: active?.key ?? null, preview, togglePinned, closePreview, cancelPreviewClose, close }), [active?.key, preview, togglePinned, closePreview, cancelPreviewClose, close]);
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
      compact
      embedded={isMobile}
    />
  );
  const dismiss = (open: boolean) => { if (!open) close(); };
  const panel = active && (
    isMobile ? (
      <AppDialog
        isOpen
        onOpenChange={dismiss}
        title="Skill details"
        size="sheet"
        overlayClassName="z-[400]"
        className="max-h-[85dvh] md:max-w-none"
        headerAction={<AppButton variant="quiet" iconOnly onPress={() => close()} aria-label="Close skill details"><XIcon className="h-4 w-4" /></AppButton>}
      >
        <div className="p-3 pb-[max(2.5rem,env(safe-area-inset-bottom))]">{inspector(active.cardName, active.cardId)}</div>
      </AppDialog>
    ) : (
      <DesktopSkillInspectorPopover active={active} onOpenChange={dismiss}>
        {inspector(active.cardName, active.cardId)}
      </DesktopSkillInspectorPopover>
    )
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
  const clearTimers = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }, []);
  useEffect(() => clearTimers, [clearTimers]);
  const target = useCallback(() => triggerRef.current ? ({ key: triggerKey, skillId, anchor: triggerRef.current, fallbackSkill, cardName, cardId, origins, isParentMode, runningStyle, raceParams }) : null, [triggerKey, skillId, fallbackSkill, cardName, cardId, origins, isParentMode, runningStyle, raceParams]);
  const preview = () => { const next = target(); if (next) inspector?.preview(next); };
  const togglePinned = () => { const next = target(); if (next) inspector?.togglePinned(next); };

  const { buttonProps } = useButton({
    elementType: "span",
    onPress: () => { clearTimers(); togglePinned(); },
    "aria-haspopup": "dialog",
    "aria-expanded": inspector?.activeKey === triggerKey,
    "aria-label": `Inspect ${fallbackSkill?.nameEn || fallbackSkill?.nameJp || `skill ${skillId}`}`,
  }, triggerRef);

  return (
    <span {...(interactiveChild ? { onClick: (event: React.MouseEvent) => { event.stopPropagation(); clearTimers(); togglePinned(); } } : buttonProps)} ref={triggerRef}
      onPointerEnter={(event) => {
        if (!inspector || event.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
        inspector.cancelPreviewClose();
        clearTimers();
        hoverTimer.current = setTimeout(preview, 350);
      }}
      onPointerLeave={() => {
        if (!inspector) return;
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        inspector.closePreview(triggerKey);
      }}
      className={`inline-block cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600 ${className}`}
    >{children}</span>
  );
}

export default SkillHoverCard;
