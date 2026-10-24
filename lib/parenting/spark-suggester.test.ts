import { describe, expect, test } from "bun:test";
import { charactersById } from "../data/registry";
import type { Course } from "../skill-engine/types";
import { buildLoopCandidates, type LoopAncestorSlot, type LoopCandidate, type ParentingLoopConfig } from "./loop-planner";
import type { ParentingMinmaxContext } from "./minmax";
import { JUNK_STAR_CAP, geneticPriorityWeights, suggestBranchSparks } from "./spark-suggester";
import type { KyumaruVeteranItem } from "../veterans/types";

const character = charactersById.get(106802)!;
const arimaCourse: Course = { id: 1, terrain: 1, distance: 4, length: 2500, turn: 1, inout: 1, corners: [], straights: [], slopes: [] };
const dirtCourse: Course = { ...arimaCourse, terrain: 2, distance: 3 };

function rosterCandidate(slot: string, base?: string[]): LoopCandidate {
  const candidate = { ...buildLoopCandidates([], [character])[0], key: slot };
  candidate.baseAptitude = base ?? Array(10).fill("A");
  candidate.aptitude = [...candidate.baseAptitude];
  return candidate;
}

function suggestContext(overrides?: {
  ancestors?: ParentingMinmaxContext["ancestors"];
  config?: Partial<ParentingLoopConfig>;
  course?: Course | null;
  runningStyle?: number | null;
}): ParentingMinmaxContext {
  const config: ParentingLoopConfig = {
    geneGoals: {}, aptitudeGoals: {}, selectedSlots: {}, lockedSlots: {}, factorGoals: {},
    includeTripleCrownAffinity: false, includeTiaraAffinity: false,
    ...overrides?.config,
  };
  return {
    ancestors: overrides?.ancestors ?? {
      p1: rosterCandidate("p1"),
      p1_gp1: rosterCandidate("p1_gp1"),
      p1_gp2: rosterCandidate("p1_gp2"),
    },
    config,
    target: character,
    course: overrides?.course === undefined ? arimaCourse : overrides.course,
    runningStyle: overrides?.runningStyle === undefined ? 2 : overrides.runningStyle,
  };
}

function assignmentStars(suggestion: NonNullable<ReturnType<typeof suggestBranchSparks>>, slot: LoopAncestorSlot) {
  return suggestion.assignments[slot] ?? { pink: null, pinkStars: 0 };
}

