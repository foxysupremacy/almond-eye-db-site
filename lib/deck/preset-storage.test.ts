import { afterEach, describe, expect, test } from "bun:test";
import {
  createDefaultPreset,
  DEFAULT_PRESET,
  loadStoredPresets,
  persistPresetsAndVisualizer,
} from "./preset-storage";
import { PRESETS_STORAGE_KEY, VISUALIZER_SAVE_KEY } from "./constants";

function fakeStorage(): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void; _map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    _map: map,
  };
}

function installWindow(storage = fakeStorage()) {
  (globalThis as Record<string, unknown>).window = { localStorage: storage };
  return storage;
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe("createDefaultPreset", () => {
  test("6 empty main + parent slots and default track info", () => {
    const p = createDefaultPreset("id-1", "My Build");
    expect(p.id).toBe("id-1");
    expect(p.name).toBe("My Build");
    expect(p.mainDeckIds).toEqual([null, null, null, null, null, null]);
    expect(p.parentDeckIds).toEqual([null, null, null, null, null, null]);
    expect(p.trackInfo.racerCount).toBe(12);
    expect(p.trackInfo.pvpEventId).toBeNull();
  });

  test("DEFAULT_PRESET uses the canonical default id/name", () => {
    expect(DEFAULT_PRESET.id).toBe("default-1");
    expect(DEFAULT_PRESET.name).toBe("Default Build");
  });
});

describe("loadStoredPresets", () => {
  test("returns null without a window/localStorage", () => {
    expect(loadStoredPresets()).toBeNull();
  });

  test("returns null when the storage key is absent or empty array", () => {
    installWindow();
    expect(loadStoredPresets()).toBeNull();
    installWindow().setItem(PRESETS_STORAGE_KEY, "[]");
    expect(loadStoredPresets()).toBeNull();
  });

  test("round-trips valid presets with the first preset active", () => {
    const stored = [
      { id: "a", name: "First", mainDeckIds: [1, 2, null, null, null, null], parentDeckIds: [null, null, null, null, null, null], trackInfo: { trackId: 10006, courseId: 10606, runningStyle: 2, racerCount: 15, pvpEventId: "pvp-1" }, mainChainChoices: { "1:5": 2 } },
      { id: "b", name: "Second" },
    ];
    installWindow().setItem(PRESETS_STORAGE_KEY, JSON.stringify(stored));
    const out = loadStoredPresets();
    expect(out?.activeId).toBe("a");
    expect(out?.presets[0].trackInfo.runningStyle).toBe(2);
    expect(out?.presets[0].trackInfo.pvpEventId).toBe("pvp-1");
    expect(out?.presets[0].mainChainChoices).toEqual({ "1:5": 2 });
    expect(out?.presets[1].name).toBe("Second");
  });

  test("sanitizes malformed entries instead of throwing", () => {
    const stored = [
      { name: 42, mainDeckIds: "nope", trackInfo: { runningStyle: 9, racerCount: "many" }, mainChainChoices: { ok: 1.5, bad: "x" } },
    ];
    installWindow().setItem(PRESETS_STORAGE_KEY, JSON.stringify(stored));
    const out = loadStoredPresets();
    expect(out).not.toBeNull();
    const p = out!.presets[0];
    expect(p.id).toMatch(/^preset-1-/); // synthesized id
    expect(p.name).toBe("Preset 1");
    expect(p.mainDeckIds).toEqual([null, null, null, null, null, null]);
    expect(p.trackInfo.runningStyle).toBeNull();
    expect(p.trackInfo.racerCount).toBe(12);
    // cleanChoices keeps finite numbers, drops everything else
    expect(p.mainChainChoices).toEqual({ ok: 1.5 });
  });

  test("truncates deck id arrays to DECK_SIZE and coerces non-numbers to null", () => {
    const stored = [{ id: "a", name: "n", mainDeckIds: [1, "x", 3, 4, 5, 6, 7, 8] }];
    installWindow().setItem(PRESETS_STORAGE_KEY, JSON.stringify(stored));
    const out = loadStoredPresets()!;
    expect(out.presets[0].mainDeckIds).toEqual([1, null, 3, 4, 5, 6]);
  });

  test("returns null on corrupt JSON", () => {
    installWindow().setItem(PRESETS_STORAGE_KEY, "{not json");
    expect(loadStoredPresets()).toBeNull();
  });
});

describe("persistPresetsAndVisualizer", () => {
  test("writes presets, activePresetId, and the visualizer snapshot from the active preset", () => {
    const storage = installWindow();
    const preset = createDefaultPreset("a", "A");
    preset.trackInfo = { trackId: 10007, courseId: 10607, runningStyle: 3, racerCount: 14, pvpEventId: null };
    persistPresetsAndVisualizer([preset], preset);

    const saved = JSON.parse(storage._map.get(PRESETS_STORAGE_KEY)!);
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe("a");
    expect(storage._map.get("almondeye_active_preset_id")).toBe("a");
    const viz = JSON.parse(storage._map.get(VISUALIZER_SAVE_KEY)!);
    expect(viz).toEqual({ trackId: 10007, courseId: 10607, racerCount: 14 });
  });

  test("restores activeId from almondeye_active_preset_id when present", () => {
    const storage = installWindow();
    const stored = [
      { id: "p1", name: "Preset 1" },
      { id: "p2", name: "Preset 2" },
    ];
    storage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(stored));
    storage.setItem("almondeye_active_preset_id", "p2");
    const out = loadStoredPresets();
    expect(out?.activeId).toBe("p2");
  });

  test("is a no-op without a window/localStorage", () => {
    expect(() => persistPresetsAndVisualizer([DEFAULT_PRESET], DEFAULT_PRESET)).not.toThrow();
  });
});
