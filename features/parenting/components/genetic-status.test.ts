import { expect, test } from "bun:test";
import { charactersById } from "@/lib/data/registry";
import { branchSourceSlots, buildLoopCandidates } from "@/lib/parenting/loop-planner";
import { evaluateParentingMinmax, type ParentingMinmaxContext } from "@/lib/parenting/minmax";
import { DEFAULT_PARENTING_SETUP } from "@/lib/parenting/state";
import { ancestorTitle } from "./ancestor-label";
import { geneticStatus } from "./genetic-status";

function context(dirtStars: number, withCourse = true): ParentingMinmaxContext {
  const candidate = buildLoopCandidates([], [charactersById.get(106802)!])[0];
  candidate.baseAptitude = Array(10).fill("A");
  return {
    ancestors: { p1: candidate },
    config: { ...DEFAULT_PARENTING_SETUP.loopConfig!, factorGoals: Object.fromEntries(branchSourceSlots("p1").map((slot, index) => [slot, { pink: index < 2 ? "Dirt" : null, pinkStars: index < 2 ? dirtStars : 0 }])) },
    course: withCourse ? { id: 1, terrain: 1, distance: 4, length: 2500, turn: 1, inout: 1, corners: [], straights: [], slopes: [] } : null,
    runningStyle: withCourse ? 2 : null,
  };
}
const status = (ctx: ParentingMinmaxContext) => geneticStatus(evaluateParentingMinmax(ctx).slots[0], ctx);

test("frequent risk is a warning with the indicator's wording", () => {
  expect(status(context(3))).toEqual({ text: "1 frequent genetic risks", tone: "warning", alert: true });
});
test("low pink with a full course target is good planning", () => {
  expect(status(context(1))).toEqual({ text: "Good genetic planning", tone: "good", alert: false });
});
test("no course or style stays muted and asks for it", () => {
  expect(status(context(1, false))).toEqual({ text: "Select course / style", tone: "muted", alert: true });
});
test("ancestor titles read naturally", () => {
  expect(ancestorTitle("p1")).toBe("Parent 1");
  expect(ancestorTitle("p2_gp1")).toBe("GP · Parent 2 · left");
});
