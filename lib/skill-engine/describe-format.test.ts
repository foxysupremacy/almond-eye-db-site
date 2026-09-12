import { describe, it, expect } from "bun:test";
import { formatEffect, conditionBranches } from "./describe";

describe("SkillHoverCard effect calculation", () => {
  it("computes exact target speed and duration for Ascendance on 1800m course", () => {
    const effect = formatEffect([{ type: 27, value: 3500 }], 24000, 1800);
    expect(effect).toBe("+0.35 m/s Target Speed for 4.3 s");
  });

  it("splits condition branches into human-readable labels", () => {
    const branches = conditionBranches("distance_type==2&phase_random==1@distance_type==3&phase_random==1");
    expect(branches.branches.length).toBe(2);
    expect(branches.branches[0]).toEqual(["a mile", "random point in mid-race"]);
    expect(branches.branches[1]).toEqual(["a medium-distance race", "random point in mid-race"]);
  });
});
