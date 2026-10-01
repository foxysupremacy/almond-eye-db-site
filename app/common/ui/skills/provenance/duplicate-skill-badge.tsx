"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "react-aria-components/Button";
import { AppPopover, type AppPopoverProps } from "@/app/common/ui/controls/app-popover";
import { CopyIcon } from "@/app/common/ui/primitives/icons";
import { getCardImageUrl } from "@/lib/api";
import { formatCardType } from "@/app/common/ui/cards/card-type-icon";
import type { DuplicateSkillCard } from "@/lib/skills/duplicates";
import { duplicateSkillBadgeClass } from "@/app/common/ui/skills/skill-badges";
import EventChainAttribution from "@/app/common/ui/skills/provenance/event-chain-attribution";

export type { DuplicateSkillCard as DuplicateCardEntry } from "@/lib/skills/duplicates";

export interface DuplicateSkillBadgeProps {
  cards: DuplicateSkillCard[];
  currentCardId?: number;
  skillName?: string;
  variant?: "amber" | "sky";
  className?: string;
}

export default function DuplicateSkillBadge({
  cards,
  currentCardId,
  skillName,
  variant = "amber",
  className = "",
}: DuplicateSkillBadgeProps) {
  const [mode, setMode] = useState<"closed" | "preview" | "pinned">("closed");
  const isOpen = mode !== "closed";
  const [layer, setLayer] = useState<AppPopoverProps["layer"]>("duplicate");

  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const updateLayer = useCallback(() => {
    // A provenance badge inside a dialog must render above that dialog's surface.
    let ancestor: HTMLElement | null = triggerRef.current?.closest('[role="dialog"]') ?? null;
    let parentLayer = 0;
    while (ancestor) {
      const zIndex = Number.parseInt(window.getComputedStyle(ancestor).zIndex, 10);
      if (Number.isFinite(zIndex)) parentLayer = Math.max(parentLayer, zIndex);
      ancestor = ancestor.parentElement;
    }
    setLayer(parentLayer >= 400 ? "duplicate-inspector" : parentLayer >= 300 ? "duplicate-inspection" : "duplicate");
  }, []);

  const handleOpen = useCallback(() => {
    cancelClose();
    updateLayer();
    setMode((current) => current === "closed" ? "preview" : current);
  }, [cancelClose, updateLayer]);

  const handleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      setMode((current) => current === "preview" ? "closed" : current);
    }, 150);
  }, [cancelClose]);

  const handleToggle = useCallback(() => {
    cancelClose();
    updateLayer();
    setMode((current) => current === "pinned" ? "closed" : "pinned");
  }, [cancelClose, updateLayer]);

  const isAmber = variant === "amber";

  // Filter out the current card to find the other duplicating card(s)
  const otherCards = useMemo(() => {
    if (!currentCardId) return cards;
    return cards.filter((c) => c.cardId !== currentCardId);
  }, [cards, currentCardId]);

  // Accessible detail description when the visual label is truncated
  const titleTooltip = useMemo(() => {
    if (currentCardId && otherCards.length > 0) {
      return `Duplicate with ${otherCards.map((c: DuplicateSkillCard) => c.cardName).join(", ")}:\n${cards
        .map(
          (c: DuplicateSkillCard) =>
            `• ${c.cardName}${c.cardId === currentCardId ? " (This card)" : ""}${
              c.source ? ` [${c.source}]` : ""
            }${c.type ? ` (${c.type})` : ""}`
        )
        .join("\n")}`;
    }
    return `Duplicate Skill (${cards.length} cards):\n${cards
      .map(
        (c: DuplicateSkillCard) =>
          `• ${c.cardName}${c.source ? ` [${c.source}]` : ""}${
            c.type ? ` (${c.type})` : ""
          }`
      )
      .join("\n")}`;
  }, [cards, currentCardId, otherCards]);

  const badgeContent = useMemo(() => {
    if (currentCardId && otherCards.length > 0) {
      if (otherCards.length === 1) {
        return (
          <span className="inline-flex items-center gap-1 min-w-0">
            <span className="font-normal text-[8.5px] opacity-90">duplicate with</span>
            <span className="truncate max-w-[120px] sm:max-w-[160px] font-bold">
              {otherCards[0].cardName}
            </span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 min-w-0">
          <span className="font-normal text-[8.5px] opacity-90">duplicate with</span>
          <span className="truncate max-w-[100px] sm:max-w-[140px] font-bold">
            {otherCards[0].cardName}
          </span>
          <span className="shrink-0 text-[8px] opacity-80 font-normal">
            (+{otherCards.length - 1})
          </span>
        </span>
      );
    }
    return <span>duplicate ({cards.length})</span>;
  }, [currentCardId, otherCards, cards.length]);

  const popoverContent = isOpen && (
    <AppPopover
      key={mode}
      triggerRef={triggerRef}
      isOpen
      onOpenChange={(open) => { if (!open) { cancelClose(); setMode("closed"); } }}
      isNonModal={mode === "preview"}
      trigger={mode === "preview" ? "PreviewTrigger" : undefined}
      aria-label={skillName ? `Duplicate sources for ${skillName}` : "Duplicate skill sources"}
      layer={layer}
      placement="bottom end"
      offset={6}
      style={{ transformOrigin: "var(--trigger-anchor-point)" }}
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onClick={(e) => e.stopPropagation()}
      className="w-72 sm:w-80 max-h-[340px] overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/98 dark:bg-zinc-900/98 backdrop-blur-md p-3 shadow-2xl dark:shadow-zinc-950/80 text-left data-[entering]:animate-in data-[entering]:fade-in data-[entering]:zoom-in-95 data-[entering]:duration-200 data-[entering]:ease-out-expo"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-md shrink-0 ${
              isAmber
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                : "bg-sky-500/15 text-sky-700 dark:text-sky-400"
            }`}
          >
            <CopyIcon className="h-3 w-3" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {currentCardId && otherCards.length === 1
                ? `Duplicate with ${otherCards[0].cardName}`
                : `Duplicate Skill (${cards.length} cards)`}
            </p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
              {skillName ? `${skillName} · ` : ""}Present on {cards.length} cards in deck
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 border ${
            isAmber
              ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300/80 dark:border-amber-700/80"
              : "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-300/80 dark:border-sky-700/80"
          }`}
        >
          {cards.length} Cards
        </span>
      </div>

      {/* Cards List */}
      <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
        {cards.map((c) => {
          const isCurrent = currentCardId === c.cardId;
          const imageSrc =
            c.portraitUrl || c.imgUrl || getCardImageUrl(c.cardId, "portrait");

          return (
            <div
              key={`${c.cardId}-${c.source}`}
              className={`flex items-center gap-2.5 py-2 transition-colors ${
                isCurrent
                  ? "bg-zinc-100/90 dark:bg-zinc-800/80"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
              }`}
            >
              {/* Card Portrait Thumbnail */}
              <img
                src={imageSrc}
                alt=""
                loading="lazy"
                className="h-8 w-8 rounded-md object-contain border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800 shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />

              {/* Name & Subtitle */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {c.cardName}
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-200/80 dark:bg-zinc-700/80 px-1 py-0.2 rounded shrink-0">
                      This Card
                    </span>
                  )}
                </div>
                {c.cardNameJp && (
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                    {c.cardNameJp}
                  </p>
                )}
                {c.eventMeta && (
                  <EventChainAttribution eventMeta={c.eventMeta} className="mt-0.5 max-w-[160px]" />
                )}
              </div>

              {/* Type & Source Badges */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                {c.type && (
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium capitalize">
                    {formatCardType(c.type)}
                  </span>
                )}
                {c.source && (
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded border ${
                      c.source === "event"
                        ? "bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200/80 dark:border-violet-800/80"
                        : c.source === "hint"
                        ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    {c.source}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AppPopover>
  );

  return (
    <>
      <Button
        ref={triggerRef}
        onPress={handleToggle}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onHoverStart={handleOpen}
        onHoverEnd={handleClose}
        aria-description={titleTooltip}
        className={`min-h-11 md:min-h-5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 ${duplicateSkillBadgeClass(variant)} ${className}`}
      >
        <CopyIcon className="h-2.5 w-2.5 flex-none" />
        {badgeContent}
      </Button>

      {popoverContent}
    </>
  );
}
