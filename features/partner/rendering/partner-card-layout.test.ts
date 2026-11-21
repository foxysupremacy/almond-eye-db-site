import { describe, expect, test } from "bun:test";
import type { PartnerCardModel } from "../model/partner-card-model";
import { CARD_WIDTH, layoutPartnerCard, type DrawOp } from "./partner-card-layout";

const measure = (text: string) => text.length * 8;

const MODEL: PartnerCardModel = {
  cardId: 111401,
  nameEn: "Test Uma",
  nameJp: "テスト",
  titleEn: "[Title]",
  portraitUrl: "https://cdn.example/portrait.png",
  rank: 81,
  rankIconSrc: "/assets/statusrank/utx_ico_statusrank_81.png",
  rarity: 3,
  stats: [
    { label: "Speed", value: 1200 },
    { label: "Stamina", value: 900 },
    { label: "Power", value: 800 },
    { label: "Guts", value: 400 },
    { label: "Wit", value: 600 },
  ],
  aptitudes: {
    surface: [{ label: "Turf", grade: "A" }, { label: "Dirt", grade: "G" }],
    distance: [{ label: "Sprint", grade: "G" }, { label: "Mile", grade: "B" }, { label: "Medium", grade: "A" }, { label: "Long", grade: "S" }],
    style: [{ label: "Front", grade: "G" }, { label: "Pace", grade: "A" }, { label: "Late", grade: "A" }, { label: "End", grade: "C" }],
  },
  supportCards: Array.from({ length: 6 }, (_, i) => ({ id: 30000 + i, nameEn: `Card ${i}`, nameJp: "", rarity: 3, lbLabel: "MLB", imageUrl: `https://cdn.example/c${i}.png` })),
  skills: Array.from({ length: 9 }, (_, i) => ({ id: i + 1, nameEn: `Skill ${i}`, nameJp: "", level: 1, rarity: 1, iconId: 10011 })),
  sparks: [
    {
      owner: "self",
      ownerName: "Test Uma",
      blue: [{ factorId: 203, type: "blue", name: "Stamina", stars: 3 }],
      pink: [{ factorId: 2402, type: "pink", name: "Chaser", stars: 2 }],
      green: [],
      white: Array.from({ length: 30 }, (_, i) => ({ factorId: 1000 + i, type: "white" as const, name: `Very long white spark ${i}`, stars: 1 })),
    },
  ],
  wins: Array.from({ length: 7 }, (_, i) => ({ id: i, name: `G1 Race ${i}`, nameJp: "" })),
};

const texts = (ops: DrawOp[]) => ops.filter((o) => o.type === "text").map((o) => (o as { text: string }).text);
const images = (ops: DrawOp[]) => ops.filter((o) => o.type === "image");

describe("layoutPartnerCard", () => {
  test("draws every visible section and fits all ops inside the canvas", () => {
    const layout = layoutPartnerCard(MODEL, ["support-cards", "skills", "sparks", "affinity", "wins"], { total: 120, base: 100, raceBonus: 20 }, "Trainee", measure);
    expect(layout.width).toBe(CARD_WIDTH);
    const t = texts(layout.ops);
    for (const heading of ["SUPPORT CARDS", "SKILLS", "SPARKS", "AFFINITY", "G1 WINS"]) expect(t).toContain(heading);
    expect(t).toContain("Test Uma");
    expect(t).toContain("120 pts");
    for (const op of layout.ops) {
      expect(op.y).toBeGreaterThanOrEqual(0);
      expect(op.y).toBeLessThanOrEqual(layout.height);
      if ("x" in op) expect(op.x).toBeLessThanOrEqual(CARD_WIDTH);
    }
    // portrait + rank + 6 cards + 9 skill icons
    expect(images(layout.ops).length).toBe(2 + 6 + 9);
  });

  test("hidden sections are not drawn and the card gets shorter", () => {
    const full = layoutPartnerCard(MODEL, ["support-cards", "skills", "sparks", "wins"], null, null, measure);
    const slim = layoutPartnerCard(MODEL, ["skills"], null, null, measure);
    expect(slim.height).toBeLessThan(full.height);
    expect(texts(slim.ops)).not.toContain("SUPPORT CARDS");
    expect(texts(slim.ops)).not.toContain("SPARKS");
    expect(texts(slim.ops)).toContain("SKILLS");
  });

  test("spark chips wrap onto new lines instead of overflowing", () => {
    const layout = layoutPartnerCard(MODEL, ["sparks"], null, null, measure);
    const chips = layout.ops.filter((o) => o.type === "rect" && (o as { tag?: string }).tag === "spark") as { x: number; y: number; w: number }[];
    expect(chips.length).toBe(32);
    expect(new Set(chips.map((c) => c.y)).size).toBeGreaterThan(1);
    for (const c of chips) expect(c.x + c.w).toBeLessThanOrEqual(CARD_WIDTH);
  });

  test("affinity without a trainee says so", () => {
    const layout = layoutPartnerCard(MODEL, ["affinity"], null, null, measure);
    expect(texts(layout.ops).some((t) => t.includes("No trainee"))).toBe(true);
  });
});
