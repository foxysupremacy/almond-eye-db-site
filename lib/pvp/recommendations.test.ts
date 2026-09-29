import { describe, expect, test } from "bun:test";
import { pvpRecommendations, loadRacetracks } from "@/lib/data/registry";
import { PVP_EVENTS } from "./events";
import {
  filterRecommendedSkillsByStyle,
  getRecommendedRace,
  findMasterChallengeRace,
  raceParametersForMasterChallenge,
} from "./recommendations";
import type { PvpRaceFitAssistance, RecommendedPvpSkill } from "@/lib/data/types";

describe("PvP game recommendation mapping", () => {
  test("maps CM events by the declared source event id, course id, and sub-id", () => {
    const events = pvpRecommendations.raceFitAssistance;
    const mapped = PVP_EVENTS.filter((event) => event.recommendationEventId != null);

    expect(mapped.map((event) => event.recommendationEventId).sort()).toEqual([49, 50]);
    for (const event of mapped) {
      expect(getRecommendedRace(
        events,
        event.recommendationEventId,
        event.courseId,
        event.recommendationEventSubId,
      )).not.toBeNull();
    }
    expect(getRecommendedRace(events, 50, 11203, 0)).toBeNull();
    expect(getRecommendedRace(events, 50, 10808, 1)).toBeNull();
  });

  test("exposes all current Master Challenge race sub-events and maps them to local courses", async () => {
    const assistance = pvpRecommendations.raceFitAssistance;
    const masterChallenges = assistance.filter((event) => event.eventType === 3);
    expect(masterChallenges).toHaveLength(1);
    expect(masterChallenges[0].races.map((race) => race.eventSubId).sort((a, b) => a - b))
      .toEqual([1044, 1045, 1046, 1047, 1048]);

    const tracks = await loadRacetracks();
    const localCourseIds = new Set(tracks.flatMap((track) => track.courses.map((course) => course.id)));
    for (const race of masterChallenges[0].races) {
      expect(localCourseIds.has(race.raceCourseSetId)).toBe(true);
      expect(findMasterChallengeRace(assistance, masterChallenges[0].eventId, race.eventSubId)?.race).toEqual(race);
    }
  });

  test("keeps style status codes intact and treats either positive code as eligible", () => {
    const mixedStyleValues: RecommendedPvpSkill[] = [
      { skillId: 1, supportCardIds: [], runningStyleValues: { nige: 0, senko: 1, sashi: 0, oikomi: 0 } },
      { skillId: 2, supportCardIds: [], runningStyleValues: { nige: 2, senko: 0, sashi: 0, oikomi: 0 } },
      { skillId: 3, supportCardIds: [], runningStyleValues: { nige: 0, senko: 0, sashi: 0, oikomi: 0 } },
    ];

    expect(filterRecommendedSkillsByStyle(mixedStyleValues, 1).map((skill) => skill.skillId)).toEqual([2]);
    expect(filterRecommendedSkillsByStyle(mixedStyleValues, 2).map((skill) => skill.skillId)).toEqual([1]);
    expect(filterRecommendedSkillsByStyle(mixedStyleValues, null).map((skill) => skill.skillId)).toEqual([1, 2]);
    expect(filterRecommendedSkillsByStyle(mixedStyleValues, 5)).toEqual([]);
  });

  test("converts Master Challenge conditions to the shared race parameter shape", () => {
    const event: PvpRaceFitAssistance = pvpRecommendations.raceFitAssistance.find((entry) => entry.eventType === 3)!;
    const race = event.races[0];
    expect(raceParametersForMasterChallenge(race)).toEqual({
      season: race.season,
      weather: race.weather,
      groundCondition: race.ground,
      time: race.timezone,
      numUmas: race.entryCount,
      noDebuffs: false,
    });
  });
});
