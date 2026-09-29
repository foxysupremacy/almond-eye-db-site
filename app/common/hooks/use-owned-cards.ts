"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

const STORAGE_KEY = "almondeye_owned_cards";

export function useOwnedCards() {
  const [ownedCards, setOwnedCards] = useState<Record<string, number>>({});

  const reload = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      setOwnedCards(raw ? JSON.parse(raw) : {});
    } catch {
      setOwnedCards({});
    }
  }, []);

  useEffect(() => {
    reload();

    const handleCustomUpdate = () => reload();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) reload();
    };

    window.addEventListener("almondeye_inventory_updated", handleCustomUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("almondeye_inventory_updated", handleCustomUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, [reload]);

  const saveCards = useCallback((updated: Record<string, number>) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setOwnedCards(updated);
      window.dispatchEvent(new Event("almondeye_inventory_updated"));
    } catch (err) {
      console.error("Failed to save owned cards:", err);
    }
  }, []);

  const getLimitBreak = useCallback(
    (cardId: number | string): number | undefined => {
      return ownedCards[String(cardId)];
    },
    [ownedCards]
  );

  const isOwned = useCallback(
    (cardId: number | string): boolean => {
      return ownedCards[String(cardId)] !== undefined;
    },
    [ownedCards]
  );

  const setLimitBreak = useCallback(
    (cardId: number | string, limitBreak: number) => {
      const clamped = Math.max(0, Math.min(4, Math.floor(limitBreak)));
      const next = { ...ownedCards, [String(cardId)]: clamped };
      saveCards(next);
    },
    [ownedCards, saveCards]
  );

  const removeCard = useCallback(
    (cardId: number | string) => {
      const next = { ...ownedCards };
      delete next[String(cardId)];
      saveCards(next);
    },
    [ownedCards, saveCards]
  );

  const toggleOwned = useCallback(
    (cardId: number | string) => {
      const strId = String(cardId);
      const current = ownedCards[strId];
      if (current === undefined) {
        // Not owned -> start at MLB (4★) or 0★? MLB is what most players want when adding an SSR, but let's cycle 4 -> 0 -> 1 -> 2 -> 3 -> 4
        setLimitBreak(strId, 4);
      } else if (current === 4) {
        setLimitBreak(strId, 0);
      } else {
        setLimitBreak(strId, current + 1);
      }
    },
    [ownedCards, setLimitBreak]
  );

  const clearAll = useCallback(() => {
    saveCards({});
  }, [saveCards]);

  const stats = useMemo(() => {
    const entries = Object.entries(ownedCards);
    const mlbCount = entries.filter(([_, lb]) => lb === 4).length;
    return {
      totalOwned: entries.length,
      mlbCount,
    };
  }, [ownedCards]);

  return {
    ownedCards,
    getLimitBreak,
    isOwned,
    setLimitBreak,
    removeCard,
    toggleOwned,
    clearAll,
    reload,
    totalOwned: stats.totalOwned,
    mlbCount: stats.mlbCount,
  };
}
