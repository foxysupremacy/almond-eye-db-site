import { describe, expect, test } from "bun:test";
import { charactersById, successionFactors } from "../data/registry";
import { decodeFactor } from "../lineage/factor-decoder";
import type { KyumaruVeteranItem } from "../veterans/types";
import { DEFAULT_APTITUDE_GOALS, LOOP_ANCESTOR_SLOTS, LOOP_UMA_SLOTS, evaluateParentingBranch, buildLoopCandidates, branchSourceSlots, planParentingLoop, type LoopAncestorSlot, type ParentingLoopRequest } from "./loop-planner";

const FIXTURE_IDS = {
  target: 106802, p1: 114101, p2: 107702,
  p1_gp1: 103202, p1_gp2: 102303, p2_gp1: 102002, p2_gp2: 102602,
  p1_gp1_g1: 101401, p1_gp1_g2: 100601,
  p1_gp2_g1: 101401, p1_gp2_g2: 100601,
  p2_gp1_g1: 101401, p2_gp1_g2: 103402,
  p2_gp2_g1: 101401, p2_gp2_g2: 103402,
  p1_gp1_g1_g1: 101401, p1_gp1_g1_g2: 103402, p1_gp1_g2_g1: 101401, p1_gp1_g2_g2: 103402,
  p1_gp2_g1_g1: 101401, p1_gp2_g1_g2: 103402, p1_gp2_g2_g1: 101401, p1_gp2_g2_g2: 103402,
  p2_gp1_g1_g1: 101401, p2_gp1_g1_g2: 103402, p2_gp1_g2_g1: 101401, p2_gp1_g2_g2: 103402,
  p2_gp2_g1_g1: 101401, p2_gp2_g1_g2: 103402, p2_gp2_g2_g1: 101401, p2_gp2_g2_g2: 103402,
} satisfies Record<"target" | LoopAncestorSlot, number>;

function makeVeteran(cardId: number, factors: number[] = []): KyumaruVeteranItem {
  return {
    card_id: cardId, trained_chara_id: cardId, name: charactersById.get(cardId)?.nameEn,
    rank: 6, rank_score: 10000, speed: 1000, stamina: 1000, power: 1000, guts: 1000, wiz: 1000,
    proper_ground_dirt: 3, proper_distance_mile: 5, proper_distance_middle: 5, proper_distance_long: 5,
    factor_info_array: factors.map((factor_id) => ({ factor_id })),
    succession_chara_array: [
      { position_id: 10, card_id: cardId, factor_info_array: [] },
      { position_id: 20, card_id: cardId, factor_info_array: [] },
    ],
    skill_array: [{ skill_id: 200012, level: 1 }], win_saddle_id_array: [16],
  };
}

function fixtureRequest(): ParentingLoopRequest {
  const roster = Object.values(FIXTURE_IDS).map((id) => charactersById.get(id)).filter((entry) => entry != null);
  const factorBySlot: Partial<Record<LoopAncestorSlot, number[]>> = {
    p1: [5000603, 103, 2403], p2: [5000703, 3403],
    p1_gp1: [5000603, 2403], p1_gp2: [5000703, 2403],
    p2_gp1: [5000603, 5000703, 3103], p2_gp2: [5000603, 5000703, 3103],
  };
  const veterans = [...new Set(Object.entries(FIXTURE_IDS).filter(([slot]) => slot !== "target").map(([, id]) => id))]
    .map((id) => {
      const slot = Object.entries(FIXTURE_IDS).find(([key, value]) => key !== "target" && value === id)?.[0] as LoopAncestorSlot;
      return makeVeteran(id, factorBySlot[slot] ?? []);
    });
  const lockedSlots: Partial<Record<LoopAncestorSlot, string>> = {};
  for (const slot of LOOP_ANCESTOR_SLOTS) lockedSlots[slot] = `v:${FIXTURE_IDS[slot]}:`;
  return {
    target: charactersById.get(FIXTURE_IDS.target)!, veterans, roster,
    course: null, runningStyle: 1, mainDeckSkillIds: [200012], mode: "generate",
    config: {
      geneGoals: { distance: [50006], style: [50007], surface: [50001] }, aptitudeGoals: DEFAULT_APTITUDE_GOALS, selectedSlots: {}, lockedSlots,
      includeTripleCrownAffinity: true, includeTiaraAffinity: true,
    },
  };
}

