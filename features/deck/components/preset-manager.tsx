"use client";

import { AppDialog } from "@/app/common/ui/controls/app-dialog";
import { AppButton } from "@/app/common/ui/controls/app-button";



import { AppSelect } from "@/app/common/ui/controls/app-select";

// Preset management: switch, create, rename, duplicate, delete,
// and drag up & down to reorder preset combos (Main Deck + Parent Deck + Track Info).

import { useState, useRef } from "react";
import { useDeck } from "@/features/deck/state";
import type { DeckPreset } from "@/lib/deck/types";
import ShareModal from "./share-modal";
import { LinkIcon, XIcon, EditIcon, PlusIcon, ListIcon, ChevronUpIcon, ChevronDownIcon } from "@/app/common/ui/primitives/icons";

export default function PresetManager() {
  const {
    presets,
    activePresetId,
    activePreset,
    setActivePresetId,
    addPreset,
    duplicatePreset,
    updatePresetName,
    deletePreset,
    reorderPresets,
  } = useDeck();

  const [isOpen, setIsOpen] = useState(false);
  const [sharingPreset, setSharingPreset] = useState<DeckPreset | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  function startRename(p: DeckPreset) {
    setEditingId(p.id);
    setEditName(p.name);
  }

  function commitRename(id: string) {
    if (editName.trim()) {
      updatePresetName(id, editName.trim());
    }
    setEditingId(null);
  }

  function handleDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  }

  function handleDrop(index: number) {
    if (draggedIndex !== null && draggedIndex !== index) {
      reorderPresets(draggedIndex, index);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  return (
    <>
      {/* Inline Preset Bar */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          <span className="hidden sm:inline">Build:</span>
          <AppSelect
            value={activePresetId}
            onValueChange={(value) => setActivePresetId(value)}
            className="max-w-full"
           label="Build" options={presets.map(p => ({ value: p.id, label: p.name }))} />
        </label>

        <AppButton
          type="button"
          onPress={() => {
            const id = addPreset();
            setActivePresetId(id);
          }}
          variant="secondary"
          title="New Preset"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          <span>New</span>
        </AppButton>

        <AppButton
          type="button"
          onPress={() => setIsOpen(true)}
          variant="secondary"
        >
          <ListIcon className="h-3.5 w-3.5" />
          <span>Manage ({presets.length})</span>
        </AppButton>

        <AppButton
          type="button"
          onPress={() => setSharingPreset(activePreset)}
          variant="secondary"
          title="Share active build with ultra-compact URL"
        >
          <LinkIcon className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
          <span>Share</span>
        </AppButton>
      </div>

      {/* Preset Management Modal */}
      <AppDialog isOpen={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setEditingId(null); }}
        title="Manage Build Presets" ariaLabel="Manage Build Presets" size="md" overlayLayer="share"
        dialogRef={modalRef} header={<></>} bodyClassName="contents" className="max-h-[85vh] max-w-lg text-left">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800 px-5 py-4 bg-white dark:bg-zinc-900">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Manage Build Presets</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Each preset bundles Main Deck + Parent Deck + Track info. Drag handles to reorder.
                </p>
              </div>
              <AppButton variant="quiet"
                type="button"
                aria-label="Close build manager" iconOnly
                onPress={() => {
                  setIsOpen(false);
                  setEditingId(null);
                }}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <XIcon className="h-4 w-4" />
              </AppButton>
            </div>

            {/* Presets List */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-2 touch-auto">
              {presets.map((p, idx) => {
                const isActive = p.id === activePresetId;
                const isEditing = editingId === p.id;
                const isDragOver = dragOverIndex === idx;

                const mainCount = p.mainDeckIds.filter(Boolean).length;
                const parentCount = p.parentDeckIds.filter(Boolean).length;

                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={() => {
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                    }}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                      isDragOver
                        ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 scale-[1.01]"
                        : isActive
                          ? "border-emerald-500/60 dark:border-emerald-500/50 bg-white dark:bg-zinc-900 ring-1 ring-emerald-500/20 shadow-xs"
                          : "border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    {/* Drag Handle & Order Controls */}
                    <div className="flex items-center gap-1 text-zinc-400 cursor-grab active:cursor-grabbing">
                      <ListIcon className="h-4 w-4" />
                      <div className="flex flex-col">
                        <AppButton variant="quiet"
                          type="button"
                          isDisabled={idx === 0}
                          onPress={() => reorderPresets(idx, idx - 1)}
                          className="h-3.5 text-[9px] hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed leading-none"
                          iconOnly aria-label={`Move ${p.name} up`}
                        >
                          <ChevronUpIcon className="h-3.5 w-3.5" />
                        </AppButton>
                        <AppButton variant="quiet"
                          type="button"
                          isDisabled={idx === presets.length - 1}
                          onPress={() => reorderPresets(idx, idx + 1)}
                          className="h-3.5 text-[9px] hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed leading-none"
                          iconOnly aria-label={`Move ${p.name} down`}
                        >
                          <ChevronDownIcon className="h-3.5 w-3.5" />
                        </AppButton>
                      </div>
                    </div>

                    {/* Preset Info / Rename Input */}
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(p.id);
                              if (e.key === "Escape") { e.stopPropagation(); setEditingId(null); }
                            }}
                            aria-label="Preset name"
                            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-800 dark:text-zinc-100 outline-none focus:border-emerald-500"
                          />
                          <AppButton variant="quiet"
                            type="button"
                            onPress={() => commitRename(p.id)}
                            className="rounded px-2 py-1 text-[11px] font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 cursor-pointer"
                          >
                            Save
                          </AppButton>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <AppButton variant="quiet"
                            type="button"
                            onPress={() => setActivePresetId(p.id)}
                            className="truncate text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                          >
                            {p.name}
                          </AppButton>
                          {isActive && (
                            <span className="rounded bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                              Active
                            </span>
                          )}
                          <AppButton variant="quiet"
                            type="button"
                            onPress={() => startRename(p)}
                            className="text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer p-0.5"
                            title="Rename preset"
                          >
                            <EditIcon className="h-3 w-3" />
                          </AppButton>
                        </div>
                      )}

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                        <span>Main: {mainCount}/6 cards</span>
                        <span>·</span>
                        <span>Parent: {parentCount}/6 cards</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <AppButton variant="quiet"
                        type="button"
                        onPress={() => setSharingPreset(p)}
                        className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                        title="Share preset build"
                      >
                        Share
                      </AppButton>
                      <AppButton variant="quiet"
                        type="button"
                        onPress={() => duplicatePreset(p.id)}
                        className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                        title="Duplicate preset"
                      >
                        Duplicate
                      </AppButton>
                      <AppButton variant="quiet"
                        type="button"
                        isDisabled={presets.length <= 1}
                        onPress={() => deletePreset(p.id)}
                        className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-[11px] font-medium text-zinc-400 hover:border-red-200 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title={presets.length <= 1 ? "Cannot delete the only preset" : "Delete preset"}
                      >
                        Delete
                      </AppButton>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-3">
              <AppButton variant="quiet"
                type="button"
                onPress={() => {
                  const id = addPreset();
                  setActivePresetId(id);
                }}
                className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 cursor-pointer"
              >
                <PlusIcon className="h-3.5 w-3.5" /> Add New Preset
              </AppButton>

              <AppButton variant="quiet"
                type="button"
                onPress={() => {
                  setIsOpen(false);
                  setEditingId(null);
                }}
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer"
              >
                Done
              </AppButton>
            </div>
      </AppDialog>

      {/* Share Preset Modal */}
      <ShareModal
        preset={sharingPreset || activePreset}
        isOpen={Boolean(sharingPreset)}
        onClose={() => setSharingPreset(null)}
      />
    </>
  );
}
