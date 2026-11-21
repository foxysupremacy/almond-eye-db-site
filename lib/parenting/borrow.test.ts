import { describe, expect, test } from "bun:test";
import { DEFAULT_PARENTING_SETUP, type ParentingSetup } from "./state";
import { applyBorrowedParent, selectLoopSlotInSetup } from "./borrow";
import type { KyumaruVeteranItem } from "../veterans/types";

const withLoop = (selected: Record<string, string>, extra: Partial<ParentingSetup> = {}): ParentingSetup => ({
  ...DEFAULT_PARENTING_SETUP,
  ...extra,
  loopConfig: {
    ...(DEFAULT_PARENTING_SETUP.loopConfig ?? {}),
    geneGoals: {},
    factorGoals: { p2_gp1: { blue: 1, blueStars: 3, pink: null, pinkStars: 0 } },
    selectedSlots: selected,
    lockedSlots: selected,
  } as ParentingSetup["loopConfig"],
});

describe("selectLoopSlotInSetup", () => {
  test("selects and locks the slot and derives factor goals from sparks", () => {
    const next = selectLoopSlotInSetup(withLoop({}), "p2", "b:111401", [{ factor_id: 203 }, { factor_id: 2402 }]);
    expect(next.loopConfig?.selectedSlots.p2).toBe("b:111401");
    expect(next.loopConfig?.lockedSlots?.p2).toBe("b:111401");
    expect(next.loopConfig?.factorGoals?.p2).toEqual({ blue: 2, blueStars: 3, pink: "Chaser", pinkStars: 2 });
  });

  test("clears descendants when the slot changes to a different candidate", () => {
    const next = selectLoopSlotInSetup(withLoop({ p2: "v:1:x", p2_gp1: "v:2:y" }), "p2", "b:111401");
    expect(next.loopConfig?.selectedSlots.p2_gp1).toBeUndefined();
    expect(next.loopConfig?.factorGoals?.p2_gp1).toBeUndefined();
    expect(next.loopConfig?.factorGoals?.p2).toBeUndefined();
  });
});

describe("applyBorrowedParent", () => {
  const vet = { card_id: 111401, rank: 81, rank_score: 1, speed: 1, stamina: 1, power: 1, guts: 1, wiz: 1, factor_info_array: [{ factor_id: 203, level: 0 }] } as KyumaruVeteranItem;

  test("sets P2 as a borrowed parent and resets its grandparent overrides", () => {
    const prev = withLoop({}, {
      gpOverrides: { ...DEFAULT_PARENTING_SETUP.gpOverrides, p2_gp1: { card_id: 1 } as never, p1_gp1: { card_id: 2 } as never },
      p2IsBorrow: false,
    });
    const next = applyBorrowedParent(prev, vet);
    expect(next.parent2).toBe(vet);
    expect(next.p2IsBorrow).toBe(true);
    expect(next.gpOverrides.p2_gp1).toBeNull();
    expect(next.gpOverrides.p2_gp2).toBeNull();
    expect(next.gpOverrides.p1_gp1).toEqual({ card_id: 2 } as never);
    expect(next.loopConfig?.selectedSlots.p2).toBe("b:111401");
  });
});
