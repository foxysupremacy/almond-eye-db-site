import { describe, expect, test } from "bun:test";
import { loadRacetracks, skillsById } from "../data/registry";
import { flattenCourse } from "../api/course-format";
import { placedTriggerIndices, resolveConditionGroup } from "./condition-group";

async function course(courseId: number) {
  for (const track of await loadRacetracks()) {
    const row = track.courses.find((c) => c.id === courseId);
    if (row) return { ...flattenCourse(row), trackId: track.id };
  }
  throw new Error(`course ${courseId} missing`);
}

describe("resolveConditionGroup", () => {
  const cascading = skillsById.get(120171)!; // Cascading Might (Halloween Rudolf)

  test("Kyoto 2200 turf resolves the 3x track-bonus group (index 0)", async () => {
    const r = resolveConditionGroup(cascading, await course(10808), { groundCondition: 1 }, 2);
    expect(r?.index).toBe(0);
    expect(r?.group.effects?.[0]?.value).toBe(4500);
  });

  test("Longchamp 2400 falls through to the plain group (index 1)", async () => {
    const r = resolveConditionGroup(cascading, await course(11203), { groundCondition: 3 }, 2);
    expect(r?.index).toBe(1);
    expect(r?.group.effects?.[0]?.value).toBe(1500);
    expect(r?.allZones).toHaveLength(2);
    expect(r?.allZones[0].regions.length).toBe(0);
  });

  test("a style the precondition excludes cannot fire at all", async () => {
    // running_style==2@running_style==3 → a Runner (1) never fires
    expect(resolveConditionGroup(cascading, await course(10808), {}, 1)).toBeNull();
  });

  test("chained trigger: Stay Gold 101351 places g0 and the is_activate_other_skill_detail g1 (R7.3)", async () => {
    const r = resolveConditionGroup(skillsById.get(101351)!, await course(10808), { groundCondition: 1 }, 3)!;
    expect(r.index).toBe(0);
    expect(r.triggers.map((t) => t.index)).toEqual([0, 1]);
    expect(r.triggers[0].zones).toBe(r.zones);
    expect(r.triggers[1].zones.regions[0].start).toBeCloseTo(1467, 0);
  });

  test("a later group without a chain marker is not placed (only the first firable group)", async () => {
    const r = resolveConditionGroup(cascading, await course(10808), { groundCondition: 1 }, 2)!;
    expect(r.triggers.map((t) => t.index)).toEqual([0]);
  });

  test("R32: a prerequisite group (is_used_skill_id of another skill) is met for any Uma: Scarlet Lily 100971 fires g0 as a Leader", async () => {
    const r = resolveConditionGroup(skillsById.get(100971)!, await course(10808), { groundCondition: 1 }, 2)!;
    expect(r.allZones[0].regions.length).toBeGreaterThan(0);
    expect(r.index).toBe(0);
    expect(r.triggers.map((t) => t.index)).toEqual([0]);
  });

  test("R32: a chained group that also names another skill is placed with its trigger: Silent Oath 109701211 g1 (Impulse 203781)", () => {
    const groups = skillsById.get(109701211)!.conditionGroups!;
    const zones = groups.map(() => ({ regions: [{ length: 1 }] }));
    expect(placedTriggerIndices(groups, zones, 109701211)).toEqual([0, 1]);
  });

  test("is_used_skill_id naming the skill itself is a same-skill chain; naming another skill is an alternative (synthetic)", () => {
    const groups = [{ condition: "phase==1" }, { condition: "phase==2&is_used_skill_id==555" }, { condition: "phase==2&is_used_skill_id==777" }];
    const zones = groups.map(() => ({ regions: [{ length: 1 }] }));
    expect(placedTriggerIndices(groups, zones, 555)).toEqual([0, 1]);
  });

  test("R32: the first firable group wins even when it needs another skill (no held-skill dependence)", () => {
    const groups = [{ condition: "a==1&is_used_skill_id==777" }, { condition: "b==1" }];
    const zones = groups.map(() => ({ regions: [{ length: 1 }] }));
    expect(placedTriggerIndices(groups, zones, 555)).toEqual([0]);
  });

  test("alternative groups are mutually exclusive: no chain marker, only the first firable group", () => {
    const groups = [{ condition: "a==1" }, { condition: "b==1" }];
    expect(placedTriggerIndices(groups, [{ regions: [{ length: 1 }] }, { regions: [{ length: 1 }] }], 1)).toEqual([0]);
  });

  test("R32: with_detail_one prerequisites are met too: Red Desire 113601111 fires g0 on Kyoto 10808 for style 3", async () => {
    const r = resolveConditionGroup(skillsById.get(113601111)!, await course(10808), { groundCondition: 1 }, 3)!;
    expect(r.index).toBe(0);
  });

  test("banned skills under No Debuffs resolve to null", async () => {
    const banned = skillsById.get(201151)!; // Monopolize, in BANNED_DEBUFF_SKILL_IDS
    expect(resolveConditionGroup(banned, await course(10808), { noDebuffs: true }, 2)).toBeNull();
  });
});
