import { useState, useMemo, useCallback } from "react";
import { flushSync } from "react-dom";
import { runViewTransition } from "@/app/common/motion/view-transition";
import type { CardIndexEntry, CharacterIndexEntry } from "@/lib/api";
import { useDeck } from "@/features/deck/state";
import { useParentingSetup } from "@/features/parenting/hooks";
import { charactersByCharId, charactersById } from "@/lib/api";
import { resolveTargetCharacter } from "@/lib/parenting/pedigree-resolvers";
import { useDeckSlotSize } from "@/features/deck/state/use-deck-slot-size";
import type { DeckSlotSize } from "@/lib/deck/slot-size-pref";
import { rentalSlotAfterPick } from "@/lib/deck/rental";

export interface DeckPickerViewModelState {
  readonly isParent: boolean;
  readonly activeSlots: readonly (CardIndexEntry | null)[];
  readonly mainSlots: readonly (CardIndexEntry | null)[];
  readonly parentSlots: readonly (CardIndexEntry | null)[];
  readonly openSlot: number | null;
  readonly mobileSlot: number | null;
  readonly mobileCard: CardIndexEntry | null;
  readonly inspectCard: CardIndexEntry | null;
  readonly targetChara: CharacterIndexEntry | null;
  readonly hasMainDeck: boolean;
  readonly hasParentDeck: boolean;
  readonly mainCardIdSet: ReadonlySet<number>;
  readonly skillsByCard: ReturnType<typeof useDeck>["skillsByCard"];
  /** Persisted Compact/Large slot layout, shared by Main and Parent Deck. */
  readonly slotSize: DeckSlotSize;
  /** Slot holding this deck's borrowed MLB card (null = no rental). */
  readonly rentalSlot: number | null;
}

export interface DeckPickerViewModelCommands {
  readonly openSlotPicker: (slotIndex: number) => void;
  readonly closeSlotPicker: () => void;
  /** `asRental` marks the slot as the rental; an owned pick into the rental slot clears the mark. */
  readonly pickCard: (card: CardIndexEntry, options?: { readonly asRental?: boolean }) => void;
  /** Marks the slot as this deck's rental, or unmarks it if it already is. */
  readonly toggleRental: (slotIndex: number) => void;
  readonly removeCard: (slotIndex: number) => void;
  readonly openMobileSlot: (slotIndex: number) => void;
  readonly closeMobileSlot: () => void;
  readonly inspectCard: (card: CardIndexEntry) => void;
  readonly closeInspect: () => void;
  readonly replaceFromMobile: () => void;
  readonly removeFromMobile: () => void;
  readonly clearParent: () => void;
  readonly copyMainToParent: () => void;
  readonly setSlotSize: (size: DeckSlotSize) => void;
}

export interface DeckPickerViewModel {
  readonly state: DeckPickerViewModelState;
  readonly commands: DeckPickerViewModelCommands;
}

