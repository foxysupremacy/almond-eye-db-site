import { describe, expect, test } from "bun:test";
import { customTrackInfo, normalizeRaceConditions } from "./race-conditions";
import { createDefaultPreset } from "./preset-storage";
import { buildImportedPreset, presetReducer } from "./preset-reducer";
import { encodePresetToShareCode, decodePresetFromShareCode } from "../share-link/codec";

const conditions = { season: 5, weather: 3, groundCondition: 4, time: 2 };

describe("custom race conditions", () => {
  test("normalizes absent and invalid values independently", () => {
    expect(normalizeRaceConditions()).toEqual({ season: null, weather: null, groundCondition: null, time: null });
    expect(normalizeRaceConditions({ season: 6, weather: "2", groundCondition: 1.5, time: 0 })).toEqual(normalizeRaceConditions());
    expect(normalizeRaceConditions({ ...conditions, weather: NaN })).toEqual({ ...conditions, weather: null });
  });
  test("leaving either event resets conditions and removes both event references", () => {
    for (const event of [{ pvpEventId: "cm" }, { masterChallengeSelection: { eventId: 1009, eventSubId: 1044 } }]) {
      const info = { ...createDefaultPreset("p", "P").trackInfo, customRaceConditions: conditions, ...event };
      const result = customTrackInfo(info);
      expect(result.customRaceConditions).toEqual(normalizeRaceConditions());
      expect(result.pvpEventId).toBeNull();
      expect(result.masterChallengeSelection).toBeNull();
      expect(result.courseId).toBe(info.courseId);
    }
  });
  test("custom course changes preserve conditions; explicit custom selection resets", () => {
    const info = { ...createDefaultPreset("p", "P").trackInfo, customRaceConditions: conditions };
    expect(customTrackInfo(info).customRaceConditions).toEqual(conditions);
    expect(customTrackInfo(info, true).customRaceConditions).toEqual(normalizeRaceConditions());
  });
  test("V4 round trip and import preserve conditions; old links default to any", () => {
    const preset = createDefaultPreset("p", "P");
    expect(decodePresetFromShareCode(encodePresetToShareCode(preset))?.trackInfo.customRaceConditions).toEqual(normalizeRaceConditions());
    preset.trackInfo.customRaceConditions = conditions;
    const decoded = decodePresetFromShareCode(encodePresetToShareCode(preset))!;
    expect(decoded.trackInfo.customRaceConditions).toEqual(conditions);
    expect(buildImportedPreset("new", "New", decoded).trackInfo.customRaceConditions).toEqual(conditions);
    const next = presetReducer({ presets: [preset], activeId: "p" }, { type: "duplicatePreset", id: "p", newId: "copy" });
    next.presets[1].trackInfo.customRaceConditions!.weather = 1;
    expect(preset.trackInfo.customRaceConditions.weather).toBe(3);
    const imported = presetReducer({ presets: [preset], activeId: "p" }, { type: "importOverwrite", presetData: decoded });
    expect(imported.presets[0].trackInfo.customRaceConditions).toEqual(conditions);
  });
});
