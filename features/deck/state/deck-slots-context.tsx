"use client";

import { createContext, useContext } from "react";
import type {
  CardIndexEntry,
  CardSkills,
} from "@/lib/api";
import type {
  DeckSkill,
  ParentDeckSkill,
} from "@/lib/deck/types";
import type { ParentingSetup } from "@/lib/parenting/state";

export interface DeckSlotsContextValue {
  // Chain choices
  setChainChoice: (mode: "main" | "parent", cardId: number, eventId: number, choiceIndex: number) => void;
  getChainChoice: (mode: "main" | "parent", cardId: number, eventId: number, defaultChoiceIndex?: number) => number;
  resetCardChainChoices: (mode: "main" | "parent", cardId: number) => void;

  // Main Deck
  mainSlots: (CardIndexEntry | null)[];
  setMainCard: (index: number, card: CardIndexEntry | null) => void;
  clearMain: () => void;
  mainSkills: DeckSkill[];
  mainSkillIdSet: Set<number>;

  // Parent Deck
  parentSlots: (CardIndexEntry | null)[];
  setParentCard: (index: number, card: CardIndexEntry | null) => void;
  clearParent: () => void;
  copyMainToParent: () => void;
  parentSkills: ParentDeckSkill[];

  // Parenting Setup
  parentingSetup: ParentingSetup;
  setParentingSetup: (updater: ParentingSetup | ((prev: ParentingSetup) => ParentingSetup)) => void;

  allCards: CardIndexEntry[] | null;
  skillsByCard: Record<number, CardSkills | null>;
  loading: boolean;
}

export const DeckSlotsContext = createContext<DeckSlotsContextValue | null>(null);

export function useDeckSlots(): DeckSlotsContextValue {
  const ctx = useContext(DeckSlotsContext);
  if (!ctx) throw new Error("useDeckSlots must be used within a DeckProvider");
  return ctx;
}
