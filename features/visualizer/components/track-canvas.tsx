"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components/ToggleButtonGroup";
import type { Course } from "@/lib/skill-engine/types";
import { renderCourse, type TrackSvgElement } from "@/features/visualizer/rendering/track-render";
import type { SkillZoneResult } from "@/lib/skill-engine/zones";
import type { SkillEvaluationResult } from "@/lib/evaluator/types";
import { CourseMapCanvas } from "./course-map-canvas";
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

type ViewMode = "all" | "1d" | "map";

interface TrackCanvasProps {
  course: Course | null;
  zones: SkillZoneResult[] | null;
  selectedSkillId?: string | null;
  evaluation?: SkillEvaluationResult | null;
  venueCaption?: string;
}

export function TrackCanvas({
  course,
  zones,
  selectedSkillId,
  evaluation,
  venueCaption,
}: TrackCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<TrackSvgElement | null>(null);

  // Layout mode: "all" (Map + timeline), "1d" (Board 2), "map" (Board 1).
  // The per-skill effect graph now lives in SkillEffectDetailsModal.
  const [viewMode, setViewMode] = useState<ViewMode>("1d");
  const [hoverMeter, setHoverMeter] = useState<number | null>(null);
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);

  const impact = evaluation?.raceImpact;

  const handleHover = useCallback(
    (m: number | null, clientPos?: { clientX: number; clientY: number }) => {
      setHoverMeter(m);
      if (clientPos) setHoverCoords({ x: clientPos.clientX, y: clientPos.clientY });
    },
    [],
  );

  // 1. Render the 1D flat SVG track with its speed lane and synchronized hover
  useEffect(() => {
    if (!hostRef.current || !course) return;

    const svg = renderCourse(hostRef.current, course, {
      zones: zones ?? [],
      trace: impact?.trace ?? null,
      onHover: handleHover,
    });
    svgRef.current = svg;
  }, [course, zones, impact?.trace, handleHover]);

  // 2. Update 1D SVG hover line when hoverMeter changes from the Course Map
  useEffect(() => {
    svgRef.current?.setHoverMeter(hoverMeter);
  }, [hoverMeter]);

  const defaultCaption = course ? `${course.length.toLocaleString("en-US")}m Course` : "Course";

  return (
    <div className="flex flex-col gap-3">
      {/* Header Toolbar: Venue Caption & Flat Pill View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
          {venueCaption || defaultCaption}
        </p>

        {/* View Mode Switcher */}
        <div className="flex min-w-0 items-center gap-1 text-xs">
          <ToggleButtonGroup
            aria-label="Visualizer layout"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[viewMode]}
            onSelectionChange={(keys) => {
              const key = [...keys][0];
              setViewMode(key === "1d" || key === "map" ? key : "all");
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 p-0.5 text-xs dark:bg-zinc-800"
          >
            <ToggleButton
              id="all"
              className={`flex min-h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500/70 ${
                viewMode === "all"
                  ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
              aria-description="Course Map 2.5D and 1D Linear Timeline"
            >
              <LayoutDashboardIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Map + timeline</span>
            </ToggleButton>

            <ToggleButton
              id="1d"
              className={`flex min-h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500/70 ${
                viewMode === "1d"
                  ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
              aria-description="1D Timeline Only"
            >
              <SplitVerticalIcon className="h-3.5 w-3.5" />
              <span>1D Only</span>
            </ToggleButton>

            <ToggleButton
              id="map"
              className={`flex min-h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500/70 ${
                viewMode === "map"
                  ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
              aria-description="Course Map 2.5D Only"
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span>Map Only</span>
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
      </div>

      {/* Main Track Display: Course Map + 1D Timeline (Flat, unboxed like Rankings) */}
      {course ? (
        <div className="flex flex-col gap-4">
          {/* Board 1: 2D/2.5D Course Map */}
          {(viewMode === "all" || viewMode === "map") && (
            <div className="w-full overflow-hidden">
              <CourseMapCanvas
                course={course}
                activeSkillZones={zones}
                selectedSkillId={selectedSkillId}
                hoverMeter={hoverMeter}
                onHover={handleHover}
              />
            </div>
          )}

          {/* Board 2: 1D Linear Timeline with Speed Estimate */}
          {(viewMode === "all" || viewMode === "1d") && (
            <div className="w-full overflow-x-auto">
              <div ref={hostRef} className="w-full" />
            </div>
          )}

          {/* Floating Unified Telemetry Tooltip */}
          <TrackUnifiedTooltip
            course={course}
            zones={zones}
            impact={impact}
            hoverMeter={hoverMeter}
            coords={hoverCoords}
          />
        </div>
      ) : (
        <p className="text-sm text-zinc-400">Select a course.</p>
      )}
    </div>
  );
}
