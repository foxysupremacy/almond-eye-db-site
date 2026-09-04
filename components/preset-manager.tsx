"use client";

// Preset management: switch, create, rename, duplicate, delete,
// and drag up & down to reorder preset combos (Main Deck + Parent Deck + Track Info).

import { useState, useRef, useEffect } from "react";
import { useDeck, type DeckPreset } from "./store";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        setEditingId(null);
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

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
          <select
            value={activePresetId}
            onChange={(e) => setActivePresetId(e.target.value)}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100 outline-none hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-emerald-500 cursor-pointer shadow-xs"
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id} className="dark:bg-zinc-900">
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            const id = addPreset();
            setActivePresetId(id);
          }}
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 shadow-xs cursor-pointer transition-colors"
          title="New Preset"
        >
          + New
        </button>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 shadow-xs cursor-pointer transition-colors"
        >
          <span className="hidden sm:inline">Manage </span>({presets.length})
        </button>
      </div>

      {/* Preset Management Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            ref={modalRef}
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 shadow-2xl animate-in zoom-in-95 duration-150 text-left"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800 px-5 py-4 bg-white dark:bg-zinc-900">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Manage Build Presets</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Each preset bundles Main Deck + Parent Deck + Track info. Drag handles to reorder.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setEditingId(null);
                }}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Presets List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
                      <span className="text-sm font-bold select-none">⠿</span>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => reorderPresets(idx, idx - 1)}
                          className="h-3.5 text-[9px] hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed leading-none"
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={idx === presets.length - 1}
                          onClick={() => reorderPresets(idx, idx + 1)}
                          className="h-3.5 text-[9px] hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed leading-none"
                          title="Move down"
                        >
                          ▼
                        </button>
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
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            autoFocus
                            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-800 dark:text-zinc-100 outline-none focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => commitRename(p.id)}
                            className="rounded px-2 py-1 text-[11px] font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActivePresetId(p.id)}
                            className="truncate text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                          >
                            {p.name}
                          </button>
                          {isActive && (
                            <span className="rounded bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                              Active
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => startRename(p)}
                            className="text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                            title="Rename preset"
                          >
                            ✎
                          </button>
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
                      <button
                        type="button"
                        onClick={() => duplicatePreset(p.id)}
                        className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                        title="Duplicate preset"
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        disabled={presets.length <= 1}
                        onClick={() => deletePreset(p.id)}
                        className="rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-[11px] font-medium text-zinc-400 hover:border-red-200 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title={presets.length <= 1 ? "Cannot delete the only preset" : "Delete preset"}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  const id = addPreset();
                  setActivePresetId(id);
                }}
                className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 cursor-pointer"
              >
                + Add New Preset
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setEditingId(null);
                }}
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
