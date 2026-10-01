"use client";

import { useState, useMemo } from "react";
import { Button } from "react-aria-components/Button";
import { AppDialog } from "@/app/common/ui/controls/app-dialog";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { XIcon } from "@/app/common/ui/primitives/icons";
import { type CharacterIndexEntry, getCharacterImageUrl } from "@/lib/api";
import { PickerSearchBar } from "@/app/common/ui/controls/picker-search-bar";

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
    <AppDialog
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={title}
      description="Select the Uma Musume to plan compatibility and parent bloodlines for."
      size="lg"
      bodyClassName="flex min-h-0 flex-1 flex-col"
      headerAction={<AppButton variant="quiet" iconOnly aria-label="Close character picker" onPress={onClose}><XIcon className="h-4 w-4" /></AppButton>}
    >
        {/* Search */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/40">
          <PickerSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search characters by name (e.g. Silence Suzuka, Special Week)..."
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
                <Button
                  key={chara.id}
                  onPress={() => {
                    onSelect(chara);
                    onClose();
                  }}
                  className="group flex items-center gap-2.5 min-h-14 p-2 border-b border-zinc-100 dark:border-zinc-800/80 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 transition-colors cursor-pointer"
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
                </Button>
              );
            })
          )}
        </div>
    </AppDialog>
  );
}
