"use client";

// The Visualizer tab: pick a venue + course, see the deck's skills as a list,
// and click one to overlay ITS activation zones on the track's ruler band.
// Only the selected skill is computed + drawn.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  flattenCourse,
  type SkillDetail,
} from "../lib/api";
import { computeAllZones, horseForStrategy, type SkillZoneResult } from "../lib/skill-engine/zones";
import { conditionBranches, formatEffect } from "../lib/skill-engine/describe";
import { renderCourse, ZONE_COLORS } from "../lib/track-render";
import { useDeck } from "./store";
import {
  matchesRarityFilter,
  getSkillRarityStyle,
  type RarityFilterKey,
} from "../lib/skill-rarity";
import SkillIcon from "./skill-icon";

function rarityBadge(rarity?: number) {
  const meta = getSkillRarityStyle(rarity);
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${meta.badgeClass}`}>
      {meta.badgeLabel}
    </span>
  );
}

// Persisted visualizer prefs (selected skill).
const SAVE_KEY = "visualizer.v1";

// Zone colors are #rrggbb; convert to rgba so the swatch can carry alpha.
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Some skill descriptions lead with a qualifier ("Leader・…", "Medium・…").
// Peel it into a small badge so the qualifier reads as a tag, not a run-on.
function splitStylePrefix(desc: string | undefined): { style: string | null; text: string } {
  const m = /^([A-Za-z]+)・(.+)$/.exec(desc ?? "");
  if (m) {
    return { style: m[1], text: m[2] };
  }
  return { style: null, text: desc ?? "" };
}

// One row of chips per `@` branch, tinted by the trigger's zone color. `needs`
// (precondition) rows render on top in a neutral gray; the trigger conditions
// the skill fires on sit beneath.
function ConditionChips({ branches, needsBranches, tint, muted }: {
  branches: string[][];
  needsBranches: string[][] | null;
  tint: string;
  muted: boolean;
}) {
  const needs = needsBranches && needsBranches.length > 0 ? needsBranches : null;
  return (
    <div className="flex flex-col gap-1">
      {needs && (
        <div className="mb-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Needs:</span>
          {needs.map((chips, bi) => (
            <div key={bi} className="mt-0.5 flex flex-wrap items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 flex-none rounded-sm border border-zinc-300 bg-zinc-200" />
              {bi > 0 && (
                <span className="mr-0.5 text-[10px] font-semibold uppercase text-zinc-400">or</span>
              )}
              {chips.map((chip, ci) => (
                <span
                  key={ci}
                  className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] leading-4 text-zinc-500"
                >
                  {chip}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
      {branches.map((chips, bi) => (
        <div key={bi} className="flex flex-wrap items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 flex-none rounded-sm border"
            style={{ background: tint, borderColor: muted ? "#a1a1aa" : "#d4d4d8" }}
          />
          {bi > 0 && (
            <span className="mr-0.5 text-[10px] font-semibold uppercase text-zinc-400">or</span>
          )}
          {chips.map((chip, ci) => (
            <span
              key={ci}
              className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-1.5 py-0.5 text-[11px] leading-4 text-zinc-700 dark:text-zinc-200"
            >
              {chip}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function TrackView() {
  const {
    course,
    runningStyle,
    racerCount,
    mainSlots,
    parentSlots,
    mainSkills,
    parentSkills,
  } = useDeck();

  const [visualizerDeck, setVisualizerDeck] = useState<"main" | "parent">("main");
  const [rarityFilter, setRarityFilter] = useState<RarityFilterKey>("all");
  const activeSkills = visualizerDeck === "main" ? mainSkills : parentSkills;
  const activeSlots = visualizerDeck === "main" ? mainSlots : parentSlots;

  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  const [skillDetail, setSkillDetail] = useState<SkillDetail | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const [zones, setZones] = useState<SkillZoneResult[] | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);
  const conditionViewerRef = useRef<HTMLDivElement>(null);

  // Restore saved selectedSkillId after client hydration
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.skillId === "number") {
          setSelectedSkillId(p.skillId);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Horse used to gate running_style conditions; undefined = default (Nige).
  // Memoized: a fresh object each render would re-fire the zone effects forever.
  const styleHorse = useMemo(
    () => (runningStyle ? horseForStrategy(runningStyle) : undefined),
    [runningStyle],
  );

  // Auto-select a deck skill: the saved one when valid, else the first skill.
  // Keeps a valid selection as the deck changes.
  useEffect(() => {
    if (activeSkills.length === 0) {
      setSelectedSkillId(null);
      return;
    }
    setSelectedSkillId((cur) => {
      if (cur != null && activeSkills.some((s) => s.id === cur)) return cur;
      return activeSkills[0].id;
    });
  }, [activeSkills]);

  // Fetch the selected skill detail.
  useEffect(() => {
    if (selectedSkillId == null) return;
    let alive = true;
    setSkillLoading(true);
    setSkillDetail(null);
    setZones(null);
    api
      .skill(selectedSkillId)
      .then((d) => {
        if (!alive) return;
        setSkillDetail(d);
        const groups = (d.conditionGroups ?? []).map((g) => ({
          condition: g.condition ?? "",
          precondition: g.precondition ?? null,
        }));
        if (course) setZones(computeAllZones(course, groups, styleHorse));
        else setZones([]);
      })
      .catch(() => alive && setSkillDetail(null))
      .finally(() => alive && setSkillLoading(false));
    return () => {
      alive = false;
    };
  }, [selectedSkillId, course, styleHorse]);

  // Recompute zones when the course changes and we still have a detail loaded.
  useEffect(() => {
    if (!course || !skillDetail) return;
    const groups = (skillDetail.conditionGroups ?? []).map((g) => ({
      condition: g.condition ?? "",
      precondition: g.precondition ?? null,
    }));
    setZones(computeAllZones(course, groups, styleHorse));
  }, [course, skillDetail, styleHorse]);

  // Render the track into the host element whenever the course (or zones) change.
  useEffect(() => {
    if (!hostRef.current || !course) return;
    renderCourse(hostRef.current, course, { zones: zones ?? [] });
  }, [course, zones]);

  // Cache skill details so triggerability can be computed for every deck skill
  // without re-fetching on each course change.
  const detailCacheRef = useRef<Map<number, SkillDetail>>(new Map());

  const fetchSkillCached = useCallback(async (id: number): Promise<SkillDetail | undefined> => {
    const hit = detailCacheRef.current.get(id);
    if (hit) return hit;
    try {
      const d = await api.skill(id);
      detailCacheRef.current.set(id, d);
      return d;
    } catch {
      return undefined;
    }
  }, []);

  // For each deck skill, compute whether it can activate on the current course.
  // A skill "fires here" when any condition group yields non-empty regions.
  // Store the full per-skill zones so the list can show per-trigger ranges.
  const [zonesBySkill, setZonesBySkill] = useState<Map<number, SkillZoneResult[]> | null>(null);

  useEffect(() => {
    if (!course || activeSkills.length === 0) {
      setZonesBySkill(null);
      return;
    }
    let alive = true;
    (async () => {
      await Promise.all(activeSkills.map((s) => fetchSkillCached(s.id)));
      if (!alive) return;
      const bySkill = new Map<number, SkillZoneResult[]>();
      for (const s of activeSkills) {
        const d = detailCacheRef.current.get(s.id);
        if (!d) continue;
        const groups = (d.conditionGroups ?? []).map((g) => ({
          condition: g.condition ?? "",
          precondition: g.precondition ?? null,
        }));
        bySkill.set(s.id, computeAllZones(course, groups, styleHorse));
      }
      setZonesBySkill(bySkill);
    })();
    return () => {
      alive = false;
    };
  }, [course, activeSkills, fetchSkillCached, styleHorse]);

  const selectedSkill = activeSkills.find((s) => s.id === selectedSkillId) ?? null;
  const hasDeck = activeSlots.some(Boolean);

  // Whether a skill fires on the current course (null while zones haven't
  // been computed for it yet).
  const firesOnCourse = useCallback(
    (id: number): boolean | null => {
      const zones = zonesBySkill?.get(id);
      if (!zones) return null;
      return zones.some((z) => z.regions.length > 0);
    },
    [zonesBySkill],
  );

  // Triggerable skills first; stable within each group (existing name order).
  const sortedSkills = useMemo(() => {
    if (!zonesBySkill) return activeSkills;
    return [...activeSkills].sort((a, b) => {
      const fa = firesOnCourse(a.id) ?? false;
      const fb = firesOnCourse(b.id) ?? false;
      return Number(fb) - Number(fa);
    });
  }, [activeSkills, zonesBySkill, firesOnCourse]);

  const displayedSkills = useMemo(() => {
    return sortedSkills.filter((s) => matchesRarityFilter(s.rarity, rarityFilter));
  }, [sortedSkills, rarityFilter]);

  return (
    <div className="flex flex-col gap-3">
      {!hasDeck ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
          Build a deck on the Main Deck tab first - its skills will appear here.
        </div>
      ) : (
        <>
          {/* Track Map Container */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 sm:p-4 shadow-xs transition-colors">
            <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Track Elevation & Activation Zones
              </span>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                Touch or hover across track to inspect meter markers
              </span>
            </div>

            {course ? (
              <div ref={hostRef} className="w-full overflow-x-auto" />
            ) : (
              <p className="text-sm text-zinc-400">Select a course.</p>
            )}
          </div>

          {/* Bottom Section: Condition Viewer (Order 1 on mobile) + Skill Selector (Order 2 on mobile) */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-3">
            {/* Left 1/3 on desktop, bottom on mobile: skill selector */}
            <div className="order-2 md:order-1 flex min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
              <div className="flex flex-col gap-2 border-b border-zinc-100 dark:border-zinc-800 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {visualizerDeck === "main" ? "Main Deck Skills" : "Parent Deck Skills"}
                    </h3>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                      {displayedSkills.length} of {activeSkills.length} skills · <span className="text-emerald-700 dark:text-emerald-400 font-medium">green = triggers</span>
                    </p>
                  </div>
                  <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/80 p-0.5 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setVisualizerDeck("main")}
                      className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                        visualizerDeck === "main"
                          ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      Main
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisualizerDeck("parent")}
                      className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                        visualizerDeck === "parent"
                          ? "bg-emerald-700 dark:bg-emerald-600 text-white shadow-2xs font-semibold"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      Parent
                    </button>
                  </div>
                </div>

                {/* Rarity Tabs */}
                <div className="flex flex-wrap rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 text-[11px] font-medium shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setRarityFilter("all")}
                    className={`rounded px-2 py-0.5 transition-colors cursor-pointer ${
                      rarityFilter === "all" ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setRarityFilter("white")}
                    className={`rounded px-2 py-0.5 transition-colors cursor-pointer ${
                      rarityFilter === "white" ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 font-semibold" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                    }`}
                  >
                    White
                  </button>
                  <button
                    type="button"
                    onClick={() => setRarityFilter("gold")}
                    className={`rounded px-2 py-0.5 transition-colors cursor-pointer ${
                      rarityFilter === "gold"
                        ? "bg-amber-500 text-amber-950 font-bold shadow-2xs"
                        : "text-amber-950 dark:text-amber-100 hover:bg-amber-100/60 dark:hover:bg-amber-950/60 font-medium"
                    }`}
                  >
                    Gold
                  </button>
                  <button
                    type="button"
                    onClick={() => setRarityFilter("unique")}
                    className={`rounded px-2 py-0.5 transition-colors cursor-pointer ${
                      rarityFilter === "unique"
                        ? "bg-pink-500 text-white font-bold shadow-2xs"
                        : "text-pink-700 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/40"
                    }`}
                  >
                    Unique
                  </button>
                  <button
                    type="button"
                    onClick={() => setRarityFilter("evolved")}
                    className={`rounded px-2 py-0.5 transition-colors cursor-pointer ${
                      rarityFilter === "evolved"
                        ? "bg-purple-600 text-white font-bold shadow-2xs"
                        : "text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                    }`}
                  >
                    Evo
                  </button>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-1.5 max-h-[380px] md:max-h-[460px] overflow-y-auto p-2">
                {displayedSkills.length === 0 ? (
                  (rarityFilter === "unique" || rarityFilter === "evolved") ? (
                    <div className="p-4 text-center">
                      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">No {rarityFilter === "unique" ? "Unique" : "Evolved"} Skills</p>
                      <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                        {visualizerDeck === "parent"
                          ? "Unique skills can be inherited directly from Parent characters."
                          : "Unique and Evolved skills come from Trainee/Parent characters."}
                      </p>
                    </div>
                  ) : (
                    <p className="p-4 text-center text-xs text-zinc-400 dark:text-zinc-500">No skills match.</p>
                  )
                ) : (
                  displayedSkills.map((s) => {
                    const active = s.id === selectedSkillId;
                    const fires = firesOnCourse(s.id);
                    const rStyle = getSkillRarityStyle(s.rarity);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedSkillId(s.id);
                          if (typeof window !== "undefined" && window.innerWidth < 768) {
                            conditionViewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }
                        }}
                        className={`flex min-w-[180px] flex-col gap-1 rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                          active
                            ? "ring-2 ring-emerald-600 dark:ring-emerald-400 shadow-xs"
                            : rStyle.borderClass
                        } ${fires ? "border-emerald-500/80 dark:border-emerald-600/80" : ""} ${rStyle.bgClass ?? "bg-white dark:bg-zinc-900"}`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`inline-block h-2 w-2 flex-none rounded-full ${
                              fires ? "bg-emerald-500 shadow-2xs" : "bg-zinc-300 dark:bg-zinc-700"
                            }`}
                            title={
                              fires
                                ? "Triggers on this course"
                                : "No trigger on this course"
                            }
                          />
                          <SkillIcon iconId={s.iconId} name={s.nameEn} className="h-4 w-4 object-contain flex-none" />
                          <span className={`truncate text-xs font-semibold ${active ? "text-zinc-950 dark:text-zinc-100" : "text-zinc-900 dark:text-zinc-200"}`}>
                            {s.nameEn}
                          </span>
                          <span className="flex-none text-[10px] text-zinc-400 dark:text-zinc-500">{s.nameJp}</span>
                          <span className="ml-auto flex-none">{rarityBadge(s.rarity)}</span>
                        </div>
                        {s.descEn && (
                          <p className="line-clamp-2 text-[11px] leading-4 text-zinc-700 dark:text-zinc-300">{s.descEn}</p>
                        )}
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                          {(s.grants && s.grants.length > 0
                            ? s.grants
                            : [{ cardId: s.cardId, cardName: s.cardName, source: s.source }]
                          ).map((g, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1">
                              <span
                                className={`rounded px-1 py-0.2 text-[8px] font-bold uppercase tracking-wide ${
                                  g.source === "event"
                                    ? "bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300"
                                    : "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300"
                                }`}
                              >
                                {g.source}
                              </span>
                              <span className="truncate text-zinc-600 dark:text-zinc-400 font-medium">{g.cardName}</span>
                              {g.originalGoldSkill && (
                                <span className="text-amber-950 dark:text-amber-100 text-[8px] font-bold">
                                  ({g.originalGoldSkill.nameEn})
                                </span>
                              )}
                              {idx < (s.grants?.length ?? 1) - 1 && <span className="text-zinc-300 dark:text-zinc-700">·</span>}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Condition Viewer & Timing (Order 1 on mobile, 2/3 column on desktop) */}
            <div
              ref={conditionViewerRef}
              className="order-1 md:order-2 min-w-0 max-h-[500px] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4 text-sm shadow-xs text-left scroll-mt-20 sm:scroll-mt-24"
            >
              {skillLoading ? (
                <p className="text-zinc-400 dark:text-zinc-500">Loading skill…</p>
              ) : skillDetail ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <SkillIcon iconId={skillDetail.iconId} name={skillDetail.nameEn} className="h-6 w-6 object-contain flex-none" />
                      <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{skillDetail.nameEn}</span>{" "}
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">{skillDetail.nameJp}</span>
                      {rarityBadge(selectedSkill?.rarity ?? skillDetail.rarity)}
                    </div>
                    {(() => {
                      const deckSkill = activeSkills.find((x: { id: number }) => x.id === skillDetail.id);
                      if (!deckSkill) return null;
                      const grants =
                        deckSkill.grants && deckSkill.grants.length > 0
                          ? deckSkill.grants
                          : [
                              {
                                cardId: deckSkill.cardId,
                                cardName: deckSkill.cardName,
                                source: deckSkill.source,
                              },
                            ];
                      return (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="text-zinc-400 dark:text-zinc-500">From:</span>
                          {grants.map((g: { cardName: string; source: string }, idx: number) => (
                            <span key={idx} className="inline-flex items-center gap-1">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                  g.source === "event"
                                    ? "bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300"
                                    : "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300"
                                }`}
                              >
                                {g.source}
                              </span>
                              <span className="font-medium text-zinc-700 dark:text-zinc-300">{g.cardName}</span>
                              {idx < grants.length - 1 && <span className="text-zinc-300 dark:text-zinc-700">·</span>}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                    {(() => {
                      const { style, text } = splitStylePrefix(skillDetail.descEn);
                      return (
                        <div className="mt-1 flex flex-wrap items-start gap-x-2">
                          {style && (
                            <span className="mt-0.5 inline-flex flex-none items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium leading-4 text-zinc-600 dark:text-zinc-300">
                              <span
                                className="inline-block h-1.5 w-1.5 flex-none rounded-full bg-zinc-400 dark:bg-zinc-500"
                                aria-hidden
                              />
                              {style}
                            </span>
                          )}
                          <span className="min-w-0 flex-1 leading-6 text-zinc-600 dark:text-zinc-300">{text}</span>
                        </div>
                      );
                    })()}
                  </div>

                  {zones && zones.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {(skillDetail.conditionGroups ?? []).map((g, gi) => {
                        const z = zones[gi];
                        if (!z || !z.regions.length) return null;
                        const wins = z.regions
                          .map((r) => `${Math.round(r.start)}-${Math.round(r.end)}m`)
                          .join(", ");
                        const branches = conditionBranches(g.condition ?? "", racerCount).branches;
                        const needsBranches = g.precondition
                          ? conditionBranches(g.precondition, racerCount).branches
                          : null;
                        const effectLine = formatEffect(
                          (g.effects as Array<{ type: number; value: number }> | undefined) ?? [],
                          g.base_time,
                          course?.length ?? 0,
                        );
                        return (
                          <div key={gi} className="rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-xs shadow-2xs">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span
                                className="inline-block h-3 w-3 flex-none rounded-sm border border-zinc-300 dark:border-zinc-700"
                                style={{ background: hexToRgba(ZONE_COLORS[gi % ZONE_COLORS.length], 0.35) }}
                              />
                              <span className="font-bold text-zinc-800 dark:text-zinc-200">T{gi + 1}</span>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                {z.isRandom ? "random" : "deterministic"}
                              </span>
                              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 font-mono ml-auto">
                                {wins}
                              </span>
                            </div>

                            <div className="mt-1">
                              <ConditionChips
                                branches={branches}
                                needsBranches={needsBranches}
                                tint={hexToRgba(ZONE_COLORS[gi % ZONE_COLORS.length], 0.35)}
                                muted={false}
                              />
                            </div>

                            {effectLine && (
                              <div className="mt-2">
                                <span className="inline-flex flex-wrap items-center gap-1 rounded-md border border-emerald-300 dark:border-emerald-600/60 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-xs font-semibold text-emerald-900 dark:text-emerald-300 shadow-2xs">
                                  {effectLine}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {zones.every((z) => !z.regions.length) && (
                        <p className="text-amber-700 dark:text-amber-400 text-xs font-medium">⚠ No trigger activates on this course.</p>
                      )}
                    </div>
                  )}

                  {zones && zones.some((z) => !z.regions.length) && (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      (Some triggers do not activate on this course.)
                    </p>
                  )}
                </div>
              ) : selectedSkillId ? (
                <p className="text-zinc-400 dark:text-zinc-500">Could not load that skill.</p>
              ) : (
                <p className="text-zinc-400 dark:text-zinc-500">Select a skill from the deck.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
