import { describe, expect, test } from "bun:test";
import { getRunBorrowState, type ParentingSetup } from "./parenting-state";

function makeSetup(overrides: Partial<ParentingSetup> = {}): ParentingSetup {
  return {
    targetCharaId: 1024,
    parent1: null,
    parent2: null,
    p1IsBorrow: false,
    p2IsBorrow: false,
    gpOverrides: {},
    supportCardIds: [null, null, null, null, null, null],
    ...overrides,
  };
}

describe("getRunBorrowState — 1 borrow per training run", () => {
  test("P1/P2 slots share the target run's single borrow", () => {
    // P2 borrowed (the default) → the target run's borrow is taken for P1 slot
    expect(getRunBorrowState(makeSetup({ p2IsBorrow: true }), "p1")).toEqual({
      used: true,
      runLabel: "Target run",
    });
    // P1 borrowed → taken for P2 slot
    expect(getRunBorrowState(makeSetup({ p1IsBorrow: true }), "p2")).toEqual({
      used: true,
      runLabel: "Target run",
    });
    // Neither borrowed → available for both parent slots
    expect(getRunBorrowState(makeSetup(), "p1").used).toBe(false);
    expect(getRunBorrowState(makeSetup(), "p2").used).toBe(false);
  });

  test("a borrowed GP only marks its own branch's run, not the target run", () => {
    const setup = makeSetup({
      gpOverrides: { p1_gp1: { card_id: 100101, isBorrow: true } },
    });

    // Sibling GP slot in the same branch sees the borrow as used
    expect(getRunBorrowState(setup, "p1_gp2")).toEqual({
      used: true,
      runLabel: "P1 training run",
    });
    // The other branch's run is untouched
    expect(getRunBorrowState(setup, "p2_gp1").used).toBe(false);
    expect(getRunBorrowState(setup, "p2_gp2").used).toBe(false);
    // The target run is untouched
    expect(getRunBorrowState(setup, "p1").used).toBe(false);
    expect(getRunBorrowState(setup, "p2").used).toBe(false);
  });

  test("the whole P2 branch can be borrowed: P2 + its GPs are separate runs", () => {
    const setup = makeSetup({
      p2IsBorrow: true,
      gpOverrides: { p2_gp2: { card_id: 100201, isBorrow: true } },
    });

    // P2 slot (target run borrow) is open until assigned even though a GP is borrowed
    expect(getRunBorrowState(setup, "p2_gp1")).toEqual({
      used: true,
      runLabel: "P2 training run",
    });
    expect(getRunBorrowState(setup, "p1_gp1").used).toBe(false);
    expect(getRunBorrowState(setup, "p1_gp2").used).toBe(false);
  });
});
