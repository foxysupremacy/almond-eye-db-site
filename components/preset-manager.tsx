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
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
          <span className="hidden sm:inline">Build:</span>
          <select
            value={activePresetId}
            onChange={(e) => setActivePresetId(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-800 outline-none hover:border-zinc-300 focus:border-zinc-400 cursor-pointer shadow-xs"
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={() => {
            const id = addPreset();
            setActivePresetId(id);
          }}
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 shadow-xs cursor-pointer"
          title="New Preset"
        >
          + New
        </button>

        <button
          onClick={() => setIsOpen(true)}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 shadow-xs cursor-pointer"
        >
          Manage ({presets.length})
        </button>
      </div>

      {/* Preset Management Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div
            ref={modalRef}
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-[#fbf9f5] shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-200/80 px-5 py-4 bg-white">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Manage Build Presets</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Each preset bundles Main Deck + Parent Deck + Track info. Drag handles to reorder.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setEditingId(null);
                }}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 text-sm font-bold"
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
                        ? "border-[#794016] bg-amber-50/60 scale-[1.01]"
                        : isActive
                          ? "border-[#794016]/40 bg-white shadow-xs"
                          : "border-zinc-200/80 bg-white hover:border-zinc-300"
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
                          className="h-3.5 text-[9px] hover:text-zinc-800 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed leading-none"
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={idx === presets.length - 1}
                          onClick={() => reorderPresets(idx, idx + 1)}
                          className="h-3.5 text-[9px] hover:text-zinc-800 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed leading-none"
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
                            className="w-full rounded-md border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-800 outline-none focus:border-[#794016]"
                          />
                          <button
                            onClick={() => commitRename(p.id)}
                            className="rounded px-2 py-1 text-[11px] font-medium bg-zinc-900 text-white hover:bg-zinc-800"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setActivePresetId(p.id)}
                            className="truncate text-left text-sm font-semibold text-zinc-900 hover:text-[#794016]"
                          >
                            {p.name}
                          </button>
                          {isActive && (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                              Active
                            </span>
                          )}
                          <button
                            onClick={() => startRename(p)}
                            className="text-[11px] text-zinc-400 hover:text-zinc-700 cursor-pointer"
                            title="Rename preset"
                          >
                            ✎
                          </button>
                        </div>
                      )}

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-400">
                        <span>Main: {mainCount}/6 cards</span>
                        <span>·</span>
                        <span>Parent: {parentCount}/6 cards</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => duplicatePreset(p.id)}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                        title="Duplicate preset"
                      >
                        Duplicate
                      </button>
                      <button
                        disabled={presets.length <= 1}
                        onClick={() => deletePreset(p.id)}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
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
            <div className="flex items-center justify-between border-t border-zinc-200 bg-white px-5 py-3">
              <button
                onClick={() => {
                  const id = addPreset();
                  setActivePresetId(id);
                }}
                className="rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-semibold text-[#794016] hover:border-[#794016] hover:bg-amber-50/40 cursor-pointer"
              >
                + Add New Preset
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  setEditingId(null);
                }}
                className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer"
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
