// Pure layout for the Partner Card PNG: model → list of draw operations.
// No DOM access, so it is unit-testable; the canvas renderer just executes ops.

import type { AffinityCalculationResult } from "@/lib/lineage/affinity-engine";
import type { PartnerSection } from "@/lib/veterans/share/partner-codec";
import type { PartnerCardModel } from "../model/partner-card-model";

export const CARD_WIDTH = 1080;
const PAD = 48;
const INNER = CARD_WIDTH - PAD * 2;
const FONT_FAMILY = "Outfit, 'Segoe UI', system-ui, sans-serif";

export const PALETTE = {
  paper: "#f5f2ec",
  ink: "#2b2b2b",
  muted: "#8a8478",
  rule: "#e2ddd3",
  accent: "#794016",
  chipText: "#ffffff",
  white: "#ffffff",
  sparkBlue: "#dbeafe",
  sparkPink: "#fce7f3",
  sparkGreen: "#d1fae5",
  sparkWhite: "#ffffff",
  gold: "#fde68a",
  unique: "#fbcfe8",
};

export type TextMeasure = (text: string, font: string) => number;

export type DrawOp =
  | { type: "rect"; x: number; y: number; w: number; h: number; fill: string; radius?: number; stroke?: string; tag?: string }
  | { type: "text"; x: number; y: number; text: string; font: string; fill: string; align?: "left" | "center" | "right"; maxWidth?: number }
  | { type: "image"; x: number; y: number; w: number; h: number; src: string; fallbackSrc?: string; round?: boolean; fit?: "cover" | "contain" };

export interface PartnerCardLayout {
  readonly width: number;
  readonly height: number;
  readonly ops: DrawOp[];
}

const font = (size: number, weight = 400) => `${weight} ${size}px ${FONT_FAMILY}`;

const SPARK_FILL: Record<string, string> = {
  blue: PALETTE.sparkBlue,
  pink: PALETTE.sparkPink,
  green: PALETTE.sparkGreen,
  white: PALETTE.sparkWhite,
};

const SKILL_FILL: Record<number, string> = { 2: PALETTE.gold, 3: PALETTE.unique, 4: PALETTE.unique, 5: PALETTE.unique };

