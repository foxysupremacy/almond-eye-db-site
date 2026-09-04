"use client";

// Popover listing ALL support cards for one deck slot, with search + sort by
// recommendation score (for parent farming), rarity (SSR/SR/R), or type.
// Rendered absolutely and layered above everything (z-[100]) so it never gets clipped.

import { useEffect, useMemo, useRef, useState } from "react";
import { api, type CardIndexEntry } from "../lib/api";
import { useDeck } from "./store";
import { recommendCardsForParent, type CardRecommendation } from "../lib/recommendation-engine";
import CardTypeIcon, { formatCardType } from "./card-type-icon";

// Rarity label + chip colors. Rarity: 3 = SSR, 2 = SR, 1 = R.
const RARITY_META: Record<number, { label: string; chip: string }> = {
  1: { label: "R", chip: "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300" },
  2: { label: "SR", chip: "bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200" },
  3: { label: "SSR", chip: "bg-amber-200/90 dark:bg-amber-950 text-amber-950 dark:text-amber-100 font-bold border border-amber-400/80 dark:border-amber-700" },
};

type SortKey = "recommended" | "rarity" | "type";
type TypeKey =
  | "all"
  | "speed"
  | "stamina"
  | "power"
  | "guts"
  | "intelligence"
  | "friend"
  | "group";

const TYPES: TypeKey[] = ["all", "speed", "stamina", "power", "guts", "intelligence", "friend", "group"];
const TYPE_ORDER: Record<TypeKey, number> = {
  all: 0,
  speed: 1,
  stamina: 2,
  power: 3,
  guts: 4,
  intelligence: 5,
  friend: 6,
  group: 7,
};

export { RARITY_META };

function cardLabel(card: CardIndexEntry) {
  return card.nameEn || card.nameJp;
}

