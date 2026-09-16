"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import type { Course } from "../../lib/skill-engine/types";
import type { SkillZoneResult } from "../../lib/skill-engine/zones";
import { loadCourseShapes, getCachedCourseShape } from "../../lib/track-geometry/shape-loader";
import { buildTrackScene, type TrackSceneObjects } from "../../lib/track-geometry/mesh-builder";
import { getSlopeInfoAtDistance, DEFAULT_ELEVATION_EXAGGERATION } from "../../lib/track-geometry/elevation";
import { interpolateTrackPoint2D, clamp } from "../../lib/track-geometry/interpolation";
import type { CompactShapeEntry, SlopeInfo } from "../../lib/track-geometry/types";

interface Track3DCanvasProps {
  course: Course | null;
  zones: SkillZoneResult[] | null;
  hoverMeter: number | null;
  onHoverMeter?: (meter: number | null) => void;
  elevationExaggeration?: number;
  selectedLap?: "all" | 1 | 2;
  loopSplitRatio?: number | null;
  onResetView?: () => void;
}

export function Track3DCanvas({
  course,
  zones,
  hoverMeter,
  onHoverMeter,
  elevationExaggeration = DEFAULT_ELEVATION_EXAGGERATION,
  selectedLap = "all",
  loopSplitRatio = null,
}: Track3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [shape, setShape] = useState<CompactShapeEntry | null>(null);
  const [loadingShape, setLoadingShape] = useState(false);
  const [hoverSlopeInfo, setHoverSlopeInfo] = useState<SlopeInfo | null>(null);

  // Scene references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneObjectsRef = useRef<TrackSceneObjects | null>(null);

  // Camera view state (pan offset & zoom)
  const cameraInitialRef = useRef<{
    center: THREE.Vector3;
    frustumSize: number;
  } | null>(null);
  const panOffsetRef = useRef<THREE.Vector2>(new THREE.Vector2(0, 0));
  const zoomLevelRef = useRef<number>(1.0);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 1. Fetch / load course shape
  useEffect(() => {
    if (!course) {
      setShape(null);
      return;
    }

    const cached = getCachedCourseShape(course.id);
    if (cached) {
      setShape(cached);
      return;
    }

    let alive = true;
    setLoadingShape(true);

    loadCourseShapes()
      .then((shapes) => {
        if (!alive) return;
        const s = shapes[String(course.id)] ?? null;
        setShape(s);
      })
      .catch((err) => {
        console.error("Failed to load shape for track", course.id, err);
      })
      .finally(() => {
        if (alive) setLoadingShape(false);
      });

    return () => {
      alive = false;
    };
  }, [course]);

  // Helper to re-render scene
  const requestRender = useCallback(() => {
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, []);

  // 2. Initialize Three.js WebGL Scene
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !course || !shape) return;

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 360;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    // Lighting (Warm directional light angled across slopes to emphasize physical ramps)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    dirLight.position.set(120, 240, 140);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.4);
    fillLight.position.set(-120, 80, -140);
    scene.add(fillLight);

    // Build Track Meshes (Ribbon, slopes ___/ & ---\, floating skill arcs, wireframe grid)
    const sceneObjects = buildTrackScene({
      course,
      shape,
      elevationExaggeration,
      selectedLap,
      loopSplitRatio,
      zones,
    });
    sceneObjectsRef.current = sceneObjects;
    scene.add(sceneObjects.group);

    // Camera setup: Fixed 35° Isometric perspective
    const { minX, maxX, minY, maxY, minZ, maxZ } = sceneObjects.bounds;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const center = new THREE.Vector3(centerX, centerY, centerZ);

    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxZ - minZ);
    const maxSpan = Math.max(spanX, spanZ) * 1.25;

    const aspect = width / height;
    const frustumSize = maxSpan;

    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      -2000,
      2000
    );

    // Position camera at 35° isometric elevation angle and 45° azimuth
    const isoDist = 500;
    const pitchRad = (35 * Math.PI) / 180;
    const yawRad = (45 * Math.PI) / 180;

    const camX = centerX + isoDist * Math.cos(pitchRad) * Math.sin(yawRad);
    const camY = centerY + isoDist * Math.sin(pitchRad);
    const camZ = centerZ + isoDist * Math.cos(pitchRad) * Math.cos(yawRad);

    camera.position.set(camX, camY, camZ);
    camera.lookAt(center);
    cameraRef.current = camera;

    cameraInitialRef.current = { center, frustumSize };
    panOffsetRef.current.set(0, 0);
    zoomLevelRef.current = 1.0;

    requestRender();

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (!container || !camera || !renderer) return;
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      if (nw <= 0 || nh <= 0) return;

      const newAspect = nw / nh;
      const fSize = (cameraInitialRef.current?.frustumSize ?? 300) / zoomLevelRef.current;
      camera.left = (-fSize * newAspect) / 2;
      camera.right = (fSize * newAspect) / 2;
      camera.top = fSize / 2;
      camera.bottom = -fSize / 2;
      camera.updateProjectionMatrix();

      renderer.setSize(nw, nh);
      requestRender();
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      // Dispose Three resources
      renderer.dispose();
      scene.clear();
      sceneObjects.trackMesh.geometry.dispose();
    };
  }, [course, shape, elevationExaggeration, selectedLap, loopSplitRatio, zones, requestRender]);

  // 3. Update runner marker position when hoverMeter changes (from 1D or 3D)
  useEffect(() => {
    if (!sceneObjectsRef.current) return;
    sceneObjectsRef.current.updateRunnerPosition(hoverMeter);

    if (course && hoverMeter != null) {
      setHoverSlopeInfo(getSlopeInfoAtDistance(course, hoverMeter));
    } else {
      setHoverSlopeInfo(null);
    }

    requestRender();
  }, [hoverMeter, course, requestRender]);

  // 4. Reset camera view handler
  const handleResetView = useCallback(() => {
    const camera = cameraRef.current;
    const container = containerRef.current;
    const initial = cameraInitialRef.current;
    if (!camera || !container || !initial) return;

    panOffsetRef.current.set(0, 0);
    zoomLevelRef.current = 1.0;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const aspect = width / height;

    camera.left = (-initial.frustumSize * aspect) / 2;
    camera.right = (initial.frustumSize * aspect) / 2;
    camera.top = initial.frustumSize / 2;
    camera.bottom = -initial.frustumSize / 2;
    camera.updateProjectionMatrix();

    const isoDist = 500;
    const pitchRad = (35 * Math.PI) / 180;
    const yawRad = (45 * Math.PI) / 180;
    camera.position.set(
      initial.center.x + isoDist * Math.cos(pitchRad) * Math.sin(yawRad),
      initial.center.y + isoDist * Math.sin(pitchRad),
      initial.center.z + isoDist * Math.cos(pitchRad) * Math.cos(yawRad)
    );
    camera.lookAt(initial.center);

    requestRender();
  }, [requestRender]);

  // 5. Mouse pan, zoom, and raycast interactions
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const camera = cameraRef.current;
    const container = containerRef.current;
    if (!camera || !container) return;

    // Pan camera on drag
    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      dragStartRef.current = { x: e.clientX, y: e.clientY };

      const panSpeed = (cameraInitialRef.current?.frustumSize ?? 300) / (container.clientHeight * zoomLevelRef.current);
      // Shift along camera right & up vectors
      const right = new THREE.Vector3();
      camera.getWorldDirection(right);
      right.cross(camera.up).normalize();

      camera.position.addScaledVector(right, -dx * panSpeed);
      camera.position.addScaledVector(camera.up, dy * panSpeed);

      requestRender();
      return;
    }

    // Hover raycast against track mesh to find nearest meter
    if (!course || !shape || !onHoverMeter) return;

    const rect = container.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

    const trackMesh = sceneObjectsRef.current?.trackMesh;
    if (!trackMesh) return;

    const intersects = raycaster.intersectObject(trackMesh, false);
    if (intersects.length > 0) {
      const hitPt = intersects[0].point;

      // Find closest sample point along the 251 spline
      let bestDist = Infinity;
      let bestRatio = 0;

      for (let i = 0; i < shape.points.length; i++) {
        const pt = shape.points[i];
        const d = Math.hypot(pt[0] - hitPt.x, pt[1] - hitPt.z);
        if (d < bestDist) {
          bestDist = d;
          bestRatio = i / (shape.points.length - 1);
        }
      }

      const calculatedMeter = Math.round(bestRatio * course.length);
      onHoverMeter(calculatedMeter);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const camera = cameraRef.current;
    const container = containerRef.current;
    const initial = cameraInitialRef.current;
    if (!camera || !container || !initial) return;

    const zoomDelta = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = clamp(zoomLevelRef.current * zoomDelta, 0.4, 4.0);
    zoomLevelRef.current = newZoom;

    const aspect = container.clientWidth / container.clientHeight;
    const fSize = initial.frustumSize / newZoom;

    camera.left = (-fSize * aspect) / 2;
    camera.right = (fSize * aspect) / 2;
    camera.top = fSize / 2;
    camera.bottom = -fSize / 2;
    camera.updateProjectionMatrix();

    requestRender();
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[280px] sm:h-[320px] md:h-[340px] rounded-xl overflow-hidden bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        isDraggingRef.current = false;
        onHoverMeter?.(null);
      }}
      onWheel={handleWheel}
      style={{ touchAction: "none" }}
    >
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

      {/* Floating slope & hover HUD */}
      <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5 pointer-events-none z-10">
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-zinc-900/90 text-zinc-300 border border-zinc-700/60 backdrop-blur-xs">
          3D Isometric (35°)
        </span>

        {hoverMeter != null && (
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-900/90 text-amber-300 border border-amber-500/40 backdrop-blur-xs">
            {Math.round(hoverMeter)}m
          </span>
        )}

        {hoverSlopeInfo && (
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-md border backdrop-blur-xs ${
              hoverSlopeInfo.isUp
                ? "bg-amber-950/90 text-amber-400 border-amber-600/60"
                : hoverSlopeInfo.isDown
                ? "bg-cyan-950/90 text-cyan-400 border-cyan-600/60"
                : "bg-zinc-900/90 text-zinc-400 border-zinc-700/60"
            }`}
          >
            {hoverSlopeInfo.isUp ? "↗ " : hoverSlopeInfo.isDown ? "↘ " : ""}
            {hoverSlopeInfo.gradeFormatted}
          </span>
        )}
      </div>

      {/* Quick controls: Reset view + Legend pills */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
        <button
          type="button"
          onClick={handleResetView}
          className="text-[11px] font-medium px-2 py-1 rounded-md bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 backdrop-blur-xs shadow-xs transition-colors cursor-pointer"
          title="Reset camera zoom and center"
        >
          Reset View
        </button>
      </div>

      {/* Bottom slope guide legend */}
      <div className="absolute bottom-2 left-2.5 right-2.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-400 pointer-events-none z-10">
        <div className="flex items-center gap-2.5 bg-zinc-900/80 px-2 py-1 rounded-md border border-zinc-800/80 backdrop-blur-xs">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2 rounded-xs bg-amber-600 inline-block" />
            <span>Uphill ramp (___/)</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2 rounded-xs bg-sky-600 inline-block" />
            <span>Downhill ramp (---\)</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2 rounded-xs bg-emerald-700 inline-block" />
            <span>Flat</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2 rounded-xs bg-fuchsia-500 inline-block" />
            <span>Spurt line</span>
          </span>
        </div>
        <span className="hidden sm:inline bg-zinc-900/80 px-2 py-1 rounded-md border border-zinc-800/80">
          Drag to Pan · Scroll to Zoom
        </span>
      </div>

      {loadingShape && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/60 backdrop-blur-xs z-20">
          <span className="text-xs text-zinc-300 font-medium animate-pulse">Loading 3D track spline...</span>
        </div>
      )}
    </div>
  );
}
