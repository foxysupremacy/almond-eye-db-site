"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Course } from "../../lib/skill-engine/types";
import { renderCourse } from "../../lib/track-render";
import type { SkillZoneResult } from "../../lib/skill-engine/zones";
import type { SkillEvaluationResult } from "../../lib/evaluator/types";
import type { SkillDetail } from "../../lib/api";
import { CourseMapCanvas } from "./course-map-canvas";
import { RaceEffectGraph } from "./race-effect-graph";
import { TrackUnifiedTooltip } from "./track-unified-tooltip";

function LayoutDashboardIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

function LayersIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function MapIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" x2="9" y1="3" y2="18" />
      <line x1="15" x2="15" y1="6" y2="21" />
    </svg>
  );
}

function SplitVerticalIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="2" y2="22" />
      <line x1="2" x2="22" y1="12" y2="12" />
    </svg>
  );
}

function TrendingUpIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

interface TrackCanvasProps {
  course: Course | null;
  zones: SkillZoneResult[] | null;
  selectedSkillId?: string | null;
  evaluation?: SkillEvaluationResult | null;
  skillDetail?: SkillDetail | null;
}

export function TrackCanvas({
  course,
  zones,
  selectedSkillId,
  evaluation,
  skillDetail,
}: TrackCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Layout mode: "all" (Full 3 Boards), "timeline-graph" (Board 2 + 3), "1d" (Board 2), "graphs" (Board 3), "map" (Board 1)
  const [viewMode, setViewMode] = useState<"all" | "timeline-graph" | "1d" | "graphs" | "map">("all");
  const [hoverMeter, setHoverMeter] = useState<number | null>(null);
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [unit, setUnit] = useState<"meters" | "bashin">("meters");

  const impact = evaluation?.raceImpact;

  const handleHover = useCallback(
    (m: number | null, clientPos?: { clientX: number; clientY: number }) => {
      if (isPinned) return;
      setHoverMeter(m);
      if (clientPos) setHoverCoords({ x: clientPos.clientX, y: clientPos.clientY });
    },
    [isPinned],
  );

  const handleTogglePin = useCallback(() => {
    setIsPinned((prev) => !prev);
  }, []);

  const handleUnpin = useCallback(() => {
    setIsPinned(false);
    setHoverMeter(null);
    setHoverCoords(null);
  }, []);

  // Unpin on skill selection change
  useEffect(() => {
    setIsPinned(false);
  }, [selectedSkillId]);

  // 1. Render the 1D flat SVG track with benefit lane and hook up synchronized hover
  useEffect(() => {
    if (!hostRef.current || !course) return;

    const svg = renderCourse(hostRef.current, course, {
      zones: zones ?? [],
      distribution: impact?.distribution ?? null,
      onHover: handleHover,
    });
    svgRef.current = svg;
  }, [course, zones, impact?.distribution, handleHover]);

  // 2. Update 1D SVG hover line when hoverMeter changes from Course Map or Effect Graphs
  useEffect(() => {
    if (svgRef.current && (svgRef.current as any).__setHoverMeter) {
      (svgRef.current as any).__setHoverMeter(hoverMeter);
    }
  }, [hoverMeter]);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 sm:p-4 shadow-xs transition-colors">
      {/* Header Toolbar */}
      <div className="mb-3 flex flex-col items-stretch justify-between gap-2.5 lg:flex-row lg:items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Course Map & Track Visualizer
            </span>
            <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.2 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              3-Board Mode
            </span>
          </div>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Course Map 2.5D · 1D Linear Timeline with Benefit Lane · Race / Skill Effect Graph
          </span>
        </div>

        {/* View Mode Switcher */}
        <div className="flex min-w-0 items-center gap-1 text-xs">
          <div className="grid w-full grid-cols-2 gap-1 sm:grid-cols-5 sm:flex sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode("all")}
              className={`flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer sm:px-2.5 ${
                viewMode === "all"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
              title="Full View: All 3 Boards (Map + 1D Timeline + Effect Graphs)"
            >
              <LayoutDashboardIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Full View</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("timeline-graph")}
              className={`flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer sm:px-2.5 ${
                viewMode === "timeline-graph"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
              title="Timeline & Graphs: 1D Timeline on top, Effect Graphs on bottom"
            >
              <LayersIcon className="h-3.5 w-3.5" />
              <span>Timeline & Graphs</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("1d")}
              className={`flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer sm:px-2.5 ${
                viewMode === "1d"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
              title="1D Timeline Only"
            >
              <SplitVerticalIcon className="h-3.5 w-3.5" />
              <span>1D Only</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("graphs")}
              className={`flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer sm:px-2.5 ${
                viewMode === "graphs"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
              title="Effect Graphs Only"
            >
              <TrendingUpIcon className="h-3.5 w-3.5" />
              <span>Graphs Only</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer sm:px-2.5 ${
                viewMode === "map"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
              title="Course Map 2.5D Only"
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span>Map Only</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Track Display: Three-Board Sequence */}
      {course ? (
        <div className="flex flex-col gap-4">
          {/* Board 1: 2D/2.5D Course Map */}
          {(viewMode === "all" || viewMode === "map") && (
            <div className="w-full overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-900/40">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 px-3 py-2 text-[11px]">
                <span className="font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Board 1 · Course Map 2.5D
                </span>
                <span className="text-zinc-400 dark:text-zinc-500">
                  3D Spline Geometry · Elevation Ramps · Activation Zones
                </span>
              </div>
              <CourseMapCanvas
                course={course}
                activeSkillZones={zones}
                selectedSkillId={selectedSkillId}
                hoverMeter={hoverMeter}
                onHover={handleHover}
              />
            </div>
          )}

          {/* Board 2: 1D Linear Timeline with Benefit Lane */}
          {(viewMode === "all" || viewMode === "timeline-graph" || viewMode === "1d") && (
            <div className="overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 sm:p-3 transition-all">
              <div className="flex items-center justify-between mb-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Board 2 · 1D Linear Timeline
                  </span>
                  <span className="rounded bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                    Benefit Lane Active
                  </span>
                </div>
                <span className="text-zinc-400 dark:text-zinc-500 hidden sm:inline">
                  Elevation · Slopes · Straights/Corners · Phase Bands · 24 Sections · Benefit Curve
                </span>
              </div>
              <div ref={hostRef} className="w-full overflow-x-auto" />
            </div>
          )}

          {/* Board 3: Race / Skill Effect Graph */}
          {(viewMode === "all" || viewMode === "timeline-graph" || viewMode === "graphs") && (
            <RaceEffectGraph
              course={course}
              zones={zones}
              impact={impact}
              hoverMeter={hoverMeter}
              onHover={handleHover}
              isPinned={isPinned}
              onTogglePin={handleTogglePin}
              unit={unit}
              onUnitChange={setUnit}
            />
          )}

          {/* Floating Unified Telemetry Tooltip */}
          <TrackUnifiedTooltip
            course={course}
            zones={zones}
            impact={impact}
            hoverMeter={hoverMeter}
            coords={hoverCoords}
            isPinned={isPinned}
            onUnpin={handleUnpin}
            unit={unit}
          />
        </div>
      ) : (
        <p className="text-sm text-zinc-400">Select a course.</p>
      )}
    </div>
  );
}
