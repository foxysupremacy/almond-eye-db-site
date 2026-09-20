// State persistence and URL serialization for the Parenting Hub.
// Manages Trainee, Parents, Grandparent overrides, and Parent Support Deck slots.

import { useState, useEffect, useCallback, useContext } from "react";
import type { KyumaruVeteranItem } from "./kyumaru-types";
import {
  readJsonStorage,
  writeJsonStorage,
  notifyLocalUpdate,
  subscribeLocalUpdates,
} from "./persistence";
import { DeckContext } from "./deck/context";

export interface GrandparentSlot {
  card_id: number;
  name?: string;
  rank?: number;
  rarity?: number;
  win_saddle_id_array?: number[];
  trained_chara_id?: number;
  factor_info_array?: { factor_id: number }[];
  isBorrow?: boolean;
}

export interface ParentingSetup {
  targetCharaId: number | null;
  parent1: KyumaruVeteranItem | null;
  parent2: KyumaruVeteranItem | null;
  p1IsBorrow?: boolean;
  p2IsBorrow?: boolean;
  gpOverrides: {
    p1_gp1?: GrandparentSlot | null;
    p1_gp2?: GrandparentSlot | null;
    p2_gp1?: GrandparentSlot | null;
    p2_gp2?: GrandparentSlot | null;
  };
  supportCardIds: (number | null)[];
}

export type PickerSlotKey = "p1" | "p2" | "p1_gp1" | "p1_gp2" | "p2_gp1" | "p2_gp2";

export interface RunBorrowState {
  /** True when this run's single friend-borrow slot is already occupied. */
  used: boolean;
  /** Human label of the run the slot belongs to ("Target run", "P1 training run", …). */
  runLabel: string;
}

/**
 * "1 friend borrow per training run" accounting. Each pedigree slot belongs to
 * one training run, and each run allows exactly one borrow:
 * - Target run: the P1/P2 slots share one borrow.
 * - P1's run: P1's two grandparent slots share one borrow (same for P2's run).
 * Display-only — selection is never blocked.
 */
export function getRunBorrowState(
  setup: ParentingSetup,
  slotKey: PickerSlotKey
): RunBorrowState {
  switch (slotKey) {
    case "p1":
      return { used: !!setup.p2IsBorrow, runLabel: "Target run" };
    case "p2":
      return { used: !!setup.p1IsBorrow, runLabel: "Target run" };
    case "p1_gp1":
      return { used: !!setup.gpOverrides.p1_gp2?.isBorrow, runLabel: "P1 training run" };
    case "p1_gp2":
      return { used: !!setup.gpOverrides.p1_gp1?.isBorrow, runLabel: "P1 training run" };
    case "p2_gp1":
      return { used: !!setup.gpOverrides.p2_gp2?.isBorrow, runLabel: "P2 training run" };
    case "p2_gp2":
      return { used: !!setup.gpOverrides.p2_gp1?.isBorrow, runLabel: "P2 training run" };
  }
}

export const DEFAULT_PARENTING_SETUP: ParentingSetup = {
  targetCharaId: null,
  parent1: null,
  parent2: null,
  p1IsBorrow: false,
  p2IsBorrow: true,
  gpOverrides: {},
  supportCardIds: [null, null, null, null, null, null],
};

const STORAGE_KEY = "almondeye_parenting_setup";
const EVENT_KEY = "almondeye_parenting_updated";

export function loadParentingSetup(): ParentingSetup {
  const parsed = readJsonStorage<Partial<ParentingSetup>>(STORAGE_KEY);
  if (!parsed) return DEFAULT_PARENTING_SETUP;
  return {
      targetCharaId: parsed.targetCharaId ?? null,
      parent1: parsed.parent1 ?? null,
      parent2: parsed.parent2 ?? null,
      p1IsBorrow: parsed.p1IsBorrow ?? false,
      p2IsBorrow: parsed.p2IsBorrow ?? true,
      gpOverrides: parsed.gpOverrides ?? {},
    supportCardIds: Array.isArray(parsed.supportCardIds)
      ? parsed.supportCardIds
      : [null, null, null, null, null, null],
  };
}

export function saveParentingSetup(setup: ParentingSetup): void {
  writeJsonStorage(STORAGE_KEY, setup);
  notifyLocalUpdate(EVENT_KEY);
}

/** Serialize parenting setup to a URL-safe deflated Base64 hash */
export async function serializeParentingToHash(setup: ParentingSetup): Promise<string> {
  const minimalPayload = {
    t: setup.targetCharaId,
    p1: setup.parent1 ? setup.parent1.trained_chara_id || setup.parent1.card_id : null,
    p2: setup.parent2 ? setup.parent2.trained_chara_id || setup.parent2.card_id : null,
    b1: setup.p1IsBorrow ? 1 : 0,
    b2: setup.p2IsBorrow ? 1 : 0,
    gpo: setup.gpOverrides,
    cards: setup.supportCardIds,
  };

  const jsonStr = JSON.stringify(minimalPayload);
  const bytes = new TextEncoder().encode(jsonStr);

  const stream = new Response(
    new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"))
  );
  const compressedBuffer = await stream.arrayBuffer();
  const binary = String.fromCharCode(...new Uint8Array(compressedBuffer));
  const b64 = btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `parenting=${b64}`;
}

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

    return subscribeLocalUpdates(EVENT_KEY, handleUpdate);
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
