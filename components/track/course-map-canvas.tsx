"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { Course } from "@/lib/skill-engine/types";
import type { SkillZoneResult } from "@/lib/skill-engine/zones";
import { loadCourseShapes } from "@/lib/track-geometry/shape-loader";
import type { CompactShapeEntry } from "@/lib/track-geometry/types";
import { transformCourseSpline, type CourseTransformResult } from "@/lib/track-geometry/course-transform";
import { renderCourseMap } from "@/lib/track-geometry/course-map-render";

// Inline SVG Icon components
function ZoomInIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function ZoomOutIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function RotateCcwIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function CompassIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function MountainIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    </svg>
  );
}

function AlertCircleIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

interface CourseMapCanvasProps {
  course: Course;
  activeSkillZones?: SkillZoneResult[] | null;
  selectedSkillId?: string | null;
  hoverMeter?: number | null;
  onHover?: (meter: number | null) => void;
  className?: string;
}

export function CourseMapCanvas({
  course,
  activeSkillZones,
  selectedSkillId,
  hoverMeter = null,
  onHover,
  className = "",
}: CourseMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [shape, setShape] = useState<CompactShapeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pan & Zoom state
  const [zoom, setZoom] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });

  // Size state
  const [dimensions, setDimensions] = useState({ width: 800, height: 440 });

  // Load shape data on mount or course change
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    loadCourseShapes()
      .then((shapes) => {
        if (!active) return;
        const entry = shapes[String(course.id)];
        if (entry) {
          setShape(entry);
        } else {
          setError(`No 3D spline shape available for course #${course.id}`);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load course shapes:", err);
        setError("Failed to load course shape");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [course.id]);

  // Track container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 50 && height > 50) {
          setDimensions({
            width: Math.floor(width),
            height: Math.floor(Math.max(220, height)),
          });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Compute transformed spline coordinates
  const transform = useMemo<CourseTransformResult | null>(() => {
    if (!shape) return null;
    return transformCourseSpline(shape, course, dimensions.width, dimensions.height);
  }, [shape, course, dimensions.width, dimensions.height]);

  // Check dark mode
  const isDark = useMemo(() => {
    if (typeof document === "undefined") return true;
    return document.documentElement.classList.contains("dark");
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !shape || !transform) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = dimensions;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    renderCourseMap(ctx, width, height, dpr, course, shape, transform, {
      hoverMeter,
      activeSkillZones,
      selectedSkillId,
      viewOffset,
      zoom,
      isDark,
    });
  }, [
    dimensions,
    shape,
    transform,
    course,
    hoverMeter,
    activeSkillZones,
    selectedSkillId,
    viewOffset,
    zoom,
    isDark,
  ]);

  // Mouse interaction: Pan
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Left click only
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    offsetStartRef.current = { ...viewOffset };
  }, [viewOffset]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (isDraggingRef.current) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setViewOffset({
          x: offsetStartRef.current.x + dx,
          y: offsetStartRef.current.y + dy,
        });
        return;
      }

      // Raycast to find nearest meter on track
      if (!transform || !onHover) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Invert pan & zoom
      const cx = dimensions.width / 2 + viewOffset.x;
      const cy = dimensions.height / 2 + viewOffset.y;
      const localX = (mouseX - cx) / zoom + dimensions.width / 2;
      const localY = (mouseY - cy) / zoom + dimensions.height / 2;

      let closestDist = Infinity;
      let closestMeter: number | null = null;

      for (let i = 0; i < transform.points.length; i++) {
        const pt = transform.points[i];
        const dist = Math.hypot(pt.x - localX, pt.y - localY);
        if (dist < closestDist) {
          closestDist = dist;
          closestMeter = pt.distance;
        }
      }

      // Active hover threshold (scaled with zoom)
      const threshold = 42;
      if (closestDist <= threshold && closestMeter != null) {
        onHover(closestMeter);
      } else {
        onHover(null);
      }
    },
    [dimensions, transform, onHover, viewOffset, zoom]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    onHover?.(null);
  }, [onHover]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(3.5, Math.max(1.0, prev * zoomFactor)));
  }, []);

  const handleZoomIn = () => setZoom((z) => Math.min(3.5, z * 1.25));
  const handleZoomOut = () => setZoom((z) => Math.max(1.0, z * 0.8));
  const handleResetView = () => {
    setZoom(1);
    setViewOffset({ x: 0, y: 0 });
  };

  const isLeftTurn = course.turn === 2;

  const totalDist = course.length || transform?.totalDistance || 2000;
  const hoverPhaseIdx = useMemo(() => {
    if (hoverMeter == null || hoverMeter < 0) return null;
    const p0 = totalDist / 6;
    const p1 = (totalDist * 2) / 3;
    const p2 = (totalDist * 5) / 6;
    if (hoverMeter < p0) return 0;
    if (hoverMeter < p1) return 1;
    if (hoverMeter < p2) return 2;
    return 3;
  }, [hoverMeter, totalDist]);

  const activeSlopeType = useMemo(() => {
    if (hoverMeter == null || !course.slopes) return null;
    const s = course.slopes.find((sl) => hoverMeter >= sl.start && hoverMeter <= sl.end);
    if (!s) return null;
    return s.slope > 0 ? "up" : "down";
  }, [hoverMeter, course.slopes]);

  const activeCorner = useMemo(() => {
    if (hoverMeter == null || !course.corners) return null;
    return course.corners.find((c) => hoverMeter >= c.start && hoverMeter <= c.end) || null;
  }, [hoverMeter, course.corners]);

  return (
    <div
      ref={containerRef}
      className={`relative min-h-[240px] w-full overflow-hidden rounded-xl border border-border/70 bg-card/60 backdrop-blur select-none md:min-h-[400px] ${className}`}
    >
      {/* Top Status Header */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
        <div className="flex items-center gap-1.5 rounded-md bg-background/85 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur border border-border/50 pointer-events-auto">
          <CompassIcon className="h-3.5 w-3.5 text-primary" />
          <span>{isLeftTurn ? "Left-handed (Counter-clockwise)" : "Right-handed (Clockwise)"}</span>
        </div>
        <div className="hidden items-center gap-1.5 rounded-md bg-background/85 px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur border border-border/50 md:flex">
          <span>Final Straight: Horizontal at bottom</span>
        </div>
        {course.slopes && course.slopes.length > 0 && (
          <div className="hidden items-center gap-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-1 text-xs font-medium border border-amber-500/20 md:flex">
            <MountainIcon className="h-3.5 w-3.5" />
            <span>{course.slopes.length} Slopes (2.5D Ramps)</span>
          </div>
        )}
      </div>

      {/* Floating Zoom & Reset Toolbar */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-lg bg-background/90 p-1 shadow-md backdrop-blur border border-border/60">
        <button
          type="button"
          onClick={handleZoomIn}
          disabled={zoom >= 3.499}
          title="Zoom In"
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
        >
          <ZoomInIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={zoom <= 1.001}
          title="Zoom Out"
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
        >
          <ZoomOutIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          title="Reset View"
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <RotateCcwIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Canvas */}
      {loading ? (
        <div className="flex h-[240px] w-full items-center justify-center text-sm text-muted-foreground md:h-[420px]">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2" />
          Loading course shape...
        </div>
      ) : error ? (
        <div className="flex h-[240px] w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground md:h-[420px]">
          <AlertCircleIcon className="h-6 w-6 text-destructive" />
          <span>{error}</span>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          className="block h-[240px] w-full touch-none cursor-grab active:cursor-grabbing md:h-[420px]"
        />
      )}

      {/* Bottom Legend Bar */}
      <div className="absolute bottom-2.5 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-background/85 px-3 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur border border-border/50 pointer-events-auto">
          <span className="text-muted-foreground font-semibold mr-1">Phases:</span>
          <span
            className={`flex items-center gap-1.5 transition-all duration-150 rounded px-1.5 py-0.5 ${
              hoverPhaseIdx === 0
                ? "bg-[#eab308]/20 ring-1.5 ring-[#eab308] font-bold text-foreground"
                : "text-foreground/90"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[#eab308]" />
            <span>Early (0–1/6)</span>
          </span>
          <span
            className={`flex items-center gap-1.5 transition-all duration-150 rounded px-1.5 py-0.5 ${
              hoverPhaseIdx === 1
                ? "bg-[#8b5cf6]/20 ring-1.5 ring-[#8b5cf6] font-bold text-foreground"
                : "text-foreground/90"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[#8b5cf6]" />
            <span>Mid (1/6–2/3)</span>
          </span>
          <span
            className={`flex items-center gap-1.5 transition-all duration-150 rounded px-1.5 py-0.5 ${
              hoverPhaseIdx === 2
                ? "bg-[#06b6d4]/20 ring-1.5 ring-[#06b6d4] font-bold text-foreground"
                : "text-foreground/90"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[#06b6d4]" />
            <span>Late (2/3–5/6)</span>
          </span>
          <span
            className={`flex items-center gap-1.5 transition-all duration-150 rounded px-1.5 py-0.5 ${
              hoverPhaseIdx === 3
                ? "bg-[#ef4444]/20 ring-1.5 ring-[#ef4444] font-bold text-foreground"
                : "text-foreground/90"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
            <span>Final Stretch</span>
          </span>
          <span className="text-muted-foreground/50 mx-0.5">|</span>
          <span
            className={`flex items-center gap-1 font-semibold transition-all duration-150 rounded px-1.5 py-0.5 ${
              activeSlopeType === "up"
                ? "bg-amber-500/20 ring-1.5 ring-amber-500 text-amber-500 font-bold"
                : "text-amber-500"
            }`}
          >
            <span>↗ Uphill</span>
          </span>
          <span
            className={`flex items-center gap-1 font-semibold transition-all duration-150 rounded px-1.5 py-0.5 ${
              activeSlopeType === "down"
                ? "bg-cyan-500/20 ring-1.5 ring-cyan-500 text-cyan-500 font-bold"
                : "text-cyan-500"
            }`}
          >
            <span>↘ Downhill</span>
          </span>
          {course.corners && course.corners.length > 0 && (
            <>
              <span className="text-muted-foreground/50 mx-0.5">|</span>
              <span
                className={`flex items-center gap-1 font-semibold transition-all duration-150 rounded px-1.5 py-0.5 ${
                  activeCorner
                    ? "bg-orange-500/20 ring-1.5 ring-orange-500 text-orange-500 font-bold"
                    : "text-orange-500"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                <span>{activeCorner ? `Corner ${activeCorner.number ?? ""}` : "Corners"}</span>
              </span>
            </>
          )}
        </div>

        <div className="text-[10px] text-muted-foreground/75 bg-background/80 px-2 py-1 rounded backdrop-blur border border-border/40">
          Drag to Pan • Wheel to Zoom
        </div>
      </div>
    </div>
  );
}
