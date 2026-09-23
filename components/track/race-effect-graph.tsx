"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import type { Course } from "../../lib/skill-engine/types";
import type { SkillZoneResult } from "../../lib/skill-engine/zones";
import type { RaceImpactResult } from "../../lib/race-impact/types";
import {
  meterToBaselineTime,
  timeToBaselineMeter,
} from "../../lib/race-impact/trace";

interface RaceEffectGraphProps {
  course: Course | null;
  zones: SkillZoneResult[] | null;
  impact?: RaceImpactResult | null;
  hoverMeter: number | null;
  onHover?: (meter: number | null, clientPos?: { clientX: number; clientY: number }) => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  unit: "meters" | "bashin";
  onUnitChange: (unit: "meters" | "bashin") => void;
}

const BASHIN_METERS = 2.5;

export function RaceEffectGraph({
  course,
  zones,
  impact,
  hoverMeter,
  onHover,
  isPinned,
  onTogglePin,
  unit,
  onUnitChange,
}: RaceEffectGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showPhysicsInfo, setShowPhysicsInfo] = useState(false);

  const courseLength = course?.length ?? 2000;
  const spurt = course?.spurtStart?.meters ?? Math.round((courseLength * 2) / 3);

  const trace = impact?.trace;
  const dist = impact?.distribution;
  const physicsStatus = impact?.physicsStatus ?? "not-modeled";

  // Coordinates helpers
  const totalTime = trace?.totalTimeSeconds ?? 130;
  const minSpeed = 15;
  const maxSpeed = 28;

  // Chart dimensions
  const W = 620;
  const H1 = 150; // Speed-Time
  const H2 = 140; // Gain-Meter
  const H3 = 110; // Rate-Meter

  // Time to X on Chart 1
  const timeToX = useCallback((t: number) => (t / Math.max(1, totalTime)) * W, [totalTime, W]);
  // Speed to Y on Chart 1
  const speedToY = useCallback(
    (v: number) => H1 - 20 - ((clamp(v, minSpeed, maxSpeed) - minSpeed) / (maxSpeed - minSpeed)) * (H1 - 36),
    [H1],
  );

  // Meter to X on Chart 2 & 3
  const meterToX = useCallback((m: number) => (m / Math.max(1, courseLength)) * W, [courseLength, W]);

  // Chart 1: Speed-Time curves & Phase background rects
  const speedPaths = useMemo(() => {
    if (!trace || !trace.points.length) return null;
    let baseD = "";
    let skillD = "";

    for (let i = 0; i < trace.points.length; i++) {
      const p = trace.points[i];
      const x = timeToX(p.timeSeconds);
      const yBase = speedToY(p.baselineSpeed);
      const ySkill = speedToY(p.skillSpeed);

      if (i === 0) {
        baseD += `M ${x.toFixed(1)} ${yBase.toFixed(1)}`;
        skillD += `M ${x.toFixed(1)} ${ySkill.toFixed(1)}`;
      } else {
        baseD += ` L ${x.toFixed(1)} ${yBase.toFixed(1)}`;
        skillD += ` L ${x.toFixed(1)} ${ySkill.toFixed(1)}`;
      }
    }

    // Active effect window
    let effectAreaD = "";
    const activePoints = trace.points.filter(
      (p) => p.timeSeconds >= trace.activationTimeSeconds && p.timeSeconds <= trace.effectEndTimeSeconds,
    );
    if (activePoints.length > 1) {
      const first = activePoints[0];
      const last = activePoints[activePoints.length - 1];
      effectAreaD = `M ${timeToX(first.timeSeconds).toFixed(1)} ${speedToY(first.baselineSpeed).toFixed(1)}`;
      for (const p of activePoints) {
        effectAreaD += ` L ${timeToX(p.timeSeconds).toFixed(1)} ${speedToY(p.skillSpeed).toFixed(1)}`;
      }
      for (let i = activePoints.length - 1; i >= 0; i--) {
        const p = activePoints[i];
        effectAreaD += ` L ${timeToX(p.timeSeconds).toFixed(1)} ${speedToY(p.baselineSpeed).toFixed(1)}`;
      }
      effectAreaD += " Z";
    }

    // Phase transition times
    const tPhase1 = meterToBaselineTime(courseLength / 6, trace);
    const tPhase2 = meterToBaselineTime((courseLength * 2) / 3, trace);
    const tSpurt = meterToBaselineTime(spurt, trace);

    return { baseD, skillD, effectAreaD, tPhase1, tPhase2, tSpurt };
  }, [trace, timeToX, speedToY, courseLength, spurt]);

  // Chart 2: Gain vs Meter path
  const gainPaths = useMemo(() => {
    if (!dist || !dist.samples.length) return null;
    const maxGain = dist.maxGainMeters > 0 ? (unit === "bashin" ? dist.maxGainMeters / BASHIN_METERS : dist.maxGainMeters) : 1;
    const yZero = H2 - 20;
    const yTop = 16;
    const gainToY = (g: number) => {
      const val = unit === "bashin" ? g / BASHIN_METERS : g;
      return yZero - (Math.max(0, val) / maxGain) * (yZero - yTop);
    };

    const segments: { stroke: string; fill: string }[] = [];
    let curPoints: { x: number; y: number }[] = [];

    for (const s of dist.samples) {
      if (s.eligible && s.gainMeters > 0) {
        curPoints.push({ x: meterToX(s.meter), y: gainToY(s.gainMeters) });
      } else {
        if (curPoints.length > 0) {
          segments.push(buildSvgSegment(curPoints, yZero));
          curPoints = [];
        }
      }
    }
    if (curPoints.length > 0) {
      segments.push(buildSvgSegment(curPoints, yZero));
    }

    const optX = dist.optimalMeter != null ? meterToX(dist.optimalMeter) : null;
    const optY = dist.optimalGainMeters != null ? gainToY(dist.optimalGainMeters) : null;

    return { segments, maxGain, yZero, optX, optY };
  }, [dist, unit, H2, meterToX]);

  // Chart 3: Activation & Useful Rate paths
  const ratePaths = useMemo(() => {
    if (!dist || !dist.samples.length) return null;
    const yZero = H3 - 16;
    const yTop = 14;
    const rateToY = (rate: number) => yZero - clamp(rate, 0, 1) * (yZero - yTop);

    let actD = "";
    let usefulD = "";

    for (let i = 0; i < dist.samples.length; i++) {
      const s = dist.samples[i];
      const x = meterToX(s.meter);
      const yAct = rateToY(s.activationRate);
      const yUse = rateToY(s.usefulRate);

      if (i === 0) {
        actD += `M ${x.toFixed(1)} ${yAct.toFixed(1)}`;
        usefulD += `M ${x.toFixed(1)} ${yUse.toFixed(1)}`;
      } else {
        actD += ` L ${x.toFixed(1)} ${yAct.toFixed(1)}`;
        usefulD += ` L ${x.toFixed(1)} ${yUse.toFixed(1)}`;
      }
    }

    return { actD, usefulD, yZero, yTop };
  }, [dist, H3, meterToX]);

  // Crosshair calculations
  const hoverX_meter = hoverMeter != null ? meterToX(hoverMeter) : null;
  const hoverT = hoverMeter != null && trace ? meterToBaselineTime(hoverMeter, trace) : null;
  const hoverX_time = hoverT != null ? timeToX(hoverT) : null;

  // Pointer event handlers
  const handlePointerMoveTime = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!trace || !onHover) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const frac = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const t = frac * totalTime;
      const m = timeToBaselineMeter(t, trace);
      onHover(m, { clientX: e.clientX, clientY: e.clientY });
    },
    [trace, totalTime, onHover],
  );

  const handlePointerMoveMeter = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!onHover) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const frac = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const m = Math.round(frac * courseLength);
      onHover(m, { clientX: e.clientX, clientY: e.clientY });
    },
    [courseLength, onHover],
  );

  const handlePointerLeave = useCallback(() => {
    if (!isPinned) onHover?.(null);
  }, [isPinned, onHover]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!onHover) return;
      const current = hoverMeter ?? 0;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onHover(Math.max(0, current - 20));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onHover(Math.min(courseLength, current + 20));
      }
    },
    [hoverMeter, courseLength, onHover],
  );

  // Status badge config
  const statusConfig = {
    modeled: { label: "Modeled Physics", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-500/30" },
    provisional: { label: "Provisional", color: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-500/30" },
    partial: { label: "Partial Physics", color: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-500/30" },
    "not-modeled": { label: "Not Modeled", color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700" },
  }[physicsStatus];

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 sm:p-4 shadow-xs transition-colors outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
    >
      {/* Board 3 Header Toolbar */}
      <div className="mb-3.5 flex flex-col items-stretch justify-between gap-2.5 sm:flex-row sm:items-center border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Board 3 · Race / Skill Effect Graph
            </span>
            {/* Physics Status Badge */}
            <button
              type="button"
              onClick={() => setShowPhysicsInfo((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border ${statusConfig.color} cursor-pointer`}
              title="Click to view physics model details"
            >
              <span>{statusConfig.label}</span>
              <span className="opacity-60 text-[9px]">ℹ</span>
            </button>
          </div>
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            Speed Trajectory (m/s) · Gain by Activation Position · Eligibility Density
          </p>
        </div>

        {/* Units & Interaction Controls */}
        <div className="flex items-center gap-2 text-xs">
          {/* Unit Toggle: Meters vs Bashin */}
          <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-0.5">
            <button
              type="button"
              onClick={() => onUnitChange("meters")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                unit === "meters"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Distance (Δx)
            </button>
            <button
              type="button"
              onClick={() => onUnitChange("bashin")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                unit === "bashin"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Bashin (バ)
            </button>
          </div>
        </div>
      </div>

      {/* Physics Information Dropdown Card */}
      {showPhysicsInfo && (
        <div className="mb-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800/50 p-3 text-xs text-zinc-600 dark:text-zinc-300">
          <div className="flex items-center justify-between font-semibold text-zinc-900 dark:text-zinc-100">
            <span>Simulation Model Parameters</span>
            <button
              type="button"
              onClick={() => setShowPhysicsInfo(false)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 leading-relaxed text-[11px]">
            {impact?.physicsNote ??
              "Velocity curves are simulated using official phase target speeds and stat bonuses (Speed, Power, Guts). Gain represents the net meters gained if activated at that position."}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            <span>• Bashin scale: 1 bashin = 2.5m</span>
            <span>• Spurt start: {spurt}m</span>
            <span>• Course length: {courseLength}m</span>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {/* Sub-Chart 1: Speed vs Time */}
        <div className="rounded-xl border border-zinc-100 dark:border-zinc-800/70 bg-zinc-50/40 dark:bg-zinc-900/60 p-2.5 sm:p-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              1. Trajectory Speed (m/s vs. Time)
            </span>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="inline-flex items-center gap-1 text-zinc-500">
                <span className="h-0.5 w-3 border-t border-dashed border-zinc-400" /> Baseline
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="h-0.5 w-3 bg-emerald-600 dark:bg-emerald-400" /> Skill Active
              </span>
            </div>
          </div>

          <div className="relative w-full overflow-hidden select-none">
            <svg
              viewBox={`0 0 ${W} ${H1}`}
              className="w-full h-auto cursor-crosshair"
              onPointerMove={handlePointerMoveTime}
              onPointerLeave={handlePointerLeave}
              onClick={onTogglePin}
            >
              {/* Background Phase Bands */}
              {speedPaths && (
                <>
                  <rect x="0" y="0" width={timeToX(speedPaths.tPhase1)} height={H1} fill="rgba(0,154,111,0.06)" />
                  <rect
                    x={timeToX(speedPaths.tPhase1)}
                    y="0"
                    width={timeToX(speedPaths.tPhase2) - timeToX(speedPaths.tPhase1)}
                    height={H1}
                    fill="rgba(242,233,103,0.06)"
                  />
                  <rect
                    x={timeToX(speedPaths.tPhase2)}
                    y="0"
                    width={timeToX(speedPaths.tSpurt) - timeToX(speedPaths.tPhase2)}
                    height={H1}
                    fill="rgba(209,134,175,0.06)"
                  />
                  <rect
                    x={timeToX(speedPaths.tSpurt)}
                    y="0"
                    width={W - timeToX(speedPaths.tSpurt)}
                    height={H1}
                    fill="rgba(199,109,159,0.10)"
                  />
                </>
              )}

              {/* Grid Lines */}
              <line x1="0" y1={speedToY(18)} x2={W} y2={speedToY(18)} stroke="rgba(148,163,184,0.25)" strokeDasharray="3 3" />
              <line x1="0" y1={speedToY(20.5)} x2={W} y2={speedToY(20.5)} stroke="rgba(148,163,184,0.25)" strokeDasharray="3 3" />
              <line x1="0" y1={speedToY(26)} x2={W} y2={speedToY(26)} stroke="rgba(148,163,184,0.25)" strokeDasharray="3 3" />

              {/* Y Axis Labels */}
              <text x="6" y={speedToY(26) - 4} fontSize="9" fill="rgba(148,163,184,0.8)">26 m/s (Spurt)</text>
              <text x="6" y={speedToY(20.5) - 4} fontSize="9" fill="rgba(148,163,184,0.8)">20.5 m/s (Middle)</text>
              <text x="6" y={speedToY(18) - 4} fontSize="9" fill="rgba(148,163,184,0.8)">18 m/s</text>

              {/* Curves */}
              {speedPaths && (
                <>
                  {speedPaths.effectAreaD && (
                    <path d={speedPaths.effectAreaD} fill="rgba(16,185,129,0.18)" />
                  )}
                  <path d={speedPaths.baseD} fill="none" stroke="#71717a" strokeWidth="1.6" strokeDasharray="4 3" />
                  <path d={speedPaths.skillD} fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" />
                </>
              )}

              {/* Time Crosshair Line */}
              {hoverX_time != null && (
                <line
                  x1={hoverX_time}
                  y1="0"
                  x2={hoverX_time}
                  y2={H1}
                  stroke="var(--track-hover-line, #0284c7)"
                  strokeWidth="1.8"
                />
              )}
            </svg>
          </div>
        </div>

        {/* Sub-Chart 2: Gain vs Activation Position */}
        <div className="rounded-xl border border-zinc-100 dark:border-zinc-800/70 bg-zinc-50/40 dark:bg-zinc-900/60 p-2.5 sm:p-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              2. Distance Gain by Activation Position
            </span>
            {dist?.optimalGainMeters != null && dist.optimalGainMeters > 0 && (
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                Peak: +{unit === "bashin" ? (dist.optimalGainMeters / BASHIN_METERS).toFixed(2) + " bashin" : dist.optimalGainMeters.toFixed(2) + "m"} @ {dist.optimalMeter}m
              </span>
            )}
          </div>

          <div className="relative w-full overflow-hidden select-none">
            <svg
              viewBox={`0 0 ${W} ${H2}`}
              className="w-full h-auto cursor-crosshair"
              onPointerMove={handlePointerMoveMeter}
              onPointerLeave={handlePointerLeave}
              onClick={onTogglePin}
            >
              {/* Trigger Zones Background Tint */}
              {zones && zones.length > 0 && (
                zones.map((z, gi) =>
                  z.regions.map((reg, ri) => (
                    <rect
                      key={`${gi}-${ri}`}
                      x={meterToX(reg.start)}
                      y="0"
                      width={Math.max(2, meterToX(reg.end) - meterToX(reg.start))}
                      height={H2}
                      fill="rgba(16,185,129,0.07)"
                      stroke="rgba(16,185,129,0.2)"
                      strokeWidth="0.5"
                    />
                  )),
                )
              )}

              {/* Zero Line */}
              {gainPaths && (
                <line x1="0" y1={gainPaths.yZero} x2={W} y2={gainPaths.yZero} stroke="rgba(148,163,184,0.35)" strokeDasharray="3 3" />
              )}

              {/* Y Axis Max & Zero Labels */}
              {gainPaths && (
                <>
                  <text x="6" y="14" fontSize="9" fill="rgb(15,118,110)" fontWeight="600">
                    +{gainPaths.maxGain.toFixed(1)} {unit === "bashin" ? "bashin" : "m"}
                  </text>
                  <text x="6" y={gainPaths.yZero - 3} fontSize="8" fill="rgba(148,163,184,0.8)">
                    0m
                  </text>
                </>
              )}

              {/* Curves */}
              {gainPaths &&
                gainPaths.segments.map((seg, i) => (
                  <React.Fragment key={i}>
                    <path d={seg.fill} fill="rgba(16,185,129,0.14)" />
                    <path d={seg.stroke} fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
                  </React.Fragment>
                ))}

              {/* Optimal Peak Pin */}
              {gainPaths && gainPaths.optX != null && gainPaths.optY != null && (
                <circle cx={gainPaths.optX} cy={gainPaths.optY} r="3" fill="#059669" stroke="#ffffff" strokeWidth="1.5" />
              )}

              {/* Meter Crosshair Line */}
              {hoverX_meter != null && (
                <line
                  x1={hoverX_meter}
                  y1="0"
                  x2={hoverX_meter}
                  y2={H2}
                  stroke="var(--track-hover-line, #0284c7)"
                  strokeWidth="1.8"
                />
              )}
            </svg>
          </div>
        </div>

        {/* Sub-Chart 3: Eligibility & Useful Rate vs Meter (Full Width on Bottom) */}
        <div className="col-span-1 lg:col-span-2 rounded-xl border border-zinc-100 dark:border-zinc-800/70 bg-zinc-50/40 dark:bg-zinc-900/60 p-2.5 sm:p-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              3. Spatial Activation & Useful Rate (% vs. Course Position)
            </span>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="h-0.5 w-3 bg-emerald-600 dark:bg-emerald-400" /> Activation Rate
              </span>
              <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium">
                <span className="h-0.5 w-3 bg-sky-600 dark:bg-sky-400" /> Useful Rate (Gain &gt; 0)
              </span>
            </div>
          </div>

          <div className="relative w-full overflow-hidden select-none">
            <svg
              viewBox={`0 0 ${W} ${H3}`}
              className="w-full h-auto cursor-crosshair"
              onPointerMove={handlePointerMoveMeter}
              onPointerLeave={handlePointerLeave}
              onClick={onTogglePin}
            >
              {/* Axis Guides */}
              {ratePaths && (
                <>
                  <line x1="0" y1={ratePaths.yTop} x2={W} y2={ratePaths.yTop} stroke="rgba(148,163,184,0.2)" strokeDasharray="2 2" />
                  <line x1="0" y1={ratePaths.yZero} x2={W} y2={ratePaths.yZero} stroke="rgba(148,163,184,0.35)" />
                  <text x="6" y={ratePaths.yTop + 9} fontSize="8" fill="rgba(148,163,184,0.8)">100%</text>
                  <text x="6" y={ratePaths.yZero - 3} fontSize="8" fill="rgba(148,163,184,0.8)">0%</text>
                </>
              )}

              {/* Curves */}
              {ratePaths && (
                <>
                  <path d={ratePaths.actD} fill="none" stroke="#059669" strokeWidth="1.8" />
                  <path d={ratePaths.usefulD} fill="none" stroke="#0284c7" strokeWidth="1.6" strokeDasharray="3 2" />
                </>
              )}

              {/* Meter Crosshair Line */}
              {hoverX_meter != null && (
                <line
                  x1={hoverX_meter}
                  y1="0"
                  x2={hoverX_meter}
                  y2={H3}
                  stroke="var(--track-hover-line, #0284c7)"
                  strokeWidth="1.8"
                />
              )}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function buildSvgSegment(points: { x: number; y: number }[], yZero: number): { stroke: string; fill: string } {
  if (!points.length) return { stroke: "", fill: "" };
  let stroke = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    stroke += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
  }
  const fill = `M ${points[0].x.toFixed(1)} ${yZero} L ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} ${stroke.slice(1)} L ${points[points.length - 1].x.toFixed(1)} ${yZero} Z`;
  return { stroke, fill };
}
