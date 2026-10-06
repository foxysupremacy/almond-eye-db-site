import { describe, expect, test } from "bun:test";
import { deserializeParentingFromHash, getRunBorrowState, normalizeLoopConfig, normalizeParentingSetup, DEFAULT_PARENTING_SETUP, serializeParentingToHash, type ParentingSetup } from "./state";
import { DEFAULT_APTITUDE_GOALS, type ParentingLoopConfig } from "./loop-planner";
import type { KyumaruVeteranItem } from "../veterans/types";

function makeSetup(overrides: Partial<ParentingSetup> = {}): ParentingSetup {
  return {
    targetCharaId: 1024,
    targetCharaCardId: null,
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

  test("each pair of GGP donor slots shares its own GP training run", () => {
    const setup = makeSetup({
      loopConfig: {
        geneGoals: {}, aptitudeGoals: DEFAULT_APTITUDE_GOALS, selectedSlots: {},
        lockedSlots: { p1_gp1_g1: "b:100101", p2_gp2_g2: "b:100201" },
        includeTripleCrownAffinity: false,
        includeTiaraAffinity: false,
      },
    });
    expect(getRunBorrowState(setup, "p1_gp1_g2")).toEqual({ used: true, runLabel: "P1 GP1 training run" });
    expect(getRunBorrowState(setup, "p1_gp2_g1").used).toBe(false);
    expect(getRunBorrowState(setup, "p2_gp2_g1")).toEqual({ used: true, runLabel: "P2 GP2 training run" });
  });

  test("terminal GGGP spark inputs have no borrow accounting", () => {
    const setup = makeSetup({ loopConfig: {
      geneGoals: {}, aptitudeGoals: DEFAULT_APTITUDE_GOALS, selectedSlots: {},
      lockedSlots: { p1_gp1_g1_g1: "b:100101", p2_gp2_g2_g2: "b:100201" },
      includeTripleCrownAffinity: false, includeTiaraAffinity: false,
    } });
    expect(getRunBorrowState(setup, "p1_gp1_g1_g2")).toEqual({ used: false, runLabel: "GGP spark inputs" });
    expect(getRunBorrowState(setup, "p1_gp1_g2_g1").used).toBe(false);
    expect(getRunBorrowState(setup, "p2_gp2_g2_g1")).toEqual({ used: false, runLabel: "GGP spark inputs" });
  });
});

