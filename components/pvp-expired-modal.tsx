"use client";

import { useMemo, useState } from "react";
import { useDeck } from "./store";
import {
  getPvpEventById,
  isPvpEventEnded,
  getActivePvpEvents,
  type PvpEvent,
} from "../lib/pvp-events";
import { AlertCircleIcon, TrashIcon, CheckIcon } from "./icons";

export function PvpExpiredModal() {
  const { presets, deletePreset, importPreset } = useDeck();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [migrateSelections, setMigrateSelections] = useState<Record<string, string>>({});

  const activeEvents = useMemo(() => getActivePvpEvents(), []);

  // Presets linked to an ended PVP event
  const affectedPresets = useMemo(() => {
    return presets.filter((p) => {
      if (dismissedIds.has(p.id)) return false;
      const eventId = p.trackInfo.pvpEventId;
      if (!eventId) return false;
      const event = getPvpEventById(eventId);
      return !event || isPvpEventEnded(event);
    });
  }, [presets, dismissedIds]);

  if (affectedPresets.length === 0) return null;

  const handleKeepTrack = (presetId: string) => {
    const p = presets.find((item) => item.id === presetId);
    if (!p) return;
    importPreset(
      {
        ...p,
        trackInfo: {
          ...p.trackInfo,
          pvpEventId: null,
        },
      },
      false,
      p.name
    );
  };

  const handleMigrate = (presetId: string, targetEvent: PvpEvent) => {
    const p = presets.find((item) => item.id === presetId);
    if (!p) return;
    importPreset(
      {
        ...p,
        trackInfo: {
          ...p.trackInfo,
          trackId: targetEvent.trackId,
          courseId: targetEvent.courseId,
          racerCount: targetEvent.racerCount,
          pvpEventId: targetEvent.id,
        },
      },
      false,
      p.name
    );
  };

  const handleDelete = (presetId: string) => {
    deletePreset(presetId);
  };

  const handleKeepAll = () => {
    for (const p of affectedPresets) {
      handleKeepTrack(p.id);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="expired-pvp-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
            <AlertCircleIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="expired-pvp-title" className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              PvP Event Ended
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              The Champions Meeting or PvP event linked to the following preset(s) has concluded. Choose how you would like to update them:
            </p>
          </div>
        </div>

        {/* Affected Presets List */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/80 px-5">
          {affectedPresets.map((preset) => {
            const event = getPvpEventById(preset.trackInfo.pvpEventId);
            const eventName = event ? event.name : "Expired Event";
            const selectedMigrateId = migrateSelections[preset.id] ?? activeEvents[0]?.id ?? "";

            return (
              <div key={preset.id} className="py-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {preset.name}
                    </h3>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <span>{eventName} (Ended)</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(preset.id)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Delete Preset"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                </div>

                {/* Actions for this preset */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* Option 1: Keep Track */}
                  <button
                    type="button"
                    onClick={() => handleKeepTrack(preset.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <CheckIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Keep Course Geometry</span>
                  </button>

                  {/* Option 2: Migrate to active event */}
                  {activeEvents.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={selectedMigrateId}
                        onChange={(e) =>
                          setMigrateSelections((prev) => ({
                            ...prev,
                            [preset.id]: e.target.value,
                          }))
                        }
                        className="rounded-lg border border-purple-200 dark:border-purple-800/80 bg-purple-50/60 dark:bg-purple-950/40 px-2 py-1.5 text-xs font-medium text-purple-900 dark:text-purple-200 outline-none"
                      >
                        {activeEvents.map((ae) => (
                          <option key={ae.id} value={ae.id} className="dark:bg-zinc-900">
                            Switch to {ae.shortName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const target = activeEvents.find((ae) => ae.id === selectedMigrateId) ?? activeEvents[0];
                          if (target) handleMigrate(preset.id, target);
                        }}
                        className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 shadow-xs transition-colors"
                      >
                        Migrate
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/60">
          <button
            type="button"
            onClick={handleKeepAll}
            className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
          >
            Keep courses for all presets
          </button>
          <button
            type="button"
            onClick={() => setDismissedIds(new Set(affectedPresets.map((p) => p.id)))}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Dismiss for now
          </button>
        </div>
      </div>
    </div>
  );
}
