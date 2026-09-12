"use client";

// The 6-slot support-card deck. Each slot opens a popover (CardPickerPopover)
// that lists ALL cards with search + sort; picking fills the slot.
// Supports mode="main" (default) and mode="parent" (for Parent Deck farming).

import { useState, useMemo } from "react";
import type { CardIndexEntry } from "../lib/api";
import { useDeck } from "./store";
import { DECK_SIZE } from "../lib/deck/constants";
import CardPickerPopover, { RARITY_META } from "./card-picker-popover";
import CardChainSelector from "./card-chain-selector";
import CardTypeIcon, { formatCardType } from "./card-type-icon";
import CardSkillsSheet from "./card-skills-sheet";
import SkillPickerModal from "./skill-picker-modal";
import { SearchIcon } from "./icons";
import { useParentingSetup } from "../lib/parenting-state";
import { findCharConflict } from "../lib/deck/card-constraints";
import { charactersByCharId } from "../lib/data/registry";

function cardLabel(card: CardIndexEntry) {
  return card.nameEn || card.nameJp;
}

export interface DeckPickerProps {
  mode?: "main" | "parent";
}

export default function DeckPicker({ mode = "main" }: DeckPickerProps) {
  const {
    slots: mainSlots,
    setCard,
    parentSlots,
    setParentCard,
    clearParent,
    copyMainToParent,
    mainSkills,
    skillsByCard,
    pendingSkillCards,
  } = useDeck();

  const { setup } = useParentingSetup();
  const targetChara = useMemo(() => {
    if (!setup.targetCharaId) return null;
    return charactersByCharId.get(setup.targetCharaId) || null;
  }, [setup.targetCharaId]);

  const isParent = mode === "parent";
  const activeSlots = isParent ? parentSlots : mainSlots;
  const onPickCard = isParent ? setParentCard : setCard;

  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [inspectCard, setInspectCard] = useState<CardIndexEntry | null>(null);
  const [isSkillPickerOpen, setIsSkillPickerOpen] = useState(false);

  function pick(card: CardIndexEntry) {
    if (openSlot == null) return;
    onPickCard(openSlot, card);
    setOpenSlot(null);
  }

  const mainCardIdSet = new Set(mainSlots.filter(Boolean).map((c) => c!.id));
  const hasMainDeck = mainSlots.some(Boolean);
  const hasParentDeck = parentSlots.some(Boolean);

  return (
    <section className="flex flex-col gap-4">
      {/* Header & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {isParent ? "Parent Support Deck" : "Support Deck"}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isParent
              ? "Pick 6 cards to farm parent inheritance skills that your Main Deck does not have."
              : "Pick 6 support cards. The skills they grant become your active deck pool."}
          </p>
        </div>

        {isParent && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSkillPickerOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/50 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 shadow-xs cursor-pointer transition-colors"
              title="Search cards granting target speed, current speed, accel, heal, or debuff skills"
            >
              <SearchIcon className="h-3.5 w-3.5" />
              <span>Search by Skill</span>
            </button>
            {hasMainDeck && (
              <button
                type="button"
                onClick={copyMainToParent}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 shadow-xs cursor-pointer transition-colors"
                title="Copy the 6 cards from your Main Deck into the Parent Deck"
              >
                Copy from Main
              </button>
            )}
            {hasParentDeck && (
              <button
                type="button"
                onClick={clearParent}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:border-red-200 dark:hover:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 shadow-xs cursor-pointer transition-colors"
              >
                Clear Parent Deck
              </button>
            )}
          </div>
        )}
      </div>

      {/* 6-Slot Grid */}
      <div className="grid grid-cols-2 min-[680px]:grid-cols-[repeat(3,208px)] justify-center justify-items-center gap-2 sm:gap-3.5 max-w-[440px] min-[680px]:max-w-none mx-auto">
        {Array.from({ length: DECK_SIZE }, (_, i) => i).map((slotIndex) => {
          const card = activeSlots[slotIndex];
          const isInMain = isParent && card && mainCardIdSet.has(card.id);
          const cardSkills = card ? skillsByCard[card.id] : undefined;
          const allSkills = [
            ...(cardSkills?.eventSkills.map((s) => ({ ...s, source: "event" as const })) ?? []),
            ...(cardSkills?.hintSkills.map((s) => ({ ...s, source: "hint" as const })) ?? []),
          ];
          const isTraineeConflict = Boolean(
            !isParent && // Parent Deck targets P1/P2, not the trainee — cards sharing the trainee's character are allowed there
            card &&
            targetChara &&
            (card.nameEn?.toLowerCase() === targetChara.nameEn?.toLowerCase() ||
             card.nameJp === targetChara.nameJp)
          );
          // Same-uma rule (per deck): another DIFFERENT card of this character is
          // equipped elsewhere in this deck (possible via imported/shared presets).
          const charConflict = card
            ? findCharConflict(isParent ? parentSlots : mainSlots, slotIndex, card)
            : null;

          return (
            <div
              key={slotIndex}
              className={`group relative flex w-full max-w-[208px] flex-col rounded-2xl bg-white dark:bg-zinc-900 shadow-xs transition-all overflow-hidden ${
                isTraineeConflict
                  ? "border-2 border-rose-500 ring-2 ring-rose-500/30"
                  : charConflict
                  ? "border-2 border-amber-500 ring-2 ring-amber-500/30"
                  : "border border-zinc-200/90 dark:border-zinc-800"
              }`}
            >
              {card ? (
                <div className="flex flex-1 flex-col p-0">
                  {/* Edge-to-Edge Artwork (zero gaps left & right, natural aspect ratio) */}
                  <div className="relative w-full overflow-hidden rounded-t-2xl bg-zinc-100 dark:bg-zinc-800">
                    {isTraineeConflict && (
                      <div className="absolute top-0 inset-x-0 z-30 bg-rose-600 text-white text-[9px] font-extrabold text-center py-0.5 tracking-wide shadow-xs">
                        ⚠️ Trainee Card Prohibited
                      </div>
                    )}
                    {charConflict && (
                      <div
                        className="absolute top-0 inset-x-0 z-30 bg-amber-500 text-white text-[9px] font-extrabold text-center py-0.5 tracking-wide shadow-xs"
                        title={`Same uma as "${charConflict.nameEn || charConflict.nameJp}" — two different cards of one uma cannot be active at once.`}
                      >
                        ⚠️ Same Uma Equipped Twice
                      </div>
                    )}
                    <img
                      src={card.imgUrl}
                      alt={cardLabel(card)}
                      className="w-full h-auto block object-contain select-none"
                      loading="lazy"
                    />
                    {isInMain && (
                      <span className="absolute top-2 right-2 z-20 rounded-md bg-amber-200/95 dark:bg-amber-950/95 px-2 py-0.5 text-[9px] font-bold text-amber-950 dark:text-amber-100 border border-amber-400/80 dark:border-amber-700 shadow-xs">
                        In Main
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-2 sm:p-3 gap-2 sm:gap-2.5">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${RARITY_META[card.rarity]?.chip ?? "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"}`}>
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
                    <CardChainSelector card={card} mode={mode} />

                    <div className="flex items-center justify-between pt-1 border-t border-zinc-100/80 dark:border-zinc-800/80">
                      <button
                        type="button"
                        onClick={() => setInspectCard(card)}
                        className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                        title="Click to view and inspect all skills from this card"
                      >
                        {pendingSkillCards.has(card.id)
                          ? "loading…"
                          : skillsByCard[card.id]
                          ? `${(skillsByCard[card.id]?.hintSkills?.length ?? 0) + (skillsByCard[card.id]?.eventSkills?.length ?? 0)} skills ↗`
                          : "Inspect skills ↗"}
                      </button>
                      <button
                        type="button"
                        className="text-[10px] font-medium text-zinc-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer transition-colors"
                        onClick={() => onPickCard(slotIndex, null)}
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
                      type="button"
                      className="flex w-full flex-col items-center justify-center gap-2 sm:gap-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-3.5 sm:p-5 text-zinc-400 dark:text-zinc-500 hover:border-emerald-400 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 cursor-pointer transition-all ease-out-quart duration-150 active:scale-[0.98]"
                      onClick={() => setOpenSlot(slotIndex)}
                    >
                      <span className="grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 text-base sm:text-xl font-light">
                        +
                      </span>
                      <span className="text-[10px] sm:text-xs font-semibold">Pick Slot {slotIndex + 1}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Support Card Picker Modal */}
      {openSlot !== null && (
        <CardPickerPopover
          mode={mode}
          slotIndex={openSlot}
          onPick={pick}
          onClose={() => setOpenSlot(null)}
        />
      )}

      {/* Expanded Card Skills Sheet */}
      {inspectCard && (
        <CardSkillsSheet
          card={inspectCard}
          isOpen={Boolean(inspectCard)}
          onClose={() => setInspectCard(null)}
          mode={mode}
        />
      )}

      {/* Skill Search & Effect Picker Modal (Parent mode) */}
      {isParent && (
        <SkillPickerModal
          isOpen={isSkillPickerOpen}
          onClose={() => setIsSkillPickerOpen(false)}
        />
      )}
    </section>
  );
}
