import { MobileFilters } from "./shared/mobile-filters";
import { useMemo, useState, useEffect } from "react";
import { useDeck } from "./store";
import { RUNNING_STYLE_OPTIONS } from "../lib/deck/constants";
import type { DeckSkill } from "../lib/deck/types";
import {
  matchesRarityFilter,
  getSkillRarityStyle,
  type RarityFilterKey,
} from "../lib/skill-rarity";
import SkillIcon from "./skill-icon";
import SkillHoverCard from "./skill-hover-card";
import SkillItem from "./skill-item";
import { isSkillBanned } from "../lib/pvp-events";
import { deriveSkillsForDeck } from "../lib/deck/skill-resolver";
import CardTypeIcon, { formatCardType } from "./card-type-icon";
import { RARITY_META } from "../lib/skill-rarity";
import DuplicateSkillBadge from "./duplicate-skill-badge";
import { SkillIndicator, SkillSourceIcons } from "./shared/skill-badges";
import { Badge } from "./shared/badge";
import { buildDuplicateSkillIndex, getDuplicateSkillIds } from "../lib/skill-duplicates";
import EventChainAttribution from "./event-chain-attribution";

export default function SkillList() {
  const {
    mainSkills,
    mainSlots,
    loading,
    runningStyle,
    setRunningStyle,
    activePvpEvent,
    activePreset,
    skillsByCard,
  } = useDeck();
  const [sourceFilter, setSourceFilter] = useState<"all" | "event" | "hint">("all");
  const [rarityFilter, setRarityFilter] = useState<RarityFilterKey>("all");
  const [viewMode, setViewMode] = useState<"list" | "card">("list");
  // Remember the skill view mode (Unified List / Group by Card) across visits
  useEffect(() => {
    try {
      const stored = localStorage.getItem("almond_skill_view_mode");
      if (stored === "card" || stored === "list") setViewMode(stored);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("almond_skill_view_mode", viewMode);
    } catch {}
  }, [viewMode]);
  const [search, setSearch] = useState("");

  // Map each card slot to its exact granted skills (respecting chosen chain branches)
  const cardSkillsMap = useMemo(() => {
    const map = new Map<number, DeckSkill[]>();
    mainSlots.forEach((card) => {
      if (!card) return;
      const cSkills = deriveSkillsForDeck(
        [card],
        false,
        skillsByCard,
        activePreset.mainChainChoices
      );
      map.set(card.id, cSkills);
    });
    return map;
  }, [mainSlots, skillsByCard, activePreset.mainChainChoices]);

  // Map skillId -> all deck cards that provide this skill
  const duplicateSkillCardsMap = useMemo(() => {
    return buildDuplicateSkillIndex(
      mainSlots.flatMap((card) => {
        if (!card) return [];
        return [{
          card: {
            cardId: card.id,
            cardName: card.nameEn || card.nameJp || `Card #${card.id}`,
            cardNameJp: card.nameJp,
            rarity: card.rarity,
            type: card.type,
            portraitUrl: card.portraitUrl,
            imgUrl: card.imgUrl,
          },
          grants: (cardSkillsMap.get(card.id) || []).map((s) => ({
            id: s.id,
            source: s.source,
            eventMeta: s.grants?.find((g) => g.cardId === card.id)?.eventMeta ?? null,
            originalGoldSkill: s.grants?.find((g) => g.cardId === card.id)?.originalGoldSkill,
          })),
        }];
      })
    );
  }, [mainSlots, cardSkillsMap]);

  // Track skills appearing in more than one support card
  const duplicateSkillIdSet = useMemo(() => {
    return getDuplicateSkillIds(duplicateSkillCardsMap);
  }, [duplicateSkillCardsMap]);

  const whiteCount = useMemo(() => mainSkills.filter((s) => (s.rarity ?? 1) === 1).length, [mainSkills]);
  const goldCount = useMemo(() => mainSkills.filter((s) => s.rarity === 2).length, [mainSkills]);
  const uniqueCount = useMemo(() => mainSkills.filter((s) => [3, 4, 5].includes(s.rarity)).length, [mainSkills]);
  const evolvedCount = useMemo(() => mainSkills.filter((s) => s.rarity === 6).length, [mainSkills]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mainSkills.filter((s) => {
      if (sourceFilter !== "all" && s.source !== sourceFilter) return false;
      if (!matchesRarityFilter(s.rarity, rarityFilter)) return false;
      if (q && !`${s.nameEn} ${s.nameJp} ${s.descEn ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [mainSkills, sourceFilter, rarityFilter, search]);

  const hasDeck = mainSlots.some(Boolean);

  return (
    <section className="mt-8">
      <div className="mb-3 md:hidden">
        <h2 className="mb-2 text-lg font-semibold">Deck skills <span className="text-sm font-normal text-zinc-500">({mainSkills.length})</span></h2>
        <input aria-label="Search skills" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search skills…" className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base dark:border-zinc-800 dark:bg-zinc-900" />
      </div>
      <MobileFilters count={Number(sourceFilter !== "all") + Number(rarityFilter !== "all")} summary={`${filtered.length} skills · ${viewMode === "card" ? "by card" : "unified list"}`}>
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Skills <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500">({mainSkills.length})</span>
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {hasDeck
              ? "Union of event + hint skills across the deck. Click any skill to inspect activation conditions."
              : "Add cards to see the skills they grant."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span className="hidden sm:inline">Style</span>
            <select
              value={runningStyle ?? ""}
              onChange={(e) =>
                setRunningStyle(e.target.value === "" ? null : (Number(e.target.value) as 1 | 2 | 3 | 4 | 5))
              }
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:border-zinc-400 dark:focus:border-zinc-600 shadow-2xs cursor-pointer"
            >
              {RUNNING_STYLE_OPTIONS.map((o) => (
                <option key={o.label} value={o.value ?? ""}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills…"
            className="hidden md:block w-36 sm:w-44 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-zinc-400 dark:focus:border-zinc-600 shadow-2xs"
          />

          {/* Rarity Tabs */}
          <div className="flex flex-wrap md:flex-nowrap rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 text-xs font-medium shadow-2xs scrollbar-none">
            <button
              onClick={() => setRarityFilter("all")}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer whitespace-nowrap ${
                rarityFilter === "all"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              All ({mainSkills.length})
            </button>
            <button
              onClick={() => setRarityFilter("white")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer whitespace-nowrap ${
                rarityFilter === "white"
                  ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              White ({whiteCount})
            </button>
            <button
              onClick={() => setRarityFilter("gold")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer whitespace-nowrap ${
                rarityFilter === "gold"
                  ? "bg-amber-500 text-amber-950 font-bold shadow-2xs"
                  : "text-amber-950 dark:text-amber-100 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 font-medium"
              }`}
            >
              Gold ({goldCount})
            </button>
            <button
              onClick={() => setRarityFilter("unique")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer whitespace-nowrap ${
                rarityFilter === "unique"
                  ? "bg-pink-500 text-white font-bold shadow-2xs"
                  : "text-pink-700 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/30"
              }`}
            >
              Unique ({uniqueCount})
            </button>
            <button
              onClick={() => setRarityFilter("evolved")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer whitespace-nowrap ${
                rarityFilter === "evolved"
                  ? "bg-purple-600 text-white font-bold shadow-2xs"
                  : "text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
              }`}
            >
              Evo ({evolvedCount})
            </button>
          </div>

          {/* Source Filter */}
          <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 text-xs font-medium shadow-2xs">
            {(["all", "hint", "event"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSourceFilter(f)}
                className={`rounded-md px-2 py-1 capitalize cursor-pointer transition-colors ${
                  sourceFilter === f
                    ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 font-semibold"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {f === "all" ? "Sources" : f}
              </button>
            ))}
          </div>

          {/* View Mode Toggle (Unified List vs Group by Card) */}
          <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 text-xs font-medium shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                viewMode === "list"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Unified List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                viewMode === "card"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Group by Card
            </button>
          </div>
        </div>
      </div>

      </MobileFilters>
      {/* List Body */}
      {loading && !hasDeck ? (
        <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">Loading card index…</p>
      ) : !hasDeck ? (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-zinc-400 dark:text-zinc-500">
          No cards equipped yet. Add cards above to view granted skills.
        </div>
      ) : filtered.length === 0 ? (
        (rarityFilter === "unique" || rarityFilter === "evolved") ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30 p-6 text-center">
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              No {rarityFilter === "unique" ? "Unique" : "Evolved"} Skills in Support Deck
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Unique and Evolved skills come from Trainee/Parent characters, not support cards.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">No skills match the selected filters.</p>
        )
      ) : viewMode === "card" ? (
        <div className="mt-4 space-y-6">
          {mainSlots.map((card, slotIdx) => {
            if (!card) return null;
            const allCardSkills = cardSkillsMap.get(card.id) || [];
            const cFiltered = allCardSkills.filter((s) => {
              if (sourceFilter !== "all" && s.source !== sourceFilter) return false;
              if (!matchesRarityFilter(s.rarity, rarityFilter)) return false;
              if (
                search.trim() &&
                !`${s.nameEn} ${s.nameJp} ${s.descEn ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())
              ) {
                return false;
              }
              return true;
            });

            const cardLabel = card.nameEn || card.nameJp;

            return (
              <div
                key={card.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs"
              >
                {/* Card Slot Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-zinc-50/75 dark:bg-zinc-900/90 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <img
                      src={card.portraitUrl || card.imgUrl}
                      alt=""
                      className="h-10 w-10 object-contain shrink-0 rounded-lg bg-zinc-50 dark:bg-zinc-800 p-0.5"
                      loading="lazy"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          Slot {slotIdx + 1}: {cardLabel}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                            RARITY_META[card.rarity]?.chip ?? "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {RARITY_META[card.rarity]?.label ?? "R"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 capitalize">
                          <CardTypeIcon type={card.type} className="h-3.5 w-3.5 object-contain" />
                          <span>{formatCardType(card.type)}</span>
                        </span>
                        {card.nameJp && (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-700">·</span>
                            <span className="text-[11px] text-zinc-400">{card.nameJp}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <Badge size="standard" tone="emerald" className="font-bold">
                      {cFiltered.length} skills granted
                    </Badge>
                  </div>
                </div>

                {/* Card Skills List */}
                {cFiltered.length === 0 ? (
                  <p className="text-xs text-zinc-400 p-3">No skills match current filter for this card.</p>
                ) : (
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {cFiltered.map((s) => {
                      const isBanned = isSkillBanned(s.id, activePvpEvent);
                      const isDupe = duplicateSkillIdSet.has(s.id);

                      return (
                        <li
                          key={`${card.id}-${s.id}-${s.source}`}
                          className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 ${
                            isBanned ? "opacity-60 bg-rose-50/20 dark:bg-rose-950/10" : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <SkillItem
                              skill={{ ...s, cardName: cardLabel, cardId: card.id }}
                              size="sm"
                              isBanned={isBanned}
                              isParentMode={false}
                              trailing={
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {isBanned && (
                                    <SkillIndicator
                                      kind="banned"
                                      title="Banned by Special Rule (No Debuffs) - this skill cannot be used and will not activate"
                                    />
                                  )}
                                  {isDupe && (
                                    <DuplicateSkillBadge
                                      cards={duplicateSkillCardsMap.get(s.id) || []}
                                      currentCardId={card.id}
                                      skillName={s.nameEn}
                                      variant="amber"
                                    />
                                  )}
                                </div>
                              }
                            >
                              {s.descEn && (
                                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                                  {s.descEn}
                                </p>
                              )}
                            </SkillItem>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {filtered.map((s) => {
            const rStyle = getSkillRarityStyle(s.rarity);
            const isBanned = isSkillBanned(s.id, activePvpEvent);

            return (
              <li
                key={s.id}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${
                  rStyle.borderClass
                } ${rStyle.bgClass ?? ""} ${isBanned ? "opacity-60 bg-rose-50/20 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/50" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <SkillItem
                    skill={s}
                    size="md"
                    isBanned={isBanned}
                    isParentMode={false}
                                trailing={
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {isBanned && (
                                      <SkillIndicator
                                        kind="banned"
                                        title="Banned by Special Rule (No Debuffs) - this skill cannot be used and will not activate"
                                      />
                                    )}
                                    {duplicateSkillIdSet.has(s.id) && (
                          <DuplicateSkillBadge
                            cards={duplicateSkillCardsMap.get(s.id) || []}
                            skillName={s.nameEn}
                            variant="amber"
                          />
                        )}
                      </div>
                    }
                  >
                    {s.descEn && (
                      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-zinc-700 dark:text-zinc-300">{s.descEn}</p>
                    )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <SkillSourceIcons
                      sources={(s.grants?.length ? s.grants : [{ cardId: s.cardId, cardName: s.cardName }]).map((grant) => ({
                        kind: "card" as const,
                        cardId: grant.cardId,
                        name: grant.cardName,
                      }))}
                    />

                    {s.grants
                      ?.filter((g) => g.eventMeta)
                      .map((g, idx) => {
                        return <EventChainAttribution key={idx} eventMeta={g.eventMeta!} />;
                      })}

                    <span>· #{s.id}</span>
                  </div>
                </SkillItem>
              </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
