// Pure Parenting setup transforms for loop-slot selection and borrowed parents.

import type { KyumaruVeteranItem } from "../veterans/types";
import { LOOP_ANCESTOR_SLOTS, type LoopAncestorSlot } from "./loop-planner";
import type { ParentingSetup } from "./state";

const PINK_BY_CODE = {
  11: "Turf", 12: "Dirt", 21: "Sprint", 22: "Mile", 23: "Medium", 24: "Long",
  31: "Runner", 32: "Leader", 33: "Betweener", 34: "Chaser",
} as const;

/**
 * Select and lock a loop-planner slot. Switching a slot to a different
 * candidate clears its descendants; spark factors (when given) seed the
 * slot's blue/pink goals.
 */
export function selectLoopSlotInSetup(
  prev: ParentingSetup,
  slot: LoopAncestorSlot,
  candidateKey: string,
  factors?: { factor_id: number }[],
): ParentingSetup {
  const factorGoals = { ...(prev.loopConfig?.factorGoals ?? {}) };
  const selectedSlots = { ...(prev.loopConfig?.selectedSlots ?? {}) };
  const lockedSlots = { ...(prev.loopConfig?.lockedSlots ?? {}) };
  if (selectedSlots[slot] && selectedSlots[slot] !== candidateKey) {
    for (const descendant of LOOP_ANCESTOR_SLOTS.filter((key) => key.startsWith(`${slot}_`))) {
      delete selectedSlots[descendant];
      delete lockedSlots[descendant];
      if (descendant.split("_").length < 4) delete factorGoals[descendant];
    }
  }
  if (factors) {
    const blueId = factors.find(({ factor_id }) => factor_id >= 101 && factor_id <= 503)?.factor_id;
    const pinkId = factors.find(({ factor_id }) => factor_id >= 1101 && factor_id <= 3403)?.factor_id;
    const pinkCode = pinkId == null ? 0 : Math.floor(pinkId / 100);
    const pink = PINK_BY_CODE[pinkCode as keyof typeof PINK_BY_CODE] ?? null;
    factorGoals[slot] = {
      blue: blueId == null ? null : Math.floor(blueId / 100),
      blueStars: blueId == null ? 0 : blueId % 10,
      pink,
      pinkStars: pinkId == null ? 0 : pinkId % 10,
    };
  } else delete factorGoals[slot];
  return {
    ...prev,
    loopConfig: {
      ...prev.loopConfig,
      geneGoals: prev.loopConfig?.geneGoals ?? {},
      factorGoals,
      selectedSlots: { ...selectedSlots, [slot]: candidateKey },
      lockedSlots: { ...lockedSlots, [slot]: candidateKey },
      aptitudeGoals: prev.loopConfig?.aptitudeGoals ?? {},
      includeTripleCrownAffinity: prev.loopConfig?.includeTripleCrownAffinity ?? false,
      includeTiaraAffinity: prev.loopConfig?.includeTiaraAffinity ?? false,
    },
  };
}

/** Put a shared (non-owned) veteran into the P2 slot as the run's borrowed parent. */
export function applyBorrowedParent(prev: ParentingSetup, veteran: KyumaruVeteranItem): ParentingSetup {
  const withSlot = selectLoopSlotInSetup(prev, "p2", `b:${veteran.card_id}`, veteran.factor_info_array);
  return {
    ...withSlot,
    parent2: veteran,
    p2IsBorrow: true,
    gpOverrides: { ...withSlot.gpOverrides, p2_gp1: null, p2_gp2: null },
  };
}