describe("parenting loop optimizer", () => {
  test("Minmax retains a clean low-blue run before candidate and beam pruning", () => {
    const request = fixtureRequest();
    delete request.config.lockedSlots.p1;
    request.config.factorGoals = {};
    request.runningStyle = 1;
    request.roster = [];
    request.veterans = request.veterans.map((veteran) => ({ ...veteran,
      factor_info_array: [...veteran.factor_info_array!, { factor_id: 5000803 }],
      proper_ground_turf: 7, proper_ground_dirt: 7, proper_distance_short: 7, proper_distance_mile: 7,
      proper_distance_middle: 7, proper_distance_long: 7, proper_running_style_nige: 7,
      proper_running_style_senko: 7, proper_running_style_sashi: 7, proper_running_style_oikomi: 7,
    }));
    const dirty = request.veterans.find((veteran) => veteran.card_id === FIXTURE_IDS.p1)!;
    for (let index = 0; index < 20; index++) request.veterans.push({ ...dirty, trained_chara_id: 900000 + index, rank_score: 50000 });
    const clean = { ...dirty, trained_chara_id: 999999, rank_score: 1000, factor_info_array: [{ factor_id: 101 }, { factor_id: 2403 }] };
    request.veterans.push(clean);
    const result = planParentingLoop(request);
    expect(result.blueprints[0].ancestors.p1.veteran?.trained_chara_id).toBe(clean.trained_chara_id);
    expect(result.blueprints[0].minmax.slots.find((slot) => slot.slot === "p1")?.actual).toHaveLength(0);
  });
  test("a Uma's pink factor boosts its child, not its own aptitude projection", () => {
    const config = fixtureRequest().config;
    const gp = buildLoopCandidates([makeVeteran(FIXTURE_IDS.p1_gp1)], [])[0];
    const parent = buildLoopCandidates([makeVeteran(FIXTURE_IDS.p1)], [])[0];
    gp.baseAptitude = Array(10).fill("G");
    parent.baseAptitude = Array(10).fill("G");
    config.factorGoals = Object.fromEntries(
      [...new Set([...branchSourceSlots("p1"), ...branchSourceSlots("p1_gp1")])]
        .map((slot) => [slot, { pink: null, pinkStars: 0 }]),
    );
    config.factorGoals.p1_gp1 = { pink: "Mile", pinkStars: 3 };

    const gpAssessment = evaluateParentingBranch("p1_gp1", { p1_gp1: gp }, config);
    const parentAssessment = evaluateParentingBranch("p1", { p1: parent, p1_gp1: gp }, config);
    const gpMile = gpAssessment.projections.find((entry) => entry.aptitude === "Mile")!;
    const parentMile = parentAssessment.projections.find((entry) => entry.aptitude === "Mile")!;

    expect(gpMile.availablePinkStars).toBe(0);
    expect(gpMile.projected).toBe("G");
    expect(parentMile.availablePinkStars).toBe(3);
    expect(parentMile.projected).toBe("F");
  });

  test("GGP and GGGP pink sparks improve the GP aptitude and white genetic assessment", () => {
    const request = fixtureRequest();
    const sourceSlots = branchSourceSlots("p1_gp1");
    const gp = buildLoopCandidates([makeVeteran(FIXTURE_IDS.p1_gp1)], [])[0];
    gp.baseAptitude = Array(10).fill("G");
    const sources = Object.fromEntries(sourceSlots.map((slot) => [slot, { factorIds: [], factorKnowledge: true }])) as Partial<Record<LoopAncestorSlot, ReturnType<typeof buildLoopCandidates>[number]>>;
    const before = evaluateParentingBranch("p1_gp1", { ...sources, p1_gp1: gp }, request.config);
    request.config.factorGoals = Object.fromEntries(sourceSlots.map((slot) => [slot, { pink: "Mile", pinkStars: 3 }]));
    const after = evaluateParentingBranch("p1_gp1", { ...sources, p1_gp1: gp }, request.config);

    expect(after.sourceSlots).toContain("p1_gp1_g1");
    expect(after.sourceSlots).toContain("p1_gp1_g1_g1");
    expect(after.projections.find((entry) => entry.aptitude === "Mile")?.availablePinkStars).toBe(18);
    expect(after.projections.find((entry) => entry.aptitude === "Mile")?.projected).not.toBe(before.projections.find((entry) => entry.aptitude === "Mile")?.projected);
    expect(after.whiteFactors.find((entry) => entry.name === "Mile")?.status).toBe("guaranteed");
  });

  test("terminal sparks work without Uma selections and only the immediate lineage contributes", () => {
    const config = fixtureRequest().config;
    config.factorGoals = Object.fromEntries(LOOP_ANCESTOR_SLOTS.map((slot) => [slot, { pink: "Long", pinkStars: 3 }]));
    const partial = evaluateParentingBranch("p1_gp1_g1", {}, config);
    expect(partial.sourceSlots).toEqual(["p1_gp1_g1_g1", "p1_gp1_g1_g2"]);
    expect(partial.partialLineage).toBe(true);
    expect(partial.whiteFactors.find((entry) => entry.name === "Long")?.status).toBe("possible");
    expect(partial.g1.unknown).toBe(true);
    for (const slot of ["p1", "p1_gp1", "target"] as const) {
      const branch = evaluateParentingBranch(slot, {}, config);
      expect(branch.sourceSlots).toHaveLength(6);
      expect(branch.whiteFactors.find((entry) => entry.name === "Long")?.availablePinkStars).toBe(18);
    }
    expect(branchSourceSlots("p1_gp1")).not.toContain("p2_gp1_g1");
  });

  test("per-slot targets report missing stars without applying old global goals", () => {
    const request = fixtureRequest();
    const candidate = buildLoopCandidates([makeVeteran(FIXTURE_IDS.p1_gp1_g1)], [])[0];
    candidate.baseAptitude = Array(10).fill("G");
    request.config.factorGoals = { p1_gp1_g1_g1: { pink: "Dirt", pinkStars: 3 }, p1_gp1_g1_g2: { pink: "Dirt", pinkStars: 3 } };
    request.config.aptitudeGoals = { Dirt: "S" };
    const tree = { p1_gp1_g1: candidate };
    let branch = evaluateParentingBranch("p1_gp1_g1", tree, request.config);
    expect(branch.projections.find((entry) => entry.aptitude === "Dirt")?.targetStatus).toBe("met");
    request.config.slotAptitudeGoals = { p1_gp1_g1: { Dirt: "C" }, p1_gp1_g2: { Dirt: "D" } };
    branch = evaluateParentingBranch("p1_gp1_g1", tree, request.config);
    const dirt = branch.projections.find((entry) => entry.aptitude === "Dirt")!;
    expect(dirt.projected).toBe("E");
    expect(dirt.targetStatus).toBe("unmet");
    expect(dirt.missingPinkStars).toBe(4);
  });

  test("white thresholds distinguish missing data, known shortfall, 6 and 12 stars", () => {
    const config = fixtureRequest().config;
    config.factorGoals = { p1_gp1_g1_g1: { pink: "Turf", pinkStars: 3 } };
    const white = () => evaluateParentingBranch("p1_gp1_g1", {}, config).whiteFactors.find((entry) => entry.name === "Turf")!;
    expect(white().status).toBe("unknown");
    config.factorGoals.p1_gp1_g1_g2 = { pink: null, pinkStars: 0 };
    expect(white().status).toBe("insufficient");
    config.factorGoals.p1_gp1_g1_g2 = { pink: "Turf", pinkStars: 3 };
    expect(white().status).toBe("possible");
    for (const slot of branchSourceSlots("p1_gp1").slice(0, 4)) config.factorGoals[slot] = { pink: "Turf", pinkStars: 3 };
    const gp = evaluateParentingBranch("p1_gp1", {}, config);
    expect(gp.whiteFactors.find((entry) => entry.name === "Turf")?.status).toBe("guaranteed");
    expect(gp.whiteFactors).toHaveLength(10);
    expect(LOOP_UMA_SLOTS).toHaveLength(14);
  });

  test("MDB factors keep aptitude sparks and three gene families distinct", () => {
    expect(decodeFactor(2403).type).toBe("pink");
    expect(decodeFactor(5000603).type).toBe("distance");
    expect(decodeFactor(5000103).type).toBe("surface");
    expect(decodeFactor(5000703).type).toBe("style");
    expect(successionFactors.aptitudeThresholds.map((row) => [row.minStars, row.maxStars, row.addRank])).toEqual([
      [1, 3, 1], [4, 6, 2], [7, 9, 3], [10, 999, 4],
    ]);
  });

  test("Kitasan alt 2 fixture resolves fourteen Uma slots and fifteen runs without terminal identities", () => {
    const result = planParentingLoop(fixtureRequest());
    expect(result.blueprints).toHaveLength(1); // every fixture slot is locked, so alternatives would violate locks
    const plan = result.blueprints[0];
    expect(plan.ancestors.p1.cardId).toBe(114101); // Epiphaneia original
    expect(plan.ancestors.p2.cardId).toBe(107702); // Narita Top Road Xmas
    expect(plan.ancestors.p1_gp1.cardId).toBe(103202); // summer Tachyon
    expect(plan.ancestors.p1_gp2.cardId).toBe(102303); // Mecha Biwa
    expect(plan.ancestors.p2_gp1.cardId).toBe(102002); // ballroom Seiun
    expect(plan.ancestors.p2_gp2.cardId).toBe(102602); // Valentine Bourbon
    expect(plan.ancestors.p1_gp1_g1.cardId).toBe(101401); // Pasa repeats by run
    expect(plan.ancestors.p1_gp2_g1.cardId).toBe(101401);
    expect(plan.trainingSteps).toHaveLength(15);
    expect(plan.trainingSteps.slice(0, 8).every((step) => step.donorSlots.every((slot) => slot.split("_").length === 4))).toBe(true);
    expect(plan.trainingSteps.every((step) => step.borrowCount <= 1)).toBe(true);
    expect(plan.floorMet).toBe(false); // base aptitudes, not veteran training ranks, drive the new plan
    expect(Object.keys(plan.ancestors)).toHaveLength(14);
    expect(plan.deckSkillOverlap.some((entry) => entry.skillId === 200012)).toBe(true);
    expect(plan.geneCoverage.distance.count).toBeGreaterThan(0);
    expect(plan.eligibleG1).toHaveLength(15);
    expect(plan.g1OpportunityCount).toBeGreaterThan(0);
    expect(plan.affinityBreakdown.tripleCrown).toBeGreaterThan(0);
    expect(plan.aptitudeSparkCoverage.some((spark) => spark.factorGroupId === 24)).toBe(true);
    expect(plan.targetAptitude).toHaveLength(10);
    expect(plan.parentAptitude.p1).toHaveLength(10);
    expect(plan.trainingSteps.at(-1)?.racePlan.races).toHaveLength(0);
    expect(plan.trainingSteps.slice(0, 6).every((step) => step.racePlan.races.every((race) => race.donorSlots.length > 0))).toBe(true);
  });

  test("white-factor appearances are derived for all aptitudes without white rarity goals", () => {
    const request = fixtureRequest();
    request.config.whiteFactorGoals = { 50006: 3 };
    request.config.factorGoals = {
      ...request.config.factorGoals,
      p1_gp1_g1_g1: { pink: "Long", pinkStars: 3 },
      p1_gp1_g1_g2: { pink: "Long", pinkStars: 3 },
      p1_gp1_g2_g1: { pink: "Long", pinkStars: 3 },
      p1_gp1_g2_g2: { pink: "Long", pinkStars: 3 },
    };
    const outputs = planParentingLoop(request).blueprints[0].whiteFactorProduction;
    const ggp1 = outputs.find((entry) => entry.factorGroupId === 50006 && entry.traineeSlot === "p1_gp1_g1");
    expect(Object.hasOwn(ggp1!, "requestedStars")).toBe(false);
    expect(ggp1?.availablePinkStars).toBe(6);
    expect(ggp1?.status).toBe("possible");
    expect(ggp1?.projectedAptitude).toBe("A");
    expect(outputs.filter((entry) => entry.factorGroupId === 50006)).toHaveLength(15);
  });

  test("red aptitude projection follows all four star thresholds and stops at A", () => {
    const sources = ["p1", "p2", "p1_gp1", "p1_gp2", "p2_gp1", "p2_gp2"] as const;
    const cases = [[1, 1], [3, 1], [4, 2], [6, 2], [7, 3], [9, 3], [10, 4], [12, 4]] as const;
    for (const [stars, expectedRank] of cases) {
      const request = fixtureRequest();
      request.target = { ...request.target, aptitude: ["G", "G", "G", "G", "G", "G", "G", "G", "G", "G"] };
      const goals: NonNullable<typeof request.config.factorGoals> = {};
      let remaining = stars;
      for (const slot of sources) {
        const selectedStars = Math.min(3, remaining);
        if (selectedStars > 0) goals[slot] = { pink: "Long", pinkStars: selectedStars };
        else goals[slot] = { pink: null, pinkStars: 0 };
        remaining -= selectedStars;
      }
      request.config.factorGoals = goals;
      const projected = planParentingLoop(request).blueprints[0].targetAptitude.find((entry) => entry.aptitude === "Long");
      expect(projected?.availablePinkStars).toBe(stars);
      expect(projected?.projected).toBe(["G", "F", "E", "D", "C"][expectedRank]);
    }

    const capRequest = fixtureRequest();
    capRequest.target = { ...capRequest.target, aptitude: ["G", "G", "G", "G", "G", "A", "G", "G", "G", "G"] };
    capRequest.config.factorGoals = Object.fromEntries(sources.map((slot) => [slot, { pink: "Long", pinkStars: 3 }]));
    expect(planParentingLoop(capRequest).blueprints[0].targetAptitude.find((entry) => entry.aptitude === "Long")?.projected).toBe("A");
  });

  test("parent projection stays unknown when a required great-grandparent has no factor data", () => {
    const request = fixtureRequest();
    request.config.lockedSlots.p1_gp1_g1 = `r:${FIXTURE_IDS.p1_gp1_g1}`;
    const result = planParentingLoop(request).blueprints[0];
    expect(result.parentAptitude.p1.every((entry) => entry.confidence === "unknown")).toBe(true);
  });

  test("red aptitude and star goals contribute to alternative ranking", () => {
    const request = fixtureRequest();
    delete request.config.lockedSlots.p1;
    request.config.factorGoals = { p1: { pink: "Long", pinkStars: 3 } };
    const result = planParentingLoop(request);
    expect(result.blueprints[0].ancestors.p1.factorIds).toContain(2403);
    expect(result.blueprints[0].factorGoalScore).toBeGreaterThan(0);
  });

  test("blue aptitude and exact star goals contribute to alternative ranking", () => {
    const request = fixtureRequest();
    request.config.factorGoals = { p1: { blue: 1, blueStars: 3 } };
    expect(planParentingLoop(request).blueprints[0].factorGoalScore).toBe(5000);

    request.config.factorGoals = { p1: { blue: 1, blueStars: 2 } };
    expect(planParentingLoop(request).blueprints[0].factorGoalScore).toBe(-5000);
  });

  test("warns when a parent's planned red factor aptitude remains below A", () => {
    const request = fixtureRequest();
    request.config.factorGoals = { p1: { pink: "Dirt", pinkStars: 1 } };
    const result = planParentingLoop(request).blueprints[0];
    expect(result.parentAptitude.p1.find((entry) => entry.aptitude === "Dirt")?.needsOutputA).toBe(true);
  });

  test("comparison keeps the user's tree as the current baseline and ranks alternatives after it", () => {
    const request = fixtureRequest();
    request.config.lockedSlots = { ...request.config.lockedSlots };
    delete request.config.lockedSlots.p1_gp1;
    request.current = Object.fromEntries(LOOP_ANCESTOR_SLOTS.map((slot) => [slot, `v:${FIXTURE_IDS[slot]}:`]));
    const result = planParentingLoop(request);
    expect(result.blueprints.length).toBeGreaterThan(1);
    expect(result.blueprints[0].isCurrent).toBe(true);
    expect(result.blueprints[0].ancestors.p1_gp1.cardId).toBe(FIXTURE_IDS.p1_gp1);
    expect(result.blueprints.slice(1).some((plan) => plan.ancestors.p1_gp1.cardId !== FIXTURE_IDS.p1_gp1)).toBe(true);
  });

  test("uses roster base aptitude with known donor sparks and keeps optional crown scoring optional", () => {
    const request = fixtureRequest();
    request.config.lockedSlots.p1 = "r:114101";
    const scored = planParentingLoop(request).blueprints[0];
    expect(scored.aptitudeFloorGaps.find((gap) => gap.slot === "p1" && gap.aptitude === "Turf")?.status).toBe("met");
    expect(scored.aptitudeFloorGaps.find((gap) => gap.slot === "p1" && gap.aptitude === "Dirt")?.status).toBe("unmet");
    expect(scored.floorMet).toBe(false);
    request.config.includeTripleCrownAffinity = false;
    request.config.includeTiaraAffinity = false;
    const withoutOptionalTieBreak = planParentingLoop(request).blueprints[0];
    expect(withoutOptionalTieBreak.affinityBreakdown.tripleCrown).toBe(0);
    expect(withoutOptionalTieBreak.affinityBreakdown.tiara).toBe(0);
    expect(withoutOptionalTieBreak.affinityBreakdown.total).toBeGreaterThan(0);
  });

  test("same donor is reusable across different runs, but never twice in one run", () => {
    const request = fixtureRequest();
    const plan = planParentingLoop(request).blueprints[0];
    expect(plan.ancestors.p1_gp1_g1.cardId).toBe(plan.ancestors.p1_gp2_g1.cardId);
    const bad = fixtureRequest();
    bad.config.lockedSlots.p1_gp1_g1 = "b:101401";
    bad.config.lockedSlots.p1_gp1_g2 = "b:100601";
    const rejected = planParentingLoop({ ...bad, roster: bad.roster });
    expect(rejected.blueprints).toHaveLength(0);
  });
});
