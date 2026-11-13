import { describe, expect, test } from "bun:test";
import { flattenCourse } from "../api/course-format";
import { loadRacetracks, skillsById } from "../data/registry";
import { defaultRaceImpactProfile } from "../race-impact";
import type { SkillGroup } from "./skill-groups";
import { autoPickCacheKey, buildValueTable, scoreSkillValues, type RawSkillValue } from "./values";

const raw = (skillId: number, bashin: number, groups: SkillGroup[], activates = true): RawSkillValue => ({ skillId, bashin, activates, groups });
const on = (...g: SkillGroup[]) => new Set<SkillGroup>(g);
const pick = (s?: { value: number; flat: boolean }) => ({ value: s?.value, flat: s?.flat });
const SPEED = on("target_speed", "current_speed", "acceleration");

describe("buildValueTable", () => {
  const table = {
    1: raw(1, 0.2, ["target_speed"]),
    2: raw(2, 0.4, ["acceleration"]),
    3: raw(3, 0, ["recovery"]),
    4: raw(4, 0, ["recovery"], false),
    5: raw(5, 0.3, ["passive"]),
    6: raw(6, 0.4, ["target_speed", "recovery"]),
  };
  test("default groups: recovery skill is 0, off-group speed-less skill is 0", () => {
    const v = buildValueTable(table, SPEED);
    expect(pick(v.get(3))).toEqual({ value: 0, flat: false });
    expect(v.get(5)!.value).toBe(0);
    expect(v.get(1)!.value).toBe(0.2);
  });
  test("enabling recovery gives the mean of positive speed bashin, flat", () => {
    const v = buildValueTable(table, on("target_speed", "current_speed", "acceleration", "recovery"));
    // speed skills with bashin > 0: 0.2, 0.4, 0.4 -> mean 1/3
    expect(v.get(3)!.value).toBeCloseTo(1 / 3, 9);
    expect(v.get(3)!.flat).toBe(true);
    expect(v.get(4)!.value).toBe(0);
    expect(v.get(4)!.flat).toBe(false);
  });
  test("mixed skill keeps its own bashin when only recovery is on", () => {
    const v = buildValueTable(table, on("recovery"));
    expect(pick(v.get(6))).toEqual({ value: 0.4, flat: false });
    expect(v.get(1)!.value).toBe(0);
    expect(v.get(3)!.value).toBeCloseTo(1 / 3, 9);
  });
  test("no speed skills means flat value 0", () => {
    const v = buildValueTable({ 3: raw(3, 0, ["recovery"]) }, on("recovery"));
    expect(pick(v.get(3))).toEqual({ value: 0, flat: true });
  });
});

async function kyoto() {
  for (const t of await loadRacetracks()) { const r = t.courses.find((c) => c.id === 10808); if (r) return { ...flattenCourse(r), trackId: t.id }; }
  throw new Error("course");
}

describe("scoreSkillValues", () => {
  test("missing skill yields zero record and progress reaches total", async () => {
    const calls: [number, number][] = [];
    const out = scoreSkillValues({ key: "k", skillIds: [111, 222], skills: {}, course: await kyoto(), raceParams: {}, style: 2, racerCount: 9, profile: defaultRaceImpactProfile() }, (d, t) => calls.push([d, t]));
    expect(out[111]).toEqual({ skillId: 111, bashin: 0, activates: false, groups: ["other"] });
    expect(calls[calls.length - 1]).toEqual([2, 2]);
  });
  test("real course and skill smoke", async () => {
    const skill = skillsById.get(120171)!;
    const out = scoreSkillValues({ key: "k", skillIds: [120171], skills: { 120171: skill }, course: await kyoto(), raceParams: {}, style: 2, racerCount: 9, profile: defaultRaceImpactProfile() });
    expect(out[120171].bashin).toBeGreaterThanOrEqual(0);
    expect(typeof out[120171].activates).toBe("boolean");
  });
});

describe("autoPickCacheKey", () => {
  test("includes style and version suffix", () => {
    const k = autoPickCacheKey({ courseId: 10808, raceParams: {}, racerCount: 9, profile: defaultRaceImpactProfile(), style: 2 });
    expect(k.endsWith("|style=2|autopick=v1")).toBe(true);
    expect(k.startsWith("rankings:v3|course=10808")).toBe(true);
  });
});
