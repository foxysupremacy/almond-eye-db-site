"use client";
import { BAND_FILL, CHART_W as W, type PhaseBand } from "./chart-frame";

const H = 24;

/**
 * Where on the course the skill can activate (the sampled positions of its zone). Under R32 every point is
 * assumed to fire, so marks are full height: the strip shows coverage, not a likelihood.
 */
export function ActivationStrip({ courseLength, samples, bands }: {
  courseLength: number;
  samples: { meter: number }[];
  bands: PhaseBand[];
}) {
  if (!samples.length || courseLength <= 0) return null;
  const x = (m: number) => (m / courseLength) * W;
  const step = samples.length > 1 ? Math.abs(samples[1].meter - samples[0].meter) : courseLength / 100;
  const barW = Math.max(1, x(step));
  return (
    <svg
      role="img"
      aria-label="Possible activation points along the course"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ height: H }}
      className="w-full rounded-md bg-zinc-50 dark:bg-zinc-900"
    >
      {bands.map((b) => (
        <rect key={`${b.tone}-${b.start}`} x={x(b.start)} y={0} width={Math.max(0, x(b.end) - x(b.start))} height={H} className={BAND_FILL[b.tone]} />
      ))}
      {samples.map((s) => (
        <rect key={s.meter} data-point="" x={x(s.meter) - barW / 2} y={0} width={barW} height={H} className="fill-amber-600/70 dark:fill-amber-400/70" />
      ))}
    </svg>
  );
}
