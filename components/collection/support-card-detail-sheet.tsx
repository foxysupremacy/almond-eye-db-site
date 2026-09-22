"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  type CardIndexEntry,
  type CardSkills,
  type SkillSummary,
  type SupportCardEffectsBlob,
  api,
} from "../../lib/api";
import { useDeck } from "../store";
import { useBodyScrollLock } from "../../lib/use-body-scroll-lock";
import CardTypeIcon, { formatCardType } from "../card-type-icon";
import SkillIcon from "../skill-icon";
import { SkillHoverCard } from "../skill-hover-card";
import {
  evaluateSkillActivation,
  runningStyleToNum,
} from "../../lib/parenting/skill-evaluator";
import { getPvpRaceParameters, isSkillBanned } from "../../lib/pvp-events";
import { getSkillRarityStyle, RARITY_META } from "../../lib/skill-rarity";
import { Badge } from "../shared/badge";
import EventChainAttribution from "../event-chain-attribution";
import {
  AlertTriangleIcon,
  CheckIcon,
  SparklesIcon,
  TrophyIcon,
  XIcon,
} from "../icons";

interface SupportCardDetailSheetProps {
  card: CardIndexEntry | null;
  isOpen: boolean;
  onClose: () => void;
  limitBreak: number | undefined;
  onSetLimitBreak: (cardId: number, lb: number) => void;
  onRemoveCard: (cardId: number) => void;
}

const LB_LABELS = ["0 LB", "1 LB", "2 LB", "3 LB", "MLB"] as const;

