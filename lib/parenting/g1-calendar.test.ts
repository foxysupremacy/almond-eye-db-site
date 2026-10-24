import { describe, expect, test } from "bun:test";
import { careersByCharId, g1Calendar } from "../data/registry";
import type { CalendarG1Race, G1CalendarData } from "../data/types";
import { APTITUDE_KEYS, DEFAULT_FARM_GOALS, type AptitudeProjection, type FarmAptitude, type FarmRank } from "./loop-planner";
import { evaluateG1Calendar } from "./g1-calendar";

const aptitudes: AptitudeProjection[] = APTITUDE_KEYS.map((aptitude) => ({ aptitude, base: "A", projected: "A", availablePinkStars: 0, confidence: "feasible", needsOutputA: false }));
function race(programId: number, half = 1, years = [3]): CalendarG1Race {
  return { programId, baseProgramId: 0, raceId: programId, saddleId: programId, nameEn: `G1 ${programId}`, nameJp: `G1 ${programId}`, grade: 100, trackId: 10006, month: 5, half, years, needFans: 5000, fillyOnly: false, defaultProgram: true, distance: 1600, terrain: 1 };
}

describe("ordinary G1 calendar", () => {
  test("contains optional domestic G1s, excludes scenario finals and overseas programs", () => {
    expect(g1Calendar.races.length).toBeGreaterThan(30);
    expect(g1Calendar.races.every((entry) => entry.raceId >= 1000 && entry.raceId < 9000)).toBe(true);
    const careerIds = new Set((careersByCharId["1001"] ?? []).map((entry) => entry.raceId));
    const assessment = evaluateG1Calendar(1001, aptitudes, DEFAULT_FARM_GOALS);
    expect(assessment.races.some((entry) => !careerIds.has(entry.race.raceId) && entry.status === "eligible")).toBe(true);
    expect(assessment.races.some((entry) => entry.race.terrain === 2)).toBe(true);
  });

  test("cannot count two simultaneous races as two wins; another year can resolve the conflict", () => {
    const data: G1CalendarData = { races: [race(1), race(2)], objectivesByCharId: {} };
    expect(evaluateG1Calendar(1001, aptitudes, DEFAULT_FARM_GOALS, data).eligibleCount).toBe(2);
    expect(evaluateG1Calendar(1001, aptitudes, DEFAULT_FARM_GOALS, data).schedulableCount).toBe(1);
    data.races[0].years = [2, 3];
    const result = evaluateG1Calendar(1001, aptitudes, DEFAULT_FARM_GOALS, data);
    expect(result.schedulableCount).toBe(2);
    expect(result.scheduledSaddles).toHaveLength(2);
  });

  test("separates aptitude blockers, career turns and conditional fan requirements", () => {
    const data: G1CalendarData = { races: [race(1), race(2, 2)], objectivesByCharId: { "1001": [{ turn: 57, programIds: [99] }] } };
    const projected = aptitudes.map((entry) => entry.aptitude === "Mile" ? { ...entry, projected: "E" } : entry);
    let result = evaluateG1Calendar(1001, projected, DEFAULT_FARM_GOALS, data);
    expect(result.races[0].status).toBe("career-blocked");
    expect(result.races[1].status).toBe("aptitude-blocked");
    expect(result.races[1].conditions).toContain("Fans ≥ 5,000 · not confirmed");
    result = evaluateG1Calendar(1001, projected, { ...DEFAULT_FARM_GOALS, Mile: "E" }, data);
    expect(result.races[1].status).toBe("eligible");
    expect(evaluateG1Calendar(undefined, aptitudes, DEFAULT_FARM_GOALS, data).unknown).toBe(true);
  });

  test("keeps missing inheritance data unknown unless the known minimum already meets the target", () => {
    const data: G1CalendarData = { races: [race(1)], objectivesByCharId: {} };
    const projected = aptitudes.map((entry) => entry.aptitude === "Mile" ? { ...entry, projected: "E", confidence: "unknown" as const } : entry);
    expect(evaluateG1Calendar(1001, projected, DEFAULT_FARM_GOALS, data).races[0].status).toBe("unknown");
    expect(evaluateG1Calendar(1001, projected, { ...DEFAULT_FARM_GOALS, Mile: "E" }, data).races[0].status).toBe("eligible");
  });

  test("aptitudes toggled off in farm focus exclude their races from the calendar", () => {
    const data: G1CalendarData = { races: [race(1), { ...race(2), distance: 1200 }], objectivesByCharId: {} };
    const goals: Partial<Record<FarmAptitude, FarmRank>> = { ...DEFAULT_FARM_GOALS };
    delete goals.Sprint;
    const result = evaluateG1Calendar(1001, aptitudes, goals, data);
    expect(result.races.find((entry) => entry.race.programId === 1)!.status).toBe("eligible");
    const sprint = result.races.find((entry) => entry.race.programId === 2)!;
    expect(sprint.status).toBe("excluded");
    const sprintRequirement = sprint.requirements.find((entry) => entry.aptitude === "Sprint")!;
    expect(sprintRequirement.status).toBe("excluded");
    expect(sprintRequirement.required).toBeNull();
    expect(result.schedulableCount).toBe(1);
  });
});
