"use client";

// Unified Target Race Profile: Venue + Course + Running Style + Racers.
// This is the single source of truth that drives Parent recommendations,
// Main Deck analysis, and Visualizer racecourse simulation.

import { useState } from "react";
import { MobileSheet } from "@/app/common/ui/controls/mobile-sheet";
import { useDeck } from "@/features/deck/state";
import { RUNNING_STYLE_OPTIONS, RUNNING_STYLE_LABELS } from "@/lib/deck/constants";
import type { RunningStyle } from "@/lib/deck/types";
import { distanceLabel, terrainLabel, turnLabel } from "@/lib/api";
import { getActivePvpEvents } from "@/lib/pvp/events";
import { TrophyIcon, FlagIcon, ChevronDownIcon } from "@/app/common/ui/primitives/icons";
import { Badge } from "@/app/common/ui/primitives/badge";

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
    activePvpEventId,
    activePvpEvent,
    activePreset,
    masterChallengeEvents,
    activeMasterChallengeEvent,
    activeMasterChallengeRace,
    selectMasterChallengeRace,
    clearMasterChallenge,
    racetrackDetails,
    applyPvpPreset,
    clearPvpPreset,
  } = useDeck();

  const [mobileExpanded, setMobileExpanded] = useState(false);

  const raceTitle = activeCourseRow && trackDetail
    ? `${trackDetail.nameEn} · ${distanceLabel(activeCourseRow.distance, activeCourseRow.length)} · ${terrainLabel(activeCourseRow.terrain)}`
    : "Select Target Race";

  const masterChallengeSelection = activePreset.trackInfo.masterChallengeSelection ?? null;
  const selectedMasterChallengeEvent = masterChallengeEvents.find((event) => event.eventId === masterChallengeSelection?.eventId) ?? null;
  const selectedMasterChallengeRace = selectedMasterChallengeEvent?.races.find((race) => race.eventSubId === masterChallengeSelection?.eventSubId) ?? null;

  function courseLabel(courseId: number): string {
    const track = racetrackDetails.find((entry) => entry.courses.some((course) => course.id === courseId));
    const course = track?.courses.find((entry) => entry.id === courseId);
    if (!track || !course) return `Course ${courseId}`;
    return `${track.nameEn} · ${distanceLabel(course.distance, course.length)} · ${terrainLabel(course.terrain)}${turnLabel(course.turn) ? ` · ${turnLabel(course.turn)}` : ""}`;
  }

  function handleMasterChallengeEventChange(value: string) {
    const eventId = Number(value);
    const event = masterChallengeEvents.find((entry) => entry.eventId === eventId);
    if (!event) {
      clearMasterChallenge();
      return;
    }
    const preferredRace = event.races.find((race) => race.raceCourseSetId === courseId)
      ?? [...event.races].sort((a, b) => a.eventSubId - b.eventSubId || a.raceCourseSetId - b.raceCourseSetId)[0];
    if (preferredRace) selectMasterChallengeRace(event.eventId, preferredRace.eventSubId);
  }

  const controls = (<div className="race-controls flex min-w-0 flex-col gap-3">
        {/* PvP Presets & Conditions Section */}
        <div className="flex flex-col gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-2">
          {/* PvP Presets Row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 text-[11px] mr-1 flex items-center gap-1.5">
              <TrophyIcon className="h-3.5 w-3.5" />
              <span>PvP:</span>
            </span>
            {getActivePvpEvents().map((event) => {
              const isActive = activePvpEventId === event.id;
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => {
                    if (isActive) {
                      clearPvpPreset();
                    } else {
                      applyPvpPreset(event);
                    }
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-purple-600 text-white shadow-xs ring-2 ring-purple-500/40 border border-purple-500"
                      : "border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/90 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                  title={event.name}
                >
                  <span>{event.shortName}</span>
                </button>
              );
            })}
            <label className="flex min-h-8 items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50/80 px-2 dark:border-violet-900/70 dark:bg-violet-950/40">
              <span className="text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">Master Challenge</span>
              <select
                aria-label="Master Challenge event"
                value={masterChallengeSelection?.eventId ?? ""}
                onChange={(event) => handleMasterChallengeEventChange(event.target.value)}
                className="max-w-[220px] bg-transparent text-xs font-semibold text-violet-950 outline-none dark:text-violet-100"
              >
                <option value="" className="dark:bg-zinc-900">Choose event</option>
                {masterChallengeEvents.map((event) => (
                  <option key={event.eventId} value={event.eventId} className="dark:bg-zinc-900">
                    Master Challenge #{event.eventId} · {event.schedule}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50/90 px-2 dark:border-zinc-700/80 dark:bg-zinc-800/80">
              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Race</span>
              <select
                aria-label="Master Challenge race"
                value={selectedMasterChallengeRace?.eventSubId ?? ""}
                onChange={(event) => {
                  const eventSubId = Number(event.target.value);
                  if (selectedMasterChallengeEvent && Number.isInteger(eventSubId)) {
                    selectMasterChallengeRace(selectedMasterChallengeEvent.eventId, eventSubId);
                  }
                }}
                disabled={!selectedMasterChallengeEvent}
                className="max-w-[300px] bg-transparent text-xs font-semibold text-zinc-800 outline-none disabled:text-zinc-400 dark:text-zinc-100"
              >
                <option value="" className="dark:bg-zinc-900">Choose race</option>
                {(selectedMasterChallengeEvent?.races ?? []).map((race) => (
                  <option key={race.eventSubId} value={race.eventSubId} className="dark:bg-zinc-900">
                    {courseLabel(race.raceCourseSetId)} · Race {race.eventSubId}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {activeMasterChallengeEvent && activeMasterChallengeRace && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]" aria-live="polite">
              <Badge size="standard" tone="purple" className="font-semibold">
                Master Challenge #{activeMasterChallengeEvent.eventId} · Race #{activeMasterChallengeRace.eventSubId}
              </Badge>
              <span className="text-zinc-500 dark:text-zinc-400">
                Season {activeMasterChallengeRace.season} · Weather {activeMasterChallengeRace.weather} · Ground {activeMasterChallengeRace.ground} · Time {activeMasterChallengeRace.timezone} · {activeMasterChallengeRace.entryCount} racers
              </span>
            </div>
          )}

          {/* Active Event Conditions Badges (Below PvP Selector) */}
          {activePvpEvent && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] animate-in fade-in duration-200 ease-out-quart">
              {/* Season */}
              <span className="inline-flex items-center gap-1 rounded-md border border-orange-200 dark:border-orange-900/60 bg-orange-50/80 dark:bg-orange-950/40 px-1.5 py-0.5 font-medium text-orange-800 dark:text-orange-300">
                <img src={activePvpEvent.seasonIcon} alt={activePvpEvent.season} className="h-3.5 w-3.5 object-contain" />
                <span>{activePvpEvent.season}</span>
              </span>

              {/* Weather */}
              {activePvpEvent.weather && activePvpEvent.weatherIcon ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 dark:border-sky-900/60 bg-sky-50/80 dark:bg-sky-950/40 px-1.5 py-0.5 font-medium text-sky-800 dark:text-sky-300">
                  <img src={activePvpEvent.weatherIcon} alt={activePvpEvent.weather} className="h-3.5 w-3.5 object-contain" />
                  <span>{activePvpEvent.weather}</span>
                </span>
              ) : null}

              {/* Ground */}
              {activePvpEvent.ground ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/40 px-1.5 py-0.5 font-medium text-emerald-800 dark:text-emerald-300">
                  <span>Ground: {activePvpEvent.ground}</span>
                </span>
              ) : null}

              {/* Variable Weather / Ground for LoH */}
              {!activePvpEvent.weather && !activePvpEvent.ground && (
                <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-800/60 px-1.5 py-0.5 font-medium text-zinc-600 dark:text-zinc-300">
                  <span>Ground/Weather: Random</span>
                </span>
              )}

              {/* Timezone */}
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/40 px-1.5 py-0.5 font-medium text-amber-800 dark:text-amber-300">
                <img src={activePvpEvent.timeIcon} alt={activePvpEvent.time} className="h-3.5 w-3.5 object-contain" />
                <span>{activePvpEvent.time}</span>
              </span>

              {/* Special Rule: No Debuff */}
              {activePvpEvent.noDebuffs && (
                <span
                  className="inline-flex items-center gap-1 rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/60 px-1.5 py-0.5 font-bold text-rose-800 dark:text-rose-300 shadow-2xs"
                  title="Special Rule: Debuff skills cannot be used and will not activate (debuff=false)"
                >
                  <span>🚫</span>
                  <span>No Debuff</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Selectors Grid */}
        <div className="flex flex-wrap items-center justify-between gap-3">
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
              className="bg-transparent text-xs font-semibold text-zinc-800 dark:text-zinc-100 outline-none cursor-pointer min-w-0 flex-1"
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
              className="bg-transparent text-xs font-semibold text-zinc-800 dark:text-zinc-100 outline-none cursor-pointer w-full min-w-0 truncate flex-1"
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
              className="bg-transparent text-xs font-semibold text-zinc-800 dark:text-zinc-100 outline-none cursor-pointer min-w-0 flex-1"
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
            <Badge size="standard" tone="amber" className="font-semibold shadow-2xs">
              {raceTitle}
            </Badge>
            <span className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Visualizer synced</span>
            </span>
          </div>
        )}
      </div>
    </div>);
  return <>
    <button type="button" onClick={() => setMobileExpanded(true)} aria-haspopup="dialog" aria-label={`Edit target race: ${raceTitle}`}
      className="flex min-h-12 w-full min-w-0 items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-left dark:border-zinc-800 dark:bg-zinc-900 lg:hidden">
      <FlagIcon className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{raceTitle}</span>
        <span className="mt-0.5 block truncate text-[11px] text-zinc-500 dark:text-zinc-400">{runningStyle ? RUNNING_STYLE_LABELS[runningStyle] : "All styles"} · {racerCount} racers{activePvpEvent ? ` · ${activePvpEvent.shortName}` : ""}{activePvpEvent?.noDebuffs ? " · No Debuff" : ""}</span>
      </span>
      <ChevronDownIcon className="h-4 w-4 shrink-0 text-zinc-400" />
    </button>
    <div className="hidden rounded-2xl border border-zinc-200/80 bg-white/95 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/90 lg:block">{controls}</div>
    <MobileSheet open={mobileExpanded} onClose={() => setMobileExpanded(false)} title="Target race" description="This profile applies to your decks, lineage, and skill zones.">{controls}</MobileSheet>
  </>;
}
