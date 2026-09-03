"use client";

// The 6-slot support-card deck. Each slot opens a popover (CardPickerPopover)
// that lists ALL cards with search + sort; picking fills the slot.

import { useState } from "react";
import type { CardIndexEntry } from "../lib/api";
import { DECK_SIZE, useDeck } from "./store";
import CardPickerPopover, { RARITY_META } from "./card-picker-popover";
import CardChainSelector from "./card-chain-selector";
import CardTypeIcon, { formatCardType } from "./card-type-icon";

function cardLabel(card: CardIndexEntry) {
  return card.nameEn || card.nameJp;
}

export default function DeckPicker() {
  const { slots, setCard, skillsByCard, pendingSkillCards } = useDeck();
  const [openSlot, setOpenSlot] = useState<number | null>(null);

  function pick(card: CardIndexEntry) {
    if (openSlot == null) return;
    setCard(openSlot, card);
    setOpenSlot(null);
  }

  return (
    <section>
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Support deck</h2>
        <p className="text-sm text-zinc-500">
          Pick 6 support cards — the skills they grant become your pool.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: DECK_SIZE }, (_, i) => i).map((slotIndex) => {
          const card = slots[slotIndex];
          const isOpen = openSlot === slotIndex;
          return (
            <div
              key={slotIndex}
              className="relative flex min-h-[180px] flex-col rounded-xl border border-zinc-200 bg-white shadow-sm"
            >
              {card ? (
                <>
                  <div className="flex flex-1 flex-col rounded-xl p-0">
                    <div className="flex-1 rounded-t-xl bg-zinc-50 p-3">
                      <img src={card.imgUrl} alt={cardLabel(card)} className="mx-auto h-24 object-contain" loading="lazy" />
                    </div>
                    <div className="rounded-b-xl border-t border-zinc-100 p-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${RARITY_META[card.rarity].chip}`}>
                          {RARITY_META[card.rarity].label}
                        </span>
                        <span className="inline-flex items-center gap-1 truncate text-[10px] text-zinc-400 capitalize">
                          <CardTypeIcon type={card.type} className="h-3.5 w-3.5 object-contain flex-none" />
                          <span>{formatCardType(card.type)}</span>
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-zinc-800">{cardLabel(card)}</p>
                      <p className="truncate text-[11px] text-zinc-400">{card.nameJp}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-zinc-500">
                          {pendingSkillCards.has(card.id)
                            ? "loading…"
                            : `${(skillsByCard[card.id]?.eventSkills.length ?? 0) + (skillsByCard[card.id]?.hintSkills.length ?? 0)} skills`}
                        </span>
                        <button
                          className="text-[11px] font-medium text-zinc-400 hover:text-red-600"
                          onClick={() => setCard(slotIndex, null)}
                        >
                          remove
                        </button>
                      </div>

                      {/* SSR Continuous Choices Chain */}
                      <CardChainSelector card={card} mode="main" />
                    </div>
                  </div>
                </>
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
                    {isOpen && <CardPickerPopover onPick={pick} onClose={() => setOpenSlot(null)} />}
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
