"use client";

import { useEffect, useRef } from "react";
import { renderCourse } from "@/features/visualizer/rendering";
import type { Course } from "@/lib/skill-engine/types";
import type { SkillZoneResult } from "@/lib/skill-engine/zones";

/** Course order index of each item (DOM order matches the array order). */
function orderOf(items: { start: number }[]): number[] {
  const sorted = items.map((item, i) => ({ start: item.start, i })).sort((a, b) => a.start - b.start);
  const rank: number[] = [];
  sorted.forEach((entry, n) => { rank[entry.i] = n + 1; });
  return rank;
}

function numberSegments(svg: SVGSVGElement, course: Course) {
  const straightRank = orderOf(course.straights);
  svg.querySelectorAll("svg.straight > text.sectionText").forEach((node, i) => { node.textContent = `Straight ${straightRank[i] ?? i + 1}`; });
  const cornerRank = orderOf(course.corners);
  svg.querySelectorAll("svg.corner > text.sectionText").forEach((node, i) => { node.textContent = `Corner ${cornerRank[i] ?? i + 1}`; });
}

export interface CourseStripProps {
  course: Course;
  zones?: SkillZoneResult[];
  /** Phone: a shorter strip (CSS height only; the SVG letterboxes). */
  compact?: boolean;
  /** Relabel straights/corners as `Straight 1…` / `Corner 1…` in course order. */
  numberedSegments?: boolean;
}

/** Thin wrapper over the visualizer's track renderer without the speed lane. */
export function CourseStrip({ course, zones, compact = false, numberedSegments = false }: CourseStripProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const svg = renderCourse(host, course, { showSpeedLane: false, zones: zones ?? [] });
    if (compact) svg.classList.add("compact");
    if (numberedSegments) numberSegments(svg, course);
  }, [course, zones, compact, numberedSegments]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={`Course layout, ${course.length.toLocaleString("en-US")}m`}
      className={`w-full ${compact ? "[&_.racetrackView]:h-24" : ""}`}
    />
  );
}
