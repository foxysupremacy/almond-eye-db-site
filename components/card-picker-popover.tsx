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
  1: { label: "R", chip: "bg-zinc-200 text-zinc-700" },
  2: { label: "SR", chip: "bg-sky-100 text-sky-800" },
  3: { label: "SSR", chip: "bg-amber-100 text-amber-800" },
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
    <div
      ref={panelRef}
      className="absolute left-1/2 top-full z-[100] mt-2 flex w-[min(94vw,28rem)] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
    >
      {/* Search + Sort Header */}
      <div className="border-b border-zinc-100 p-3 bg-zinc-50/50">
        <input
          ref={searchBoxRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cards by English or Japanese name…"
          className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-zinc-400"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 outline-none cursor-pointer"
          >
            {mode === "parent" && <option value="recommended">Sort: ⭐ Recommended</option>}
            <option value="rarity">Sort: Rarity</option>
            <option value="type">Sort: Type</option>
          </select>

          {mode === "parent" && (
            <span className="text-[10px] text-zinc-400 font-medium ml-auto">
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
                  ? "bg-zinc-800 text-white shadow-2xs font-semibold"
                  : "bg-white text-zinc-600 border border-zinc-200/80 hover:bg-zinc-100"
              }`}
            >
              {t !== "all" && <CardTypeIcon type={t} className="h-3 w-3 object-contain" />}
              <span className="capitalize">{formatCardType(t)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cards List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-zinc-50">
        {!cards ? (
          <p className="p-4 text-xs text-zinc-400">Loading cards…</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-xs text-zinc-400">{query ? "No matches found." : "No cards."}</p>
        ) : (
          <ul>
            {filtered.map((c) => {
              const rec = recommendationsMap.get(c.id);
              const isInMain = mainCardIdSet.has(c.id);
              const isInParent = parentCardIdSet.has(c.id);

              return (
                <li key={c.id}>
                  <button
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-amber-50/40 cursor-pointer transition-colors"
                    onClick={() => onPick(c)}
                  >
                    <img
                      src={c.portraitUrl || c.imgUrl}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover border border-zinc-200/80 bg-zinc-50"
                      loading="lazy"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-zinc-900 truncate">
                          {cardLabel(c)}
                        </span>
                        {isInMain && (
                          <span className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-bold text-amber-800">
                            In Main
                          </span>
                        )}
                        {isInParent && (
                          <span className="rounded bg-zinc-200 px-1 py-0.2 text-[9px] font-bold text-zinc-700">
                            Equipped
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 truncate">
                          <span className="truncate">{c.nameJp}</span>
                          <span className="text-zinc-300">·</span>
                          <span className="inline-flex items-center gap-1 text-zinc-500 capitalize flex-none">
                            <CardTypeIcon type={c.type} className="h-3.5 w-3.5 object-contain flex-none" />
                            <span>{formatCardType(c.type)}</span>
                          </span>
                        </span>
                        {rec && rec.totalNewCount > 0 && (
                          <span
                            className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800"
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
  );
}