describe("normalizeParentingSetup — exact costume and legacy data", () => {
  test("migrates legacy GGGP veteran factors, preserves manual spark choices and drops terminal locks", () => {
    const value: ParentingLoopConfig = { geneGoals: {}, aptitudeGoals: {}, selectedSlots: { p1_gp1_g1_g1: "v:77:55", p1_gp1_g1_g2: "v:77:55" }, lockedSlots: { p1_gp1_g1_g1: "v:77:55" }, factorGoals: { p1_gp1_g1_g2: { pink: "Mile", pinkStars: 2 } }, includeTripleCrownAffinity: false, includeTiaraAffinity: false };
    const veterans = [{ card_id: 103202, trained_chara_id: 77, create_time: 55, factor_info_array: [{ factor_id: 2403 }] } as unknown as KyumaruVeteranItem];
    const migrated = normalizeLoopConfig(value, veterans);
    expect(migrated.factorGoals?.p1_gp1_g1_g1).toEqual({ pink: "Long", pinkStars: 3 });
    expect(migrated.factorGoals?.p1_gp1_g1_g2).toEqual({ pink: "Mile", pinkStars: 2 });
    expect(migrated.selectedSlots).toEqual({});
    expect(migrated.lockedSlots).toEqual({});
    expect(normalizeLoopConfig(migrated, veterans)).toEqual(migrated);
  });

  test("new share links preserve per-slot C/D/E targets and terminal sparks without identities", async () => {
    const setup = normalizeParentingSetup({ loopConfig: { geneGoals: {}, aptitudeGoals: {}, selectedSlots: { p1: "r:103202" }, lockedSlots: {}, slotAptitudeGoals: { p1: { Dirt: "D", Turf: "C" }, p1_gp1: { Mile: "E" }, p1_gp1_g1: { Long: "D" } }, factorGoals: { p1_gp1_g1_g1: { pink: "Long", pinkStars: 3 }, p1_gp1_g1_g2: { pink: null, pinkStars: 0 } }, includeTripleCrownAffinity: false, includeTiaraAffinity: false } });
    const restored = await deserializeParentingFromHash(await serializeParentingToHash(setup));
    expect(restored.loopConfig?.slotAptitudeGoals).toEqual(setup.loopConfig?.slotAptitudeGoals);
    expect(restored.loopConfig?.factorGoals).toEqual(setup.loopConfig?.factorGoals);
    expect(restored.loopConfig?.selectedSlots).toEqual({ p1: "r:103202" });
  });

  test("normalizes an exact target costume without changing the affinity character id", () => {
    const setup = normalizeParentingSetup({
      targetCharaId: 1033,
      targetCharaCardId: 103302,
    });
    expect(setup.targetCharaId).toBe(1033);
    expect(setup.targetCharaCardId).toBe(103302);
  });

  test("loads legacy parenting data with no exact costume", () => {
    const setup = normalizeParentingSetup({ targetCharaId: 1033 });
    expect(setup.targetCharaId).toBe(1033);
    expect(setup.targetCharaCardId).toBeNull();
  });

  test("DEFAULT_PARENTING_SETUP has null targetCharaCardId", () => {
    expect(DEFAULT_PARENTING_SETUP.targetCharaCardId).toBeNull();
  });

  test("normalizes empty object to full defaults", () => {
    const setup = normalizeParentingSetup({});
    expect(setup.targetCharaId).toBeNull();
    expect(setup.targetCharaCardId).toBeNull();
    expect(setup.parent1).toBeNull();
    expect(setup.parent2).toBeNull();
    expect(setup.supportCardIds).toEqual([null, null, null, null, null, null]);
    expect(setup.loopConfig?.geneGoals).toEqual({});
    expect(setup.loopConfig?.lockedSlots).toEqual({});
  });

  test("persists editable loop goals and locks while old setups receive defaults", () => {
    const loopConfig: ParentingLoopConfig = {
      geneGoals: { distance: [50006], style: [50007], surface: [50002] },
      whiteFactorGoals: { 50006: 1, 50007: 1, 50002: 1 },
      aptitudeGoals: DEFAULT_APTITUDE_GOALS,
      factorGoals: { p1: { blue: 1, blueStars: 3, pink: "Mile", pinkStars: 2 }, p1_gp1: { blue: null, blueStars: 0, pink: null, pinkStars: 0 } },
      selectedSlots: { p1: "v:103202:" },
      lockedSlots: { p1_gp1: "v:103202:" },
      includeTripleCrownAffinity: true,
      includeTiaraAffinity: false,
    };
    expect(normalizeParentingSetup({ loopConfig }).loopConfig).toEqual({ ...loopConfig, slotAptitudeGoals: {}, slotWhiteTargets: {} });
    expect(normalizeParentingSetup({ targetCharaId: 1068 }).loopConfig).toEqual({
      slotAptitudeGoals: {}, slotWhiteTargets: {}, geneGoals: {}, whiteFactorGoals: {}, aptitudeGoals: DEFAULT_APTITUDE_GOALS, selectedSlots: {}, lockedSlots: {}, factorGoals: {}, includeTripleCrownAffinity: false, includeTiaraAffinity: false,
    });
  });

  test("share hash round-trips editable factor values and selected slots", async () => {
    const setup = normalizeParentingSetup({
      targetCharaId: 1033,
      parent1: { card_id: 103202, trained_chara_id: 77, create_time: 55, factor_info_array: [{ factor_id: 2403 }] } as unknown as KyumaruVeteranItem,
      loopConfig: {
        geneGoals: { distance: [50006], style: [], surface: [] }, whiteFactorGoals: { 50006: 2 }, aptitudeGoals: DEFAULT_APTITUDE_GOALS,
        factorGoals: { p1: { blue: 5, blueStars: 2, pink: "Long", pinkStars: 3 }, p2_gp2_g1: { blue: null, blueStars: 0, pink: null, pinkStars: 0 } },
        selectedSlots: { p1: "v:103202:", p1_gp1_g1_g2: "v:103202:" }, lockedSlots: { p1: "v:103202:", p1_gp1_g1_g2: "v:103202:" },
        includeTripleCrownAffinity: true, includeTiaraAffinity: false,
      },
    });
    const hash = await serializeParentingToHash(setup);
    const restored = await deserializeParentingFromHash(hash);
    expect(restored.targetCharaId).toBe(1033);
    expect(restored.parent1?.factor_info_array).toEqual([{ factor_id: 2403 }]);
    expect(restored.parent1?.create_time).toBe(55);
    expect(restored.loopConfig?.factorGoals).toEqual(setup.loopConfig?.factorGoals);
    expect(restored.loopConfig?.selectedSlots).toEqual({ p1: "v:103202:", p1_gp1_g1_g2: "v:103202:" });
    expect(restored.loopConfig?.whiteFactorGoals).toEqual({ 50006: 2 });
  });

  test("accepts all GGGP slots and upgrades legacy factor-family goals", () => {
    const setup = normalizeParentingSetup({ loopConfig: {
      geneGoals: { distance: [50006], style: [], surface: [] }, aptitudeGoals: DEFAULT_APTITUDE_GOALS,
      selectedSlots: { p1_gp1_g1_g2: "v:103202:" }, lockedSlots: { p1_gp1_g1_g2: "v:103202:" },
      includeTripleCrownAffinity: false, includeTiaraAffinity: false,
    } });
    expect(setup.loopConfig?.selectedSlots).toEqual({ p1_gp1_g1_g2: "v:103202:" });
    expect(setup.loopConfig?.whiteFactorGoals).toEqual({ 50006: 1 });
  });

  test("normalizes Blue star goals to zero through three stars", () => {
    const setup = normalizeParentingSetup({ loopConfig: {
      geneGoals: {}, aptitudeGoals: DEFAULT_APTITUDE_GOALS, selectedSlots: {}, lockedSlots: {},
      factorGoals: { p1: { blue: 3, blueStars: 4 }, p2: { blue: 2, blueStars: 0 } },
      includeTripleCrownAffinity: false, includeTiaraAffinity: false,
    } });
    expect(setup.loopConfig?.factorGoals).toEqual({ p1: { blue: 3 }, p2: { blue: 2, blueStars: 0 } });
  });

  test("legacy share hashes without factor data still restore with empty factor goals", async () => {
    const payload = new TextEncoder().encode(JSON.stringify({ t: 1068, tc: 106802, p1: 12345, p2: null, b1: 0, b2: 1, gpo: {}, cards: [null, 1] }));
    const compressed = await new Response(new Blob([payload]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer();
    const binary = String.fromCharCode(...new Uint8Array(compressed));
    const legacyHash = `parenting=${btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}`;
    const restored = await deserializeParentingFromHash(legacyHash);
    expect(restored.targetCharaId).toBe(1068);
    expect(restored.supportCardIds).toEqual([null, 1]);
    expect(restored.loopConfig?.factorGoals).toEqual({});
  });
});

test("white targets normalize valid Uma slots and aptitude keys without migrating global targets", async () => {
  const config = normalizeLoopConfig({ slotWhiteTargets: { p1: ["Medium", "Medium", "Turf", "Leader", "invalid"], p2: ["Dirt"], p1_gp1: ["Mile"], p2_gp2: ["Long"], p1_gp1_g1: ["Medium"], p1_gp1_g1_g1: ["Dirt"] }, whiteFactorGoals: { 10001: 3 } } as unknown as ParentingLoopConfig);
  expect(config.slotWhiteTargets).toEqual({ p1: ["Medium", "Turf", "Leader"], p2: ["Dirt"], p1_gp1: ["Mile"], p2_gp2: ["Long"] });
  expect(normalizeLoopConfig({ whiteFactorGoals: { 10001: 3 } } as unknown as ParentingLoopConfig).slotWhiteTargets).toEqual({});
  const encoded = await serializeParentingToHash(makeSetup({ loopConfig: config }));
  const decoded = await deserializeParentingFromHash(encoded, []);
  expect(decoded?.loopConfig?.slotWhiteTargets).toEqual(config.slotWhiteTargets);
});