describe("branch spark suggester", () => {
  test("returns null until the branch has all three trainees selected", () => {
    const context = suggestContext({ ancestors: { p1: rosterCandidate("p1") } });
    expect(suggestBranchSparks(context, "p1")).toBeNull();
    expect(suggestBranchSparks(context, "p2")).toBeNull();
  });

  function ggpTotals(suggestion: NonNullable<ReturnType<typeof suggestBranchSparks>>): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const slot of ["p1_gp1_g1", "p1_gp1_g2", "p1_gp2_g1", "p1_gp2_g2"] as LoopAncestorSlot[]) {
      const assignment = assignmentStars(suggestion, slot);
      totals[assignment.pink!] = (totals[assignment.pink!] ?? 0) + assignment.pinkStars;
    }
    return totals;
  }

  test("turf ace spreads the shared GGP pair into 6★ Long + 6★ Leader instead of one 12★ pool", () => {
    const suggestion = suggestBranchSparks(suggestContext(), "p1")!;
    // Wide beats deep: the P run's donor pool (the 4 GGP slots) covers two
    // target genetics at the 6★ roll threshold rather than guaranteeing one.
    expect(ggpTotals(suggestion)).toEqual({ Long: 6, Leader: 6 });
    const p1 = suggestion.trainees.find((trainee) => trainee.slot === "p1")!;
    for (const aptitude of ["Long", "Leader"] as const) {
      const genetic = p1.genetics.find((entry) => entry.aptitude === aptitude)!;
      expect(genetic.stars).toBe(6);
      expect(genetic.status).toBe("possible");
    }
    expect(p1.genetics.every((entry) => entry.status !== "guaranteed")).toBe(true);
    // Each GP run reaches all three Ace categories at 6★ (18★ pool capacity).
    for (const gpSlot of ["p1_gp1", "p1_gp2"] as const) {
      const gp = suggestion.trainees.find((trainee) => trainee.slot === gpSlot)!;
      for (const aptitude of ["Long", "Leader", "Turf"] as const) {
        const genetic = gp.genetics.find((entry) => entry.aptitude === aptitude)!;
        expect(genetic.stars).toBe(6);
        expect(genetic.status).toBe("possible");
      }
    }
    // 8 obtainable pools (2 on P + 3 on each GP), ≈0.4 roll odds per pool per run.
    expect(suggestion.obtainableGenetics).toBe(8);
    expect(suggestion.expectedGenetics).toBeCloseTo(3.2);
    expect(suggestion.junkWarnings).toHaveLength(0);
  });

  test("dirt ace splits the shared GGP pair between Medium and Dirt instead of guaranteeing Medium", () => {
    const suggestion = suggestBranchSparks(suggestContext({ course: dirtCourse, runningStyle: 3 }), "p1")!;
    expect(ggpTotals(suggestion)).toEqual({ Medium: 6, Dirt: 6 });
    const p1 = suggestion.trainees.find((trainee) => trainee.slot === "p1")!;
    for (const aptitude of ["Medium", "Dirt"] as const) {
      const genetic = p1.genetics.find((entry) => entry.aptitude === aptitude)!;
      expect(genetic.stars).toBe(6);
      expect(genetic.status).toBe("possible");
    }
    expect(p1.genetics.every((entry) => entry.status !== "guaranteed")).toBe(true);
    for (const gpSlot of ["p1_gp1", "p1_gp2"] as const) {
      const gp = suggestion.trainees.find((trainee) => trainee.slot === gpSlot)!;
      expect(gp.genetics.every((entry) => entry.stars === 6 && entry.status === "possible")).toBe(true);
      expect(gp.genetics).toHaveLength(3);
    }
  });

  test("never lets an off-target pool pass the junk cap, even to close a farm target", () => {
    const base = () => { const ranks = Array(10).fill("A"); ranks[1] = "G"; return ranks; };
    const context = suggestContext({
      ancestors: {
        p1: rosterCandidate("p1", base()),
        p1_gp1: rosterCandidate("p1_gp1", base()),
        p1_gp2: rosterCandidate("p1_gp2", base()),
      },
    });
    const suggestion = suggestBranchSparks(context, "p1")!;
    expect(suggestion.junkWarnings).toHaveLength(0);
    for (const trainee of suggestion.trainees) {
      const dirt = trainee.junk.find((entry) => entry.aptitude === "Dirt");
      if (dirt) expect(dirt.stars).toBeLessThanOrEqual(JUNK_STAR_CAP);
      expect(trainee.targets.find((entry) => entry.aptitude === "Dirt")!.met).toBe(true);
    }
  });

  test("off-target targets that cannot fit under the cap are reported unmet instead of breached", () => {
    // Medium is off-target for a Long ace; base G needs 7★ to reach the default C floor,
    // which the junk cap forbids.
    const base = () => { const ranks = Array(10).fill("A"); ranks[4] = "G"; return ranks; };
    const suggestion = suggestBranchSparks(suggestContext({
      ancestors: {
        p1: rosterCandidate("p1", base()),
        p1_gp1: rosterCandidate("p1_gp1", base()),
        p1_gp2: rosterCandidate("p1_gp2", base()),
      },
    }), "p1")!;
    expect(suggestion.junkWarnings).toHaveLength(0);
    // The cap is per donor pool: Medium may total 8★ across the branch but no
    // single training-run pool may pass 5★.
    for (const trainee of suggestion.trainees) {
      const medium = trainee.junk.find((entry) => entry.aptitude === "Medium");
      if (medium) expect(medium.stars).toBeLessThanOrEqual(JUNK_STAR_CAP);
    }
    const mediumOutcome = suggestion.trainees.find((trainee) => trainee.slot === "p1")!.targets.find((entry) => entry.aptitude === "Medium")!;
    expect(mediumOutcome.met).toBe(false);
    expect(suggestion.warnings.some((warning) => warning.includes("p1") && warning.includes("Medium"))).toBe(true);
  });

  test("keeps manually edited deep slots untouched and lists them", () => {
    const context = suggestContext({ config: { factorGoals: { p1_gp1_g1_g1: { pink: "Turf", pinkStars: 2 } } } });
    const suggestion = suggestBranchSparks(context, "p1")!;
    expect(suggestion.kept).toContain("p1_gp1_g1_g1");
    expect(suggestion.assignments.p1_gp1_g1_g1).toBeUndefined();
  });

  test("leaves no free slot empty — every assignment is an on-target pink", () => {
    const context = suggestContext({ config: { factorGoals: { p1_gp1_g1_g1: { pink: "Leader", pinkStars: 1 } } } });
    const suggestion = suggestBranchSparks(context, "p1")!;
    const entries = Object.values(suggestion.assignments);
    expect(entries).toHaveLength(11);
    for (const assignment of entries) {
      expect(assignment!.pink).not.toBeNull();
      expect(["Long", "Leader", "Turf"]).toContain(assignment!.pink);
      expect(assignment!.pinkStars).toBeGreaterThanOrEqual(1);
    }
  });

  test("toggled-off farm aptitudes drop their floor and free the budget for the Ace's distance", () => {
    const base = () => { const ranks = Array(10).fill("A"); ranks[2] = "G"; return ranks; };
    const ancestors = {
      p1: rosterCandidate("p1", base()),
      p1_gp1: rosterCandidate("p1_gp1", base()),
      p1_gp2: rosterCandidate("p1_gp2", base()),
    };
    const withFloor = suggestBranchSparks(suggestContext({ ancestors }), "p1")!;
    expect(withFloor.trainees.every((trainee) => trainee.targets.some((entry) => entry.aptitude === "Sprint"))).toBe(true);
    expect(Object.values(withFloor.assignments).some((assignment) => assignment!.pink === "Sprint")).toBe(true);

    const focused = suggestBranchSparks(suggestContext({ ancestors, config: { disabledFarmAptitudes: ["Sprint"] } }), "p1")!;
    expect(focused.trainees.every((trainee) => !trainee.targets.some((entry) => entry.aptitude === "Sprint"))).toBe(true);
    expect(Object.values(focused.assignments).every((assignment) => assignment!.pink !== "Sprint")).toBe(true);
    const p1 = focused.trainees.find((trainee) => trainee.slot === "p1")!;
    const p1Long = p1.genetics.find((genetic) => genetic.aptitude === "Long")!;
    expect(p1Long.stars).toBeGreaterThanOrEqual(6);
    expect(p1.genetics.filter((genetic) => genetic.stars >= 6).length).toBeGreaterThanOrEqual(2);
    expect(focused.junkWarnings).toHaveLength(0);
  });

  test("warns about junk that fixed GP pinks force into the P run", () => {
    const context = suggestContext({ config: { factorGoals: { p1_gp1: { pink: "Dirt", pinkStars: 3 }, p1_gp2: { pink: "Dirt", pinkStars: 3 } } } });
    const suggestion = suggestBranchSparks(context, "p1")!;
    expect(suggestion.junkWarnings.some((warning) => warning.includes("p1") && warning.includes("Dirt"))).toBe(true);
    // The engine never piles more Dirt on top of an already overflowing pool.
    expect(Object.values(suggestion.assignments).every((assignment) => assignment!.pink !== "Dirt")).toBe(true);
  });

  test("veteran trainees are flagged as retraining plans", () => {
    const veteran = buildLoopCandidates([{ card_id: character.id, factor_info_array: [] } as unknown as KyumaruVeteranItem], [])[0];
    veteran.baseAptitude = Array(10).fill("A");
    const context = suggestContext({ ancestors: { p1: veteran, p1_gp1: rosterCandidate("p1_gp1"), p1_gp2: rosterCandidate("p1_gp2") } });
    const suggestion = suggestBranchSparks(context, "p1")!;
    expect(suggestion.trainees.find((trainee) => trainee.slot === "p1")!.retrainingNote).toBe(true);
    expect(suggestion.warnings.some((warning) => warning.includes("retraining"))).toBe(true);
  });

  test("exposes the user's priority order for both surfaces", () => {
    expect(geneticPriorityWeights({ surface: "Turf", distance: "Long", style: "Leader" })).toEqual({ distance: 3, style: 2, surface: 1 });
    expect(geneticPriorityWeights({ surface: "Dirt", distance: "Medium", style: "Betweener" })).toEqual({ distance: 3, surface: 2, style: 1 });
  });

  test("warns when the Global Track Bar has no course or style", () => {
    const suggestion = suggestBranchSparks(suggestContext({ course: null, runningStyle: null }), "p1")!;
    expect(suggestion.warnings.some((warning) => warning.includes("Global Track Bar"))).toBe(true);
  });
});
