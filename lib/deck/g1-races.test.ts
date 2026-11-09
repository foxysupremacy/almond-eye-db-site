import { describe, expect, it } from "bun:test";
import racetracks from "../data/generated/racetracks.json";
import { G1_RACES, g1TrackInfo, matchingG1Races } from "./g1-races";
import type { TrackInfo } from "./types";

const base = {
  trackId: 10001,
  courseId: 10101,
  runningStyle: 1,
  racerCount: 12,
  pvpEventId: "cm-x",
  masterChallengeSelection: null,
  customRaceConditions: { season: 2, weather: 1, groundCondition: 3, time: 1 },
} as unknown as TrackInfo;

const byName = (name: string, trackId?: number) =>
  G1_RACES.find((race) => race.nameEn === name && (trackId == null || race.trackId === trackId))!;

describe("G1 race quick-select (GameTora races data)", () => {
  it("points every G1 at a real course on its own venue, once", () => {
    const tracks = racetracks as unknown as { id: number; courses: { id: number }[] }[];
    expect(G1_RACES.length).toBeGreaterThan(40);
    for (const race of G1_RACES) {
      const track = tracks.find((t) => t.id === race.trackId);
      expect(track?.courses.some((c) => c.id === race.courseId)).toBe(true);
      expect(race.season).toBeGreaterThanOrEqual(1);
      expect(race.season).toBeLessThanOrEqual(5);
    }
    expect(new Set(G1_RACES.map((r) => r.id)).size).toBe(G1_RACES.length);
    expect(new Set(G1_RACES.map((r) => `${r.nameEn}|${r.courseId}|${r.season}`)).size).toBe(G1_RACES.length);
  });

  it("takes season and time as GameTora publishes them", () => {
    expect(byName("Oka Sho").season).toBe(5);
    expect(byName("Osaka Hai").season).toBe(5);
    expect(byName("Teio Sho").time).toBe(4);
    expect(byName("Tokyo Daishoten").time).toBe(3);
  });

  it("adds the master.mdb Breeders' Cup G1s at Santa Anita and Del Mar", () => {
    const bc = G1_RACES.filter((race) => race.raceId >= 23001 && race.raceId <= 23018);
    expect(bc).toHaveLength(18);
    expect(bc.filter((race) => race.trackId === 10202)).toHaveLength(9);
    expect(bc.filter((race) => race.trackId === 10203)).toHaveLength(9);
    expect(bc.every((race) => race.season === 3 && race.time === 2 && race.nameEn.startsWith("BC "))).toBe(true);
    expect(byName("BC Classic", 10203).courseId).toBe(11709);
  });

  it("applies course, season and time; leaves weather and ground random; keeps style and racers", () => {
    const next = g1TrackInfo(base, byName("Arima Kinen"));
    expect(next.trackId).toBe(10005);
    expect(next.courseId).toBe(10506);
    expect(next.pvpEventId).toBeNull();
    expect(next.masterChallengeSelection).toBeNull();
    expect(next.customRaceConditions).toEqual({ season: 4, weather: null, groundCondition: null, time: 2 });
    expect(next.runningStyle).toBe(base.runningStyle);
    expect(next.racerCount).toBe(12);
  });

  it("finds the G1s that match the current custom track", () => {
    const tokyoMile = g1TrackInfo(base, byName("Victoria Mile"));
    expect(matchingG1Races(tokyoMile).map((r) => r.nameEn).sort()).toEqual(["NHK Mile Cup", "Victoria Mile", "Yasuda Kinen"]);
    expect(matchingG1Races({ ...tokyoMile, pvpEventId: "cm-x" })).toEqual([]);
  });
});
