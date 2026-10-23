"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { api, type CardIndexEntry } from "@/lib/api";
import { useOwnedCards } from "@/app/common/hooks/use-owned-cards";
import { filterCollectionCards } from "../model/filters";
import type { CardTypeKey } from "../model/types";

export interface SupportsCollectionViewModelState {
  readonly cards: CardIndexEntry[];
  readonly loading: boolean;
  readonly query: string;
  readonly cardType: CardTypeKey;
  readonly cardRarity: number | "all";
  readonly ownedFirst: boolean;
  readonly isImportModalOpen: boolean;
  readonly filteredCards: CardIndexEntry[];
  readonly totalOwned: number;
  readonly mlbCount: number;
  readonly getLimitBreak: (cardId: number | string) => number | undefined;
}

export interface SupportsCollectionViewModelCommands {
  readonly setQuery: (q: string) => void;
  readonly setCardType: (type: CardTypeKey) => void;
  readonly setCardRarity: (rarity: number | "all") => void;
  readonly setOwnedFirst: (val: boolean | ((prev: boolean) => boolean)) => void;
  readonly openImportModal: () => void;
  readonly closeImportModal: () => void;
  readonly setLimitBreak: (cardId: number, lb: number) => void;
  readonly removeCard: (cardId: number) => void;
  readonly reload: () => Promise<void>;
}

export interface SupportsCollectionViewModel {
  readonly state: SupportsCollectionViewModelState;
  readonly commands: SupportsCollectionViewModelCommands;
}

export function useSupportsCollectionViewModel(): SupportsCollectionViewModel {
  const [cards, setCards] = useState<CardIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [cardType, setCardType] = useState<CardTypeKey>("all");
  const [cardRarity, setCardRarity] = useState<number | "all">("all");
  const [ownedFirst, setOwnedFirst] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const { getLimitBreak, setLimitBreak, removeCard, totalOwned, mlbCount } = useOwnedCards();

  const loadData = useCallback(async () => {
    try {
      const data = await api.listCardIndex();
      setCards(data);
    } catch (error) {
      console.error("Failed to load supports:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredCards = useMemo(
    () => filterCollectionCards(cards, query, cardType, cardRarity),
    [cards, query, cardRarity, cardType],
  );

  const openImportModal = useCallback(() => setIsImportModalOpen(true), []);
  const closeImportModal = useCallback(() => setIsImportModalOpen(false), []);

  return {
    state: {
      cards,
      loading,
      query,
      cardType,
      cardRarity,
      ownedFirst,
      isImportModalOpen,
      filteredCards,
      totalOwned,
      mlbCount,
      getLimitBreak,
    },
    commands: {
      setQuery,
      setCardType,
      setCardRarity,
      setOwnedFirst,
      openImportModal,
      closeImportModal,
      setLimitBreak,
      removeCard,
      reload: loadData,
    },
  };
}
