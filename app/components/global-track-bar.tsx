"use client";

import { AppSelect } from "@/app/common/ui/controls/app-select";

// Unified Target Race Profile: Venue + Course + Running Style + Racers.
// This is the single source of truth that drives Parent recommendations,
// Main Deck analysis, and Visualizer racecourse simulation.

import { normalizeRaceConditions } from "@/lib/deck/race-conditions";
import { RaceConditionChips, TurnBadge } from "@/app/common/ui/controls/race-condition-chips";
import { useDeckTrack, useDeckPresets } from "@/features/deck/state";
import { RUNNING_STYLE_OPTIONS } from "@/lib/deck/constants";
import type { RunningStyle } from "@/lib/deck/types";
import { terrainLabel } from "@/lib/api";
import { getActivePvpEvents } from "@/lib/pvp/events";

/** Race selectors shared by the desktop global bar and the mobile Build sheet. */
export function GlobalRaceControls() {
  const { activePreset } = useDeckPresets();
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
    masterChallengeEvents,
    activeMasterChallengeRace,
    selectMasterChallengeRace,
    selectCustomTrack,
    setCustomRaceConditions,
    racetrackDetails,
    applyPvpPreset,
  } = useDeckTrack();

  const masterChallengeSelection = activePreset.trackInfo.masterChallengeSelection ?? null;
  function courseLabel(courseId: number): string {
    const track = racetrackDetails.find((entry) => entry.courses.some((course) => course.id === courseId));
    const course = track?.courses.find((entry) => entry.id === courseId);
    if (!track || !course) return `Course ${courseId}`;
    return `${track.nameEn} ${course.length}m`;
  }

  // Turn direction is fixed by the game's course data; it always mirrors the active course.
  // In Custom mode, picking a direction moves to a course that runs that way.
  const courseTurn = activeCourseRow?.turn ?? null;
  const coursesFor = (id: number) => racetrackDetails.find((entry) => entry.id === id)?.courses ?? [];
  const turnOptions = [1, 2, 4].filter((turn) => racetrackDetails.some((track) => track.courses.some((course) => course.turn === turn)));
  function selectTurn(nextTurn: number) {
    if (courseTurn === nextTurn) return;
    const sameVenue = coursesFor(trackId).filter((course) => course.turn === nextTurn);
    const nextTrackId = sameVenue.length ? trackId : (tracks ?? []).find((t) => coursesFor(t.id).some((course) => course.turn === nextTurn))?.id;
    if (nextTrackId == null) return;
    const candidates = sameVenue.length ? sameVenue : coursesFor(nextTrackId).filter((course) => course.turn === nextTurn);
    const nextCourse = candidates.find((course) => course.terrain === activeCourseRow?.terrain && course.length === activeCourseRow?.length)
      ?? candidates.find((course) => course.terrain === activeCourseRow?.terrain) ?? candidates[0];
    if (nextTrackId !== trackId) setTrackId(nextTrackId);
    setCourseId(nextCourse.id);
  }

  const availableGrounds = new Set((trackDetail?.courses ?? []).map((course) => course.terrain));
  const selectedGround = activeCourseRow?.terrain ?? 1;
  const groundLabel = (ground: number) => terrainLabel(ground as 1 | 2);
  const matchingGroundCourses = (trackDetail?.courses ?? []).filter((course) => course.terrain === selectedGround);
  const distanceOptions = Array.from(new Map(matchingGroundCourses.map((course) => [course.length, course])).values());

  const customConditions = normalizeRaceConditions(activePreset.trackInfo.customRaceConditions);
  const isCustomTrack = !activePvpEvent && !activeMasterChallengeRace;
  const raceMode = activeMasterChallengeRace ? "master" : activePvpEvent ? (activePvpEvent.recommendationEventType === 2 ? "loh" : "cm") : "custom";
  const pvpEvents = getActivePvpEvents();
  if (activePvpEvent && !pvpEvents.some((event) => event.id === activePvpEvent.id)) pvpEvents.push(activePvpEvent);
  const modeEvents = pvpEvents.filter((event) => (event.recommendationEventType === 2 ? "loh" : "cm") === raceMode);
  const modes = [
    { id: "cm", label: "CM", available: pvpEvents.some((event) => event.recommendationEventType !== 2) },
    { id: "loh", label: "LoH", available: pvpEvents.some((event) => event.recommendationEventType === 2) },
    { id: "master", label: "Master Challenge", available: masterChallengeEvents.some((event) => event.races.length > 0) },
    { id: "custom", label: "Custom", available: true },
  ] as const;

  function selectRaceMode(mode: typeof modes[number]["id"]) {
    if (mode === raceMode) return;
    if (mode === "custom") { selectCustomTrack(); return; }
    if (mode === "master") {
      const event = masterChallengeEvents.find((entry) => entry.races.length > 0);
      if (event) selectMasterChallengeRace(event.eventId, event.races[0].eventSubId);
      return;
    }
    const event = pvpEvents.find((entry) => (entry.recommendationEventType === 2 ? "loh" : "cm") === mode);
    if (event) applyPvpPreset(event);
  }

  const controls = (<div className="race-controls flex min-w-0 flex-col gap-3">
        {/* PvP Presets & Conditions Section */}
        <div className="flex flex-col gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-2">
          <div role="group" aria-label="Race mode" className="flex flex-wrap items-center gap-1.5">
            {modes.map((mode) => (
              <button key={mode.id} type="button" aria-pressed={raceMode === mode.id} disabled={!mode.available}
                onClick={() => selectRaceMode(mode.id)}
                className={`min-h-11 md:min-h-8 cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${raceMode === mode.id
                  ? "border-purple-500 bg-purple-600 text-white"
                  : "border-zinc-200 bg-zinc-50/90 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700/80 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-700"}`}>
                {mode.label}
              </button>
            ))}
          </div>
          {(raceMode === "cm" || raceMode === "loh") && (
            <AppSelect value={activePvpEventId ?? ""}
                onValueChange={(value) => {
                  const selected = modeEvents.find((entry) => entry.id === value);
                  if (selected) applyPvpPreset(selected);
                }}
                className="w-full md:w-64" triggerLabel="Event" label="Event" options={modeEvents.map(event => ({ value: event.id, label: event.shortName }))} />
          )}
          {raceMode === "master" && (
            <AppSelect
                value={masterChallengeSelection ? `${masterChallengeSelection.eventId}:${masterChallengeSelection.eventSubId}` : ""}
                onValueChange={(value) => {
                  const [eventId, raceId] = value.split(":").map(Number);
                  selectMasterChallengeRace(eventId, raceId);
                }}
                className="w-full md:w-80"
                label="Master Challenge race" options={masterChallengeEvents.flatMap(event => event.races.map(race => ({ value: `${event.eventId}:${race.eventSubId}`, label: courseLabel(race.raceCourseSetId), group: `Master Challenge #${event.eventId} · ${event.schedule}` })))} />
          )}


          {(isCustomTrack || activeMasterChallengeRace) && (
            <RaceConditionChips
              conditions={activeMasterChallengeRace ? normalizeRaceConditions({
                season: activeMasterChallengeRace.season,
                weather: activeMasterChallengeRace.weather,
                groundCondition: activeMasterChallengeRace.ground,
                time: activeMasterChallengeRace.timezone,
              }) : customConditions}
              onChange={isCustomTrack ? setCustomRaceConditions : undefined}
              turn={{ value: courseTurn, ...(isCustomTrack ? { options: turnOptions, onChange: selectTurn } : {}) }}
            />
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

              {/* Turn direction (from course data) */}
              {courseTurn != null && <TurnBadge turn={courseTurn} />}

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
          <AppSelect
              value={String(trackId)}
              onValueChange={(value) => setTrackId(Number(value))}
              className="w-full md:w-60"
             triggerLabel="Venue" label="Venue" options={(tracks ?? []).map(t => ({ value: String(t.id), label: `${t.nameEn} (${t.nameJa})` }))} />

          {/* Ground is selected independently, while remaining tied to a real course surface. */}
          <AppSelect
              value={String(selectedGround)}
              onValueChange={(value) => {
                const targetGround = Number(value);
                const currentCourse = activeCourseRow;
                const nextCourse = (trackDetail?.courses ?? []).find((course) =>
                  course.terrain === targetGround && currentCourse && course.distance === currentCourse.distance && course.length === currentCourse.length
                ) ?? (trackDetail?.courses ?? []).find((course) => course.terrain === targetGround);
                if (nextCourse) setCourseId(nextCourse.id);
              }}
              className="w-full md:w-32"
              triggerLabel="Ground" label="Ground"
              options={[1, 2].map((ground) => ({
                value: String(ground),
                label: groundLabel(ground),
                disabled: !availableGrounds.has(ground as 1 | 2),
              }))} />

          {/* Course Selector */}
          <AppSelect
              value={String(activeCourseRow?.length ?? "")}
              onValueChange={(value) => {
                const length = Number(value);
                const nextCourse = matchingGroundCourses.find((course) => course.length === length);
                if (nextCourse) setCourseId(nextCourse.id);
              }}
              className="w-full md:w-36"
             triggerLabel="Distance" label="Distance" options={distanceOptions.map(course => ({ value: String(course.length), label: `${course.length}m` }))} />

          {/* Running Style Selector */}
          <AppSelect
              value={String(runningStyle ?? "")}
              onValueChange={(value) =>
                setRunningStyle(value === "" ? null : (Number(value) as RunningStyle))
              }
              className="w-full md:w-40"
             triggerLabel="Style" label="Running style" options={RUNNING_STYLE_OPTIONS.map(o => ({ value: String(o.value ?? ""), label: o.label }))} />

          {/* Racers Input */}
          <label className="flex min-h-11 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/80 px-2 py-1.5 text-zinc-700 dark:text-zinc-300 shadow-2xs md:min-h-0">
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

      </div>
    </div>);
  return controls;
}

export default function GlobalTrackBar() {
  return <div className="p-3.5"><GlobalRaceControls /></div>;
}
