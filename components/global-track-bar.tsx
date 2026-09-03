"use client";

// Unified Target Race Profile: Venue + Course + Running Style + Racers.
// This is the single source of truth that drives Parent recommendations,
// Main Deck analysis, and Visualizer racecourse simulation.

import {
  useDeck,
  RUNNING_STYLE_OPTIONS,
  type RunningStyle,
} from "./store";
import { distanceLabel, terrainLabel, turnLabel } from "../lib/api";

export default function GlobalTrackBar() {
  const {
    tracks,
    trackId,
    setTrackId,
    trackDetail,
    courseId,
    setCourseId,
    activeCourseRow,
    runningStyle,
    setRunningStyle,
    racerCount,
    setRacerCount,
  } = useDeck();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white/90 p-3.5 shadow-xs backdrop-blur-xs">
      <div className="flex flex-wrap items-center gap-2.5 text-xs">
        <span className="font-bold uppercase tracking-wider text-[#794016] text-[11px]">
          Target Race:
        </span>

        {/* Venue Selector */}
        <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50/80 px-2.5 py-1.5 text-zinc-700 shadow-2xs">
          <span className="text-[11px] font-medium text-zinc-500">Venue:</span>
          <select
            value={trackId}
            onChange={(e) => setTrackId(Number(e.target.value))}
            className="bg-transparent text-xs font-semibold text-zinc-800 outline-none cursor-pointer"
          >
            {(tracks ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.nameEn} ({t.nameJa})
              </option>
            ))}
          </select>
        </label>

        {/* Course Selector */}
        <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50/80 px-2.5 py-1.5 text-zinc-700 shadow-2xs">
          <span className="text-[11px] font-medium text-zinc-500">Course:</span>
          <select
            value={courseId}
            onChange={(e) => setCourseId(Number(e.target.value))}
            className="bg-transparent text-xs font-semibold text-zinc-800 outline-none cursor-pointer max-w-[210px] truncate"
          >
            {(trackDetail?.courses ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {distanceLabel(c.distance, c.length)} · {terrainLabel(c.terrain)}{turnLabel(c.turn) ? ` · ${turnLabel(c.turn)}` : ""}
              </option>
            ))}
          </select>
        </label>

        {/* Running Style Selector */}
        <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50/80 px-2.5 py-1.5 text-zinc-700 shadow-2xs">
          <span className="text-[11px] font-medium text-zinc-500">Style:</span>
          <select
            value={runningStyle ?? ""}
            onChange={(e) =>
              setRunningStyle(e.target.value === "" ? null : (Number(e.target.value) as RunningStyle))
            }
            className="bg-transparent text-xs font-semibold text-zinc-800 outline-none cursor-pointer"
          >
            {RUNNING_STYLE_OPTIONS.map((o) => (
              <option key={o.label} value={o.value ?? ""}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {/* Racers Input */}
        <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50/80 px-2 py-1.5 text-zinc-700 shadow-2xs">
          <span className="text-[11px] font-medium text-zinc-500">Racers:</span>
          <input
            type="number"
            min={9}
            max={18}
            value={racerCount}
            onChange={(e) => setRacerCount(Number(e.target.value))}
            className="w-10 bg-transparent text-xs font-semibold text-zinc-800 outline-none"
          />
        </label>
      </div>

      {/* Course Summary Pill */}
      {activeCourseRow && trackDetail && (
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
            {trackDetail.nameEn} · {distanceLabel(activeCourseRow.distance, activeCourseRow.length)} · {terrainLabel(activeCourseRow.terrain)}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="hidden sm:inline">Visualizer synced</span>
          </span>
        </div>
      )}
    </div>
  );
}
