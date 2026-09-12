"use client";

// Ace Complement Finder (Parent Deck):
// Given the active CM/LOH race (or manual course) and a running style, this panel
// 1. computes the activating-skills list — skills the ace (main) deck + parent-inherited uniques
//    will ACTIVATE for that style, and
// 2. ranks support cards granting ADDITIONAL speed-family skills that activate,
//    card-sourced only (the engine never suggests uma/character skills),
//    excluding every skill the ace already has (cards + inherited uniques).

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useDeck } from "./store";
import { RUNNING_STYLE_LABELS, DISTANCE_LABELS, SURFACE_LABELS } from "../lib/deck/constants";
import {
  recommendCardsForParent,
  doesSkillFireOnCourse,
  SPEED_TACTICAL_CATEGORIES,
  type CardRecommendation,
} from "../lib/recommendation-engine";
import { getPvpRaceParameters } from "../lib/pvp-events";
import { useLineageSkills } from "../lib/use-lineage-skills";
import { EFFECT_CATEGORIES, classifySkillEffects, type SkillEffectCategory } from "../lib/skill-effects";
import { RARITY_META } from "../lib/skill-rarity";
import type { CardIndexEntry, SkillDetail } from "../lib/api";
import { api } from "../lib/api";
import SkillIcon from "./skill-icon";
import SkillHoverCard from "./skill-hover-card";
import CardTypeIcon, { formatCardType } from "./card-type-icon";
import { ZapIcon, ChevronDownIcon } from "./icons";

// Floating collapse button appears once the user scrolls past this many cards
const FAB_TRIGGER_CARDS = 7;
const STYLE_IDS = [1, 2, 3, 4, 5] as const;
const EFFECT_FILTER_STORAGE_KEY = "almond_ace_finder_effect_filter";
const CARD_TYPE_FILTER_STORAGE_KEY = "almond_ace_finder_card_type";
const CARD_TYPE_FILTERS = ["speed", "stamina", "power", "guts", "wit", "friend", "group"] as const;

interface AceSkillEntry {
  id: number;
  nameEn: string;
  nameJp: string;
  iconId?: number | null;
  rarity?: number;
  source: "card" | "unique";
  sourceLabel: string;
  /** true = activates for this style on this course, null = not enough data to evaluate */
  fires: boolean | null;
}

/** Recommendation annotated with which skills match the active effect filter. */
interface EffectRankedRow {
  rec: CardRecommendation;
  matchedIds: Set<number>;
  matchedCount: number;
}

