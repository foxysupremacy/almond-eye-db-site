import { describe, it, expect } from "bun:test";
import {
  getInheritableSkillForUnique,
  getEvolInheritableSkillForUnique,
  getEvolInheritableSkillForWhite,
  hasEvolInheritSkill,
  UNIQUE_TO_EVOL_INHERIT_MAP,
  WHITE_TO_EVOL_INHERIT_MAP,
} from "./skill-rarity";
import { evaluateSkillActivation } from "./parenting/skill-evaluator";
import { skillsById } from "./data/registry";

import type { Course } from "./skill-engine/types";

const kyoto2200Course: Course = {
  id: 10001,
  terrain: 1,
  turn: 1,
  distance: 3,
  inout: 2,
  length: 2200,
  spurtStart: { meters: 1467 },
  slopes: [],
  corners: [
    { start: 400, end: 650 },
    { start: 650, end: 900 },
    { start: 1300, end: 1750 },
    { start: 1750, end: 1900 },
  ],
  straights: [
    { start: 0, end: 400, frontType: 1 },
    { start: 900, end: 1300, frontType: 2 },
    { start: 1900, end: 2200, frontType: 3 },
  ],
};

describe("Skill Rarity & Evolved Succession Skills (継承進化)", () => {
  it("maps base uniques to standard white inherit and evolved inherit skills", () => {
    // Epiphaneia (101411)
    expect(getInheritableSkillForUnique(101411)).toBe(901411);
    expect(getEvolInheritableSkillForUnique(101411)).toBe(91101411);
    expect(getEvolInheritableSkillForWhite(901411)).toBe(91101411);
    expect(hasEvolInheritSkill(101411)).toBe(true);
    expect(hasEvolInheritSkill(901411)).toBe(true);
    expect(hasEvolInheritSkill(91101411)).toBe(true);

    // Stay Gold (101351)
    expect(getInheritableSkillForUnique(101351)).toBe(901351);
    expect(getEvolInheritableSkillForUnique(101351)).toBe(91101351);
    expect(getEvolInheritableSkillForWhite(901351)).toBe(91101351);

    // Rhein Kraft (111091)
    expect(getInheritableSkillForUnique(111091)).toBe(911091);
    expect(getEvolInheritableSkillForUnique(111091)).toBe(92111091);
    expect(getEvolInheritableSkillForWhite(911091)).toBe(92111091);

    // Character without evolved succession skill (e.g. Special Week 100011)
    expect(getInheritableSkillForUnique(100011)).toBe(900011);
    expect(getEvolInheritableSkillForUnique(100011)).toBe(null);
    expect(getEvolInheritableSkillForWhite(900011)).toBe(null);
    expect(hasEvolInheritSkill(100011)).toBe(false);
  });

  it("evaluates both standard and evolved inherit skills properly under course & style", () => {
    // 901411 (Standard inherit of Epiphaneia): Rarity 1
    const whiteSkill = skillsById.get(901411);
    expect(whiteSkill).toBeDefined();
    expect(whiteSkill?.rarity).toBe(1);
    // Speed effect: 500 (0.05 m/s), Accel effect: 1000 (0.10 m/s²)
    expect((whiteSkill?.conditionGroups[0].effects[0] as any).value).toBe(500);
    expect((whiteSkill?.conditionGroups[1].effects[0] as any).value).toBe(1000);

    // 91101411 (Evolved inherit of Epiphaneia): Rarity 6
    const evolSkill = skillsById.get(91101411);
    expect(evolSkill).toBeDefined();
    expect(evolSkill?.rarity).toBe(6);
    // Speed effect: 1500 (0.15 m/s), Accel effect: 2000 (0.20 m/s²)
    expect((evolSkill?.conditionGroups[0].effects[0] as any).value).toBe(1500);
    expect((evolSkill?.conditionGroups[1].effects[0] as any).value).toBe(2000);

    // Both activate for Leader (2) and Runner (1)
    const whiteAsLeader = evaluateSkillActivation(901411, kyoto2200Course, 2);
    expect(whiteAsLeader.activates).toBe(true);

    const evolAsLeader = evaluateSkillActivation(91101411, kyoto2200Course, 2);
    expect(evolAsLeader.activates).toBe(true);

    // Both reject for Betweener (3) due to running_style==1@running_style==2
    const whiteAsBetweener = evaluateSkillActivation(901411, kyoto2200Course, 3);
    expect(whiteAsBetweener.activates).toBe(false);

    const evolAsBetweener = evaluateSkillActivation(91101411, kyoto2200Course, 3);
    expect(evolAsBetweener.activates).toBe(false);
  });
});
