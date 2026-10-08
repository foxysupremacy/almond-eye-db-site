import { describe, expect, test } from "bun:test";
import { api } from "@/lib/api";
import { evaluateDemoSkill } from "./demo-model";
import { loadLandingData } from "./load-landing-data";

describe("landing sample data", () => {
  test("curates a six-card deck and three working skills on the real Tokyo course", async () => {
    const data = await loadLandingData();
    expect(data.cards).toHaveLength(6);
    expect(new Set(data.cards.map((card) => card.nameEn)).size).toBe(6);
    expect(data.characters).toHaveLength(7);
    const characters = await api.listCharacters();
    expect(data.characters.every((character) => character.portraitUrl === characters.find((entry) => entry.id === character.id)?.imgUrl)).toBe(true);
    const course = data.demo!.course;
    expect({ id: course.id, trackId: course.trackId, length: course.length, terrain: course.terrain, turn: course.turn }).toEqual({ id: 10604, trackId: 10006, length: 2000, terrain: 1, turn: 2 });
    expect(data.demo?.skills.map((skill) => skill.id)).toEqual([200332, 200362, 210292]);
    const demo = data.demo!;
    const results = demo.skills.map((skill) => evaluateDemoSkill(demo.course, skill));
    expect(results.map((result) => result.rangeText)).toEqual([
      "200-400m, 950-1225m, 1225-1475m",
      "400-950m, 1475-2000m",
      "1475-2000m",
    ]);
    expect(results.map((result) => result.isRandom)).toEqual([true, true, false]);
    expect(results.every((result) => result.conditionText.length > 0)).toBe(true);
    // The demo's client projection carries conditions, not the full skill database.
    expect("grantingCards" in demo.skills[0]).toBe(false);
    expect("effects" in demo.skills[0].conditionGroups[0]).toBe(false);
  });

  test("a failed course load leaves the rest of the landing data usable", async () => {
    const original = api.racetrack;
    api.racetrack = async () => { throw new Error("Course unavailable"); };
    try {
      const data = await loadLandingData();
      expect(data.demo).toBeNull();
      expect(data.cards).toHaveLength(6);
      expect(data.characters).toHaveLength(7);
    } finally {
      api.racetrack = original;
    }
  });
});
