import { describe, expect, test } from "bun:test";
import type { Course } from "../skill-engine/types";
import { computePvpSkillZones } from "./skill-zones";

const course: Course = {
  id: 1,
  trackId: 1,
  terrain: 1,
  turn: 1,
  distance: 3,
  inout: 0,
  length: 2400,
  phases: [{ id: 0, start: 0, end: 2400 }],
  corners: [],
  slopes: [],
  straights: [],
};

describe("computePvpSkillZones", () => {
  const groups = [{ condition: "phase>=2" }];

  test("keeps Champions Meeting bans for banned debuff and unique skills", () => {
    for (const skillId of [201151, 110071]) {
      const [zone] = computePvpSkillZones(course, groups, undefined, {
        skillId: String(skillId),
        noDebuffs: true,
      });
      expect(zone.regions).toHaveLength(0);
    }
  });

  test("preserves normal zones for unbanned skills and when the event rule is off", () => {
    const allowedSkill = computePvpSkillZones(course, groups, undefined, {
      skillId: "200011",
      noDebuffs: true,
    });
    const ruleOff = computePvpSkillZones(course, groups, undefined, {
      skillId: "201151",
      noDebuffs: false,
    });

    expect(allowedSkill[0].regions.length).toBeGreaterThan(0);
    expect(ruleOff[0].regions.length).toBeGreaterThan(0);
  });
});
