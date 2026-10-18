"use client";
import { useMemo } from "react";
import type { RaceEffectTrace } from "@/lib/race-impact";
import { useScrub } from "./use-scrub";
import { ChartFrame, CHART_W as W, EmptyChart, fmtMeters } from "./chart-frame";

export function SpeedTimeChart({ trace, height = 160 }: { trace: RaceEffectTrace; height?: number }) {
  // Window: 6 s before activation to 4 s after the effect ends (whole race when no activation).
  const pts = useMemo(() => {
    const from = trace.activationMeter == null ? 0 : trace.activationTimeSeconds - 6;
    const to = trace.activationMeter == null ? trace.totalTimeSeconds : trace.effectEndTimeSeconds + 4;
    return trace.points.filter((p) => p.timeSeconds >= from && p.timeSeconds <= to);
  }, [trace]);
  const nearest = (clientX: number, rect: DOMRect) => {
    const t0 = pts[0].timeSeconds, t1 = pts[pts.length - 1].timeSeconds;
    const t = t0 + ((clientX - rect.left) / Math.max(1, rect.width)) * (t1 - t0);
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(p.timeSeconds - t) < Math.abs(pts[best].timeSeconds - t)) best = i; });
    return best;
  };
  // First key press lands on the activation point (or the start when nothing activates).
  let anchorIdx = 0;
  if (trace.activationMeter != null) {
    pts.forEach((p, i) => { if (Math.abs(p.timeSeconds - trace.activationTimeSeconds) < Math.abs(pts[anchorIdx].timeSeconds - trace.activationTimeSeconds)) anchorIdx = i; });
  }
  const { index, handlers, onKeyDown } = useScrub(pts.length, nearest, anchorIdx);
  if (!pts.length) return <EmptyChart title="Speed vs time" />;

  const t0 = pts[0].timeSeconds, t1 = pts[pts.length - 1].timeSeconds;
  const speeds = pts.flatMap((p) => [p.baselineSpeed, p.skillSpeed]);
  const vMin = Math.floor(Math.min(...speeds)) - 0.5, vMax = Math.ceil(Math.max(...speeds)) + 0.5;
  const x = (t: number) => ((t - t0) / Math.max(1e-6, t1 - t0)) * W;
  const y = (v: number) => height - ((v - vMin) / Math.max(1e-6, vMax - vMin)) * height;
  const line = (key: "baselineSpeed" | "skillSpeed") =>
    pts.map((p, i) => `${i ? "L" : "M"}${x(p.timeSeconds).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");
  const active = index == null ? null : pts[Math.min(index, pts.length - 1)];
  const readout = active
    ? `${active.timeSeconds.toFixed(1)} s · skill ${active.skillSpeed.toFixed(2)} m/s · base ${active.baselineSpeed.toFixed(2)} m/s · ${fmtMeters(active.skillMeter)} m`
    : `${trace.bashinGain.toFixed(2)} Bashin`;

  return (
    <ChartFrame title="Speed vs time" readout={readout}>
      <svg
        role="img"
        aria-label="Speed versus elapsed time, baseline and skill"
        tabIndex={0}
        onKeyDown={onKeyDown}
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        style={{ height }}
        className="w-full touch-none rounded-md bg-zinc-50 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-zinc-900"
      >
        {trace.activationMeter != null && <line x1={x(trace.activationTimeSeconds)} x2={x(trace.activationTimeSeconds)} y1={0} y2={height} className="stroke-amber-600 dark:stroke-amber-400" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
        {trace.activationMeter != null && <line x1={x(trace.effectEndTimeSeconds)} x2={x(trace.effectEndTimeSeconds)} y1={0} y2={height} className="stroke-sky-600 dark:stroke-sky-400" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />}
        <path d={line("baselineSpeed")} fill="none" className="stroke-zinc-400 dark:stroke-zinc-500" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <path d={line("skillSpeed")} fill="none" className="stroke-emerald-600 dark:stroke-emerald-400" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {active && <line x1={x(active.timeSeconds)} x2={x(active.timeSeconds)} y1={0} y2={height} className="stroke-zinc-500" vectorEffect="non-scaling-stroke" />}
        <rect
          x={0} y={0} width={W} height={height} fill="transparent"
          {...handlers}
        />
      </svg>
    </ChartFrame>
  );
}
