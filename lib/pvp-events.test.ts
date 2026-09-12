import { describe, it, expect } from "bun:test";
import { PVP_EVENTS, getPvpEventById } from "./pvp-events";

describe("PvP Presets & Events", () => {
  it("contains all 4 curated PvP events with valid parameters", () => {
    expect(PVP_EVENTS.length).toBe(4);

    const longchampCm = getPvpEventById("cm-classic-2026-09");
    expect(longchampCm).toBeDefined();
    expect(longchampCm?.trackId).toBe(10201); // Longchamp
    expect(longchampCm?.courseId).toBe(11203); // 2400m Turf
    expect(longchampCm?.racerCount).toBe(9);
    expect(longchampCm?.season).toBe("Fall");
    expect(longchampCm?.weather).toBe("Sunny");
    expect(longchampCm?.ground).toBe("Heavy");
    expect(longchampCm?.groundNum).toBe(3);
    expect(longchampCm?.time).toBe("Daytime");
    expect(longchampCm?.noDebuffs).toBe(true);
    expect(longchampCm?.specialRules).toContain("No Debuffs");

    const sepCm = getPvpEventById("cm-mile-2026-09");
    expect(sepCm).toBeDefined();
    expect(sepCm?.trackId).toBe(10006); // Tokyo
    expect(sepCm?.courseId).toBe(10603); // 1800m Turf
    expect(sepCm?.racerCount).toBe(9);
    expect(sepCm?.season).toBe("Fall");
    expect(sepCm?.weather).toBe("Sunny");
    expect(sepCm?.ground).toBe("Good");
    expect(sepCm?.time).toBe("Daytime");

    const octCm = getPvpEventById("cm-classic-2026-10");
    expect(octCm).toBeDefined();
    expect(octCm?.trackId).toBe(10008); // Kyoto
    expect(octCm?.courseId).toBe(10808); // 2200m Turf Outer
    expect(octCm?.racerCount).toBe(9);
    expect(octCm?.weather).toBe("Cloudy");
    expect(octCm?.ground).toBe("Good");

    const novLoh = getPvpEventById("league-heroes-2026-11");
    expect(novLoh).toBeDefined();
    expect(novLoh?.trackId).toBe(10008); // Kyoto
    expect(novLoh?.courseId).toBe(10810); // 3000m Turf Outer
    expect(novLoh?.racerCount).toBe(12);
    expect(novLoh?.weather).toBeNull();
    expect(novLoh?.ground).toBeNull();
  });
});
