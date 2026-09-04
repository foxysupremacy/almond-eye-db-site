"use client";

import React, { useEffect } from "react";
import type { CardIndexEntry, SkillSummary } from "../lib/api";
import { useDeck } from "./store";
import { RARITY_META } from "./card-picker-popover";
import CardTypeIcon, { formatCardType } from "./card-type-icon";
import SkillIcon from "./skill-icon";
import { SkillHoverCard } from "./skill-hover-card";
import { getSkillRarityStyle } from "../lib/skill-rarity";

interface CardSkillsSheetProps {
  card: CardIndexEntry;
  isOpen: boolean;
  onClose: () => void;
}

export default function CardSkillsSheet({ card, isOpen, onClose }: CardSkillsSheetProps) {
  const { skillsByCard } = useDeck();

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cardSkills = skillsByCard[card.id];
  const eventSkills = cardSkills?.eventSkills ?? [];
  const hintSkills = cardSkills?.hintSkills ?? [];
  const totalCount = eventSkills.length + hintSkills.length;
  const cardTitle = card.nameEn || card.nameJp;

  function renderSkillRow(s: SkillSummary, source: "event" | "hint") {
    const rStyle = getSkillRarityStyle(s.rarity);
    return (
      <SkillHoverCard
        key={s.id}
        skillId={s.id}
        fallbackSkill={{
          nameEn: s.nameEn,
          nameJp: s.nameJp,
          rarity: s.rarity,
          iconId: s.iconId,
        }}
        cardName={cardTitle}
        className="w-full"
      >
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-2.5 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer ${
            rStyle.borderClass
          } ${rStyle.bgClass ?? "bg-white dark:bg-zinc-900"}`}
        >
          <div className="mt-0.5 flex flex-col gap-1 flex-none">
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${rStyle.badgeClass}`}>
              {rStyle.badgeLabel}
            </span>
            <span
              className={`rounded px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wide border ${
                source === "event"
                  ? "bg-violet-100 dark:bg-violet-950/80 text-violet-800 dark:text-violet-300 border-violet-200 dark:border-violet-800"
                  : "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              }`}
            >
              {source}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <SkillIcon iconId={s.iconId} name={s.nameEn} className="h-4 w-4 object-contain flex-none" />
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{s.nameEn}</span>
              {s.nameJp && <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal">{s.nameJp}</span>}
            </div>

            {s.descEn && (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-zinc-600 dark:text-zinc-300">
                {s.descEn}
              </p>
            )}

            {s.eventMeta && (
              <div className="mt-1 flex items-center gap-1 text-[10px] text-violet-700 dark:text-violet-400">
                <span className="font-semibold">Event:</span>
                <span className="truncate">{s.eventMeta.eventNameEn || s.eventMeta.eventNameJp}</span>
                <span>(Choice {s.eventMeta.choiceIndex})</span>
              </div>
            )}
          </div>

          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 flex-none self-center">
            Inspect ↗
          </span>
        </div>
      </SkillHoverCard>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[170] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-skills-title"
    >
      <div
        className="flex h-[88dvh] max-h-[92dvh] sm:h-auto sm:max-h-[88vh] w-full sm:max-w-lg flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl text-left animate-in slide-in-from-bottom sm:zoom-in-95 duration-150 pb-6 sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile handle */}
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700 sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-100 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={card.portraitUrl || card.imgUrl}
              alt={cardTitle}
              className="h-12 w-12 shrink-0 rounded-lg object-contain border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 p-0.5"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${RARITY_META[card.rarity]?.chip ?? "bg-zinc-200"}`}>
                  {RARITY_META[card.rarity]?.label ?? "R"}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 capitalize">
                  <CardTypeIcon type={card.type} className="h-3.5 w-3.5 object-contain flex-none" />
                  <span>{formatCardType(card.type)}</span>
                </span>
              </div>
              <h3 id="card-skills-title" className="mt-0.5 truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {cardTitle}
              </h3>
              <p className="truncate text-[11px] text-zinc-400 dark:text-zinc-500">{card.nameJp}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Subtitle count banner */}
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-100/60 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800 text-xs">
          <span className="text-zinc-600 dark:text-zinc-300 font-medium">
            Granted Skills ({totalCount})
          </span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Tap or hover any skill to inspect course triggers
          </span>
        </div>

        {/* Skills list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {eventSkills.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400">
                  Event Skills
                </span>
                <span className="text-[11px] text-zinc-400">({eventSkills.length})</span>
              </div>
              <div className="space-y-1.5">
                {eventSkills.map((s) => renderSkillRow(s, "event"))}
              </div>
            </div>
          )}

          {hintSkills.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Hint Skills
                </span>
                <span className="text-[11px] text-zinc-400">({hintSkills.length})</span>
              </div>
              <div className="space-y-1.5">
                {hintSkills.map((s) => renderSkillRow(s, "hint"))}
              </div>
            </div>
          )}

          {totalCount === 0 && (
            <p className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
              No skills found for this card.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