export default function CardPickerPopover({
  onPick,
  onClose,
  mode = "main",
}: {
  onPick: (card: CardIndexEntry) => void;
  onClose: () => void;
  mode?: "main" | "parent";
}) {
  const {
    mainSkillIdSet,
    mainSlots,
    parentSlots,
    course,
    runningStyle,
    distance,
    surface,
  } = useDeck();

  const [cards, setCards] = useState<CardIndexEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>(mode === "parent" ? "recommended" : "rarity");
  const [type, setType] = useState<TypeKey>("all");
  const searchBoxRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load the full card index once
  useEffect(() => {
    api.listCardIndex().then(setCards).catch(() => setCards([]));
  }, []);

  // Focus search box on open
  useEffect(() => {
    searchBoxRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  // Main & Parent cards presence sets
  const mainCardIdSet = useMemo(() => {
    return new Set(mainSlots.filter(Boolean).map((c) => c!.id));
  }, [mainSlots]);

  const parentCardIdSet = useMemo(() => {
    return new Set(parentSlots.filter(Boolean).map((c) => c!.id));
  }, [parentSlots]);

  // Recommendations map for parent mode
  const recommendationsMap = useMemo(() => {
    if (mode !== "parent") return new Map<number, CardRecommendation>();
    const recs = recommendCardsForParent({
      mainDeckSkillIds: mainSkillIdSet,
      equippedParentCardIds: parentSlots.map((c) => c?.id ?? null),
      course,
      style: runningStyle,
      distance,
      surface,
      limit: 100, // wider pool for search & sort
    });
    return new Map<number, CardRecommendation>(recs.map((r) => [r.cardId, r]));
  }, [mode, mainSkillIdSet, parentSlots, course, runningStyle, distance, surface]);

  const filtered = useMemo(() => {
    if (!cards) return [];
    const q = query.trim().toLowerCase();
    let list = cards.filter(
      (c) =>
        (type === "all" || c.type === type) &&
        (!q || `${c.nameEn} ${c.nameJp}`.toLowerCase().includes(q)),
    );

    if (sort === "recommended" && mode === "parent") {
      list = [...list].sort((a, b) => {
        const recA = recommendationsMap.get(a.id);
        const recB = recommendationsMap.get(b.id);
        const scoreA = recA?.score ?? -1;
        const scoreB = recB?.score ?? -1;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return b.rarity - a.rarity || a.type.localeCompare(b.type);
      });
    } else if (sort === "rarity") {
      list = [...list].sort((a, b) => b.rarity - a.rarity || a.type.localeCompare(b.type));
    } else if (sort === "type") {
      list = [...list].sort(
        (a, b) => TYPE_ORDER[a.type as TypeKey] - TYPE_ORDER[b.type as TypeKey] || b.rarity - a.rarity,
      );
    }
    return list;
  }, [cards, query, type, sort, mode, recommendationsMap]);

  return (
    <>
      {/* Mobile backdrop scrim */}
      <div
        className="fixed inset-0 z-[150] sm:hidden bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        className="fixed inset-x-0 bottom-0 z-[160] sm:absolute sm:left-1/2 sm:top-full sm:bottom-auto sm:z-[100] sm:mt-2 flex w-full sm:w-[min(94vw,28rem)] sm:-translate-x-1/2 flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-top-2 duration-150"
      >
        {/* Mobile drag handle */}
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700 sm:hidden" />

        {/* Search + Sort Header */}
        <div className="border-b border-zinc-100 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <input
              ref={searchBoxRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cards by English or Japanese name…"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-emerald-500 dark:focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-xs text-zinc-700 dark:text-zinc-200 outline-none cursor-pointer"
            >
              {mode === "parent" && <option value="recommended">Sort: ⭐ Recommended</option>}
              <option value="rarity">Sort: Rarity</option>
              <option value="type">Sort: Type</option>
            </select>

            {mode === "parent" && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium ml-auto">
                Parent Picker Mode
              </span>
            )}
          </div>

          {/* Type Filter Pills */}
          <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer shrink-0 ${
                  type === t
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-2xs font-semibold"
                    : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-750"
                }`}
              >
                {t !== "all" && <CardTypeIcon type={t} className="h-3 w-3 object-contain" />}
                <span className="capitalize">{formatCardType(t)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cards List */}
        <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {!cards ? (
            <p className="p-4 text-xs text-zinc-400 dark:text-zinc-500">Loading cards…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-xs text-zinc-400 dark:text-zinc-500">{query ? "No matches found." : "No cards."}</p>
          ) : (
            <ul>
              {filtered.map((c) => {
                const rec = recommendationsMap.get(c.id);
                const isInMain = mainCardIdSet.has(c.id);
                const isInParent = parentCardIdSet.has(c.id);

                return (
                  <li key={c.id}>
                    <button
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors"
                      onClick={() => onPick(c)}
                    >
                      <img
                        src={c.portraitUrl || c.imgUrl}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover border border-zinc-200/80 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                        loading="lazy"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {cardLabel(c)}
                          </span>
                          {isInMain && (
                            <span className="rounded bg-amber-200/90 dark:bg-amber-950/80 px-1 py-0.2 text-[9px] font-bold text-amber-950 dark:text-amber-100 border border-amber-400/80 dark:border-amber-700">
                              In Main
                            </span>
                          )}
                          {isInParent && (
                            <span className="rounded bg-zinc-200 dark:bg-zinc-800 px-1 py-0.2 text-[9px] font-bold text-zinc-700 dark:text-zinc-300">
                              Equipped
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                            <span className="truncate">{c.nameJp}</span>
                            <span className="text-zinc-300 dark:text-zinc-600">·</span>
                            <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400 capitalize flex-none">
                              <CardTypeIcon type={c.type} className="h-3.5 w-3.5 object-contain flex-none" />
                              <span>{formatCardType(c.type)}</span>
                            </span>
                          </span>
                          {rec && rec.totalNewCount > 0 && (
                            <span
                              className="rounded bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              title={rec.newMatchingSkills
                                .map(
                                  (s) =>
                                    `• ${s.nameEn}${
                                      s.eventMeta
                                        ? ` (${s.eventMeta.eventNameEn || s.eventMeta.eventNameJp} - Choice ${s.eventMeta.choiceIndex}: ${s.eventMeta.choiceTextEn || s.eventMeta.choiceTextJp}${
                                            s.choiceConflict ? (s.isRecommendedChoice ? " [Best]" : " [Alt]") : ""
                                          })`
                                        : ` (${s.source})`
                                    }`,
                                )
                                .join("\n")}
                            >
                              +{rec.totalNewCount} new target skills
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          RARITY_META[c.rarity]?.chip ?? "bg-zinc-200 text-zinc-700"
                        }`}
                      >
                        {RARITY_META[c.rarity]?.label ?? "R"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
