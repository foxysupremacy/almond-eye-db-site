// Browser-only: executes the pure Partner Card layout on a canvas and exports a PNG.
// Images that fail to load (or lack CORS headers, which would taint the canvas)
// are replaced by placeholder tiles so the export always succeeds.

import type { AffinityCalculationResult } from "@/lib/lineage/affinity-engine";
import type { PartnerSection } from "@/lib/veterans/share/partner-codec";
import type { PartnerCardModel } from "../model/partner-card-model";
import { layoutPartnerCard, PALETTE, type DrawOp } from "./partner-card-layout";

export interface PartnerPngResult {
  readonly blob: Blob;
  readonly missingImages: number;
}

export function partnerPngFileName(model: PartnerCardModel): string {
  const slug = model.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || String(model.cardId);
  return `partner-${slug}.png`;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** True when drawing this image would taint the canvas (no CORS grant). */
function taints(img: HTMLImageElement): boolean {
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const ctx = probe.getContext("2d");
  if (!ctx) return true;
  try {
    ctx.drawImage(img, 0, 0, 1, 1);
    ctx.getImageData(0, 0, 1, 1);
    return false;
  } catch {
    return true;
  }
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth?: number): string {
  if (!maxWidth || ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo)}…`;
}

function drawImageOp(ctx: CanvasRenderingContext2D, op: Extract<DrawOp, { type: "image" }>, img: HTMLImageElement | null) {
  ctx.save();
  if (op.round) {
    ctx.beginPath();
    ctx.arc(op.x + op.w / 2, op.y + op.h / 2, Math.min(op.w, op.h) / 2, 0, Math.PI * 2);
    ctx.clip();
  }
  if (!img) {
    ctx.fillStyle = PALETTE.rule;
    if (op.round) ctx.fillRect(op.x, op.y, op.w, op.h);
    else {
      roundRectPath(ctx, op.x, op.y, op.w, op.h, 8);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  const scale = op.fit === "contain" ? Math.min(op.w / img.width, op.h / img.height) : Math.max(op.w / img.width, op.h / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  // cover crops from the top so portraits keep the face
  const dx = op.x + (op.w - w) / 2;
  const dy = op.fit === "contain" ? op.y + (op.h - h) / 2 : op.y;
  if (op.fit !== "contain" && !op.round) {
    roundRectPath(ctx, op.x, op.y, op.w, op.h, 8);
    ctx.clip();
  }
  ctx.drawImage(img, dx, dy, w, h);
  ctx.restore();
}

export async function renderPartnerCardPng(
  model: PartnerCardModel,
  sections: readonly PartnerSection[],
  affinity: AffinityCalculationResult | null,
  traineeName: string | null,
): Promise<PartnerPngResult> {
  if (typeof document !== "undefined" && document.fonts?.ready) await document.fonts.ready;

  const measureCanvas = document.createElement("canvas").getContext("2d");
  if (!measureCanvas) throw new Error("Canvas is not available");
  const measure = (text: string, font: string) => {
    measureCanvas.font = font;
    return measureCanvas.measureText(text).width;
  };

  const layout = layoutPartnerCard(model, sections, affinity, traineeName, measure);
  const imageOps = layout.ops.filter((op): op is Extract<DrawOp, { type: "image" }> => op.type === "image");
  const fallbacks = new Map(imageOps.map((op) => [op.src, op.fallbackSrc]));
  const loaded = new Map<string, HTMLImageElement | null>();
  const usable = async (src: string | undefined) => {
    const img = src ? await loadImage(src) : null;
    return img && !taints(img) ? img : null;
  };
  await Promise.all(
    [...fallbacks.keys()].map(async (src) => {
      loaded.set(src, (await usable(src)) ?? (await usable(fallbacks.get(src))));
    }),
  );
  const missingImages = layout.ops.filter((op) => op.type === "image" && !loaded.get(op.src)).length;

  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.textBaseline = "alphabetic";

  for (const op of layout.ops) {
    if (op.type === "rect") {
      ctx.fillStyle = op.fill;
      if (op.radius) {
        roundRectPath(ctx, op.x, op.y, op.w, op.h, op.radius);
        ctx.fill();
        if (op.stroke) {
          ctx.strokeStyle = op.stroke;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else ctx.fillRect(op.x, op.y, op.w, op.h);
    } else if (op.type === "text") {
      ctx.font = op.font;
      ctx.fillStyle = op.fill;
      ctx.textAlign = op.align ?? "left";
      ctx.fillText(fitText(ctx, op.text, op.maxWidth), op.x, op.y);
    } else {
      drawImageOp(ctx, op, loaded.get(op.src) ?? null);
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("PNG export failed");
  return { blob, missingImages };
}

/** Render the card and hand the PNG to the browser as a download. */
export async function downloadPartnerCardPng(
  model: PartnerCardModel,
  sections: readonly PartnerSection[],
  affinity: AffinityCalculationResult | null,
  traineeName: string | null,
): Promise<PartnerPngResult> {
  const result = await renderPartnerCardPng(model, sections, affinity, traineeName);
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = partnerPngFileName(model);
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return result;
}
