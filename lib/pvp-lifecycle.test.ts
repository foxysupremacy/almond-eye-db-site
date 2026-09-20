import { describe, it, expect } from "bun:test";
import {
  getPvpEventStage,
  isPvpEventEnded,
  getActivePvpEvents,
  type PvpEvent,
} from "./pvp-events";

describe("PVP Event Lifecycle", () => {
  const baseEvent: PvpEvent = {
    id: "test-cm",
    name: "Test CM",
    shortName: "Test CM",
    trackId: 10006,
    courseId: 10603,
    racerCount: 9,
    season: "Fall",
    seasonIcon: "",
    seasonNum: 3,
    weather: "Sunny",
    weatherIcon: "",
    weatherNum: 1,
    ground: "Good",
    groundNum: 1,
    time: "Daytime",
    timeIcon: "",
    timeNum: 2,
    gradeNum: 100,
    startDate: "2026-09-14T12:00:00+09:00",
    durationDays: 6,
  };

  it("calculates correct CM stages over 6 days", () => {
    // Before start: upcoming
    expect(getPvpEventStage(baseEvent, new Date("2026-09-14T11:00:00+09:00"))).toBe("upcoming");

    // Day 1: round1 (0h - 48h)
    expect(getPvpEventStage(baseEvent, new Date("2026-09-14T13:00:00+09:00"))).toBe("round1");
    expect(getPvpEventStage(baseEvent, new Date("2026-09-16T11:00:00+09:00"))).toBe("round1");

    // Day 3: round2 (48h - 96h)
    expect(getPvpEventStage(baseEvent, new Date("2026-09-16T13:00:00+09:00"))).toBe("round2");
    expect(getPvpEventStage(baseEvent, new Date("2026-09-18T11:00:00+09:00"))).toBe("round2");

    // Day 5 first 12h: team_selection (96h - 108h)
    expect(getPvpEventStage(baseEvent, new Date("2026-09-18T13:00:00+09:00"))).toBe("team_selection");
    expect(getPvpEventStage(baseEvent, new Date("2026-09-18T23:00:00+09:00"))).toBe("team_selection");

    // Day 5 second 12h: matchmaking (108h - 120h)
    expect(getPvpEventStage(baseEvent, new Date("2026-09-19T01:00:00+09:00"))).toBe("matchmaking");
    expect(getPvpEventStage(baseEvent, new Date("2026-09-19T11:00:00+09:00"))).toBe("matchmaking");

    // Day 6: finals (120h - 144h)
    expect(getPvpEventStage(baseEvent, new Date("2026-09-19T13:00:00+09:00"))).toBe("finals");
    expect(getPvpEventStage(baseEvent, new Date("2026-09-20T11:00:00+09:00"))).toBe("finals");

    // After Day 6: ended (>144h)
    expect(getPvpEventStage(baseEvent, new Date("2026-09-20T13:00:00+09:00"))).toBe("ended");
    expect(isPvpEventEnded(baseEvent, new Date("2026-09-20T13:00:00+09:00"))).toBe(true);
  });

  it("filters out ended events in getActivePvpEvents", () => {
    // Current date (Sept 20, 2026 evening JST)
    const now = new Date("2026-09-20T20:00:00+09:00");
    const active = getActivePvpEvents(now);
    expect(active.some((e) => e.id === "cm-mile-2026-09")).toBe(false);
    expect(active.some((e) => e.id === "cm-classic-2026-09")).toBe(true);
  });
});
