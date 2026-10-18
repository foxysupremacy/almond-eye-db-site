"use client";
import type { ReactNode } from "react";

export interface PhaseBand { start: number; end: number; tone: "early" | "mid" | "late" | "spurt" }

export const BAND_FILL: Record<PhaseBand["tone"], string> = {
  early: "fill-sky-50/60 dark:fill-sky-950/40",
  mid: "fill-lime-50/60 dark:fill-lime-950/40",
  late: "fill-rose-50/60 dark:fill-rose-950/40",
  spurt: "fill-rose-50/60 dark:fill-rose-950/40",
};

/** Early 0–1/6, mid 1/6–2/3, late 2/3–spurt, spurt–end. Zero-width bands are dropped. */
export function phaseBandsForCourse(courseLength: number, spurt: number): PhaseBand[] {
  const L = courseLength;
  const bands: PhaseBand[] = [
    { start: 0, end: L / 6, tone: "early" },
    { start: L / 6, end: (2 * L) / 3, tone: "mid" },
    { start: (2 * L) / 3, end: spurt, tone: "late" },
    { start: spurt, end: L, tone: "spurt" },
  ];
  return bands.filter((b) => b.end - b.start > 1e-9);
}

export function ChartFrame({ title, readout, children }: { title: string; readout: string; children: ReactNode }) {
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="flex min-h-5 items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{title}</span>
        <span role="status" aria-live="polite" className="tabular-nums text-zinc-500 dark:text-zinc-400">{readout}</span>
      </figcaption>
      {children}
    </figure>
  );
}

export function EmptyChart({ title }: { title: string }) {
  return (
    <ChartFrame title={title} readout="">
      <p className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">No modeled effect on this course</p>
    </ChartFrame>
  );
}

export const CHART_W = 640;
export const fmtMeters = (m: number) => Math.round(m).toLocaleString("en-US");
