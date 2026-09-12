import { describe, expect, test } from "bun:test";
import {
  encodePresetToShareCode,
  decodePresetFromShareCode,
  buildShareUrl,
  extractShareCodeFromUrl,
} from "./share-codec";
import type { DeckPreset } from "../components/store";

describe("share-codec V2", () => {
  test("encodes and decodes a full preset accurately with compact length", () => {
    const preset: DeckPreset = {
      id: "test-preset-1",
      name: "Tokyo 2400m Leader Build",
      mainDeckIds: [30001, 30002, 30003, null, 20005, 10001],
      parentDeckIds: [30101, 30102, null, null, null, 30106],
      trackInfo: {
        trackId: 10001,
        courseId: 10001,
        runningStyle: 2,
        racerCount: 18,
      },
      mainChainChoices: { "30001": 2, "30002": 1 },
      parentChainChoices: { "30101": 3 },
    };

    const code = encodePresetToShareCode(preset);
    expect(typeof code).toBe("string");
    // Code should be ultra-compact (< 60 chars even with long name & choices)
    expect(code.length).toBeGreaterThan(20);
    expect(code.length).toBeLessThan(60);

    const decoded = decodePresetFromShareCode(code);
    expect(Boolean(decoded)).toBe(true);
    expect(decoded?.name).toBe("Tokyo 2400m Leader Build");
    expect(decoded?.trackInfo.trackId).toBe(10001);
    expect(decoded?.trackInfo.courseId).toBe(10001);
    expect(decoded?.trackInfo.runningStyle).toBe(2);
    expect(decoded?.trackInfo.racerCount).toBe(18);
    expect(decoded?.mainDeckIds).toEqual([30001, 30002, 30003, null, 20005, 10001]);
    expect(decoded?.parentDeckIds).toEqual([30101, 30102, null, null, null, 30106]);
    expect(decoded?.mainChainChoices).toEqual({ "30001": 2, "30002": 1 });
    expect(decoded?.parentChainChoices).toEqual({ "30101": 3 });
  });

  test("achieves ~40 chars on competitive deck (Mile Senkou with 6 main, 2 parent)", () => {
    const preset: DeckPreset = {
      id: "preset-mile",
      name: "Mile Senkou",
      mainDeckIds: [30305, 30311, 30275, 30253, 30289, 30294],
      parentDeckIds: [30283, 30309, null, null, null, null],
      trackInfo: {
        trackId: 10006,
        courseId: 10603,
        runningStyle: 2,
        racerCount: 9,
      },
      mainChainChoices: {},
      parentChainChoices: {},
    };

    const code = encodePresetToShareCode(preset);
    expect(code.length).toBeLessThan(42);

    const decoded = decodePresetFromShareCode(code);
    expect(decoded?.name).toBe("Mile Senkou");
    expect(decoded?.mainDeckIds).toEqual([30305, 30311, 30275, 30253, 30289, 30294]);
    expect(decoded?.parentDeckIds).toEqual([30283, 30309, null, null, null, null]);
    expect(decoded?.trackInfo.trackId).toBe(10006);
    expect(decoded?.trackInfo.courseId).toBe(10603);
    expect(decoded?.trackInfo.runningStyle).toBe(2);
    expect(decoded?.trackInfo.racerCount).toBe(9);
  });

  test("achieves ultra-compact size (~26-30 chars) without parent deck", () => {
    const preset: DeckPreset = {
      id: "preset-main-only",
      name: "Short Build",
      mainDeckIds: [30001, 30002, 30003, null, null, null],
      parentDeckIds: [],
      trackInfo: {
        trackId: 0,
        courseId: 0,
        runningStyle: null,
        racerCount: 12,
      },
    };

    const code = encodePresetToShareCode(preset);
    expect(code.length).toBeLessThan(25);

    const decoded = decodePresetFromShareCode(code);
    expect(decoded?.name).toBe("Short Build");
    expect(decoded?.mainDeckIds).toEqual([30001, 30002, 30003, null, null, null]);
    expect(decoded?.parentDeckIds).toEqual([null, null, null, null, null, null]);
  });

  test("handles Japanese Kanji, Katakana, and Emoji preset names via UTF-8 mode", () => {
    const preset: DeckPreset = {
      id: "preset-jp",
      name: "マイル先行 育成★",
      mainDeckIds: [30001, 30002, null, null, null, null],
      parentDeckIds: [],
      trackInfo: {
        trackId: 10001,
        courseId: 10001,
        runningStyle: 1,
        racerCount: 12,
      },
    };

    const code = encodePresetToShareCode(preset);
    const decoded = decodePresetFromShareCode(code);
    expect(decoded?.name).toBe("マイル先行 育成★");
  });

  test("handles high course IDs up to 11709", () => {
    const preset: DeckPreset = {
      id: "preset-high-course",
      name: "High Course Test",
      mainDeckIds: [30001, null, null, null, null, null],
      parentDeckIds: [],
      trackInfo: {
        trackId: 10203,
        courseId: 11709,
        runningStyle: 3,
        racerCount: 16,
      },
    };

    const code = encodePresetToShareCode(preset);
    const decoded = decodePresetFromShareCode(code);
    expect(decoded?.trackInfo.trackId).toBe(10203);
    expect(decoded?.trackInfo.courseId).toBe(11709);
  });

  test("builds share URL using #s= prefix", () => {
    const preset: DeckPreset = {
      id: "p1",
      name: "Test",
      mainDeckIds: [30001, null, null, null, null, null],
      parentDeckIds: [],
      trackInfo: { trackId: 0, courseId: 0, runningStyle: null, racerCount: 12 },
    };
    const url = buildShareUrl(preset, "https://database.almond-eye.tech");
    expect(url).toContain("#s=");
  });

  test("extracts share code from url hash (#s= and #share=), query, and path", () => {
    const code = "YMltB_PUZ6vPM547PQZ6Nwnnc9VBc2OZ8BN-iWm8";
    expect(extractShareCodeFromUrl(`https://database.almond-eye.tech/#s=${code}`)).toBe(code);
    expect(extractShareCodeFromUrl(`https://database.almond-eye.tech/?s=${code}`)).toBe(code);
    expect(extractShareCodeFromUrl(`https://database.almond-eye.tech/s/${code}`)).toBe(code);
    expect(extractShareCodeFromUrl(`https://database.almond-eye.tech/#share=${code}`)).toBe(code);
    expect(extractShareCodeFromUrl(`https://database.almond-eye.tech/?share=${code}`)).toBe(code);
    expect(extractShareCodeFromUrl(`https://database.almond-eye.tech/share/${code}`)).toBe(code);
  });

  test("backward compatibility: successfully decodes legacy V1 share codes", () => {
    const legacyCode = "AScWKWsCCXZhdmd2Q3YtdlF2VnZLdmUAAAAAAAAAAAUAAAEAAAIAAAIAAAMAAAMBAAACC01pbGUgU2Vua291";
    const decoded = decodePresetFromShareCode(legacyCode);
    expect(Boolean(decoded)).toBe(true);
    expect(decoded?.name).toBe("Mile Senkou");
    expect(decoded?.trackInfo.trackId).toBe(10006);
    expect(decoded?.trackInfo.courseId).toBe(10603);
    expect(decoded?.trackInfo.runningStyle).toBe(2);
    expect(decoded?.trackInfo.racerCount).toBe(9);
    expect(decoded?.mainDeckIds).toEqual([30305, 30311, 30275, 30253, 30289, 30294]);
  });
});
