"use client";

// Unified Target Race Profile: Venue + Course + Running Style + Racers.
// This is the single source of truth that drives Parent recommendations,
// Main Deck analysis, and Visualizer racecourse simulation.

import { useState } from "react";
import {
  useDeck,
  RUNNING_STYLE_OPTIONS,
  RUNNING_STYLE_LABELS,
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

  const [mobileExpanded, setMobileExpanded] = useState(false);

  const raceTitle = activeCourseRow && trackDetail
    ? `${trackDetail.nameEn} · ${distanceLabel(activeCourseRow.distance, activeCourseRow.length)} · ${terrainLabel(activeCourseRow.terrain)}`
    : "Select Target Race";

  return (
    <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 p-3.5 shadow-xs backdrop-blur-xs transition-colors">
      {/* Mobile Collapsed Summary Header (<md) */}
      <div className="flex md:hidden items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          <div className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Target Race
            </span>
            <span className="block truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {raceTitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {runningStyle && (
            <span className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
              {RUNNING_STYLE_LABELS[runningStyle]}
            </span>
          )}
          <button
            type="button"
            onClick={() => setMobileExpanded((prev) => !prev)}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            {mobileExpanded ? "Done ▴" : "Edit ▾"}
          </button>
        </div>
      </div>

      {/* Full Selectors Grid (Expanded on Mobile or always visible on md+) */}
      <div className={`mt-3 md:mt-0 flex flex-wrap items-center justify-between gap-3 ${mobileExpanded ? "block" : "hidden md:flex"}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap items-center gap-2.5 text-xs w-full md:w-auto">
          <span className="hidden md:inline font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 text-[11px]">
            Target Race:
          </span>

          {/* Venue Selector */}
          <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/80 px-2.5 py-1.5 text-zinc-700 dark:text-zinc-300 shadow-2xs">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Venue:</span>
            <select
              value={trackId}
              onChange={(e) => setTrackId(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-zinc-800 dark:text-zinc-100 outline-none cursor-pointer flex-1"
            >
              {(tracks ?? []).map((t) => (
                <option key={t.id} value={t.id} className="dark:bg-zinc-900">
                  {t.nameEn} ({t.nameJa})
                </option>
              ))}
            </select>
          </label>

          {/* Course Selector */}
          <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/80 px-2.5 py-1.5 text-zinc-700 dark:text-zinc-300 shadow-2xs">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Course:</span>
            <select
              value={courseId}
              onChange={(e) => setCourseId(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-zinc-800 dark:text-zinc-100 outline-none cursor-pointer max-w-[210px] truncate flex-1"
            >
              {(trackDetail?.courses ?? []).map((c) => (
                <option key={c.id} value={c.id} className="dark:bg-zinc-900">
                  {distanceLabel(c.distance, c.length)} · {terrainLabel(c.terrain)}{turnLabel(c.turn) ? ` · ${turnLabel(c.turn)}` : ""}
                </option>
              ))}
            </select>
          </label>

          {/* Running Style Selector */}
          <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/80 px-2.5 py-1.5 text-zinc-700 dark:text-zinc-300 shadow-2xs">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Style:</span>
            <select
              value={runningStyle ?? ""}
              onChange={(e) =>
                setRunningStyle(e.target.value === "" ? null : (Number(e.target.value) as RunningStyle))
              }
              className="bg-transparent text-xs font-semibold text-zinc-800 dark:text-zinc-100 outline-none cursor-pointer flex-1"
            >
              {RUNNING_STYLE_OPTIONS.map((o) => (
                <option key={o.label} value={o.value ?? ""} className="dark:bg-zinc-900">
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {/* Racers Input */}
          <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/80 px-2 py-1.5 text-zinc-700 dark:text-zinc-300 shadow-2xs">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Racers:</span>
            <input
              type="number"
              min={9}
              max={18}
              value={racerCount}
              onChange={(e) => setRacerCount(Number(e.target.value))}
              className="w-10 bg-transparent text-xs font-semibold text-zinc-800 dark:text-zinc-100 outline-none"
            />
          </label>
        </div>

        {/* Course Summary Pill (Desktop) */}
        {activeCourseRow && trackDetail && (
          <div className="hidden lg:flex items-center gap-2 text-xs">
            <span className="rounded-full border border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:text-amber-300 shadow-2xs">
              {raceTitle}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Visualizer synced</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
