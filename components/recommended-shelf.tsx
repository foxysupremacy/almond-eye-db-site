"use client";

// Top Recommendations shelf for the Parent Deck view.
// Ranks cards based on the unified Target Race (Venue + Course + Style),
// giving priority to skills that activate on the specific course geometry.

import { useState, useMemo } from "react";
import { useDeck } from "./store";
import { RUNNING_STYLE_LABELS, DISTANCE_LABELS, SURFACE_LABELS } from "../lib/deck/constants";
import { recommendCardsForParent, type CardRecommendation } from "../lib/recommendation-engine";
import { getPvpRaceParameters } from "../lib/pvp-events";
import { RARITY_META } from "./card-picker-popover";
import type { CardIndexEntry } from "../lib/api";
import SkillIcon from "./skill-icon";
import SkillHoverCard from "./skill-hover-card";
import CardTypeIcon, { formatCardType } from "./card-type-icon";
import { ZapIcon, StarIcon, ChevronDownIcon } from "./icons";

const INITIAL_DISPLAY_LIMIT = 4;

export default function RecommendedShelf({
  onPickCard,
}: {
  onPickCard?: (card: CardIndexEntry, slotIndex: number) => void;
}) {
  const {
    mainSkillIdSet,
    parentSlots,
    setParentCard,
    course,
    trackDetail,
    activeCourseRow,
    runningStyle,
    distance,
    surface,
    allCards,
    activePvpEvent,
  } = useDeck();

  const [isExpanded, setIsExpanded] = useState(false);

  const raceParams = useMemo(() => getPvpRaceParameters(activePvpEvent), [activePvpEvent]);

  // Recommendations calculated via pure engine with course geometry simulation and skill-evaluator
  const recommendations = useMemo<CardRecommendation[]>(() => {
    return recommendCardsForParent({
      mainDeckSkillIds: mainSkillIdSet,
      equippedParentCardIds: parentSlots.map((c) => c?.id ?? null),
      course,
      style: runningStyle,
      distance,
      surface,
      limit: 16,
      raceParams,
    });
  }, [mainSkillIdSet, parentSlots, course, runningStyle, distance, surface, raceParams]);

  const visibleRecommendations = useMemo(() => {
    return isExpanded ? recommendations : recommendations.slice(0, INITIAL_DISPLAY_LIMIT);
  }, [isExpanded, recommendations]);

  const firstEmptySlotIndex = parentSlots.findIndex((c) => c === null);

  function handleAddCard(rec: CardRecommendation) {
    if (firstEmptySlotIndex === -1) return;
    if (!allCards) return;
    const card = allCards.find((c) => c.id === rec.cardId);
    if (!card) return;

    if (onPickCard) {
      onPickCard(card, firstEmptySlotIndex);
    } else {
      setParentCard(firstEmptySlotIndex, card);
    }
  }

  const raceTitle = trackDetail && activeCourseRow
    ? `${trackDetail.nameEn} ${activeCourseRow.length}m (${DISTANCE_LABELS[activeCourseRow.distance as keyof typeof DISTANCE_LABELS]?.split(" ")[0]} ${SURFACE_LABELS[activeCourseRow.terrain as keyof typeof SURFACE_LABELS]})`
    : "Target Race";

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <StarIcon className="h-4 w-4 text-amber-500 fill-amber-500 flex-none" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Recommended Parent Cards</h3>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Tailored for{" "}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{raceTitle}</span>
            {runningStyle && (
              <>
                {" "}· <span className="font-semibold text-zinc-800 dark:text-zinc-200">{RUNNING_STYLE_LABELS[runningStyle]}</span>
              </>
            )}{" "}
            - targeting skills that trigger on this track and are missing from Main Deck.
          </p>
        </div>

        {firstEmptySlotIndex !== -1 ? (
          <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70">
            Next empty slot: Slot {firstEmptySlotIndex + 1}
          </span>
        ) : (
          <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            All 6 parent slots filled
          </span>
        )}
      </div>

      {/* Recommended Cards Grid */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visibleRecommendations.map((rec) => {
          const cardEntry = allCards?.find((c) => c.id === rec.cardId);
          const isFull = firstEmptySlotIndex === -1;

          return (
            <div
              key={rec.cardId}
              className="flex flex-col justify-between rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-all shadow-xs"
            >
              <div>
                {/* Header: Portrait Variant Art + Meta */}
                <div className="flex items-start gap-2.5">
                  <div className="h-14 w-14 flex-none overflow-hidden bg-transparent">
                    {cardEntry?.portraitUrl || cardEntry?.imgUrl ? (
                      <img
                        src={cardEntry.portraitUrl || cardEntry.imgUrl}
                        alt={rec.nameEn}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs text-zinc-400 dark:text-zinc-500">Card</div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          RARITY_META[rec.rarity]?.chip ?? "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {RARITY_META[rec.rarity]?.label ?? "R"}
                      </span>
                      <span className="inline-flex items-center gap-1 min-w-0">
                        <CardTypeIcon type={rec.type} className="h-3.5 w-3.5 object-contain flex-none" />
                        <span className="truncate text-[10px] uppercase font-medium text-zinc-400 dark:text-zinc-500">
                          {formatCardType(rec.type)}
                        </span>
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100" title={rec.nameEn}>
                      {rec.nameEn}
                    </p>
                    <p className="truncate text-[11px] text-zinc-400 dark:text-zinc-500">{rec.nameJp}</p>
                  </div>
                </div>

                {/* Skills granted breakdown */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    <span>Target skills to farm:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">+{rec.totalNewCount} new</span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {rec.newMatchingSkills.map((s) => {
                      const isFastestAccel = s.tacticalCategory === "fastest_accel" || s.evalTier === "S";
                      const isCarryOver = s.tacticalCategory === "carry_over" || s.evalTier === "A";

                      return (
                        <SkillHoverCard
                          key={s.id}
                          skillId={s.id}
                          fallbackSkill={{ nameEn: s.nameEn, rarity: s.rarity, iconId: s.iconId }}
                          cardName={rec.nameEn}
                        >
                          <span
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border cursor-pointer transition-all hover:scale-[1.02] ${
                              s.choiceConflict && !s.isRecommendedChoice
                                ? "border-amber-400 dark:border-amber-700 bg-amber-100/70 dark:bg-amber-950 text-amber-950 dark:text-amber-100 opacity-90"
                                : isFastestAccel
                                  ? "border-emerald-400 dark:border-emerald-600 bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-950 dark:text-emerald-200 font-bold shadow-2xs"
                                  : isCarryOver
                                    ? "border-cyan-400 dark:border-cyan-600 bg-cyan-100/80 dark:bg-cyan-950/80 text-cyan-950 dark:text-cyan-200 font-bold shadow-2xs"
                                    : s.firesOnCourse === true
                                      ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 font-semibold"
                                      : s.isSpecialized
                                        ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300"
                                        : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                            }`}
                            title={`${s.nameEn}${s.originalGoldName ? ` (via Gold: ${s.originalGoldName})` : ""} (${s.source})${
                              s.tacticalLabel ? ` • [${s.tacticalLabel}]` : ""
                            }${
                              s.eventMeta
                                ? `\nEvent: ${s.eventMeta.eventNameEn || s.eventMeta.eventNameJp} • Choice ${s.eventMeta.choiceIndex}: ${s.eventMeta.choiceTextEn || s.eventMeta.choiceTextJp}${
                                    s.choiceConflict ? (s.isRecommendedChoice ? " (Recommended branch)" : " (Alternative choice)") : ""
                                  }`
                                : ""
                            }${s.firesOnCourse === true ? " - Activates on this track!" : ""}`}
                          >
                            {isFastestAccel ? (
                              <span className="text-[8.5px] px-1 py-0.2 rounded font-bold bg-emerald-600 text-white flex items-center gap-0.5">
                                <ZapIcon className="h-2 w-2 flex-none" />
                                Fastest
                              </span>
                            ) : isCarryOver ? (
                              <span className="text-[8.5px] px-1 py-0.2 rounded font-bold bg-cyan-600 text-white">
                                Connect
                              </span>
                            ) : s.firesOnCourse === true ? (
                              <ZapIcon className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400 flex-none" />
                            ) : null}
                            <SkillIcon iconId={s.iconId} name={s.nameEn} className="h-3.5 w-3.5 object-contain flex-none" />
                            <span className="text-[9px] text-zinc-400 dark:text-zinc-500">[{s.source === "hint" ? "H" : "E"}]</span>
                            <span className="truncate max-w-[120px]">{s.nameEn}</span>
                            {s.eventMeta && (
                              <span
                                className={`text-[8px] px-1 py-0.2 rounded font-semibold ${
                                  s.choiceConflict
                                    ? s.isRecommendedChoice
                                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                                      : "bg-amber-200/90 dark:bg-amber-950 text-amber-950 dark:text-amber-100 font-bold"
                                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                }`}
                                title={`Choice ${s.eventMeta.choiceIndex}: ${s.eventMeta.choiceTextEn || s.eventMeta.choiceTextJp}`}
                              >
                                {s.choiceConflict
                                  ? s.isRecommendedChoice
                                    ? `Opt ${s.eventMeta.choiceIndex}★`
                                    : `Opt ${s.eventMeta.choiceIndex}`
                                  : `Opt ${s.eventMeta.choiceIndex}`}
                              </span>
                            )}
                            {s.originalGoldName && (
                              <span className="text-[9px] font-bold text-amber-800 dark:text-amber-300" title={`Mapped from Gold: ${s.originalGoldName}`}>
                                ★
                              </span>
                            )}
                          </span>
                        </SkillHoverCard>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={isFull}
                onClick={() => handleAddCard(rec)}
                className={`mt-3 w-full rounded-lg py-1.5 text-xs font-semibold transition-colors ease-out-quart duration-150 cursor-pointer ${
                  isFull
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                    : "bg-emerald-700 dark:bg-emerald-600 text-white hover:bg-emerald-800 dark:hover:bg-emerald-500 active:scale-[0.98] shadow-2xs"
                }`}
              >
                {isFull ? "Slots Full" : `+ Add to Slot ${firstEmptySlotIndex + 1}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* View More / Show Less Button */}
      {recommendations.length > INITIAL_DISPLAY_LIMIT && (
        <div className="mt-4 flex justify-center border-t border-zinc-100 dark:border-zinc-800/80 pt-3">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/90 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 active:scale-[0.98] transition-all ease-out-quart duration-150 cursor-pointer shadow-2xs"
          >
            <span>{isExpanded ? "Show Less" : `View More (${recommendations.length - INITIAL_DISPLAY_LIMIT} more)`}</span>
            <ChevronDownIcon
              className={`h-3.5 w-3.5 transition-transform duration-200 ease-in-out-cubic ${isExpanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      )}
    </section>
  );
}
