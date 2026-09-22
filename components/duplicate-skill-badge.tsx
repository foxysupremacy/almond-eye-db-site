"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { CopyIcon } from "./icons";
import { getCardImageUrl } from "../lib/data-store";
import { formatCardType } from "./card-type-icon";
import type { DuplicateSkillCard } from "../lib/skill-duplicates";
import { duplicateSkillBadgeClass } from "./shared/skill-badges";
import EventChainAttribution from "./event-chain-attribution";

export type { DuplicateSkillCard as DuplicateCardEntry } from "../lib/skill-duplicates";

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
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(320, window.innerWidth - 32);
    const popoverHeight = Math.min(260, cards.length * 64 + 60);

    // Right-align with the trigger badge by default so it stays on screen
    let left = rect.right - popoverWidth;
    if (left < 16) {
      left = 16;
    }
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }

    let top = rect.bottom + 6;
    if (top + popoverHeight > window.innerHeight - 16) {
      top = Math.max(16, rect.top - popoverHeight - 6);
    }

    setCoords({ top, left });
  }, [cards.length]);

  const handleOpen = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    updatePosition();
    setIsOpen(true);
  }, [updatePosition]);

  const handleClose = useCallback(() => {
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  }, []);

  const handleToggle = useCallback(() => {
    if (isOpen) {
      setIsOpen(false);
    } else {
      handleOpen();
    }
  }, [isOpen, handleOpen]);

  // Update coordinates on scroll or resize while open
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

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const isAmber = variant === "amber";

  // Filter out the current card to find the other duplicating card(s)
  const otherCards = useMemo(() => {
    if (!currentCardId) return cards;
    return cards.filter((c) => c.cardId !== currentCardId);
  }, [cards, currentCardId]);

  // Accessible fallback title for native tooltips
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

  const popoverContent = isOpen && mounted && (
    <div
      ref={popoverRef}
      role="tooltip"
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onClick={(e) => e.stopPropagation()}
      style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
      className="fixed z-[250] w-72 sm:w-80 max-h-[340px] overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/98 dark:bg-zinc-900/98 backdrop-blur-md p-3 shadow-2xl dark:shadow-zinc-950/80 text-left animate-in fade-in zoom-in-95 duration-200 ease-out-expo"
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
      <div className="mt-2 space-y-1.5">
        {cards.map((c) => {
          const isCurrent = currentCardId === c.cardId;
          const imageSrc =
            c.portraitUrl || c.imgUrl || getCardImageUrl(c.cardId, "portrait");

          return (
            <div
              key={`${c.cardId}-${c.source}`}
              className={`flex items-center gap-2.5 p-1.5 rounded-lg transition-colors ${
                isCurrent
                  ? "bg-zinc-100/90 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40 border border-transparent"
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
    </div>
  );

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          handleToggle();
        }}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        title={titleTooltip}
        className={`min-h-5 rounded-md ${duplicateSkillBadgeClass(variant)} ${className}`}
      >
        <CopyIcon className="h-2.5 w-2.5 flex-none" />
        {badgeContent}
      </button>

      {mounted && popoverContent && createPortal(popoverContent, document.body)}
    </>
  );
}
