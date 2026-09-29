import { describe, expect, test } from "bun:test";
import {
  encodePresetToShareCode,
  decodePresetFromShareCode,
} from "./codec";
import { buildShareUrl, extractShareCodeFromUrl } from "./url";
import type { DeckPreset } from "../deck/types";

describe("share-codec V4", () => {
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
    // Code should remain ultra-compact (< 64 chars even with a long name and choices).
    expect(code.length).toBeGreaterThan(20);
    expect(code.length).toBeLessThan(64);

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

  test("achieves ~44 chars on competitive deck (Mile Senkou with 6 main, 2 parent)", () => {
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
    expect(code.length).toBeLessThan(46);

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
    expect(code.length).toBeLessThan(28);

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
    const code = "wAOyDJbQfz1GerzzOeOz0GejcJ53PVQXNjmfATfolpvA";
    expect(extractShareCodeFromUrl(`https://database.almond-eye.tech/#s=${code}`)).toBe(code);
    expect(extractShareCodeFromUrl(`https://database.almond-eye.tech/?s=${code}`)).toBe(code);
    expect(extractShareCodeFromUrl(`https://database.almond-eye.tech/s/${code}`)).toBe(code);
    expect(extractShareCodeFromUrl(`https://database.almond-eye.tech/#share=${code}`)).toBe(code);
    expect(extractShareCodeFromUrl(`https://database.almond-eye.tech/?share=${code}`)).toBe(code);
    expect(extractShareCodeFromUrl(`https://database.almond-eye.tech/share/${code}`)).toBe(code);
  });

  test("rejects V1, V2, and V3 codes; only the current format is supported", () => {
    const oldCodes = [
      "AScWKWsCCXZhdmd2Q3YtdlF2VnZLdmUAAAAAAAAAAAUAAAEAAAIAAAIAAAMAAAMBAAACC01pbGUgU2Vua291",
      "YMltB_PUZ6vPM547PQZ6MBc2OZ8BN-iWm8A",
      "gAOyDJbQfz1GerzzOeOz0GejcJ53PVQXNjmfATfolpvA",
    ];

    for (const code of oldCodes) {
      expect(decodePresetFromShareCode(code)).toBeNull();
    }
  });

  test("skips unknown extension sections without failing", async () => {
    const { BitWriter, base64UrlToBytes } = await import("./codec");

    const preset: DeckPreset = {
      id: "ext",
      name: "Ext Test",
      mainDeckIds: [30001, null, null, null, null, null],
      parentDeckIds: [],
      trackInfo: { trackId: 10006, courseId: 10603, runningStyle: null, racerCount: 12 },
    };
    const base = encodePresetToShareCode(preset);
    expect(decodePresetFromShareCode(base)?.mainDeckIds).toEqual([
      30001, null, null, null, null, null,
    ]);

    // Rebuild the code with a bogus extension section (tag 15, 5 junk bits)
    // injected right after the version header, before the CORE section. A
    // A decoder of today's format must skip it and still decode CORE.
    const bytes = base64UrlToBytes(base);
    const w = new BitWriter(96);
    w.write(3, 2); // V4 discriminator 0b11
    w.write(15, 4); // unknown tag
    w.write(5, 16); // section length: 5 bits
    w.write(0b101, 5); // junk payload
    for (let i = 2; i < bytes.length * 8; i++) {
      w.write((bytes[i >> 3] >>> (7 - (i & 7))) & 1, 1); // rest of the original stream
    }

    const decoded = decodePresetFromShareCode(w.getEncoded());
    expect(decoded?.name).toBe("Ext Test");
    expect(decoded?.trackInfo.trackId).toBe(10006);
    expect(decoded?.trackInfo.courseId).toBe(10603);
    expect(decoded?.mainDeckIds).toEqual([30001, null, null, null, null, null]);
  });
});
