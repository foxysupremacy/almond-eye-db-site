import { describe, expect, test } from "bun:test";
import { charactersById } from "../data/registry";
import type { Course } from "../skill-engine/types";
import { buildLoopCandidates, branchSourceSlots, evaluateParentingBranch, type LoopAncestorSlot, type ParentingLoopConfig } from "./loop-planner";
import { aceGeneticTarget, compareMinmax, evaluateParentingMinmax, geneticRisk, suggestPinkReduction, type ParentingMinmaxContext, type MinmaxScore } from "./minmax";
import { resolveMinmaxPedigree } from "./minmax-context";
import { DEFAULT_PARENTING_SETUP } from "./state";
import type { KyumaruVeteranItem } from "../veterans/types";

export const arimaCourse: Course = { id: 1, terrain: 1, distance: 4, length: 2500, turn: 1, inout: 1, corners: [], straights: [], slopes: [] };
const character = charactersById.get(106802)!;
function context(): ParentingMinmaxContext {
  const config: ParentingLoopConfig = { geneGoals: {}, aptitudeGoals: {}, selectedSlots: {}, lockedSlots: {}, factorGoals: {}, includeTripleCrownAffinity: false, includeTiaraAffinity: false };
  for (const slot of branchSourceSlots("p1")) config.factorGoals![slot] = { pink: null, pinkStars: 0 };
  const parent = buildLoopCandidates([], [character])[0];
  parent.baseAptitude = Array(10).fill("A");
  return { config, ancestors: { p1: parent }, target: character, course: arimaCourse, runningStyle: 2 };
}
function dirt(context: ParentingMinmaxContext, total: number) {
  let remaining = total;
  for (const slot of branchSourceSlots("p1")) {
    const stars = Math.min(remaining, 3);
    context.config.factorGoals![slot] = { pink: stars ? "Dirt" : null, pinkStars: stars };
    remaining -= stars;
  }
}
function p1(context: ParentingMinmaxContext) { return evaluateParentingMinmax(context).slots.find((slot) => slot.slot === "p1")!; }

