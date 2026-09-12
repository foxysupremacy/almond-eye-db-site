"use client";

import { useEffect, useRef } from "react";
import type { Course } from "../../lib/skill-engine/types";
import { renderCourse } from "../../lib/track-render";
import type { SkillZoneResult } from "../../lib/skill-engine/zones";

interface TrackCanvasProps {
  course: Course | null;
  zones: SkillZoneResult[] | null;
}

export function TrackCanvas({ course, zones }: TrackCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  // Render the track into the host element whenever the course (or zones) change.
  useEffect(() => {
    if (!hostRef.current || !course) return;
    renderCourse(hostRef.current, course, { zones: zones ?? [] });
  }, [course, zones]);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 sm:p-4 shadow-xs transition-colors">
      <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          Track Elevation & Activation Zones
        </span>
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
          Touch or hover across track to inspect meter markers
        </span>
      </div>

      {course ? (
        <div ref={hostRef} className="w-full overflow-x-auto" />
      ) : (
        <p className="text-sm text-zinc-400">Select a course.</p>
      )}
    </div>
  );
}
