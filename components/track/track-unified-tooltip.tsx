"use client";

import React, { useEffect, useRef } from "react";
import type { Course } from "../../lib/skill-engine/types";
import type { SkillZoneResult } from "../../lib/skill-engine/zones";
import type { RaceImpactResult } from "../../lib/race-impact/types";
import { getPhaseAtMeter, meterToBaselineTime } from "../../lib/race-impact/trace";

interface TrackUnifiedTooltipProps {
  course: Course | null;
  zones: SkillZoneResult[] | null;
  impact?: RaceImpactResult | null;
  hoverMeter: number | null;
  coords: { x: number; y: number } | null;
  isPinned: boolean;
  onUnpin: () => void;
  unit: "meters" | "bashin";
}

const PHASE_NAMES = ["Opening leg", "Middle leg", "Final leg", "Last spurt"];

export function TrackUnifiedTooltip({
  course,
  zones,
  impact,
  hoverMeter,
  coords,
  isPinned,
  onUnpin,
  unit,
}: TrackUnifiedTooltipProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isPinned) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onUnpin();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPinned, onUnpin]);

  if (hoverMeter == null || !course || !coords) return null;

  const courseLength = course.length;
  const spurt = course.spurtStart?.meters ?? Math.round((courseLength * 2) / 3);
  const phaseIndex = getPhaseAtMeter(hoverMeter, courseLength, spurt);
  const phaseName = PHASE_NAMES[phaseIndex] ?? "Race";
  const section = Math.min(24, Math.max(1, Math.floor((hoverMeter / courseLength) * 24) + 1));

  // Trace lookup
  const trace = impact?.trace;
  const baselineTime = trace ? meterToBaselineTime(hoverMeter, trace) : null;

  // Find nearest trace point for speed
  let baseSpeed: number | null = null;
  let skillSpeed: number | null = null;
  let deltaSpeed: number | null = null;

  if (trace && trace.points.length > 0) {
    const pt = trace.points.find((p) => Math.abs(p.baselineMeter - hoverMeter) <= 30);
    if (pt) {
      baseSpeed = pt.baselineSpeed;
      skillSpeed = pt.skillSpeed;
      deltaSpeed = Number((pt.skillSpeed - pt.baselineSpeed).toFixed(2));
    }
  }

  // Distribution lookup for gain & probability
  const dist = impact?.distribution;
  const sample = dist?.samples.find((s) => Math.abs(s.meter - hoverMeter) <= 15);
  const gainMeters = sample?.gainMeters ?? (hoverMeter === trace?.activationMeter ? trace?.distanceGainMeters ?? 0 : 0);
  const bashin = sample?.bashin ?? (hoverMeter === trace?.activationMeter ? trace?.bashinGain ?? 0 : 0);
  const isEligible = sample?.eligible ?? false;
  const actRate = sample?.activationRate ?? (isEligible ? (impact?.activation.activationRate ?? 0) : 0);

  // Check active zone
  let activeZoneText: string | null = null;
  if (zones && zones.length > 0) {
    for (let zi = 0; zi < zones.length; zi++) {
      const match = zones[zi].regions.find((r) => hoverMeter >= r.start && hoverMeter <= r.end);
      if (match) {
        activeZoneText = `Trigger Zone T${zi + 1} (${Math.round(match.start)}m – ${Math.round(match.end)}m)`;
        break;
      }
    }
  }

  // Calculate viewport clamped position
  const winW = typeof window !== "undefined" ? window.innerWidth : 1200;
  const winH = typeof window !== "undefined" ? window.innerHeight : 800;

  const cardW = 290;
  const cardH = 210;
  let left = coords.x + 16;
  let top = coords.y + 16;

  if (left + cardW > winW - 12) {
    left = Math.max(12, coords.x - cardW - 16);
  }
  if (top + cardH > winH - 12) {
    top = Math.max(12, coords.y - cardH - 16);
  }

  return (
    <div
      ref={cardRef}
      style={{ left: `${left}px`, top: `${top}px` }}
      className={`fixed z-[300] w-[280px] sm:w-[295px] select-none rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 bg-white/95 dark:bg-zinc-900/95 p-3.5 shadow-xl backdrop-blur-md transition-all duration-75 text-zinc-900 dark:text-zinc-100 ${
        isPinned ? "ring-2 ring-emerald-500/80 dark:ring-emerald-400/80" : ""
      }`}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-base font-bold text-zinc-900 dark:text-zinc-50">
              {Math.round(hoverMeter).toLocaleString()}m
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {phaseName}
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Section {section}/24 {baselineTime != null && `· t = ${baselineTime.toFixed(1)}s`}
          </div>
        </div>

        {/* Pin Badge & Dismiss Button */}
        <div className="flex items-center gap-1">
          {isPinned ? (
            <button
              type="button"
              onClick={onUnpin}
              className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 cursor-pointer"
              title="Click to unpin (or press Esc)"
            >
              <span>Pinned</span>
              <span className="text-zinc-400">✕</span>
            </button>
          ) : (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Tap to pin</span>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
        {/* Speed Metric */}
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-2 border border-zinc-100 dark:border-zinc-800">
          <span className="block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Trajectory Speed
          </span>
          <div className="mt-0.5 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            {baseSpeed != null ? `${baseSpeed.toFixed(2)} m/s` : "—"}
          </div>
          {deltaSpeed != null && deltaSpeed > 0 && (
            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              +{deltaSpeed.toFixed(2)} m/s (Skill)
            </div>
          )}
        </div>

        {/* Distance Gain Metric */}
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-2 border border-zinc-100 dark:border-zinc-800">
          <span className="block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Distance Gain
          </span>
          <div className="mt-0.5 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
            {unit === "bashin" ? `${bashin.toFixed(2)} bashin` : `+${gainMeters.toFixed(2)} m`}
          </div>
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {unit === "bashin" ? `+${gainMeters.toFixed(2)} m` : `${bashin.toFixed(2)} bashin`}
          </div>
        </div>
      </div>

      {/* Activation Eligibility Status */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] border-t border-zinc-100 dark:border-zinc-800 pt-2">
        <span className="text-zinc-500 dark:text-zinc-400">Activation Probability</span>
        <span
          className={`font-semibold ${
            isEligible
              ? "text-emerald-600 dark:text-emerald-400 font-mono"
              : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {isEligible ? `${(actRate * 100).toFixed(1)}%` : "0% (Outside Zone)"}
        </span>
      </div>

      {/* Zone Indicator */}
      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            activeZoneText ? "bg-emerald-500 animate-pulse" : "bg-zinc-300 dark:bg-zinc-600"
          }`}
        />
        <span className="truncate">{activeZoneText ?? "No skill trigger at this distance"}</span>
      </div>
    </div>
  );
}
