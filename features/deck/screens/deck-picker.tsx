"use client";

// The 6-slot support-card deck. Each slot opens a popover (CardPickerPopover)
// that lists ALL cards with search + sort; picking fills the slot.
// Supports mode="main" (default) and mode="parent" (for Parent Deck farming).

import { MobileSheet } from "@/app/common/ui/controls/mobile-sheet";
import type { CardIndexEntry, CharacterIndexEntry } from "@/lib/api";
import type { DeckSlotSize } from "@/lib/deck/slot-size-pref";
import { DECK_SIZE } from "@/lib/deck/constants";
import CardPickerPopover from "@/features/deck/pickers/card-picker-popover";
import { RARITY_META } from "@/app/common/ui/skills/skill-rarity";
import CardChainSelector from "@/features/deck/components/card-chain-selector";
import CardSkillsSheet from "@/features/deck/components/card-skills-sheet";
import CardTypeIcon, { formatCardType } from "@/app/common/ui/cards/card-type-icon";
import { CardArtImage } from "@/app/common/ui/cards/card-art-image";
import { findCharConflict, isTraineeCard } from "@/lib/deck/card-constraints";
import { deckSlotTransitionName } from "@/app/common/motion/view-transition";
import { useDeckPickerViewModel } from "@/features/deck/view-models/use-deck-picker-view-model";

function cardLabel(card: CardIndexEntry) {
  return card.nameEn || card.nameJp;
}

const SLOT_SIZE_OPTIONS: readonly { value: DeckSlotSize; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "large", label: "Large" },
];

