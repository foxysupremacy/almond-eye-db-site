import { describe, expect, test } from "bun:test";
import { DEFAULT_ENABLED_GROUPS, SKILL_GROUPS, SKILL_GROUP_LABELS, SPEED_GROUPS, isCounted, skillGroupsOf, toggleGroup } from "./skill-groups";

const skill = (...effects: { type: number; value?: number; target?: number }[]) => ({ conditionGroups: [{ effects }] });

describe("skillGroupsOf", () => {
  test("one group per effect category", () => {
    expect(skillGroupsOf(skill({ type: 27, value: 1 }))).toEqual(["target_speed"]);
    expect(skillGroupsOf(skill({ type: 21, value: 1 }))).toEqual(["current_speed"]);
    expect(skillGroupsOf(skill({ type: 22, value: 1 }))).toEqual(["current_speed"]);
    expect(skillGroupsOf(skill({ type: 31, value: 1 }))).toEqual(["acceleration"]);
    expect(skillGroupsOf(skill({ type: 48, value: 1 }))).toEqual(["acceleration"]);
    expect(skillGroupsOf(skill({ type: 9, value: 1 }))).toEqual(["recovery"]);
    expect(skillGroupsOf(skill({ type: 1, value: 1 }))).toEqual(["passive"]);
    expect(skillGroupsOf(skill({ type: 28, value: 1 }))).toEqual(["other"]);
  });
  test("opponent target makes a debuff", () => {
    expect(skillGroupsOf(skill({ type: 27, value: -1, target: 9 }))).toEqual(["debuff"]);
  });
  test("no effects / unknown types are other", () => {
    expect(skillGroupsOf({})).toEqual(["other"]);
    expect(skillGroupsOf({ conditionGroups: null })).toEqual(["other"]);
    expect(skillGroupsOf(skill({ type: 9999, value: 1 }))).toEqual(["other"]);
  });
  test("de-duplicated, in SKILL_GROUPS order", () => {
    expect(skillGroupsOf(skill({ type: 9, value: 1 }, { type: 27, value: 1 }, { type: 27, value: 1 }))).toEqual(["target_speed", "recovery"]);
  });
});

describe("constants and helpers", () => {
  test("constants", () => {
    expect(SKILL_GROUPS).toEqual(["target_speed", "current_speed", "acceleration", "recovery", "debuff", "passive", "other"]);
    expect(DEFAULT_ENABLED_GROUPS).toEqual(["target_speed", "current_speed", "acceleration"]);
    expect(SPEED_GROUPS).toEqual(["target_speed", "current_speed", "acceleration"]);
    expect(SKILL_GROUP_LABELS.passive).toBe("Passive (green)");
    expect(SKILL_GROUP_LABELS.debuff).toBe("Debuffs");
  });
  test("isCounted is true when any group is enabled", () => {
    expect(isCounted(["target_speed", "recovery"], new Set(["recovery"]))).toBe(true);
    expect(isCounted(["debuff"], new Set(["recovery"]))).toBe(false);
  });
  test("toggleGroup adds, removes, and never empties", () => {
    expect(toggleGroup(["recovery"], "recovery")).toEqual(["recovery"]);
    expect(toggleGroup(["target_speed", "recovery"], "recovery")).toEqual(["target_speed"]);
    expect(toggleGroup(["target_speed"], "debuff")).toEqual(["target_speed", "debuff"]);
  });
});
