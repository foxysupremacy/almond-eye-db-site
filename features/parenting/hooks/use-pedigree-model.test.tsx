import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { characters } from "@/lib/data/registry";
import { DEFAULT_PARENTING_SETUP, type ParentingSetup } from "@/lib/parenting/state";
import { usePedigreeModel, type PedigreeModel } from "./use-pedigree-model";

const course = { id: 1, terrain: 1, distance: 4, length: 2500, turn: 1, inout: 1, corners: [], straights: [], slopes: [] };
function Probe({ onModel }: { onModel: (m: PedigreeModel) => void }) {
  const tachyon = characters.find((c) => c.nameEn === "Agnes Tachyon")!;
  const setup = { ...DEFAULT_PARENTING_SETUP, loopConfig: { ...DEFAULT_PARENTING_SETUP.loopConfig!, factorGoals: { p1_gp1_g1_g1: { pink: "Turf" as const, pinkStars: 2 } }, selectedSlots: { p1: `r:${tachyon.id}` } } };
  onModel(usePedigreeModel({ target: tachyon, veterans: [], roster: characters, setup, course, runningStyle: 2, updateSetup: () => {} }));
  return null;
}

test("model resolves the selected parent, unique skill, spark plans and minmax slots", () => {
  let model!: PedigreeModel;
  renderToStaticMarkup(<Probe onModel={(m) => { model = m; }} />);
  expect(model.selectedCandidates.p1?.name).toContain("Agnes Tachyon");
  expect(model.uniqueSkill("p1")?.nameEn).toBeTruthy();
  expect(model.assessments.p1.projections).toHaveLength(10);
  expect(model.factorPlan("p1_gp1_g1_g1")).toEqual({ pink: "Turf", pinkStars: 2 });
  expect(model.sparkSources("p1").map((s) => s.label)).toContain("P1 GP1");
  expect(model.geneticAssessment("p1")?.slot).toBe("p1");
  expect(model.geneticAssessment("p1_gp1_g1")).toBeUndefined();
  expect(model.minmax.target).toEqual({ surface: "Turf", distance: "Long", style: "Leader" });
});

function SetterProbe({ onModel, updates }: { onModel: (m: PedigreeModel) => void; updates: ParentingSetup[] }) {
  const tachyon = characters.find((c) => c.nameEn === "Agnes Tachyon")!;
  const setup = { ...DEFAULT_PARENTING_SETUP, loopConfig: { ...DEFAULT_PARENTING_SETUP.loopConfig!, factorGoals: { p1_gp1_g1: { blue: 2, blueStars: 3, pink: "Turf" as const, pinkStars: 1 } }, selectedSlots: { p1: `r:${tachyon.id}` } } };
  const latest = updates.length ? updates[updates.length - 1] : setup;
  onModel(usePedigreeModel({ target: tachyon, veterans: [], roster: characters, setup: latest, course, runningStyle: 2, updateSetup: (updater) => { updates.push(updater(latest)); } }));
  return null;
}

test("setAptitudeGoal writes and clears per-slot targets; applyBranchSparks batches pink plans in one update", () => {
  let model!: PedigreeModel;
  const updates: ParentingSetup[] = [];
  renderToStaticMarkup(<SetterProbe updates={updates} onModel={(m) => { model = m; }} />);

  model.setAptitudeGoal("p1", "Medium", "A");
  expect(updates[updates.length - 1].loopConfig?.slotAptitudeGoals?.p1).toEqual({ Medium: "A" });

  model.setAptitudeGoal("p1", "Leader", "B");
  expect(updates[updates.length - 1].loopConfig?.slotAptitudeGoals?.p1).toEqual({ Leader: "B" });

  model.applyBranchSparks({ p1_gp1_g1_g1: { pink: "Long", pinkStars: 3 }, p1_gp1_g1: { pink: null, pinkStars: 0 } });
  const factorGoals = updates[updates.length - 1].loopConfig?.factorGoals!;
  expect(factorGoals.p1_gp1_g1_g1).toEqual({ pink: "Long", pinkStars: 3 });
  // Manual blue fields survive a pink overwrite on the same slot.
  expect(factorGoals.p1_gp1_g1).toEqual({ blue: 2, blueStars: 3, pink: null, pinkStars: 0 });
});
