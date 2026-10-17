import { describe, expect, it } from "bun:test";
import { api } from "@/lib/api";
import { matchSkillsFromOcrText, normalizeOcrText, substringEditDistance } from "./ocr-match";

const ROUSED_SPIRIT = 204472;

describe("normalizeOcrText", () => {
  it("strips OCR spacing/punctuation and folds small kana and long-vowel lookalikes", () => {
    expect(normalizeOcrText("奮 い 立 つ 心")).toBe("奮い立つ心");
    expect(normalizeOcrText("ラッキー！")).toBe(normalizeOcrText("ラツキ一"));
  });
});

describe("substringEditDistance", () => {
  it("measures the best window inside a longer line", () => {
    expect(substringEditDistance("abc", "xxabcxx")).toBe(0);
    expect(substringEditDistance("abc", "xxabdxx")).toBe(1);
  });
});

describe("matchSkillsFromOcrText", () => {
  const skillsPromise = api.listSkills();

  const cases: [string, string][] = [
    ["exact name", "奮い立つ心"],
    ["glyph spacing", "奮 い 立 つ 心"],
    ["a misread kanji", "奪い立つ心"],
    ["surrounding UI text", "Hint Lv 2\n奮い立つ心 144\nCurrent Speed (natural decel) +0.15 m/s"],
    ["typed English name", "roused spirit"],
    // Verbatim tesseract.js (jpn) output for an English-client skill-hint screenshot.
    ["raw OCR of a hint panel", "ーー ババ ババ 一\nHint Lv 2\n奮 い 立 つ 心\nる Current Speed (natural decel) +0.15 m/s for\n時 ー 羽 ルッ 3 s when: Medium AND Corner 3 (random) 天 144\nAND In leading 50% OR Long AND Corner 3\n(random) AND In leading 50%"],
  ];
  for (const [label, text] of cases) {
    it(`finds Roused Spirit from ${label}`, async () => {
      const matches = matchSkillsFromOcrText(text, await skillsPromise);
      expect(matches[0]?.skill.id).toBe(ROUSED_SPIRIT);
    });
  }

  it("does not surface incidental matches next to a confident hit", async () => {
    const matches = matchSkillsFromOcrText("奮い立つ心\nる Current Speed (natural decel) +0.15 m/s", await skillsPromise);
    expect(matches.map((match) => match.skill.id)).toEqual([ROUSED_SPIRIT]);
  });

  it("returns nothing for text with no skill name", async () => {
    expect(matchSkillsFromOcrText("Current Speed +0.15 m/s for 3 s", await skillsPromise)).toEqual([]);
    expect(matchSkillsFromOcrText("", await skillsPromise)).toEqual([]);
  });
});
