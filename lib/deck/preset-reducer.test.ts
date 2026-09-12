import { describe, expect, test } from "bun:test";
import {
  presetReducer,
  buildImportedPreset,
  type PresetListState,
} from "./preset-reducer";
import { createDefaultPreset } from "./preset-storage";

function state(n = 2): PresetListState {
  return {
    presets: Array.from({ length: n }, (_, i) => {
      const p = createDefaultPreset(`p-${i + 1}`, `Preset ${i + 1}`);
      p.mainDeckIds = [30308, null, null, null, null, null];
      return p;
    }),
    activeId: "p-1",
  };
}

describe("presetReducer", () => {
  test("addPreset appends and activates, trimming the name", () => {
    const next = presetReducer(state(1), { type: "addPreset", id: "new", name: "  " });
    expect(next.presets).toHaveLength(2);
    expect(next.activeId).toBe("new");
    expect(next.presets[1].name).toBe("Preset 2"); // fallback uses current length
  });

  test("duplicatePreset deep-copies deck ids, track info and chain choices", () => {
    const s = state(1);
    s.presets[0] = {
      ...s.presets[0],
      mainChainChoices: { "30308:1001": 2 },
      parentChainChoices: { "30308:1001": 1 },
    };
    const next = presetReducer(s, { type: "duplicatePreset", id: "p-1", newId: "copy" });
    const [orig, copy] = next.presets as [typeof next.presets[0], typeof next.presets[0]];
    expect(next.activeId).toBe("copy");
    expect(copy.name).toBe("Preset 1 (Copy)");
    expect(copy.mainChainChoices).toEqual({ "30308:1001": 2 });
    copy.mainDeckIds[0] = 42;
    copy.mainChainChoices!["30308:1001"] = 3;
    expect(orig.mainDeckIds[0]).toBe(30308);
    expect(orig.mainChainChoices!["30308:1001"]).toBe(2);
  });

  test("duplicatePreset is a no-op for an unknown id", () => {
    const s = state(2);
    expect(presetReducer(s, { type: "duplicatePreset", id: "nope", newId: "x" })).toBe(s);
  });

  test("deletePreset refuses to delete the last preset and re-points activeId", () => {
    const single = state(1);
    expect(presetReducer(single, { type: "deletePreset", id: "p-1" })).toBe(single);

    const next = presetReducer(state(2), { type: "deletePreset", id: "p-1" });
    expect(next.presets.map((p) => p.id)).toEqual(["p-2"]);
    expect(next.activeId).toBe("p-2");
  });

  test("reorderPresets clamps out-of-range indices and moves the preset", () => {
    const s = state(3);
    expect(presetReducer(s, { type: "reorderPresets", fromIndex: 0, toIndex: 9 })).toBe(s);
    const moved = presetReducer(s, { type: "reorderPresets", fromIndex: 0, toIndex: 2 });
    expect(moved.presets.map((p) => p.id)).toEqual(["p-2", "p-3", "p-1"]);
  });

  test("updateActivePreset only touches the active preset", () => {
    const next = presetReducer(state(2), {
      type: "updateActivePreset",
      update: (p) => ({ ...p, trackInfo: { ...p.trackInfo, racerCount: 18 } }),
    });
    expect(next.presets[0].trackInfo.racerCount).toBe(18);
    expect(next.presets[1].trackInfo.racerCount).toBe(12);
  });

  test("importOverwrite merges shared data into the active preset", () => {
    const next = presetReducer(state(2), {
      type: "importOverwrite",
      presetData: {
        mainDeckIds: [1, 2, null, null, null, null],
        trackInfo: { trackId: 10001, courseId: 10101, runningStyle: 4, racerCount: 9 },
        mainChainChoices: { "1:5": 3 },
      },
      customName: "Imported",
    });
    const active = next.presets.find((p) => p.id === "p-1")!;
    expect(active.name).toBe("Imported");
    expect(active.mainDeckIds[0]).toBe(1);
    expect(active.trackInfo.runningStyle).toBe(4);
    expect(active.mainChainChoices).toEqual({ "1:5": 3 });
    expect(next.presets[1].name).toBe("Preset 2");
  });

  test("importAsNew appends and activates", () => {
    const preset = { ...createDefaultPreset("shared", "Shared Build") };
    const next = presetReducer(state(1), { type: "importAsNew", preset });
    expect(next.presets.map((p) => p.id)).toEqual(["p-1", "shared"]);
    expect(next.activeId).toBe("shared");
  });
});

describe("buildImportedPreset", () => {
  test("fills defaults for missing fields and clamps deck size", () => {
    const p = buildImportedPreset("id", "Name", {
      mainDeckIds: [1, 2, 3, 4, 5, 6, 7, 8] as number[],
    });
    expect(p.mainDeckIds).toEqual([1, 2, 3, 4, 5, 6]);
    expect(p.parentDeckIds).toEqual([null, null, null, null, null, null]);
    expect(p.trackInfo.racerCount).toBe(12);
    expect(p.trackInfo.pvpEventId).toBeNull();
  });
});
