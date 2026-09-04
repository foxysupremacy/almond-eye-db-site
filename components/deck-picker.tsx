"use client";

// The 6-slot support-card deck. Each slot opens a popover (CardPickerPopover)
// that lists ALL cards with search + sort; picking fills the slot.

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

export default function DeckPicker() {
  const { slots, setCard, skillsByCard, pendingSkillCards } = useDeck();
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [inspectCard, setInspectCard] = useState<CardIndexEntry | null>(null);

  function pick(card: CardIndexEntry) {
    if (openSlot == null) return;
    setCard(openSlot, card);
    setOpenSlot(null);
  }

  return (
    <section>
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Support Deck</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Pick 6 support cards. The skills they grant become your active deck pool.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 min-[680px]:grid-cols-[repeat(3,208px)] justify-center justify-items-center gap-2 sm:gap-3.5 max-w-[440px] min-[680px]:max-w-none mx-auto">
        {Array.from({ length: DECK_SIZE }, (_, i) => i).map((slotIndex) => {
          const card = slots[slotIndex];
          const isOpen = openSlot === slotIndex;
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
                <>
                  <div className="flex flex-1 flex-col p-0">
                    {/* Edge-to-Edge Artwork (zero gaps left & right, natural aspect ratio) */}
                    <div className="relative w-full overflow-hidden rounded-t-2xl bg-zinc-100 dark:bg-zinc-800">
                      <img
                        src={card.imgUrl}
                        alt={cardLabel(card)}
                        className="w-full h-auto block object-contain select-none"
                        loading="lazy"
                      />
                    </div>

                    <div className="flex flex-1 flex-col justify-between p-2 sm:p-3 gap-2 sm:gap-2.5">
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${RARITY_META[card.rarity]?.chip ?? "bg-zinc-200"}`}>
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
                      <CardChainSelector card={card} mode="main" />

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
                          onClick={() => setCard(slotIndex, null)}
                        >
                          remove
                        </button>
                      </div>
                    </div>
                  </div>
                </>
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
                    {isOpen && <CardPickerPopover onPick={pick} onClose={() => setOpenSlot(null)} />}
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
