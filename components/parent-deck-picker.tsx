"use client";

// The 6-slot support-card deck for Parent Farming.
// Features a Main Deck reference strip, duplicate card warnings,
// and opens CardPickerPopover in "parent" mode with recommendations.

import { useState } from "react";
import type { CardIndexEntry } from "../lib/api";
import { DECK_SIZE, useDeck } from "./store";
import CardPickerPopover, { RARITY_META } from "./card-picker-popover";
import CardChainSelector from "./card-chain-selector";
import CardTypeIcon, { formatCardType } from "./card-type-icon";
import CardSkillsSheet from "./card-skills-sheet";

function cardLabel(card: CardIndexEntry) {
  return card.nameEn || card.nameJp;
}

export default function ParentDeckPicker() {
  const {
    parentSlots,
    setParentCard,
    clearParent,
    copyMainToParent,
    mainSlots,
    mainSkills,
    skillsByCard,
    pendingSkillCards,
  } = useDeck();

  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [inspectCard, setInspectCard] = useState<CardIndexEntry | null>(null);

  function pick(card: CardIndexEntry) {
    if (openSlot == null) return;
    setParentCard(openSlot, card);
    setOpenSlot(null);
  }

  const mainCardIdSet = new Set(mainSlots.filter(Boolean).map((c) => c!.id));
  const hasMainDeck = mainSlots.some(Boolean);
  const hasParentDeck = parentSlots.some(Boolean);

  return (
    <section className="flex flex-col gap-5">
      {/* Header & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Parent Support Deck</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Pick 6 cards to farm parent inheritance skills that your Main Deck does not have.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasMainDeck && (
            <button
              onClick={copyMainToParent}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 shadow-xs cursor-pointer transition-colors"
              title="Copy the 6 cards from your Main Deck into the Parent Deck"
            >
              Copy from Main
            </button>
          )}
          {hasParentDeck && (
            <button
              onClick={clearParent}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:border-red-200 dark:hover:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 shadow-xs cursor-pointer transition-colors"
            >
              Clear Parent Deck
            </button>
          )}
        </div>
      </div>

      {/* Main Deck Reference Strip */}
      <div className="rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Main Deck Reference
            </span>
            <span className="rounded bg-zinc-200/80 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
              {mainSkills.length} skills covered
            </span>
          </div>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Skills already covered in Main Deck will be flagged as duplicates
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {Array.from({ length: DECK_SIZE }, (_, i) => i).map((slotIdx) => {
            const card = mainSlots[slotIdx];
            return (
              <div
                key={slotIdx}
                className="flex items-center gap-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 min-w-[130px] flex-1 shadow-2xs"
              >
                {card ? (
                  <>
                    <img
                      src={card.portraitUrl || card.imgUrl}
                      alt=""
                      className="h-7 w-7 rounded object-cover border border-zinc-200/60 dark:border-zinc-700"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-200" title={cardLabel(card)}>
                        {cardLabel(card)}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 capitalize">
                        <CardTypeIcon type={card.type} className="h-3 w-3 object-contain flex-none" />
                        <span>{formatCardType(card.type)}</span>
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">Empty Slot {slotIdx + 1}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 6-Slot Grid (Max 3 cards per row on desktop, 2 on mobile, centered, zero side gaps on artwork) */}
      <div className="grid grid-cols-2 min-[680px]:grid-cols-[repeat(3,208px)] justify-center justify-items-center gap-2 sm:gap-3.5 max-w-[440px] min-[680px]:max-w-none mx-auto">
        {Array.from({ length: DECK_SIZE }, (_, i) => i).map((slotIndex) => {
          const card = parentSlots[slotIndex];
          const isOpen = openSlot === slotIndex;
          const isInMain = card && mainCardIdSet.has(card.id);
          const cardSkills = card ? skillsByCard[card.id] : undefined;
          const allSkills = [
            ...(cardSkills?.eventSkills.map((s) => ({ ...s, source: "event" as const })) ?? []),
            ...(cardSkills?.hintSkills.map((s) => ({ ...s, source: "hint" as const })) ?? []),
          ];
          const totalSkills = allSkills.length;

          return (
            <div
              key={slotIndex}
              className="group relative flex w-full max-w-[208px] flex-col rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs transition-all overflow-hidden"
            >
              {card ? (
                <div className="flex flex-1 flex-col p-0">
                  {/* Edge-to-Edge Artwork (zero gaps left & right, natural aspect ratio) */}
                  <div className="relative w-full overflow-hidden rounded-t-2xl bg-zinc-100 dark:bg-zinc-800">
                    <img
                      src={card.imgUrl}
                      alt={cardLabel(card)}
                      className="w-full h-auto block object-contain select-none"
                      loading="lazy"
                    />
                    {isInMain && (
                      <span className="absolute top-2.5 right-2.5 z-20 rounded-md bg-amber-200/95 dark:bg-amber-950/95 px-2 py-0.5 text-[9px] font-bold text-amber-950 dark:text-amber-100 border border-amber-400/80 dark:border-amber-700 shadow-xs">
                        In Main
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-2 sm:p-3 gap-2 sm:gap-2.5">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            RARITY_META[card.rarity]?.chip ?? "bg-zinc-200"
                          }`}
                        >
                          {RARITY_META[card.rarity]?.label ?? "R"}
                        </span>
                        <span className="inline-flex items-center gap-1 truncate text-[10px] text-zinc-400 capitalize">
                          <CardTypeIcon type={card.type} className="h-3.5 w-3.5 object-contain flex-none" />
                          <span>{formatCardType(card.type)}</span>
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100" title={cardLabel(card)}>
                        {cardLabel(card)}
                      </p>
                      <p className="truncate text-[10px] text-zinc-400 dark:text-zinc-500">{card.nameJp}</p>
                    </div>

                    {/* Compacted Chain Picker + Picked Chain Skills (or SR/R fallback) */}
                    <CardChainSelector card={card} mode="parent" />

                    <div className="flex items-center justify-between pt-1 border-t border-zinc-100/80 dark:border-zinc-800/80">
                      <button
                        type="button"
                        onClick={() => setInspectCard(card)}
                        className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                        title="Click to view and inspect all skills from this card"
                      >
                        {pendingSkillCards.has(card.id)
                          ? "loading…"
                          : `${totalSkills} skills ↗`}
                      </button>
                      <button
                        className="text-[10px] font-medium text-zinc-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer transition-colors"
                        onClick={() => setParentCard(slotIndex, null)}
                      >
                        remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 min-h-[260px] sm:min-h-[330px] items-center justify-center p-2 sm:p-3">
                  <div className="relative w-full">
                    <button
                      className="flex w-full flex-col items-center justify-center gap-2 sm:gap-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-3.5 sm:p-5 text-zinc-400 dark:text-zinc-500 hover:border-emerald-400 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 cursor-pointer transition-all active:scale-[0.98]"
                      onClick={() => setOpenSlot(isOpen ? null : slotIndex)}
                    >
                      <span className="grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 text-base sm:text-xl font-light">
                        +
                      </span>
                      <span className="text-[10px] sm:text-xs font-semibold">Pick Slot {slotIndex + 1}</span>
                    </button>
                    {isOpen && (
                      <CardPickerPopover
                        mode="parent"
                        onPick={pick}
                        onClose={() => setOpenSlot(null)}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded Card Skills Sheet */}
      {inspectCard && (
        <CardSkillsSheet
          card={inspectCard}
          isOpen={Boolean(inspectCard)}
          onClose={() => setInspectCard(null)}
        />
      )}
    </section>
  );
}
