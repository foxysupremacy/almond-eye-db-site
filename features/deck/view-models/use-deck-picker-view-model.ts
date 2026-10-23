import { useState, useMemo, useCallback } from "react";
import type { CardIndexEntry, CharacterIndexEntry } from "@/lib/api";
import { useDeck } from "@/features/deck/state";
import { useParentingSetup } from "@/features/parenting/hooks";
import { charactersByCharId, charactersById } from "@/lib/api";
import { resolveTargetCharacter } from "@/lib/parenting/pedigree-resolvers";

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
}

export interface DeckPickerViewModelCommands {
  readonly openSlotPicker: (slotIndex: number) => void;
  readonly closeSlotPicker: () => void;
  readonly pickCard: (card: CardIndexEntry) => void;
  readonly removeCard: (slotIndex: number) => void;
  readonly openMobileSlot: (slotIndex: number) => void;
  readonly closeMobileSlot: () => void;
  readonly inspectCard: (card: CardIndexEntry) => void;
  readonly closeInspect: () => void;
  readonly replaceFromMobile: () => void;
  readonly removeFromMobile: () => void;
  readonly clearParent: () => void;
  readonly copyMainToParent: () => void;
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
  } = useDeck();

  const { setup } = useParentingSetup();
  const targetChara = useMemo(() => {
    return resolveTargetCharacter(setup, charactersById, charactersByCharId);
  }, [setup]);

  const isParent = mode === "parent";
  const activeSlots = isParent ? parentSlots : mainSlots;
  const onPickCard = isParent ? setParentCard : setMainCard;

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

  const pickCard = useCallback((card: CardIndexEntry) => {
    if (openSlot == null) return;
    onPickCard(openSlot, card);
    setOpenSlot(null);
  }, [openSlot, onPickCard]);

  const removeCard = useCallback((slotIndex: number) => {
    onPickCard(slotIndex, null);
  }, [onPickCard]);

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
      onPickCard(mobileSlot, null);
      setMobileSlot(null);
    }
  }, [mobileSlot, onPickCard]);

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
      clearParent,
      copyMainToParent,
    },
  };
}