/** Compact / Large segmented control; the choice is shared by Main and Parent Deck. */
function SlotSizeToggle({ value, onChange }: { value: DeckSlotSize; onChange: (size: DeckSlotSize) => void }) {
  return (
    <div role="group" aria-label="Card size" className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
      {SLOT_SIZE_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 ease-out-quart ${
              active
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Marks the deck's borrowed card; rentals are always MLB (lib/deck/rental.ts). */
function RentalBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`rounded-md border border-[#794016]/60 bg-[#794016] px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs ${className}`}
      title="Rental slot: borrowed from another player, always MLB"
    >
      Rental · MLB
    </span>
  );
}

interface CompactSlotGridProps {
  isParent: boolean;
  rentalSlot: number | null;
  activeSlots: readonly (CardIndexEntry | null)[];
  /** The slots used for same-uma conflict checks (the deck being edited). */
  deckSlots: readonly (CardIndexEntry | null)[];
  targetChara: CharacterIndexEntry | null;
  mainCardIdSet: ReadonlySet<number>;
  onOpenCard: (slotIndex: number) => void;
  onPickSlot: (slotIndex: number) => void;
}

/**
 * One row of six face-cropped tiles on desktop (3×2 on phones). Selecting a
 * filled tile opens the slot sheet (event choices, inspect, replace, remove).
 */
function CompactSlotGrid({ isParent, rentalSlot, activeSlots, deckSlots, targetChara, mainCardIdSet, onOpenCard, onPickSlot }: CompactSlotGridProps) {
  const filled = activeSlots.filter(Boolean).length;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-6" aria-label={isParent ? "Parent support deck" : "Main support deck"}>
        {Array.from({ length: DECK_SIZE }, (_, index) => {
          const card = activeSlots[index];
          const traineeConflict = Boolean(card && !isParent && isTraineeCard(card, targetChara));
          const charConflict = card ? findCharConflict(deckSlots as CardIndexEntry[], index, card) : null;
          const inMain = Boolean(isParent && card && mainCardIdSet.has(card.id));
          const isRental = rentalSlot === index;
          const border = traineeConflict
            ? "border-rose-500 ring-2 ring-rose-500/30"
            : charConflict
              ? "border-amber-500 ring-2 ring-amber-500/30"
              : card
                ? "border-zinc-200 hover:border-emerald-400 dark:border-zinc-800 dark:hover:border-emerald-600"
                : "border-dashed border-zinc-300 hover:border-emerald-400 dark:border-zinc-700 dark:hover:border-emerald-600";
          return (
            <button
              key={index}
              type="button"
              aria-label={card ? `Edit slot ${index + 1}: ${cardLabel(card)}` : `Pick Slot ${index + 1}`}
              onClick={() => (card ? onOpenCard(index) : onPickSlot(index))}
              style={{ viewTransitionName: deckSlotTransitionName(index) }}
              className={`group relative flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border bg-white text-left transition-[border-color,transform] duration-150 ease-out-quart active:scale-[0.98] dark:bg-zinc-900 ${border}`}
            >
              {card ? (
                <>
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    <CardArtImage src={card.imgUrl} fallbackSrc={card.portraitUrl} alt="" loading="lazy" className="block h-full w-full select-none object-cover object-top" />
                    <span className={`absolute left-1.5 top-1.5 rounded px-1 py-0.5 text-[10px] font-bold uppercase ${RARITY_META[card.rarity]?.chip ?? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                      {RARITY_META[card.rarity]?.label ?? "R"}
                    </span>
                    <CardTypeIcon type={card.type} className="absolute right-1.5 top-1.5 h-5 w-5 flex-none object-contain" />
                    {inMain && !traineeConflict && !charConflict && (
                      <span className="absolute bottom-1.5 right-1.5 rounded-md border border-amber-400/80 bg-amber-200/95 px-1.5 py-0.5 text-[9px] font-bold text-amber-950 shadow-xs dark:border-amber-700 dark:bg-amber-950/95 dark:text-amber-100">
                        In Main
                      </span>
                    )}
                    {isRental && !traineeConflict && !charConflict && <RentalBadge className="absolute bottom-1.5 left-1.5" />}
                    {traineeConflict && (
                      <span className="absolute inset-x-0 bottom-0 bg-rose-600 px-1 py-0.5 text-center text-[10px] font-semibold text-white" title="The trainee's own card cannot be used in the Main Deck.">
                        Trainee card
                      </span>
                    )}
                    {!traineeConflict && charConflict && (
                      <span
                        className="absolute inset-x-0 bottom-0 bg-amber-500 px-1 py-0.5 text-center text-[10px] font-semibold text-white"
                        title={`Same uma as "${charConflict.nameEn || charConflict.nameJp}" — two different cards of one uma cannot be active at once.`}
                      >
                        Same uma twice
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 px-2 py-1.5">
                    <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">{cardLabel(card)}</p>
                    <p className="mt-0.5 truncate text-[10px] text-zinc-400 dark:text-zinc-500">{card.nameJp}</p>
                  </div>
                </>
              ) : (
                <>
                  <span className="flex aspect-[4/3] w-full items-center justify-center text-zinc-400 transition-colors group-hover:text-emerald-700 dark:text-zinc-500 dark:group-hover:text-emerald-400">
                    <span className="grid h-8 w-8 place-items-center rounded-full border border-dashed border-current text-lg font-light">+</span>
                  </span>
                  <span className="min-w-0 px-2 py-1.5">
                    <span className="block truncate text-xs font-semibold text-zinc-500 dark:text-zinc-400">Slot {index + 1}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-zinc-400 dark:text-zinc-500">{isRental ? "Rental · any card, MLB" : "Empty"}</span>
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{filled} of 6 cards · Select a card for event choices and skills</p>
    </div>
  );
}

export interface DeckPickerProps {
  mode?: "main" | "parent";
}

export default function DeckPicker({ mode = "main" }: DeckPickerProps) {
  const { state, commands } = useDeckPickerViewModel(mode);
  const {
    isParent,
    activeSlots,
    openSlot,
    mobileSlot,
    mobileCard,
    inspectCard,
    targetChara,
    hasMainDeck,
    hasParentDeck,
    mainCardIdSet,
    skillsByCard,
    parentSlots,
    mainSlots,
    slotSize,
    rentalSlot,
  } = state;

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

        <div className="flex flex-wrap items-center gap-2">
          <SlotSizeToggle value={slotSize} onChange={commands.setSlotSize} />
          {isParent && hasMainDeck && (
              <button
                type="button"
                onClick={commands.copyMainToParent}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 shadow-xs cursor-pointer transition-colors"
                title="Copy the 6 cards from your Main Deck into the Parent Deck"
              >
                Copy from Main
              </button>
            )}
            {isParent && hasParentDeck && (
              <button
                type="button"
                onClick={commands.clearParent}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:border-red-200 dark:hover:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 shadow-xs cursor-pointer transition-colors"
              >
                Clear Parent Deck
              </button>
            )}
        </div>
      </div>

      {slotSize === "compact" ? (
        <CompactSlotGrid
          isParent={isParent}
          rentalSlot={rentalSlot}
          activeSlots={activeSlots}
          deckSlots={isParent ? parentSlots : mainSlots}
          targetChara={targetChara}
          mainCardIdSet={mainCardIdSet}
          onOpenCard={commands.openMobileSlot}
          onPickSlot={commands.openSlotPicker}
        />
      ) : (
      <>
      <div className="grid grid-cols-3 gap-2 lg:hidden" aria-label={isParent ? "Parent support deck" : "Main support deck"}>
        {Array.from({ length: DECK_SIZE }, (_, index) => {
          const card = activeSlots[index];
          const conflict = card && (findCharConflict(activeSlots as CardIndexEntry[], index, card) || (!isParent && isTraineeCard(card, targetChara)));
          return (
            <button
              key={index}
              type="button"
              aria-label={card ? `Edit slot ${index + 1}: ${cardLabel(card)}` : `Pick Slot ${index + 1}`}
              onClick={() => card ? commands.openMobileSlot(index) : commands.openSlotPicker(index)}
              style={{ viewTransitionName: deckSlotTransitionName(index) }}
              className={`relative flex min-h-32 min-w-0 flex-col overflow-hidden rounded-xl border bg-white text-left dark:bg-zinc-900 ${conflict ? "border-rose-500" : "border-zinc-200 dark:border-zinc-800"}`}
            >
              {card ? (
                <>
                  <div className="relative w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    <CardArtImage src={card.imgUrl} fallbackSrc={card.portraitUrl} alt="" className="block h-auto w-full object-contain" />
                    <span className={`absolute left-1.5 top-1.5 rounded px-1 py-0.5 text-[10px] font-bold ${RARITY_META[card.rarity]?.chip}`}>{RARITY_META[card.rarity]?.label}</span>
                    <CardTypeIcon type={card.type} className="absolute right-1.5 top-1.5 h-5 w-5 object-contain" />
                    {rentalSlot === index && !conflict && <RentalBadge className="absolute bottom-1.5 left-1.5" />}
                    {conflict && <span className="absolute inset-x-0 bottom-0 bg-rose-600 px-1 py-0.5 text-center text-[10px] font-semibold text-white">Card conflict</span>}
                  </div>
                  <div className="w-full min-w-0 p-2">
                    <p className="truncate text-xs font-semibold">{cardLabel(card)}</p>
                    <p className="mt-0.5 truncate text-[10px] text-zinc-400 dark:text-zinc-500">{card.nameJp}</p>
                  </div>
                </>
              ) : (
                <span className="flex flex-1 flex-col items-center justify-center gap-2 self-stretch px-2 py-5 text-zinc-400">
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-zinc-300 text-xl dark:border-zinc-700">+</span>
                  <span className="text-xs">{rentalSlot === index ? "Rental slot" : `Slot ${index + 1}`}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="-mt-2 text-xs text-zinc-500 lg:hidden">{activeSlots.filter(Boolean).length} of 6 cards · Tap a card for choices and skills</p>

      {/* 6-Slot Grid */}
      <div className="hidden lg:grid grid-cols-2 min-[1100px]:grid-cols-[repeat(3,208px)] justify-center justify-items-center gap-2 sm:gap-3.5 max-w-[440px] min-[1100px]:max-w-none mx-auto">
        {Array.from({ length: DECK_SIZE }, (_, i) => i).map((slotIndex) => {
          const card = activeSlots[slotIndex];
          const isInMain = isParent && card && mainCardIdSet.has(card.id);
          const isTraineeConflict = Boolean(!isParent && card && isTraineeCard(card, targetChara));
          const charConflict = card
            ? findCharConflict((isParent ? parentSlots : mainSlots) as CardIndexEntry[], slotIndex, card)
            : null;

          return (
            <div
              key={slotIndex}
              style={{ viewTransitionName: deckSlotTransitionName(slotIndex) }}
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
                    <CardArtImage
                      src={card.imgUrl}
                      fallbackSrc={card.portraitUrl}
                      alt={cardLabel(card)}
                      className="w-full h-auto block object-contain select-none"
                      loading="lazy"
                    />
                    {isInMain && (
                      <span className="absolute top-2 right-2 z-20 rounded-md bg-amber-200/95 dark:bg-amber-950/95 px-2 py-0.5 text-[9px] font-bold text-amber-950 dark:text-amber-100 border border-amber-400/80 dark:border-amber-700 shadow-xs">
                        In Main
                      </span>
                    )}
                    {rentalSlot === slotIndex && <RentalBadge className="absolute bottom-2 left-2 z-20" />}
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
                        onClick={() => commands.inspectCard(card)}
                        className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                        title="Click to view and inspect all skills from this card"
                      >
                        {skillsByCard[card.id]
                          ? `${(skillsByCard[card.id]?.hintSkills?.length ?? 0) + (skillsByCard[card.id]?.eventSkills?.length ?? 0)} skills ↗`
                          : "Inspect skills ↗"}
                      </button>
                      <span className="flex items-center gap-2.5">
                        <button
                          type="button"
                          aria-pressed={rentalSlot === slotIndex}
                          className="text-[10px] font-medium text-zinc-400 hover:text-[#794016] dark:hover:text-amber-300 cursor-pointer transition-colors"
                          onClick={() => commands.toggleRental(slotIndex)}
                          title={rentalSlot === slotIndex ? "Stop treating this card as the borrowed rental" : "Treat this card as the borrowed rental (always MLB)"}
                        >
                          {rentalSlot === slotIndex ? "unmark rental" : "rental"}
                        </button>
                        <button
                          type="button"
                          className="text-[10px] font-medium text-zinc-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer transition-colors"
                          onClick={() => commands.removeCard(slotIndex)}
                        >
                          remove
                        </button>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 min-h-[260px] sm:min-h-[330px] items-center justify-center p-2 sm:p-3">
                  <div className="relative w-full">
                    <button
                      type="button"
                      className="flex w-full flex-col items-center justify-center gap-2 sm:gap-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-3.5 sm:p-5 text-zinc-400 dark:text-zinc-500 hover:border-emerald-400 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 cursor-pointer transition-all ease-out-quart duration-150 active:scale-[0.98]"
                      onClick={() => commands.openSlotPicker(slotIndex)}
                    >
                      <span className="grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 text-base sm:text-xl font-light">
                        +
                      </span>
                      <span className="text-[10px] sm:text-xs font-semibold">Pick Slot {slotIndex + 1}</span>
                      {rentalSlot === slotIndex && <span className="text-[10px] font-medium text-[#794016] dark:text-amber-300">Rental · any card, MLB</span>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      </>
      )}

      <MobileSheet open={mobileSlot !== null && Boolean(mobileCard)} onClose={commands.closeMobileSlot} title={mobileCard ? cardLabel(mobileCard) : "Support card"}>
        {mobileCard && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src={mobileCard.portraitUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
              <div className="min-w-0">
                <p className="font-semibold">{cardLabel(mobileCard)}</p>
                <p className="mt-0.5 text-xs text-zinc-400">{mobileCard.nameJp}</p>
                <p className="mt-1 text-xs text-zinc-500">{RARITY_META[mobileCard.rarity]?.label} · {formatCardType(mobileCard.type)}</p>
              </div>
            </div>
            <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <p className="mb-3 text-sm font-semibold">Event choices</p>
              <CardChainSelector card={mobileCard} mode={mode} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="min-h-11 rounded-xl border border-zinc-200 px-3 text-sm dark:border-zinc-700 cursor-pointer"
                onClick={commands.inspectCard ? () => { commands.inspectCard(mobileCard); commands.closeMobileSlot(); } : undefined}
              >
                Inspect skills
              </button>
              <button
                type="button"
                className="min-h-11 rounded-xl bg-emerald-700 px-3 text-sm font-semibold text-white cursor-pointer"
                onClick={commands.replaceFromMobile}
              >
                Replace card
              </button>
            </div>
            <button
              type="button"
              aria-pressed={rentalSlot === mobileSlot}
              className="min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm dark:border-zinc-700 cursor-pointer"
              onClick={() => { if (mobileSlot !== null) commands.toggleRental(mobileSlot); }}
            >
              {rentalSlot === mobileSlot ? "Unmark rental" : "Mark as rental (borrowed, MLB)"}
            </button>
            <button
              type="button"
              className="min-h-11 w-full text-sm text-rose-600 dark:text-rose-400 cursor-pointer"
              onClick={commands.removeFromMobile}
            >
              Remove from deck
            </button>
          </div>
        )}
      </MobileSheet>

      {/* Support Card Picker Modal */}
      {openSlot !== null && (
        <CardPickerPopover
          mode={mode}
          slotIndex={openSlot}
          initialAsRental={openSlot === rentalSlot}
          onPick={commands.pickCard}
          onClose={commands.closeSlotPicker}
        />
      )}

      {/* Expanded Card Skills Sheet */}
      {inspectCard && (
        <CardSkillsSheet
          card={inspectCard}
          isOpen={Boolean(inspectCard)}
          onClose={commands.closeInspect}
          mode={mode}
        />
      )}
    </section>
  );
}