describe("parenting minmax genetics", () => {
  test("resolves Arima Turf/Long/Leader and leaves missing categories unknown", () => {
    expect(aceGeneticTarget(arimaCourse, 2)).toEqual({ surface: "Turf", distance: "Long", style: "Leader" });
    expect(aceGeneticTarget(null, 2)).toEqual({ surface: null, distance: null, style: "Leader" });
    expect(aceGeneticTarget(arimaCourse, 5).style).toBeNull();
    expect(aceGeneticTarget()).toEqual({ surface: null, distance: null, style: null });
    expect(aceGeneticTarget({ ...arimaCourse, distance: 2 }).distance).toBe("Mile");
    expect(aceGeneticTarget({ ...arimaCourse, distance: 0, length: 1400 }).distance).toBe("Sprint");
  });

  for (const stars of [0, 1, 3, 4, 5, 6, 7, 9, 10, 11, 12]) test(`${stars} stars keeps genetic risk distinct from aptitude thresholds`, () => {
    const ctx = context();
    ctx.ancestors.p1!.baseAptitude[1] = "G";
    dirt(ctx, stars);
    const forecast = p1(ctx).forecasts.find((entry) => entry.aptitude === "Dirt")!;
    expect(forecast.stars).toBe(stars);
    expect(forecast.risk).toBe(stars >= 12 ? "guaranteed" : stars >= 6 ? "frequent" : "low");
    const projection = evaluateParentingBranch("p1", ctx.ancestors, ctx.config).projections[1];
    expect(projection.projected).toBe(stars >= 10 ? "C" : stars >= 7 ? "D" : stars >= 4 ? "E" : stars >= 1 ? "F" : "G");
    ctx.ancestors.p1!.baseAptitude[1] = "A";
    expect(evaluateParentingBranch("p1", ctx.ancestors, ctx.config).projections[1].projected).toBe("A");
  });

  test("missing donors remain unknown but cannot undo a met risk threshold", () => {
    expect(geneticRisk(5, false)).toBe("unknown");
    expect(geneticRisk(6, false)).toBe("frequent");
    expect(geneticRisk(12, false)).toBe("guaranteed");
    const ctx = context();
    dirt(ctx, 6);
    delete ctx.config.factorGoals!.p1_gp2_g2;
    expect(p1(ctx).forecasts.find((entry) => entry.aptitude === "Dirt")?.complete).toBe(false);
    expect(p1(ctx).forecasts.find((entry) => entry.aptitude === "Dirt")?.risk).toBe("frequent");
  });

  test("only the protected P/GP slots are inspected, and their own pink is excluded", () => {
    const ctx = context();
    ctx.config.factorGoals!.p1 = { pink: "Dirt", pinkStars: 3 };
    ctx.config.factorGoals!.p2_gp1 = { pink: "Dirt", pinkStars: 3 };
    const ggp = buildLoopCandidates([{ card_id: character.id, factor_info_array: [{ factor_id: 5000203 }] } as KyumaruVeteranItem], [])[0];
    ctx.ancestors.p1_gp1_g1 = ggp;
    expect(evaluateParentingMinmax(ctx).slots).toHaveLength(6);
    expect(evaluateParentingMinmax(ctx).score.actualJunk).toBe(0);
    expect(p1(ctx).forecasts.find((entry) => entry.aptitude === "Dirt")?.stars).toBe(0);
  });

  test("actual junk stays visible after donor goals change; clean veterans do not reroll", () => {
    const ctx = context();
    ctx.ancestors.p1 = buildLoopCandidates([{ card_id: character.id, factor_info_array: [{ factor_id: 5000203 }, { factor_id: 5000501 }, { factor_id: 5000702 }] } as KyumaruVeteranItem], [])[0];
    expect(p1(ctx).actual.map((entry) => entry.aptitude)).toEqual(["Dirt", "Medium", "Runner"]);
    dirt(ctx, 12);
    expect(p1(ctx).forecasts.find((entry) => entry.aptitude === "Dirt")?.risk).toBe("guaranteed");
    expect(evaluateParentingMinmax(ctx).score.actualJunk).toBe(3);
    expect(evaluateParentingMinmax(ctx).score.guaranteed).toBe(0);
    dirt(ctx, 0);
    expect(p1(ctx).actual).toHaveLength(3);
    ctx.course = { ...arimaCourse, terrain: 2, distance: 3 };
    ctx.runningStyle = 1;
    expect(p1(ctx).actual).toHaveLength(0);
    ctx.ancestors.p1!.factorKnowledge = false;
    expect(p1(ctx).actualKnown).toBe(false);
  });

  test("selected off-target whites warn without changing the saved selection", () => {
    const ctx = context();
    ctx.config.slotWhiteTargets = { p1: ["Dirt", "Long"] };
    expect(p1(ctx).mismatchedTargets).toEqual(["Dirt"]);
    expect(ctx.config.slotWhiteTargets.p1).toEqual(["Dirt", "Long"]);
    ctx.course = null;
    expect(p1(ctx).mismatchedTargets).toHaveLength(0);
  });

  test("suggests a four-star patch for two aptitude ranks without mutating inputs", () => {
    const ctx = context();
    ctx.ancestors.p1!.baseAptitude[1] = "G";
    dirt(ctx, 6);
    const before = JSON.stringify(ctx);
    const suggestion = suggestPinkReduction(ctx, "p1", "Dirt")!;
    expect(suggestion.preservesAptitude).toBe(true);
    expect(suggestion.totalStars).toBe(4);
    expect(suggestion.changes).toHaveLength(1);
    expect(suggestion.lostG1).toBe(0);
    expect(JSON.stringify(ctx)).toBe(before);
    ctx.ancestors.p1!.baseAptitude[1] = "F";
    expect(suggestPinkReduction(ctx, "p1", "Dirt")!.totalStars).toBeLessThan(4);
  });

  test("reports aptitude and calendar tradeoffs when a ten-star patch is required", () => {
    const ctx = context();
    ctx.ancestors.p1!.baseAptitude[1] = "G";
    ctx.config.slotAptitudeGoals = { p1: { Dirt: "C" } };
    dirt(ctx, 12);
    const suggestion = suggestPinkReduction(ctx, "p1", "Dirt")!;
    expect(suggestion.preservesAptitude).toBe(false);
    expect(suggestion.aptitudeGaps).toBe(2);
    expect(suggestion.lostG1).toBeGreaterThan(0);
    expect(suggestion.totalStars).toBeLessThan(6);
    expect(suggestion.aptitudeChanges.find((entry) => entry.slot === "p1" && entry.aptitude === "Dirt")).toEqual({ slot: "p1", aptitude: "Dirt", before: "C", after: "E", required: "C" });
  });

  test("a low-risk reduction cannot be called safe if the planned output pink falls below A", () => {
    const ctx = context();
    ctx.ancestors.p1!.baseAptitude[1] = "E";
    ctx.config.factorGoals!.p1 = { pink: "Dirt", pinkStars: 3 };
    dirt(ctx, 12);
    expect(evaluateParentingBranch("p1", ctx.ancestors, ctx.config).needsOutputA).toBeNull();
    const suggestion = suggestPinkReduction(ctx, "p1", "Dirt")!;
    expect(suggestion.complete).toBe(true);
    expect(suggestion.preservesAptitude).toBe(false);
    expect(suggestion.aptitudeGaps).toBe(2);
    expect(suggestion.totalStars).toBeLessThan(6);
    expect(suggestion.aptitudeChanges.find((entry) => entry.slot === "p1" && entry.aptitude === "Dirt")).toEqual({ slot: "p1", aptitude: "Dirt", before: "A", after: "C", required: "A" });
  });

  test("replaces removed pink with an Ace target only when the donor can produce it", () => {
    const ctx = context();
    dirt(ctx, 12);
    for (const slot of branchSourceSlots("p1")) {
      ctx.ancestors[slot] = { ...ctx.ancestors.p1!, key: slot, name: slot, baseAptitude: Array(10).fill("A") };
    }
    const before = JSON.stringify(ctx);
    const suggestion = suggestPinkReduction(ctx, "p1", "Dirt")!;
    const removed = suggestion.changes.filter((change) => change.to === 0);
    expect(removed.length).toBeGreaterThan(0);
    expect(removed.every((change) => change.replacement?.pink === "Turf" && change.replacement.stars === change.from)).toBe(true);
    expect(suggestion.preservesAptitude).toBe(true);
    expect(JSON.stringify(ctx)).toBe(before);
    for (const slot of branchSourceSlots("p1")) {
      for (const index of [0, 5, 7]) ctx.ancestors[slot]!.baseAptitude[index] = "B";
    }
    expect(suggestPinkReduction(ctx, "p1", "Dirt")!.changes.every((change) => !change.replacement)).toBe(true);
    ctx.course = null;
    ctx.runningStyle = null;
    expect(suggestPinkReduction(ctx, "p1", "Dirt")).toBeNull();
  });

  test("details include aptitude decreases on every affected training branch", () => {
    const ctx = context();
    ctx.ancestors.p1!.baseAptitude[1] = "E";
    ctx.config.slotAptitudeGoals = { p1: { Dirt: "C" }, p1_gp1: { Dirt: "C" } };
    const gp = { ...ctx.ancestors.p1!, baseAptitude: [...ctx.ancestors.p1!.baseAptitude] };
    gp.baseAptitude[1] = "G";
    ctx.ancestors.p1_gp1 = gp;
    for (const slot of [...branchSourceSlots("p1"), ...branchSourceSlots("p1_gp1")]) ctx.config.factorGoals![slot] = { pink: "Dirt", pinkStars: 3 };
    for (const slot of branchSourceSlots("p1_gp1").filter((slot) => slot.split("_").length === 4)) ctx.config.factorGoals![slot] = { pink: null, pinkStars: 0 };
    const suggestion = suggestPinkReduction(ctx, "p1", "Dirt")!;
    expect(suggestion.aptitudeChanges.some((entry) => entry.slot === "p1" && entry.aptitude === "Dirt")).toBe(true);
    expect(suggestion.aptitudeChanges.some((entry) => entry.slot === "p1_gp1" && entry.aptitude === "Dirt")).toBe(true);
  });

  test("does not promise aptitude preservation with missing or other blocked branches", () => {
    const ctx = context();
    dirt(ctx, 6);
    delete ctx.config.factorGoals!.p1_gp2_g2;
    expect(suggestPinkReduction(ctx, "p1", "Dirt")!.preservesAptitude).toBe(false);
    expect(suggestPinkReduction(ctx, "p1", "Dirt")!.complete).toBe(false);
    const shared = buildLoopCandidates([], [character])[0];
    shared.baseAptitude = Array(10).fill("A");
    shared.baseAptitude[1] = "G";
    ctx.ancestors.p1_gp1 = shared;
    expect(suggestPinkReduction(ctx, "p1", "Dirt")!.preservesAptitude).toBe(false);
  });

  test("run substitution comparison prioritizes goals and junk before G1", () => {
    const clean: MinmaxScore = { aptitudeGaps: 0, actualJunk: 0, guaranteed: 0, frequent: 0, unknown: 0, g1: 1 };
    expect(compareMinmax(clean, { ...clean, actualJunk: 1, g1: 50 })).toBeLessThan(0);
    expect(compareMinmax({ ...clean, aptitudeGaps: 1 }, { ...clean, actualJunk: 1 })).toBeGreaterThan(0);
    expect(compareMinmax({ ...clean, guaranteed: 1 }, { ...clean, frequent: 3 })).toBeGreaterThan(0);
    expect(compareMinmax(clean, { ...clean, unknown: 1 })).toBeLessThan(0);
  });

  test("shared pedigree resolver uses GP captures, cleared-override fallback and saved templates", () => {
    const parent = { card_id: character.id, factor_info_array: [], succession_chara_array: [{ position_id: 10, card_id: character.id, factor_info_array: [{ factor_id: 5000203 }] }] } as unknown as KyumaruVeteranItem;
    const setup = { ...DEFAULT_PARENTING_SETUP, parent1: parent, gpOverrides: {}, loopConfig: { ...context().config, selectedSlots: { p2: `b:${character.id}` } } };
    const result = resolveMinmaxPedigree(setup, [], [character]);
    expect(result.ancestors.p1_gp1!.factorIds).toEqual([5000203]);
    expect(result.ancestors.p2!.source).toBe("borrow-placeholder");
    expect(resolveMinmaxPedigree({ ...setup, gpOverrides: { p1_gp1: null } }, [], [character]).ancestors.p1_gp1!.factorIds).toEqual([5000203]);
    expect(resolveMinmaxPedigree({ ...setup, gpOverrides: { p1_gp1: { card_id: character.id, factor_info_array: [] } } }, [], [character]).ancestors.p1_gp1!.factorIds).toEqual([]);
  });
});
