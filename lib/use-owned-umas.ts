"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

const STORAGE_KEY = "almondeye_owned_umas";

export function useOwnedUmas() {
  const [ownedUmas, setOwnedUmas] = useState<Record<string, [number, number]>>({});

  const reload = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      setOwnedUmas(raw ? JSON.parse(raw) : {});
    } catch {
      setOwnedUmas({});
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

  const saveUmas = useCallback((updated: Record<string, [number, number]>) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setOwnedUmas(updated);
      window.dispatchEvent(new Event("almondeye_inventory_updated"));
    } catch (err) {
      console.error("Failed to save owned umas:", err);
    }
  }, []);

  const getUmaDetails = useCallback(
    (cardId: number | string): [number, number] | undefined => {
      return ownedUmas[String(cardId)];
    },
    [ownedUmas]
  );

  const isOwned = useCallback(
    (cardId: number | string): boolean => {
      return ownedUmas[String(cardId)] !== undefined;
    },
    [ownedUmas]
  );

  const setUmaDetails = useCallback(
    (cardId: number | string, rarity: number, talent: number) => {
      const clampedRarity = Math.max(1, Math.min(5, Math.floor(rarity)));
      const clampedTalent = Math.max(1, Math.min(7, Math.floor(talent)));
      const next = { ...ownedUmas, [String(cardId)]: [clampedRarity, clampedTalent] as [number, number] };
      saveUmas(next);
    },
    [ownedUmas, saveUmas]
  );

  const removeUma = useCallback(
    (cardId: number | string) => {
      const next = { ...ownedUmas };
      delete next[String(cardId)];
      saveUmas(next);
    },
    [ownedUmas, saveUmas]
  );

  const toggleOwned = useCallback(
    (cardId: number | string, baseRarity = 3) => {
      const strId = String(cardId);
      const current = ownedUmas[strId];
      if (current === undefined) {
        setUmaDetails(strId, baseRarity, 5); // default to base rarity and talent Lv 5
      } else {
        removeUma(strId);
      }
    },
    [ownedUmas, setUmaDetails, removeUma]
  );

  const clearAll = useCallback(() => {
    saveUmas({});
  }, [saveUmas]);

  const stats = useMemo(() => {
    const entries = Object.entries(ownedUmas);
    const fiveStarCount = entries.filter(([_, [r]]) => r === 5).length;
    return {
      totalOwned: entries.length,
      fiveStarCount,
    };
  }, [ownedUmas]);

  return {
    ownedUmas,
    getUmaDetails,
    isOwned,
    setUmaDetails,
    removeUma,
    toggleOwned,
    clearAll,
    reload,
    totalOwned: stats.totalOwned,
    fiveStarCount: stats.fiveStarCount,
  };
}
