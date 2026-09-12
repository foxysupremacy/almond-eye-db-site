"use client";

import { useState, useMemo } from "react";
import { type CharacterIndexEntry, getCharacterImageUrl } from "../lib/api";

interface CharacterPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (chara: CharacterIndexEntry) => void;
  characters: CharacterIndexEntry[];
  title?: string;
}

export default function CharacterPickerModal({
  isOpen,
  onClose,
  onSelect,
  characters,
  title = "Select Trainee Character",
}: CharacterPickerModalProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter((c) => {
      const nameEn = (c.nameEn || "").toLowerCase();
      const nameJp = (c.nameJp || "").toLowerCase();
      const titleEn = (c.titleEn || "").toLowerCase();
      const titleJp = (c.titleJp || "").toLowerCase();
      return nameEn.includes(q) || nameJp.includes(q) || titleEn.includes(q) || titleJp.includes(q);
    });
  }, [characters, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="flex flex-col w-full max-w-2xl max-h-[85vh] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Select the Uma Musume to plan compatibility and parent bloodlines for.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/40">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search characters by name (e.g. Silence Suzuka, Special Week)..."
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-hidden focus:border-emerald-500 transition-colors"
            autoFocus
          />
        </div>

        {/* Characters Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.length === 0 ? (
            <div className="col-span-full py-12 text-center text-xs text-zinc-500">
              No characters matched "{search}".
            </div>
          ) : (
            filtered.map((chara) => {
              const avatarUrl = getCharacterImageUrl(chara.charId, chara.id);
              return (
                <button
                  key={chara.id}
                  type="button"
                  onClick={() => {
                    onSelect(chara);
                    onClose();
                  }}
                  className="group flex items-center gap-2.5 p-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 hover:border-emerald-500/70 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 text-left transition-all cursor-pointer shadow-2xs"
                >
                  <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                    <img
                      src={avatarUrl}
                      alt={chara.nameEn}
                      className="h-full w-full object-contain filter drop-shadow-2xs group-hover:scale-105 transition-transform duration-200 ease-out-quart"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.opacity = "0";
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      {chara.nameEn}
                    </h4>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                      {chara.titleEn || chara.titleJp || `Costume ${chara.variant}`}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] font-semibold text-amber-500">
                        {"★".repeat(chara.rarity)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