export function layoutPartnerCard(
  model: PartnerCardModel,
  sections: readonly PartnerSection[],
  affinity: Pick<AffinityCalculationResult, "total" | "base" | "raceBonus"> | null,
  traineeName: string | null,
  measure: TextMeasure,
): PartnerCardLayout {
  const ops: DrawOp[] = [];
  let y = PAD;

  const heading = (label: string) => {
    ops.push({ type: "rect", x: PAD, y, w: INNER, h: 1, fill: PALETTE.rule });
    y += 28;
    ops.push({ type: "text", x: PAD, y: y + 16, text: label, font: font(18, 700), fill: PALETTE.accent });
    y += 36;
  };

  // Header: portrait, names, rank, stats
  ops.push({ type: "image", x: PAD, y, w: 120, h: 120, src: model.portraitUrl, round: true, fit: "cover" });
  ops.push({ type: "text", x: PAD + 144, y: y + 30, text: model.titleEn, font: font(18), fill: PALETTE.muted, maxWidth: 560 });
  ops.push({ type: "text", x: PAD + 144, y: y + 70, text: model.nameEn, font: font(38, 700), fill: PALETTE.ink, maxWidth: 560 });
  if (model.nameJp) ops.push({ type: "text", x: PAD + 144, y: y + 100, text: model.nameJp, font: font(18), fill: PALETTE.muted, maxWidth: 560 });
  ops.push({ type: "image", x: CARD_WIDTH - PAD - 96, y: y + 12, w: 96, h: 96, src: model.rankIconSrc, fit: "contain" });
  y += 144;

  const statW = INNER / model.stats.length;
  model.stats.forEach((stat, i) => {
    const cx = PAD + statW * i + statW / 2;
    ops.push({ type: "text", x: cx, y: y + 18, text: stat.label, font: font(16), fill: PALETTE.muted, align: "center" });
    ops.push({ type: "text", x: cx, y: y + 52, text: String(stat.value), font: font(30, 700), fill: PALETTE.ink, align: "center" });
  });
  y += 76;

  // Aptitudes
  const aptRows = [
    ["Surface", model.aptitudes.surface],
    ["Distance", model.aptitudes.distance],
    ["Style", model.aptitudes.style],
  ] as const;
  ops.push({ type: "rect", x: PAD, y, w: INNER, h: 1, fill: PALETTE.rule });
  y += 20;
  for (const [title, items] of aptRows) {
    ops.push({ type: "text", x: PAD, y: y + 20, text: title, font: font(16), fill: PALETTE.muted });
    items.forEach((a, i) => {
      const x = PAD + 130 + i * 200;
      ops.push({ type: "text", x, y: y + 20, text: a.label, font: font(17), fill: PALETTE.ink });
      ops.push({ type: "text", x: x + 110, y: y + 21, text: a.grade, font: font(22, 800), fill: PALETTE.accent });
    });
    y += 34;
  }
  y += 12;

  const has = (s: PartnerSection) => sections.includes(s);

  if (has("support-cards")) {
    heading("SUPPORT CARDS");
    const tile = (INNER - 5 * 16) / 6;
    if (model.supportCards.length === 0) {
      ops.push({ type: "text", x: PAD, y: y + 18, text: "No support cards recorded", font: font(16), fill: PALETTE.muted });
      y += 40;
    } else {
      model.supportCards.slice(0, 6).forEach((card, i) => {
        const x = PAD + i * (tile + 16);
        ops.push({ type: "image", x, y, w: tile, h: tile, src: card.imageUrl, fit: "cover" });
        ops.push({ type: "rect", x: x + tile - 62, y: y + tile - 30, w: 58, h: 24, fill: "rgba(24,24,27,0.85)", radius: 5 });
        ops.push({ type: "text", x: x + tile - 33, y: y + tile - 12, text: card.lbLabel, font: font(14, 700), fill: PALETTE.chipText, align: "center" });
        ops.push({ type: "text", x, y: y + tile + 24, text: card.nameEn, font: font(15, 600), fill: PALETTE.ink, maxWidth: tile });
      });
      y += tile + 44;
    }
  }

  if (has("skills")) {
    heading("SKILLS");
    const colW = (INNER - 24) / 2;
    const rowH = 46;
    if (model.skills.length === 0) {
      ops.push({ type: "text", x: PAD, y: y + 18, text: "No skills recorded", font: font(16), fill: PALETTE.muted });
      y += 40;
    }
    model.skills.forEach((skill, i) => {
      const x = PAD + (i % 2) * (colW + 24);
      const rowY = y + Math.floor(i / 2) * rowH;
      ops.push({ type: "rect", x, y: rowY, w: colW, h: rowH - 6, fill: SKILL_FILL[skill.rarity] ?? PALETTE.white, radius: 6 });
      ops.push({ type: "image", x: x + 6, y: rowY + 4, w: 32, h: 32, src: `/assets/skills/${skill.iconId ?? 0}.png`, fallbackSrc: `/assets/skills/utx_ico_skill_${skill.iconId ?? 0}.png`, fit: "contain" });
      ops.push({ type: "text", x: x + 48, y: rowY + 26, text: skill.nameEn, font: font(17, 600), fill: PALETTE.ink, maxWidth: colW - 100 });
      if (skill.level > 1) ops.push({ type: "text", x: x + colW - 10, y: rowY + 26, text: `Lv${skill.level}`, font: font(15, 600), fill: PALETTE.muted, align: "right" });
    });
    y += Math.ceil(model.skills.length / 2) * rowH + 8;
  }

  if (has("sparks")) {
    heading("SPARKS");
    if (model.sparks.length === 0) {
      ops.push({ type: "text", x: PAD, y: y + 18, text: "No sparks recorded", font: font(16), fill: PALETTE.muted });
      y += 40;
    }
    const chipFont = font(15, 600);
    for (const group of model.sparks) {
      const label = group.owner === "self" ? "Own sparks" : `${group.owner === "parent1" ? "Parent 1" : "Parent 2"}  ${group.ownerName}`;
      ops.push({ type: "text", x: PAD, y: y + 16, text: label, font: font(15), fill: PALETTE.muted });
      y += 28;
      let x = PAD;
      for (const factor of [...group.blue, ...group.pink, ...group.green, ...group.white]) {
        const text = `${factor.nameEn || factor.name} ${factor.stars}★`;
        const w = Math.min(INNER, Math.ceil(measure(text, chipFont)) + 20);
        if (x + w > PAD + INNER) {
          x = PAD;
          y += 36;
        }
        ops.push({ type: "rect", x, y, w, h: 28, fill: SPARK_FILL[factor.type] ?? PALETTE.white, radius: 5, stroke: PALETTE.rule, tag: "spark" });
        ops.push({ type: "text", x: x + 10, y: y + 19, text, font: chipFont, fill: PALETTE.ink, maxWidth: w - 20 });
        x += w + 8;
      }
      y += 48;
    }
  }

  if (has("affinity")) {
    heading("AFFINITY");
    if (affinity && traineeName) {
      ops.push({ type: "text", x: PAD, y: y + 22, text: `With ${traineeName}`, font: font(18, 600), fill: PALETTE.ink, maxWidth: 520 });
      ops.push({ type: "text", x: CARD_WIDTH - PAD, y: y + 26, text: `${affinity.total} pts`, font: font(30, 800), fill: PALETTE.accent, align: "right" });
      ops.push({ type: "text", x: PAD, y: y + 50, text: `Relations ${affinity.base} + shared G1 wins ${affinity.raceBonus}`, font: font(15), fill: PALETTE.muted });
      y += 72;
    } else {
      ops.push({ type: "text", x: PAD, y: y + 18, text: "No trainee picked", font: font(16), fill: PALETTE.muted });
      y += 40;
    }
  }

  if (has("wins")) {
    heading("G1 WINS");
    const colW = INNER / 3;
    if (model.wins.length === 0) {
      ops.push({ type: "text", x: PAD, y: y + 18, text: "No G1 wins recorded", font: font(16), fill: PALETTE.muted });
      y += 40;
    }
    model.wins.forEach((win, i) => {
      ops.push({ type: "text", x: PAD + (i % 3) * colW, y: y + Math.floor(i / 3) * 32 + 20, text: win.name, font: font(16, 600), fill: PALETTE.ink, maxWidth: colW - 16 });
    });
    y += Math.ceil(model.wins.length / 3) * 32 + 12;
  }

  // Footer
  ops.push({ type: "rect", x: PAD, y: y + 8, w: INNER, h: 1, fill: PALETTE.rule });
  ops.push({ type: "text", x: CARD_WIDTH - PAD, y: y + 40, text: "Almond Eye DB · Partner Card", font: font(14, 600), fill: PALETTE.muted, align: "right" });
  y += 40 + PAD / 2;

  return { width: CARD_WIDTH, height: Math.ceil(y), ops };
}