export function SupportCardDetailSheet({
  card,
  isOpen,
  onClose,
  limitBreak,
  onSetLimitBreak,
  onRemoveCard,
}: SupportCardDetailSheetProps) {
  const { course, runningStyle, activePvpEvent, trackDetail } = useDeck();
  const raceParams = useMemo(() => getPvpRaceParameters(activePvpEvent), [activePvpEvent]);

  useBodyScrollLock(isOpen);

  const [activeTab, setActiveTab] = useState<"skills" | "effects">("skills");
  const [loadedSkills, setLoadedSkills] = useState<CardSkills | null>(null);
  const [cardEffectsBlob, setCardEffectsBlob] = useState<SupportCardEffectsBlob | null>(null);
  const [loading, setLoading] = useState(false);

  const isOwned = limitBreak !== undefined;
  const currentLb = limitBreak !== undefined ? limitBreak : 4; // Default to MLB for preview

  // Fetch card skills & support effects
  useEffect(() => {
    if (!isOpen || !card) return;

    let mounted = true;
    setLoading(true);

    Promise.all([
      api.cardSkills(card.id),
      api.cardSupportEffects(card.id),
    ])
      .then(([skills, effects]) => {
        if (!mounted) return;
        setLoadedSkills(skills);
        setCardEffectsBlob(effects || null);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load card details:", err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, card?.id]);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !card || !mounted || typeof document === "undefined") return null;

  const hintSkills = loadedSkills?.hintSkills || [];
  const eventSkills = loadedSkills?.eventSkills || [];
  const totalSkillCount = hintSkills.length + eventSkills.length;

  function evaluateSkill(skillId: number) {
    if (!course) {
      return {
        activates: false,
        reason: "No track selected on Global Track Bar",
      };
    }
    return evaluateSkillActivation(skillId, course, runningStyle, raceParams);
  }

  let activatingSkillCount = 0;
  for (const s of [...hintSkills, ...eventSkills]) {
    if (evaluateSkill(s.id).activates) activatingSkillCount++;
  }

  function renderSkillRow(s: SkillSummary, source: "hint" | "event") {
    const rStyle = getSkillRarityStyle(s.rarity);
    const isBanned = isSkillBanned(s.id, activePvpEvent);
    const evalResult = evaluateSkill(s.id);
    const activates = evalResult.activates;

    return (
      <div
        key={`${s.id}-${source}`}
        className={`flex items-center justify-between gap-3 py-2.5 px-3 transition-colors ${rStyle.bgClass ?? "bg-white dark:bg-zinc-900"} hover:brightness-[0.98] dark:hover:brightness-110`}
      >
        <div className="min-w-0 flex-1">
          <SkillHoverCard
            skillId={s.id}
            fallbackSkill={s}
            cardName={card?.nameEn || ""}
            cardId={card?.id}
            isParentMode={false}
            className="group inline-flex items-center gap-2.5 min-w-0 cursor-pointer"
          >
            {/* 1. Vertically centered icon */}
            <SkillIcon
              iconId={s.iconId}
              name={s.nameEn}
              className="h-7 w-7 object-contain flex-none shrink-0 drop-shadow-2xs"
            />

            {/* 2. Stacked Bilingual Text Container */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {isBanned && (
                  <span className="rounded px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs">
                    BANNED
                  </span>
                )}
                <span
                  className={`text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors leading-snug ${
                    isBanned ? "line-through text-zinc-500 dark:text-zinc-400" : ""
                  }`}
                >
                  {s.nameEn}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 opacity-60 group-hover:opacity-100 transition-opacity">
                  ↗
                </span>
              </div>

              {s.nameJp && (
                <p
                  className={`text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 font-normal leading-tight ${
                    isBanned ? "line-through" : ""
                  }`}
                >
                  {s.nameJp}
                </p>
              )}
            </div>
          </SkillHoverCard>

          {s.descEn && (
            <p className="mt-1 line-clamp-2 text-[11px] text-zinc-600 dark:text-zinc-400 leading-normal pl-9">
              {s.descEn}
            </p>
          )}

          {s.eventMeta && (
            <div className="mt-1 pl-9 flex items-center gap-1.5 text-[10px] text-violet-700 dark:text-violet-400 flex-wrap">
              <EventChainAttribution eventMeta={s.eventMeta} />
              {s.eventMeta.statSummary && (
                <span className="rounded bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.2 font-semibold">
                  {s.eventMeta.statSummary}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Course Activation Status Badge */}
        <div className="flex-none shrink-0">
          {course ? (
            activates ? (
              <Badge
                size="standard"
                tone="emerald"
                icon={<CheckIcon className="h-3 w-3" />}
                className="font-bold"
                title={evalResult.evalResult?.verdictSummary || "Fires on target course"}
              >
                Active
              </Badge>
            ) : (
              <Badge
                size="standard"
                tone="rose"
                icon={<AlertTriangleIcon className="h-3 w-3" />}
                className="font-bold"
                title={evalResult.reason || "Does not activate on target course"}
              >
                {evalResult.reason?.toLowerCase().includes("rank") ? "Rank Trap" : "No Fire"}
              </Badge>
            )
          ) : (
            <span className="text-[10px] text-zinc-400 italic">No track set</span>
          )}
        </div>
      </div>
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200 ease-out-quart"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-detail-title"
    >
      <div
        className="flex h-[90dvh] sm:h-[88vh] max-h-[92dvh] sm:max-h-[88vh] w-full sm:max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl text-left animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-[250ms] ease-out-expo pb-6 sm:pb-0 overscroll-contain touch-pan-y"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile handle */}
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700 sm:hidden" />

        {/* Header Profile */}
        <div className="shrink-0 flex-none border-b border-zinc-200/80 dark:border-zinc-800 p-4 bg-zinc-50/70 dark:bg-zinc-900/70">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative aspect-square h-16 w-16 flex-none rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                <img
                  src={card.portraitUrl || card.imgUrl}
                  alt={card.nameEn}
                  className="h-full w-full object-contain filter drop-shadow-xs"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge
                    size="compact"
                    uppercase
                    tone={card.rarity === 3 ? "amber" : card.rarity === 2 ? "sky" : "neutral"}
                    className="font-black"
                  >
                    {card.rarity === 3 ? "SSR" : card.rarity === 2 ? "SR" : "R"}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 capitalize">
                    <CardTypeIcon type={card.type} className="h-3.5 w-3.5" />
                    <span>{formatCardType(card.type)}</span>
                  </span>
                  {card.release && (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      • {card.release}
                    </span>
                  )}
                </div>

                <h3
                  id="card-detail-title"
                  className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate mt-0.5 leading-snug"
                >
                  {card.charName || card.nameEn}
                </h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 font-normal leading-tight">
                  {card.titleEn || card.titleJa || card.nameJp}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Limit Break Stepper + Ownership Row */}
          <div className="mt-3.5 pt-3 border-t border-zinc-200/70 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 text-[11px]">Limit Break:</span>
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => onSetLimitBreak(card.id, step)}
                    title={`Set to ${step === 4 ? "MLB" : `${step} LB`}`}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                      isOwned && limitBreak === step
                        ? step === 4
                          ? "bg-amber-400 text-amber-950 font-black shadow-2xs"
                          : "bg-emerald-600 text-white font-bold"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {LB_LABELS[step]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              {isOwned ? (
                <button
                  type="button"
                  onClick={() => onRemoveCard(card.id)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                >
                  Remove from Owned ✕
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSetLimitBreak(card.id, 4)}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-2xs"
                >
                  + Add to Owned (MLB)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Segmented Switcher: Skills vs Training Effects */}
        <div className="shrink-0 flex-none flex items-center justify-between px-4 py-2 bg-zinc-100/60 dark:bg-zinc-800/40 border-b border-zinc-200/70 dark:border-zinc-800 text-xs">
          <div className="inline-flex rounded-lg bg-zinc-200/80 dark:bg-zinc-800 p-0.5 border border-zinc-200 dark:border-zinc-700/50">
            <button
              type="button"
              onClick={() => setActiveTab("skills")}
              className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                activeTab === "skills"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Skills & Track ({totalSkillCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("effects")}
              className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                activeTab === "effects"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Support Effects ({cardEffectsBlob?.effects.length || 0})
            </button>
          </div>

          {activeTab === "skills" && (
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <TrophyIcon className="h-3 w-3 text-purple-600 dark:text-purple-400" />
              <span>{activatingSkillCount}/{totalSkillCount} Active</span>
            </div>
          )}
        </div>

        {/* Tab 1: Skills & Track Evaluation */}
        {activeTab === "skills" && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {/* Event Skills Section */}
            {eventSkills.length > 0 && (
              <div>
                <div className="px-3.5 py-1.5 bg-violet-500/10 dark:bg-violet-950/20 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                  Event Skills ({eventSkills.length})
                </div>
                {eventSkills.map((s) => renderSkillRow(s, "event"))}
              </div>
            )}

            {/* Hint Skills Section */}
            {hintSkills.length > 0 && (
              <div>
                <div className="px-3.5 py-1.5 bg-emerald-500/10 dark:bg-emerald-950/20 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Hint Skills ({hintSkills.length})
                </div>
                {hintSkills.map((s) => renderSkillRow(s, "hint"))}
              </div>
            )}

            {loading && !loadedSkills && (
              <div className="py-16 text-center text-xs text-zinc-400">
                <div className="mx-auto mb-2 h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                <p>Loading skills and effects...</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Support Effects (Training Stats) Table */}
        {activeTab === "effects" && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
            {/* Unique Effect Card */}
            {cardEffectsBlob?.uniqueEffect && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20 p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                  <SparklesIcon className="h-3.5 w-3.5 text-amber-600" />
                  <span>Unique Effect (Lv {cardEffectsBlob.uniqueEffect.lv} Unlock)</span>
                </div>
                <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
                  {cardEffectsBlob.uniqueEffect.textEn || cardEffectsBlob.uniqueEffect.textJp}
                </p>
                {cardEffectsBlob.uniqueEffect.textJp && cardEffectsBlob.uniqueEffect.textEn !== cardEffectsBlob.uniqueEffect.textJp && (
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {cardEffectsBlob.uniqueEffect.textJp}
                  </p>
                )}
              </div>
            )}

            {/* Effects Table */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 text-[11px]">
                    <th className="py-2 px-3 font-semibold">Effect</th>
                    {LB_LABELS.map((label, idx) => (
                      <th
                        key={label}
                        className={`py-2 px-2 text-center font-bold ${
                          idx === currentLb
                            ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                            : ""
                        }`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {(cardEffectsBlob?.effects || []).map((eff) => (
                    <tr
                      key={eff.type}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="py-2 px-3">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 block leading-snug">
                          {eff.nameEn}
                        </span>
                        {eff.nameJp && (
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block leading-tight">
                            {eff.nameJp}
                          </span>
                        )}
                      </td>
                      {eff.values.map((v, idx) => {
                        const isCurrent = idx === currentLb;
                        const isUnlocked = v > 0;
                        return (
                          <td
                            key={idx}
                            className={`py-2 px-2 text-center text-xs ${
                              isCurrent
                                ? "bg-amber-500/10 font-bold text-amber-900 dark:text-amber-200"
                                : isUnlocked
                                  ? "text-zinc-700 dark:text-zinc-300"
                                  : "text-zinc-300 dark:text-zinc-600"
                            }`}
                          >
                            {isUnlocked ? v : "-"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(!cardEffectsBlob || cardEffectsBlob.effects.length === 0) && !loading && (
              <p className="text-xs text-zinc-400 text-center py-8">
                No training effects data available for this support card.
              </p>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
