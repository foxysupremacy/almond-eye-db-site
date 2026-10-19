"use client";
import { useScrub } from "./use-scrub";
import { BAND_FILL, ChartFrame, CHART_W as W, EmptyChart, fmtMeters, type PhaseBand } from "./chart-frame";

export function GainPositionChart({ courseLength, samples, bands, bestMeter, height = 140 }: {
  courseLength: number;
  samples: { meter: number; bashin: number }[];
  bands: PhaseBand[];
  bestMeter: number | null;
  height?: number;
}) {
  const nearest = (clientX: number, rect: DOMRect) => {
    const m = ((clientX - rect.left) / Math.max(1, rect.width)) * courseLength;
    let bi = 0;
    samples.forEach((s, i) => { if (Math.abs(s.meter - m) < Math.abs(samples[bi].meter - m)) bi = i; });
    return bi;
  };
  let anchorIdx = 0;
  if (bestMeter != null) {
    samples.forEach((s, i) => { if (Math.abs(s.meter - bestMeter) < Math.abs(samples[anchorIdx].meter - bestMeter)) anchorIdx = i; });
  }
  const { index, handlers, onKeyDown } = useScrub(samples.length, nearest, anchorIdx);
  if (!samples.length || courseLength <= 0) return <EmptyChart title="Gain by activation position" />;

  const x = (m: number) => (m / courseLength) * W;
  const bMax = Math.max(1e-6, ...samples.map((s) => s.bashin));
  const bMin = Math.min(0, ...samples.map((s) => s.bashin));
  const y = (v: number) => height - ((v - bMin) / Math.max(1e-6, bMax - bMin)) * (height - 8) - 4;
  const y0 = y(0);
  const top = samples.map((s, i) => `${i ? "L" : "M"}${x(s.meter).toFixed(1)},${y(s.bashin).toFixed(1)}`).join("");
  const area = `${top}L${x(samples[samples.length - 1].meter).toFixed(1)},${y0.toFixed(1)}L${x(samples[0].meter).toFixed(1)},${y0.toFixed(1)}Z`;
  const best = bestMeter == null ? null : samples.reduce((a, s) => (Math.abs(s.meter - bestMeter) < Math.abs(a.meter - bestMeter) ? s : a), samples[0]);
  const active = index == null ? null : samples[Math.min(index, samples.length - 1)];
  const readout = active
    ? `${fmtMeters(active.meter)} m · ${active.bashin.toFixed(2)} Bashin`
    : best ? `best ${fmtMeters(best.meter)} m · ${best.bashin.toFixed(2)} Bashin` : "";

  return (
    <ChartFrame title="Gain by activation position" readout={readout}>
      <svg
        role="img"
        aria-label="Bashin gain by activation position along the course"
        tabIndex={0}
        onKeyDown={onKeyDown}
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        style={{ height }}
        className="w-full touch-none rounded-md bg-zinc-50 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-zinc-900"
      >
        {bands.map((b) => (
          <rect key={`${b.tone}-${b.start}`} x={x(b.start)} y={0} width={Math.max(0, x(b.end) - x(b.start))} height={height} className={BAND_FILL[b.tone]} />
        ))}
        <path d={area} className="fill-emerald-600/25 dark:fill-emerald-400/25" />
        <path d={top} fill="none" className="stroke-emerald-600 dark:stroke-emerald-400" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {best && <line x1={x(best.meter)} x2={x(best.meter)} y1={0} y2={height} className="stroke-amber-600 dark:stroke-amber-400" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
        {active && <line x1={x(active.meter)} x2={x(active.meter)} y1={0} y2={height} className="stroke-zinc-500" vectorEffect="non-scaling-stroke" />}
        <rect
          x={0} y={0} width={W} height={height} fill="transparent"
          {...handlers}
        />
      </svg>
    </ChartFrame>
  );
}
