"use client";

import { useState, useEffect, useCallback, useContext } from "react";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";
import { DEFAULT_PARENTING_SETUP, loadParentingSetup, saveParentingSetup, PARENTING_EVENT_KEY, type ParentingSetup, type GrandparentSlot } from "@/lib/parenting/state";
import { DeckContext } from "@/features/deck/state";
import { subscribeLocalUpdates } from "@/lib/storage/persistence";

/** Hook for reactive subscription to parenting state */
export function useParentingSetup() {
  const deckCtx = useContext(DeckContext);

  const [setup, setSetup] = useState<ParentingSetup>(DEFAULT_PARENTING_SETUP);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (deckCtx) return;
    setSetup(loadParentingSetup());
    setLoaded(true);

    const handleUpdate = () => {
      setSetup(loadParentingSetup());
    };

    return subscribeLocalUpdates(PARENTING_EVENT_KEY, handleUpdate);
  }, [deckCtx]);

  const updateSetup = useCallback((updater: (prev: ParentingSetup) => ParentingSetup) => {
    if (deckCtx) {
      deckCtx.setParentingSetup(updater);
      return;
    }
    setSetup((prev) => {
      const next = updater(prev);
      saveParentingSetup(next);
      return next;
    });
  }, [deckCtx]);

  const setTargetCharaId = useCallback((id: number | null) => {
    updateSetup((prev) => ({
      ...prev,
      targetCharaId: id,
    }));
  }, [updateSetup]);

  const setTargetChara = useCallback(
    (selection: { charId: number; cardId: number } | null) => {
      updateSetup((prev) => ({
        ...prev,
        targetCharaId: selection?.charId ?? null,
        targetCharaCardId: selection?.cardId ?? null,
      }));
    },
    [updateSetup],
  );

  const setParent1 = useCallback((veteran: KyumaruVeteranItem | null) => {
    updateSetup((prev) => ({
      ...prev,
      parent1: veteran,
      // Clear manual GP overrides for P1 when switching parent
      gpOverrides: {
        ...prev.gpOverrides,
        p1_gp1: null,
        p1_gp2: null,
      },
    }));
  }, [updateSetup]);

  const setParent2 = useCallback((veteran: KyumaruVeteranItem | null) => {
    updateSetup((prev) => ({
      ...prev,
      parent2: veteran,
      // Clear manual GP overrides for P2 when switching parent
      gpOverrides: {
        ...prev.gpOverrides,
        p2_gp1: null,
        p2_gp2: null,
      },
    }));
  }, [updateSetup]);

  const setP1IsBorrow = useCallback((isBorrow: boolean) => {
    updateSetup((prev) => ({
      ...prev,
      p1IsBorrow: isBorrow,
    }));
  }, [updateSetup]);

  const setP2IsBorrow = useCallback((isBorrow: boolean) => {
    updateSetup((prev) => ({
      ...prev,
      p2IsBorrow: isBorrow,
    }));
  }, [updateSetup]);

  const setParentPair = useCallback((
    p1: KyumaruVeteranItem | null,
    p2: KyumaruVeteranItem | null,
    p1Borrow?: boolean,
    p2Borrow?: boolean
  ) => {
    updateSetup((prev) => ({
      ...prev,
      parent1: p1,
      parent2: p2,
      p1IsBorrow: p1Borrow !== undefined ? p1Borrow : prev.p1IsBorrow,
      p2IsBorrow: p2Borrow !== undefined ? p2Borrow : prev.p2IsBorrow,
      gpOverrides: {},
    }));
  }, [updateSetup]);

  const setFullPedigree = useCallback((
    p1: KyumaruVeteranItem | null,
    p2: KyumaruVeteranItem | null,
    p1_gp1: GrandparentSlot | null,
    p1_gp2: GrandparentSlot | null,
    p2_gp1: GrandparentSlot | null,
    p2_gp2: GrandparentSlot | null,
    p1Borrow?: boolean,
    p2Borrow?: boolean
  ) => {
    updateSetup((prev) => ({
      ...prev,
      parent1: p1,
      parent2: p2,
      p1IsBorrow: p1Borrow !== undefined ? p1Borrow : prev.p1IsBorrow,
      p2IsBorrow: p2Borrow !== undefined ? p2Borrow : prev.p2IsBorrow,
      gpOverrides: {
        p1_gp1,
        p1_gp2,
        p2_gp1,
        p2_gp2,
      },
    }));
  }, [updateSetup]);

  const setGpOverride = useCallback((
    slotKey: "p1_gp1" | "p1_gp2" | "p2_gp1" | "p2_gp2",
    gp: GrandparentSlot | null
  ) => {
    updateSetup((prev) => ({
      ...prev,
      gpOverrides: {
        ...prev.gpOverrides,
        [slotKey]: gp,
      },
    }));
  }, [updateSetup]);

  const setSupportCard = useCallback((index: number, cardId: number | null) => {
    updateSetup((prev) => {
      const cards = [...prev.supportCardIds];
      cards[index] = cardId;
      return { ...prev, supportCardIds: cards };
    });
  }, [updateSetup]);

  const resetParenting = useCallback(() => {
    const empty: ParentingSetup = {
      targetCharaId: null,
      targetCharaCardId: null,
      parent1: null,
      parent2: null,
      p1IsBorrow: false,
      p2IsBorrow: true,
      gpOverrides: {},
      supportCardIds: [null, null, null, null, null, null],
    };
    if (deckCtx) {
      deckCtx.setParentingSetup(empty);
      return;
    }
    saveParentingSetup(empty);
    setSetup(empty);
  }, [deckCtx]);

  return {
    setup: deckCtx ? deckCtx.parentingSetup : setup,
    loaded: deckCtx ? !deckCtx.loading : loaded,
    setTargetCharaId,
    setTargetChara,
    setParent1,
    setParent2,
    setParentPair,
    setFullPedigree,
    setP1IsBorrow,
    setP2IsBorrow,
    setGpOverride,
    setSupportCard,
    resetParenting,
    updateSetup,
  };
}