export default function AceComplementFinder({
  onPickCard,
}: {
  onPickCard?: (card: CardIndexEntry, slotIndex: number) => void;
}) {
  const {
    mainSkills,
    mainSkillIdSet,
    parentSlots,
    setParentCard,
    course,
    trackDetail,
    activeCourseRow,
    runningStyle,
    distance,
    surface,
    allCards,
    activePvpEvent,
  } = useDeck();
  const { lineageUniqueSkills, bloodlineFactorSkills } = useLineageSkills();

  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isSkillListOpen, setIsSkillListOpen] = useState(true);
  const [isCardListOpen, setIsCardListOpen] = useState(true);
  // Floating collapse button becomes visible once the ranked list is scrolled
  // past FAB_TRIGGER_CARDS rows
  const fabSentinelRef = useRef<HTMLLIElement | null>(null);
  const [isFabVisible, setIsFabVisible] = useState(false);
  // null = follow the deck's running style; otherwise compare another style
  const [styleOverride, setStyleOverride] = useState<number | null>(null);
  const effectiveStyle = styleOverride ?? runningStyle;
  // Effect-category filter for the ranked-cards list (empty = show all)
  const [effectFilter, setEffectFilter] = useState<SkillEffectCategory[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(EFFECT_FILTER_STORAGE_KEY);
      if (!raw) return [];
      const allowed = new Set(EFFECT_CATEGORIES.map((c) => c.id));
      return (JSON.parse(raw) as SkillEffectCategory[]).filter((c) => allowed.has(c));
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(EFFECT_FILTER_STORAGE_KEY, JSON.stringify(effectFilter));
    } catch {}
  }, [effectFilter]);

  // Card-type filter (null = all types); normalized names from CARD_TYPE_FILTERS
  const [typeFilter, setTypeFilter] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(CARD_TYPE_FILTER_STORAGE_KEY);
      return raw && (CARD_TYPE_FILTERS as readonly string[]).includes(raw) ? raw : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    try {
      if (typeFilter) localStorage.setItem(CARD_TYPE_FILTER_STORAGE_KEY, typeFilter);
      else localStorage.removeItem(CARD_TYPE_FILTER_STORAGE_KEY);
    } catch {}
  }, [typeFilter]);

  // Full skill details for effect-category classification of suggested skills
  const [skillDetailMap, setSkillDetailMap] = useState<Map<number, SkillDetail>>(() => new Map());
  useEffect(() => {
    api
      .listSkills()
      .then((skills) => setSkillDetailMap(new Map(skills.map((s) => [s.id, s]))))
      .catch(console.error);
  }, []);

  const raceParams = useMemo(() => getPvpRaceParameters(activePvpEvent), [activePvpEvent]);

  // ----- Activating skills: ace deck card skills + inherited uniques, evaluated per style/course -----
  const aceSkillEntries = useMemo<AceSkillEntry[]>(() => {
    if (!course || !effectiveStyle) return [];
    const cardEntries: AceSkillEntry[] = mainSkills.map((s) => ({
      id: s.id,
      nameEn: s.nameEn,
      nameJp: s.nameJp,
      iconId: s.iconId,
      rarity: s.rarity,
      source: "card",
      sourceLabel: `Card (${s.cardName})`,
      fires: doesSkillFireOnCourse(s.id, course, effectiveStyle, raceParams),
    }));
    const uniqueEntries: AceSkillEntry[] = lineageUniqueSkills.map((s) => ({
      id: s.id,
      nameEn: s.nameEn,
      nameJp: s.nameJp,
      iconId: s.iconId,
      rarity: s.rarity,
      source: "unique",
      sourceLabel: s.sourceLabel,
      fires: doesSkillFireOnCourse(s.id, course, effectiveStyle, raceParams),
    }));
    return [...cardEntries, ...uniqueEntries];
  }, [mainSkills, lineageUniqueSkills, course, effectiveStyle, raceParams]);

  const firesCount = aceSkillEntries.filter((s) => s.fires === true).length;

  // ----- Ranked cards: new speed-family skills that fire, excluding all owned skills -----
  const recommendations = useMemo<CardRecommendation[]>(() => {
    if (!course || !effectiveStyle) return [];
    return recommendCardsForParent({
      mainDeckSkillIds: mainSkillIdSet,
      excludeSkillIds: new Set([
        ...lineageUniqueSkills.map((s) => s.id),
        ...bloodlineFactorSkills.map((s) => s.id),
      ]),
      equippedParentCardIds: parentSlots.map((c) => c?.id ?? null),
      course,
      style: effectiveStyle,
      distance,
      surface,
      // When filtering by effect or card type, surface every candidate card
      // so nothing matching is cut off by the default top-16 ranking
      limit: effectFilter.length > 0 || typeFilter ? 100 : 16,
      raceParams,
      tacticalCategories: SPEED_TACTICAL_CATEGORIES,
      requireFiresOnCourse: true,
    });
  }, [
    mainSkillIdSet,
    lineageUniqueSkills,
    bloodlineFactorSkills,
    parentSlots,
    course,
    effectiveStyle,
    distance,
    surface,
    raceParams,
    effectFilter,
    typeFilter,
  ]);

  // Effect + type filters: when active, keep cards granting at least one skill
  // of the selected effect categories (and of the selected card type), re-ranked
  // top-down by how many of their skills match. Chips that match light up; the
  // rest dim out. No selection = engine order.
  const rankedRecommendations = useMemo<EffectRankedRow[]>(() => {
    const byType = (rec: CardRecommendation) => !typeFilter || formatCardType(rec.type) === typeFilter;
    if (effectFilter.length === 0) {
      return recommendations.filter((rec) => byType(rec)).map((rec) => ({ rec, matchedIds: new Set<number>(), matchedCount: 0 }));
    }
    const wanted = new Set(effectFilter);
    return recommendations
      .filter((rec) => byType(rec))
      .map((rec) => {
        const matchedIds = new Set<number>();
        for (const s of rec.newMatchingSkills) {
          const detail = skillDetailMap.get(s.id);
          if (detail && classifySkillEffects(detail).some((c) => wanted.has(c))) matchedIds.add(s.id);
        }
        return { rec, matchedIds, matchedCount: matchedIds.size };
      })
      .filter((row) => row.matchedCount > 0)
      .sort((a, b) => b.matchedCount - a.matchedCount || b.rec.score - a.rec.score);
  }, [recommendations, effectFilter, typeFilter, skillDetailMap]);

  // Show the floating collapse button once the user has scrolled past the
  // FAB_TRIGGER_CARDS-th row; the sticky button stays inside the component.
  useEffect(() => {
    if (!isCardListOpen || rankedRecommendations.length <= FAB_TRIGGER_CARDS) {
      setIsFabVisible(false);
      return;
    }
    function onScroll() {
      const el = fabSentinelRef.current;
      if (!el) return;
      setIsFabVisible(el.getBoundingClientRect().top < window.innerHeight * 0.85);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isCardListOpen, rankedRecommendations.length]);

  function toggleEffectFilter(cat: SkillEffectCategory) {
    setEffectFilter((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  }

  const firstEmptySlotIndex = parentSlots.findIndex((c) => c === null);

  function handleAddCard(rec: CardRecommendation) {
    if (firstEmptySlotIndex === -1) return;
    if (!allCards) return;
    const card = allCards.find((c) => c.id === rec.cardId);
    if (!card) return;
    if (onPickCard) {
      onPickCard(card, firstEmptySlotIndex);
    } else {
      setParentCard(firstEmptySlotIndex, card);
    }
  }

  const raceTitle = activePvpEvent
    ? activePvpEvent.name
    : trackDetail && activeCourseRow
      ? `${trackDetail.nameEn} ${activeCourseRow.length}m (${DISTANCE_LABELS[activeCourseRow.distance as keyof typeof DISTANCE_LABELS]?.split(" ")[0]} ${SURFACE_LABELS[activeCourseRow.terrain as keyof typeof SURFACE_LABELS]})`
      : "Target Race";

  const hasAceData = mainSkills.length > 0 || lineageUniqueSkills.length > 0;
  const isFull = firstEmptySlotIndex === -1;
  const isEffectFiltering = effectFilter.length > 0;

  return (
    <section className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ZapIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-none" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Ace Complement Finder</h3>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Skills your ace deck + inherited uniques activate for{" "}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{raceTitle}</span>
            {effectiveStyle ? (
              <>
                {" "}· <span className="font-semibold text-zinc-800 dark:text-zinc-200">{RUNNING_STYLE_LABELS[effectiveStyle as keyof typeof RUNNING_STYLE_LABELS]}</span>
              </>
            ) : null}
            , then cards that farm missing speed skills. Card skills only — uma inheritance is excluded from suggestions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsPanelOpen((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200/90 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/80 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-2xs cursor-pointer transition-all ease-out-quart duration-150 active:scale-[0.98]"
          aria-expanded={isPanelOpen}
        >
          <span>{isPanelOpen ? "Collapse" : "Expand"}</span>
          <ChevronDownIcon
            className={`h-3.5 w-3.5 transition-transform duration-200 ease-in-out-cubic ${isPanelOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {isPanelOpen && (
        <div className="animate-in fade-in duration-200 ease-out-quart">
          {/* Style override selector */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">Style:</span>
            <button
              type="button"
              onClick={() => setStyleOverride(null)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                styleOverride === null
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Deck{runningStyle ? ` (${RUNNING_STYLE_LABELS[runningStyle]})` : ""}
            </button>
            {STYLE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setStyleOverride(id)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  styleOverride === id
                    ? "bg-emerald-700 dark:bg-emerald-600 text-white font-semibold"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {RUNNING_STYLE_LABELS[id]}
              </button>
            ))}
          </div>

          {!course ? (
            <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500 italic">
              Pick a race (CM/LOH preset or any course) in the bar above to evaluate skill activation.
            </p>
          ) : !hasAceData ? (
            <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500 italic">
              Build your Main Deck (ace) and set Parent lineage in the Parenting tab to compute activating skills.
            </p>
          ) : (
            <>
              {/* Activating skills (ace deck + inherited uniques) */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setIsSkillListOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 cursor-pointer group"
                  aria-expanded={isSkillListOpen}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <ChevronDownIcon
                      className={`h-3 w-3 flex-none transition-transform duration-200 ease-in-out-cubic ${isSkillListOpen ? "rotate-180" : ""}`}
                    />
                    <span className="group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors">
                      Ace & Inherited Skills — Activating ({firesCount}/{aceSkillEntries.length})
                    </span>
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">green = triggers</span>
                </button>
                {isSkillListOpen && (
                  <div className="flex flex-wrap gap-1 animate-in fade-in duration-200 ease-out-quart">
                  {aceSkillEntries.map((s) => (
                    <SkillHoverCard
                      key={`${s.source}-${s.id}`}
                      skillId={s.id}
                      fallbackSkill={{ nameEn: s.nameEn, nameJp: s.nameJp, rarity: s.rarity, iconId: s.iconId }}
                    >
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border cursor-pointer transition-all hover:scale-[1.02] ${
                          s.fires === true
                            ? "border-emerald-400 dark:border-emerald-600 bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-950 dark:text-emerald-200 font-semibold shadow-2xs"
                            : s.fires === false
                              ? "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500"
                              : "border-dashed border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                        }`}
                        title={`${s.nameEn} — ${s.sourceLabel}${s.fires === true ? " • Activates for this style" : s.fires === false ? " • Does not activate for this style" : " • Activation unknown"}`}
                      >
                        {s.fires === true && (
                          <ZapIcon className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400 flex-none" />
                        )}
                        <SkillIcon iconId={s.iconId} name={s.nameEn} className="h-3.5 w-3.5 object-contain flex-none" />
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500">
                          [{s.source === "card" ? "A" : "U"}]
                        </span>
                        <span className="truncate max-w-[130px]">{s.nameEn}</span>
                      </span>
                    </SkillHoverCard>
                  ))}
                  </div>
                )}
                <p className="mt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                  [A] = ace deck card skill · [U] = uma-inherited unique · dimmed = does not trigger for this style
                </p>
              </div>

              {/* Ranked cards */}
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => setIsCardListOpen((prev) => !prev)}
                  className="w-full flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 cursor-pointer"
                  aria-expanded={isCardListOpen}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <ChevronDownIcon
                      className={`h-3 w-3 flex-none transition-transform duration-200 ease-in-out-cubic ${isCardListOpen ? "rotate-180" : ""}`}
                    />
                    <span className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                      Cards farming <span className="font-bold text-emerald-700 dark:text-emerald-400">new speed skills</span> that
                      activate (beyond Ace &amp; Inherited Skills)
                      {rankedRecommendations.length > 0 && (
                        <span className="text-zinc-400 dark:text-zinc-500">
                          {" "}· {rankedRecommendations.length} card{rankedRecommendations.length > 1 ? "s" : ""}
                          {(isEffectFiltering || typeFilter !== null) ? " match filter" : ""}
                        </span>
                      )}
                    </span>
                  </span>
                  {isFull ? (
                    <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      All 6 parent slots filled
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70">
                      Next empty slot: Slot {firstEmptySlotIndex + 1}
                    </span>
                  )}
                </button>

                {isCardListOpen && (
                  <>

                {/* Effect-category filter */}
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mr-0.5">Effect:</span>
                  {EFFECT_CATEGORIES.map((cat) => {
                    const active = effectFilter.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleEffectFilter(cat.id)}
                        title={cat.description}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border cursor-pointer transition-all ease-out-quart duration-150 hover:scale-[1.02] active:scale-[0.98] ${
                          active
                            ? `${cat.badge} font-semibold shadow-2xs`
                            : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${cat.dotColor} ${active ? "" : "opacity-50"}`} />
                        {cat.label}
                      </button>
                    );
                  })}
                  {effectFilter.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setEffectFilter([])}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Card-type filter (icon-only — the icons are self-explanatory) */}
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mr-0.5">Type:</span>
                  <button
                    type="button"
                    onClick={() => setTypeFilter(null)}
                    aria-pressed={typeFilter === null}
                    className={`rounded px-1.5 py-1 text-[10px] font-medium border cursor-pointer transition-all ease-out-quart duration-150 hover:scale-[1.02] active:scale-[0.98] ${
                      typeFilter === null
                        ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 font-semibold shadow-2xs"
                        : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    All
                  </button>
                  {CARD_TYPE_FILTERS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTypeFilter((prev) => (prev === t ? null : t))}
                      title={`${t.charAt(0).toUpperCase() + t.slice(1)} cards`}
                      aria-pressed={typeFilter === t}
                      className={`inline-flex items-center justify-center rounded border p-1 cursor-pointer transition-all ease-out-quart duration-150 hover:scale-[1.05] active:scale-[0.98] ${
                        typeFilter === t
                          ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 shadow-2xs"
                          : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 opacity-55 hover:opacity-100"
                      }`}
                    >
                      <CardTypeIcon type={t} className="h-4 w-4 object-contain" />
                    </button>
                  ))}
                </div>

                {recommendations.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500 italic">
                    No additional speed-family skills found — your ace deck already covers the activating speed skills for this
                    style.
                  </p>
                ) : rankedRecommendations.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500 italic">
                    No cards grant the selected effect types — try clearing some effect filters.
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {rankedRecommendations.map((row, index) => {
                      const rec = row.rec;
                      const cardEntry = allCards?.find((c) => c.id === rec.cardId);
                      return (
                        <Fragment key={rec.cardId}>
                          <li className="flex items-start gap-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                          <div className="h-12 w-12 flex-none overflow-hidden">
                            {cardEntry?.portraitUrl || cardEntry?.imgUrl ? (
                              <img
                                src={cardEntry.portraitUrl || cardEntry.imgUrl}
                                alt={rec.nameEn}
                                className="h-full w-full object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-xs text-zinc-400 dark:text-zinc-500">Card</div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`flex-none rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                  RARITY_META[rec.rarity]?.chip ?? "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                }`}
                              >
                                {RARITY_META[rec.rarity]?.label ?? "R"}
                              </span>

                              {/* Stacked bilingual name block — the type icon is
                                  vertically centered against BOTH lines */}
                              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                <CardTypeIcon type={rec.type} className="h-4 w-4 flex-none object-contain" />
                                <div className="min-w-0 leading-tight">
                                  <span className="block truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100" title={rec.nameEn}>
                                    {rec.nameEn}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[11px] font-normal leading-tight text-zinc-400 dark:text-zinc-500" title={rec.nameJp}>
                                    {rec.nameJp}
                                  </span>
                                </div>
                              </div>

                            </div>

                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {rec.newMatchingSkills.map((s) => (
                                <SkillHoverCard
                                  key={s.id}
                                  skillId={s.id}
                                  fallbackSkill={{ nameEn: s.nameEn, rarity: s.rarity, iconId: s.iconId }}
                                  cardName={rec.nameEn}
                                >
                                  <span
                                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border cursor-pointer transition-all hover:scale-[1.02] ${
                                      !isEffectFiltering || row.matchedIds.has(s.id)
                                        ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 font-semibold"
                                        : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500 opacity-60"
                                    }`}
                                    title={`${s.nameEn}${s.tacticalLabel ? ` • [${s.tacticalLabel}]` : ""}${
                                      s.eventMeta
                                        ? `\nEvent: ${s.eventMeta.eventNameEn || s.eventMeta.eventNameJp} • Choice ${s.eventMeta.choiceIndex}: ${s.eventMeta.choiceTextEn || s.eventMeta.choiceTextJp}`
                                        : ""
                                    } • Activates on this track!`}
                                  >
                                    <ZapIcon className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400 flex-none" />
                                    <SkillIcon iconId={s.iconId} name={s.nameEn} className="h-3.5 w-3.5 object-contain flex-none" />
                                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500">[{s.source === "hint" ? "H" : "E"}]</span>
                                    <span className="truncate max-w-[130px]">{s.nameEn}</span>
                                    {s.originalGoldName && (
                                      <span className="text-[9px] font-bold text-amber-800 dark:text-amber-300" title={`Mapped from Gold: ${s.originalGoldName}`}>
                                        ★
                                      </span>
                                    )}
                                  </span>
                                </SkillHoverCard>
                              ))}
                            </div>
                          </div>

                          {/* Status badges right-aligned in a column above
                              the slot button — keeps the name row uncluttered
                              at every viewport width */}
                          <div className="flex-none self-center flex flex-col items-end justify-center gap-1">
                            <span className="inline-flex items-center gap-1.5">
                              {isEffectFiltering && (
                                <span
                                  className="rounded bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70"
                                  title={`${row.matchedCount} of this card's new skills match the selected effect types`}
                                >
                                  {row.matchedCount} match{row.matchedCount > 1 ? "es" : ""}
                                </span>
                              )}
                              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                                +{rec.totalNewCount} new
                              </span>
                            </span>
                            <button
                              type="button"
                              disabled={isFull}
                              onClick={() => handleAddCard(rec)}
                              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ease-out-quart duration-150 cursor-pointer ${
                                isFull
                                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                                  : "bg-emerald-700 dark:bg-emerald-600 text-white hover:bg-emerald-800 dark:hover:bg-emerald-500 active:scale-[0.98] shadow-2xs"
                              }`}
                            >
                              {isFull ? "Full" : `+ Slot ${firstEmptySlotIndex + 1}`}
                            </button>
                          </div>
                          </li>

                          {index === FAB_TRIGGER_CARDS - 1 && (
                            <li ref={fabSentinelRef} aria-hidden className="h-0" />
                          )}
                        </Fragment>
                      );
                    })}
                  </ul>
                )}

                {/* Floating collapse button — sticky inside the component, only
                    once the list has been scrolled past the trigger card */}
                {isCardListOpen && isFabVisible && rankedRecommendations.length > FAB_TRIGGER_CARDS && (
                  <div className="sticky bottom-4 z-20 mt-2 flex justify-center pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200 ease-out-expo">
                    <button
                      type="button"
                      onClick={() => setIsCardListOpen(false)}
                      className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-xs font-bold shadow-lg hover:bg-zinc-700 dark:hover:bg-zinc-300 active:scale-[0.97] transition-all ease-out-quart duration-150 cursor-pointer"
                      title="Collapse the card list"
                    >
                      <ChevronDownIcon className="h-3.5 w-3.5 rotate-180 flex-none" />
                      Collapse {rankedRecommendations.length} cards
                    </button>
                  </div>
                )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
