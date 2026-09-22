"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Course } from "../../lib/skill-engine/types";
import { renderCourse } from "../../lib/track-render";
import type { SkillZoneResult } from "../../lib/skill-engine/zones";
import { CourseMapCanvas } from "./course-map-canvas";

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

interface TrackCanvasProps {
  course: Course | null;
  zones: SkillZoneResult[] | null;
  selectedSkillId?: string | null;
}

export function TrackCanvas({ course, zones, selectedSkillId }: TrackCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Layout mode: "stacked" (both Map & 1D), "map" (Course map only), "1d" (1D timeline only)
  // The timeline is the primary planning surface; maps remain opt-in controls.
  const [viewMode, setViewMode] = useState<"stacked" | "map" | "1d">("1d");
  const [hoverMeter, setHoverMeter] = useState<number | null>(null);

  // 1. Render the 1D flat SVG track and hook up hover
  useEffect(() => {
    if (!hostRef.current || !course) return;

    const svg = renderCourse(hostRef.current, course, {
      zones: zones ?? [],
      onHover: (m) => setHoverMeter(m),
    });
    svgRef.current = svg;
  }, [course, zones]);

  // 2. Update 1D SVG hover line when hoverMeter changes from Course Map
  useEffect(() => {
    if (svgRef.current && (svgRef.current as any).__setHoverMeter) {
      (svgRef.current as any).__setHoverMeter(hoverMeter);
    }
  }, [hoverMeter]);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 sm:p-4 shadow-xs transition-colors">
      {/* Header Toolbar */}
      <div className="mb-3 flex flex-col items-stretch justify-between gap-2.5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Course Map & Track Visualizer
          </span>
          <span className="hidden sm:inline text-[11px] text-zinc-400 dark:text-zinc-500">
            2.5D Slope Course Map & 1D Linear Timeline
          </span>
        </div>

        {/* View Mode Switcher */}
        <div className="flex min-w-0 items-center gap-1 text-xs">
          <div className="grid w-full grid-cols-3 items-center rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-800 sm:flex sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode("stacked")}
              className={`flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer sm:px-2.5 ${
                viewMode === "stacked"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
              title="Stacked: Course Map on top, 1D Timeline on bottom"
            >
              <LayoutDashboardIcon className="h-3.5 w-3.5" />
              <span>Full View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer sm:px-2.5 ${
                viewMode === "map"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
              title="Course Map Only"
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span>Map Only</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("1d")}
              className={`flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer sm:px-2.5 ${
                viewMode === "1d"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
              title="1D Timeline Only"
            >
              <SplitVerticalIcon className="h-3.5 w-3.5" />
              <span>1D Only</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Track Display: Stacked Layout */}
      {course ? (
        <div className="flex flex-col gap-3.5">
          {/* Top: 2D/2.5D Course Map */}
          {viewMode !== "1d" && (
            <div className="w-full">
              <CourseMapCanvas
                course={course}
                activeSkillZones={zones}
                selectedSkillId={selectedSkillId}
                hoverMeter={hoverMeter}
                onHover={setHoverMeter}
              />
            </div>
          )}

          {/* Bottom: 1D Linear Timeline Container */}
          {viewMode !== "map" && (
            <div className="overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2 sm:p-2.5 transition-all">
              <div className="flex items-center justify-between mb-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                <span className="font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  1D Linear Timeline
                </span>
                <span>Ruler · 24 Sections · Phase Bands · Skill Activation Intervals</span>
              </div>
              <div ref={hostRef} className="w-full overflow-x-auto" />
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">Select a course.</p>
      )}
    </div>
  );
}
