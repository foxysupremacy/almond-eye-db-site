import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { characters } from "@/lib/data/registry";
import { DEFAULT_PARENTING_SETUP } from "@/lib/parenting/state";
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
