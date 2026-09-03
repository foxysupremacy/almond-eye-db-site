"use client";

// Top Recommendations shelf for the Parent Deck view.
// Ranks cards based on the unified Target Race (Venue + Course + Style),
// giving priority to skills that activate on the specific course geometry.

import { useMemo } from "react";
import {
  useDeck,
  RUNNING_STYLE_LABELS,
  DISTANCE_LABELS,
  SURFACE_LABELS,
} from "./store";
import { recommendCardsForParent, type CardRecommendation } from "../lib/recommendation-engine";
import { RARITY_META } from "./card-picker-popover";
import type { CardIndexEntry } from "../lib/api";
import SkillIcon from "./skill-icon";
import CardTypeIcon, { formatCardType } from "./card-type-icon";

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
  } = useDeck();

  // Recommendations calculated via pure engine with course geometry simulation
  const recommendations = useMemo<CardRecommendation[]>(() => {
    return recommendCardsForParent({
      mainDeckSkillIds: mainSkillIdSet,
      equippedParentCardIds: parentSlots.map((c) => c?.id ?? null),
      course,
      style: runningStyle,
      distance,
      surface,
      limit: 8,
    });
  }, [mainSkillIdSet, parentSlots, course, runningStyle, distance, surface]);

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
    <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-amber-600 text-sm">★</span>
            <h3 className="text-base font-semibold text-zinc-900">Recommended Parent Cards</h3>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            Tailored for{" "}
            <span className="font-semibold text-zinc-800">{raceTitle}</span>
            {runningStyle && (
              <>
                {" "}· <span className="font-semibold text-zinc-800">{RUNNING_STYLE_LABELS[runningStyle]}</span>
              </>
            )}{" "}
            — targeting skills that trigger on this track and are missing from Main Deck.
          </p>
        </div>

        {firstEmptySlotIndex !== -1 ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200/70">
            Next empty slot: Slot {firstEmptySlotIndex + 1}
          </span>
        ) : (
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500">
            All 6 parent slots filled
          </span>
        )}
      </div>

      {/* Recommended Cards Grid */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {recommendations.map((rec) => {
          const cardEntry = allCards?.find((c) => c.id === rec.cardId);
          const isFull = firstEmptySlotIndex === -1;

          return (
            <div
              key={rec.cardId}
              className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3 hover:border-zinc-300 hover:bg-white transition-all shadow-xs"
            >
              <div>
                {/* Header: Art + Meta */}
                <div className="flex items-start gap-2.5">
                  <div className="h-12 w-12 flex-none overflow-hidden rounded-lg bg-zinc-100 border border-zinc-200/80">
                    {cardEntry?.imgUrl ? (
                      <img
                        src={cardEntry.imgUrl}
                        alt={rec.nameEn}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs text-zinc-400">Card</div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          RARITY_META[rec.rarity]?.chip ?? "bg-zinc-200 text-zinc-700"
                        }`}
                      >
                        {RARITY_META[rec.rarity]?.label ?? "R"}
                      </span>
                      <span className="inline-flex items-center gap-1 min-w-0">
                        <CardTypeIcon type={rec.type} className="h-3.5 w-3.5 object-contain flex-none" />
                        <span className="truncate text-[10px] uppercase font-medium text-zinc-400">
                          {formatCardType(rec.type)}
                        </span>
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs font-semibold text-zinc-900" title={rec.nameEn}>
                      {rec.nameEn}
                    </p>
                    <p className="truncate text-[11px] text-zinc-400">{rec.nameJp}</p>
                  </div>
                </div>

                {/* Skills granted breakdown */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] font-medium text-zinc-600 mb-1.5">
                    <span>Target skills to farm:</span>
                    <span className="font-bold text-[#794016]">+{rec.totalNewCount} new</span>
                  </div>

                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {rec.newMatchingSkills.slice(0, 4).map((s) => (
                        <span
                          key={s.id}
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border ${
                            s.choiceConflict && !s.isRecommendedChoice
                              ? "border-amber-300/80 bg-amber-50/50 text-amber-900 opacity-80"
                              : s.firesOnCourse === true
                                ? "border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold"
                                : s.isSpecialized
                                  ? "border-emerald-200 bg-emerald-50/60 text-emerald-800"
                                  : "border-zinc-200 bg-white text-zinc-700"
                          }`}
                          title={`${s.nameEn}${s.originalGoldName ? ` (via Gold: ${s.originalGoldName})` : ""} (${s.source})${
                            s.eventMeta
                              ? `\nEvent: ${s.eventMeta.eventNameEn || s.eventMeta.eventNameJp} • Choice ${s.eventMeta.choiceIndex}: ${s.eventMeta.choiceTextEn || s.eventMeta.choiceTextJp}${
                                  s.choiceConflict ? (s.isRecommendedChoice ? " (Recommended branch)" : " (Alternative choice)") : ""
                                }`
                              : ""
                          }${s.firesOnCourse === true ? " — Activates on this track!" : ""}`}
                        >
                          {s.firesOnCourse === true && (
                            <span className="text-emerald-600 text-[9px]">⚡</span>
                          )}
                          <SkillIcon iconId={s.iconId} name={s.nameEn} className="h-3.5 w-3.5 rounded object-contain flex-none" />
                          <span className="text-[9px] text-zinc-400">[{s.source === "hint" ? "H" : "E"}]</span>
                          <span className="truncate max-w-[120px]">{s.nameEn}</span>
                          {s.eventMeta && (
                            <span
                              className={`text-[8px] px-1 py-0.2 rounded font-semibold ${
                                s.choiceConflict
                                  ? s.isRecommendedChoice
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                  : "bg-zinc-100 text-zinc-600"
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
                            <span className="text-[8px] font-bold text-amber-700" title={`Mapped from Gold: ${s.originalGoldName}`}>
                              ★
                            </span>
                          )}
                        </span>
                      ))}
                      {rec.newMatchingSkills.length > 4 && (
                        <span className="rounded bg-zinc-200/60 px-1 py-0.5 text-[10px] text-zinc-500 font-medium">
                          +{rec.newMatchingSkills.length - 4} more
                        </span>
                      )}
                    </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={isFull}
                onClick={() => handleAddCard(rec)}
                className={`mt-3 w-full rounded-lg py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  isFull
                    ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                    : "bg-[#794016] text-white hover:bg-[#603312] active:scale-[0.98]"
                }`}
              >
                {isFull ? "Slots Full" : `+ Add to Slot ${firstEmptySlotIndex + 1}`}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
