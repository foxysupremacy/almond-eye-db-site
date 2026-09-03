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
          <h2 className="text-lg font-semibold text-zinc-900">Parent Support Deck</h2>
          <p className="text-sm text-zinc-500">
            Pick 6 cards to farm parent inheritance skills that your Main Deck doesn't have.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasMainDeck && (
            <button
              onClick={copyMainToParent}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 shadow-xs cursor-pointer"
              title="Copy the 6 cards from your Main Deck into the Parent Deck"
            >
              Copy from Main
            </button>
          )}
          {hasParentDeck && (
            <button
              onClick={clearParent}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 shadow-xs cursor-pointer"
            >
              Clear Parent Deck
            </button>
          )}
        </div>
      </div>

      {/* Main Deck Reference Strip */}
      <div className="rounded-xl border border-zinc-200/90 bg-[#f7f5f0] p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#794016]">
              Main Deck Reference
            </span>
            <span className="rounded bg-zinc-200/70 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
              {mainSkills.length} skills covered
            </span>
          </div>
          <span className="text-[11px] text-zinc-500">
            Skills already covered in Main Deck will be flagged as duplicates
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {Array.from({ length: DECK_SIZE }, (_, i) => i).map((slotIdx) => {
            const card = mainSlots[slotIdx];
            return (
              <div
                key={slotIdx}
                className="flex items-center gap-2 rounded-lg border border-zinc-200/80 bg-white px-2.5 py-1.5 min-w-[130px] flex-1 shadow-2xs"
              >
                {card ? (
                  <>
                    <img
                      src={card.portraitUrl || card.imgUrl}
                      alt=""
                      className="h-7 w-7 rounded object-cover border border-zinc-200/60"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-zinc-800" title={cardLabel(card)}>
                        {cardLabel(card)}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 uppercase">
                        <CardTypeIcon type={card.type} className="h-3 w-3 object-contain flex-none" />
                        <span>{formatCardType(card.type)}</span>
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-zinc-400 italic">Empty Slot {slotIdx + 1}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 6-Slot Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: DECK_SIZE }, (_, i) => i).map((slotIndex) => {
          const card = parentSlots[slotIndex];
          const isOpen = openSlot === slotIndex;
          const isInMain = card && mainCardIdSet.has(card.id);

          return (
            <div
              key={slotIndex}
              className="relative flex min-h-[190px] flex-col rounded-xl border border-zinc-200 bg-white shadow-sm"
            >
              {card ? (
                <div className="flex flex-1 flex-col rounded-xl p-0">
                  <div className="relative flex-1 rounded-t-xl bg-zinc-50 p-3">
                    <img
                      src={card.imgUrl}
                      alt={cardLabel(card)}
                      className="mx-auto h-24 object-contain"
                      loading="lazy"
                    />
                    {isInMain && (
                      <span className="absolute top-2 right-2 rounded bg-amber-100/90 px-1.5 py-0.5 text-[9px] font-bold text-amber-900 border border-amber-300">
                        In Main
                      </span>
                    )}
                  </div>
                  <div className="rounded-b-xl border-t border-zinc-100 p-2">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          RARITY_META[card.rarity]?.chip ?? "bg-zinc-200 text-zinc-700"
                        }`}
                      >
                        {RARITY_META[card.rarity]?.label ?? "R"}
                      </span>
                      <span className="inline-flex items-center gap-1 truncate text-[10px] text-zinc-400 capitalize">
                        <CardTypeIcon type={card.type} className="h-3.5 w-3.5 object-contain flex-none" />
                        <span>{formatCardType(card.type)}</span>
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-zinc-800" title={cardLabel(card)}>
                      {cardLabel(card)}
                    </p>
                    <p className="truncate text-[11px] text-zinc-400">{card.nameJp}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">
                        {pendingSkillCards.has(card.id)
                          ? "loading…"
                          : `${(skillsByCard[card.id]?.eventSkills.length ?? 0) + (skillsByCard[card.id]?.hintSkills.length ?? 0)} skills`}
                      </span>
                      <button
                        className="text-[11px] font-medium text-zinc-400 hover:text-red-600 cursor-pointer"
                        onClick={() => setParentCard(slotIndex, null)}
                      >
                        remove
                      </button>
                    </div>

                    {/* SSR Continuous Choices Chain */}
                    <CardChainSelector card={card} mode="parent" />
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <div className="relative">
                    <button
                      className="flex flex-col items-center justify-center gap-2 p-3 text-zinc-300 hover:text-zinc-600 cursor-pointer transition-colors"
                      onClick={() => setOpenSlot(isOpen ? null : slotIndex)}
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-zinc-300 text-lg font-light">
                        +
                      </span>
                      <span className="text-xs font-medium">Slot {slotIndex + 1}</span>
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
    </section>
  );
}
