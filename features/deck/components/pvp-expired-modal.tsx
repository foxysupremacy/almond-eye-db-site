"use client";

import { AppDialog } from "@/app/common/ui/controls/app-dialog";
import { AppButton } from "@/app/common/ui/controls/app-button";

import { AppSelect } from "@/app/common/ui/controls/app-select";

import { useMemo, useState } from "react";
import { useDeck } from "@/features/deck/state";
import {
  getPvpEventById,
  isPvpEventEnded,
  getActivePvpEvents,
  type PvpEvent,
} from "@/lib/pvp/events";
import { AlertCircleIcon, TrashIcon, CheckIcon } from "@/app/common/ui/primitives/icons";

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
    <AppDialog isOpen={true} onOpenChange={(open) => { if (!open) setDismissedIds(new Set(affectedPresets.map((preset) => preset.id))); }}
      title={"PvP Event Ended"} ariaLabel={"PvP Event Ended"} size="md" overlayLayer="picker"
      header={<></>} bodyClassName="contents" className="max-h-[85vh]">
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
                  <AppButton variant="destructive"
                    type="button"
                    onPress={() => handleDelete(preset.id)}

                    title="Delete Preset"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </AppButton>
                </div>

                {/* Actions for this preset */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* Option 1: Keep Track */}
                  <AppButton variant="secondary"
                    type="button"
                    onPress={() => handleKeepTrack(preset.id)}

                  >
                    <CheckIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Keep Course Geometry</span>
                  </AppButton>

                  {/* Option 2: Migrate to active event */}
                  {activeEvents.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <AppSelect
                        value={selectedMigrateId}
                        onValueChange={(value) =>
                          setMigrateSelections((prev) => ({
                            ...prev,
                            [preset.id]: value,
                          }))
                        }
                        className="max-w-full"
                       label="Migration event" options={activeEvents.map(ae => ({ value: ae.id, label: `Switch to ${ae.shortName}` }))} />
                      <AppButton variant="primary"
                        type="button"
                        onPress={() => {
                          const target = activeEvents.find((ae) => ae.id === selectedMigrateId) ?? activeEvents[0];
                          if (target) handleMigrate(preset.id, target);
                        }}

                      >
                        Migrate
                      </AppButton>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/60">
          <AppButton variant="quiet"
            type="button"
            onPress={handleKeepAll}

          >
            Keep courses for all presets
          </AppButton>
          <AppButton variant="secondary"
            type="button"
            onPress={() => setDismissedIds(new Set(affectedPresets.map((p) => p.id)))}

          >
            Dismiss for now
          </AppButton>
        </div>
    </AppDialog>
  );
}