export function useDeckPickerViewModel(mode: "main" | "parent" = "main"): DeckPickerViewModel {
  const {
    mainSlots,
    setMainCard,
    parentSlots,
    setParentCard,
    clearParent,
    copyMainToParent,
    skillsByCard,
    mainRentalSlot,
    parentRentalSlot,
    setRentalSlot,
  } = useDeck();

  const { setup } = useParentingSetup();
  const targetChara = useMemo(() => {
    return resolveTargetCharacter(setup, charactersById, charactersByCharId);
  }, [setup]);

  const [slotSize, storeSlotSize] = useDeckSlotSize();

  // Deck changes animate: slots carry deck-slot-* transition names, so they glide
  // between Compact and Large and morph when a card is picked or removed.
  const animateDeckChange = useCallback((update: () => void) => {
    runViewTransition(() => flushSync(update));
  }, []);

  const setSlotSize = useCallback((size: DeckSlotSize) => {
    if (size !== slotSize) animateDeckChange(() => storeSlotSize(size));
  }, [animateDeckChange, slotSize, storeSlotSize]);

  const isParent = mode === "parent";
  const activeSlots = isParent ? parentSlots : mainSlots;
  const onPickCard = isParent ? setParentCard : setMainCard;
  const deckKind = isParent ? "parent" : "main";
  const rentalSlot = isParent ? parentRentalSlot : mainRentalSlot;

  const [mobileSlot, setMobileSlot] = useState<number | null>(null);
  const mobileCard = mobileSlot !== null ? activeSlots[mobileSlot] : null;
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [inspectCard, setInspectCard] = useState<CardIndexEntry | null>(null);

  const openSlotPicker = useCallback((slotIndex: number) => {
    setOpenSlot(slotIndex);
  }, []);

  const closeSlotPicker = useCallback(() => {
    setOpenSlot(null);
  }, []);

  const pickCard = useCallback((card: CardIndexEntry, options?: { readonly asRental?: boolean }) => {
    if (openSlot == null) return;
    const slotIndex = openSlot;
    const nextRental = rentalSlotAfterPick(rentalSlot, slotIndex, Boolean(options?.asRental));
    setOpenSlot(null);
    animateDeckChange(() => {
      onPickCard(slotIndex, card);
      if (nextRental !== rentalSlot) setRentalSlot(deckKind, nextRental);
    });
  }, [openSlot, rentalSlot, onPickCard, animateDeckChange, setRentalSlot, deckKind]);

  const toggleRental = useCallback((slotIndex: number) => {
    setRentalSlot(deckKind, rentalSlot === slotIndex ? null : slotIndex);
  }, [deckKind, rentalSlot, setRentalSlot]);

  const removeCard = useCallback((slotIndex: number) => {
    animateDeckChange(() => onPickCard(slotIndex, null));
  }, [onPickCard, animateDeckChange]);

  const openMobileSlot = useCallback((slotIndex: number) => {
    setMobileSlot(slotIndex);
  }, []);

  const closeMobileSlot = useCallback(() => {
    setMobileSlot(null);
  }, []);

  const onInspectCard = useCallback((card: CardIndexEntry) => {
    setInspectCard(card);
  }, []);

  const closeInspect = useCallback(() => {
    setInspectCard(null);
  }, []);

  const replaceFromMobile = useCallback(() => {
    if (mobileSlot !== null) {
      setOpenSlot(mobileSlot);
      setMobileSlot(null);
    }
  }, [mobileSlot]);

  const removeFromMobile = useCallback(() => {
    if (mobileSlot !== null) {
      const slotIndex = mobileSlot;
      setMobileSlot(null);
      animateDeckChange(() => onPickCard(slotIndex, null));
    }
  }, [mobileSlot, onPickCard, animateDeckChange]);

  const animatedClearParent = useCallback(() => animateDeckChange(clearParent), [animateDeckChange, clearParent]);
  const animatedCopyMainToParent = useCallback(() => animateDeckChange(copyMainToParent), [animateDeckChange, copyMainToParent]);

  const mainCardIdSet = useMemo(() => {
    return new Set(mainSlots.filter(Boolean).map((c) => c!.id));
  }, [mainSlots]);

  const hasMainDeck = useMemo(() => mainSlots.some(Boolean), [mainSlots]);
  const hasParentDeck = useMemo(() => parentSlots.some(Boolean), [parentSlots]);

  return {
    state: {
      isParent,
      activeSlots,
      mainSlots,
      parentSlots,
      openSlot,
      mobileSlot,
      mobileCard,
      inspectCard,
      targetChara,
      hasMainDeck,
      hasParentDeck,
      mainCardIdSet,
      skillsByCard,
      slotSize,
      rentalSlot,
    },
    commands: {
      openSlotPicker,
      closeSlotPicker,
      pickCard,
      removeCard,
      openMobileSlot,
      closeMobileSlot,
      inspectCard: onInspectCard,
      closeInspect,
      replaceFromMobile,
      removeFromMobile,
      clearParent: animatedClearParent,
      copyMainToParent: animatedCopyMainToParent,
      setSlotSize,
      toggleRental,
    },
  };
}
