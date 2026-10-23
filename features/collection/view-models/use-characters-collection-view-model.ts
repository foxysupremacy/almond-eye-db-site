"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { api, type CharacterIndexEntry } from "@/lib/api";
import { useOwnedUmas } from "@/app/common/hooks/use-owned-umas";
import { filterCollectionCharacters } from "../model/filters";

export interface CharactersCollectionViewModelState {
  readonly characters: CharacterIndexEntry[];
  readonly loading: boolean;
  readonly query: string;
  readonly charaRarity: number | "all";
  readonly ownedFirst: boolean;
  readonly isImportModalOpen: boolean;
  readonly filteredCharacters: CharacterIndexEntry[];
  readonly totalOwned: number;
  readonly fiveStarCount: number;
  readonly getUmaDetails: (cardId: number | string) => [number, number] | undefined;
}

export interface CharactersCollectionViewModelCommands {
  readonly setQuery: (q: string) => void;
  readonly setCharaRarity: (rarity: number | "all") => void;
  readonly setOwnedFirst: (val: boolean | ((prev: boolean) => boolean)) => void;
  readonly openImportModal: () => void;
  readonly closeImportModal: () => void;
  readonly setUmaDetails: (cardId: number | string, rarity: number, talentLevel: number) => void;
  readonly removeUma: (cardId: number | string) => void;
  readonly reload: () => Promise<void>;
}

export interface CharactersCollectionViewModel {
  readonly state: CharactersCollectionViewModelState;
  readonly commands: CharactersCollectionViewModelCommands;
}

export function useCharactersCollectionViewModel(): CharactersCollectionViewModel {
  const [characters, setCharacters] = useState<CharacterIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [charaRarity, setCharaRarity] = useState<number | "all">("all");
  const [ownedFirst, setOwnedFirst] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const { getUmaDetails, setUmaDetails, removeUma, totalOwned, fiveStarCount } = useOwnedUmas();

  const loadData = useCallback(async () => {
    try {
      const data = await api.listCharacters();
      setCharacters(data);
    } catch (error) {
      console.error("Failed to load characters:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredCharacters = useMemo(
    () => filterCollectionCharacters(characters, query, charaRarity),
    [characters, charaRarity, query],
  );

  const openImportModal = useCallback(() => setIsImportModalOpen(true), []);
  const closeImportModal = useCallback(() => setIsImportModalOpen(false), []);

  return {
    state: {
      characters,
      loading,
      query,
      charaRarity,
      ownedFirst,
      isImportModalOpen,
      filteredCharacters,
      totalOwned,
      fiveStarCount,
      getUmaDetails,
    },
    commands: {
      setQuery,
      setCharaRarity,
      setOwnedFirst,
      openImportModal,
      closeImportModal,
      setUmaDetails,
      removeUma,
      reload: loadData,
    },
  };
}
