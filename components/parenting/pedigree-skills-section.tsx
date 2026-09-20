"use client";

import { useState, useMemo, useEffect } from "react";
import { useDeck } from "../store";
import { useLineageSkills, type DisplayParentSkill } from "../../lib/use-lineage-skills";
import { evaluateSkillActivation, type SkillActivationResult } from "../../lib/parenting/skill-evaluator";
import { getPvpRaceParameters, isSkillBanned } from "../../lib/pvp-events";
import { getSkillRarityStyle, matchesRarityFilter, type RarityFilterKey } from "../../lib/skill-rarity";
import SkillHoverCard from "../skill-hover-card";
import SkillIcon from "../skill-icon";
import SkillItem from "../skill-item";
import { StarIcon, AlertTriangleIcon, SparklesIcon } from "../icons";
import { getCharacterImageUrl } from "../../lib/api";
import { getCharaIdFromCardId } from "../../lib/affinity-engine";

type PedigreeFilterTab =
  | "all"
  | "inherit_only"
  | "unique_target"
  | "in_main"
  | "hint"
  | "event"
  | "unique"
  | "factor";

type SlotFilter = "all" | "p1" | "p2";

function rarityBadge(rarity?: number) {
  const meta = getSkillRarityStyle(rarity);
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.badgeClass}`}>
      {meta.badgeLabel}
    </span>
  );
}

function sourceBadge(source: DisplayParentSkill["source"]) {
  switch (source) {
    case "event":
      return (
        <span className="rounded bg-violet-100 dark:bg-violet-950/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800/80">
          Event / Awakening
        </span>
      );
    case "hint":
      return (
        <span className="rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
          Innate
        </span>
      );
    case "unique":
      return (
        <span className="rounded bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
          Parent Unique
        </span>
      );
    case "factor":
      return (
        <span className="rounded bg-sky-100 dark:bg-sky-950/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700">
          Bloodline Factor
        </span>
      );
  }
}

export function PedigreeSkillsSection() {
  const { course, runningStyle, activePvpEvent, mainSkillIdSet } = useDeck();
  const { pedigreeSkills, pedigreeSlots, charaByCardIdMap } = useLineageSkills();

  const [filter, setFilter] = useState<PedigreeFilterTab>("all");
  const [slotFilter, setSlotFilter] = useState<SlotFilter>("all");
  const [rarityFilter, setRarityFilter] = useState<RarityFilterKey>("all");
  const [viewMode, setViewMode] = useState<"parent" | "list">("parent");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("almond_pedigree_view_mode");
      if (stored === "list" || stored === "parent") setViewMode(stored);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("almond_pedigree_view_mode", viewMode);
    } catch {}
  }, [viewMode]);

  const [search, setSearch] = useState("");

  const raceParams = useMemo(() => getPvpRaceParameters(activePvpEvent), [activePvpEvent]);

  // Precompute activation results for all pedigree skills
  const activationMap = useMemo(() => {
    const map = new Map<number, SkillActivationResult>();
    pedigreeSkills.forEach((s) => {
      map.set(s.id, evaluateSkillActivation(s.id, course, runningStyle, raceParams));
    });
    return map;
  }, [pedigreeSkills, course, runningStyle, raceParams]);

  const isSkillUniqueTarget = (s: DisplayParentSkill) => {
    if (s.isDuplicateInMain) return false;
    const act = activationMap.get(s.id);
    return act ? act.activates : true;
  };

  // Counts
  const inheritOnlyCount = useMemo(
    () => pedigreeSkills.filter((s) => s.isInheritOnly).length,
    [pedigreeSkills]
  );
  const uniqueCount = useMemo(
    () => pedigreeSkills.filter((s) => isSkillUniqueTarget(s)).length,
    [pedigreeSkills, activationMap]
  );
  const inMainCount = useMemo(
    () => pedigreeSkills.filter((s) => s.isDuplicateInMain).length,
    [pedigreeSkills]
  );

  // Filtered skills list
  const filteredSkills = useMemo(() => {
    const q = search.trim().toLowerCase();

    return pedigreeSkills.filter((s) => {
      // Slot filter (p1 branch vs p2 branch)
      if (slotFilter === "p1") {
        const hasP1 = s.grants?.some(
          (g) => g.slotLabel?.includes("Parent 1") || g.slotLabel?.includes("P1")
        );
        if (!hasP1) return false;
      } else if (slotFilter === "p2") {
        const hasP2 = s.grants?.some(
          (g) => g.slotLabel?.includes("Parent 2") || g.slotLabel?.includes("P2")
        );
        if (!hasP2) return false;
      }

      // Tab filter
      if (filter === "inherit_only" && !s.isInheritOnly) return false;
      if (filter === "unique_target" && !isSkillUniqueTarget(s)) return false;
      if (filter === "in_main" && !s.isDuplicateInMain) return false;
      if (filter === "hint" && s.source !== "hint") return false;
      if (filter === "event" && s.source !== "event") return false;
      if (filter === "unique" && s.source !== "unique") return false;
      if (filter === "factor" && s.source !== "factor") return false;

      if (!matchesRarityFilter(s.rarity, rarityFilter)) return false;

      if (q && !`${s.nameEn} ${s.nameJp} ${s.descEn ?? ""}`.toLowerCase().includes(q)) {
        return false;
      }

      return true;
    });
  }, [pedigreeSkills, filter, slotFilter, rarityFilter, search, activationMap]);

  const hasConfiguredPedigree = pedigreeSlots.some((s) => Boolean(s.cardId));

  if (!hasConfiguredPedigree) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center bg-zinc-50/50 dark:bg-zinc-900/30">
        <span className="text-3xl mb-2 inline-block">🧬</span>
        <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
          No Pedigree Configured
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
          Choose Parent 1 and Parent 2 above to discover all skills inheritable from their innate kits, awakening levels, training events, uniques, and bloodline factors.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Section Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Pedigree Inheritable Skills
            </h3>
            <span className="rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 text-[11px] font-bold">
              Lineage Pool ({pedigreeSkills.length})
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Skills obtainable from Parents and Grandparents.{" "}
            <span className="font-semibold text-indigo-700 dark:text-indigo-400">
              {inheritOnlyCount} Inherit Only
            </span>{" "}
            (exclusive to Uma lineage, not on any support card) ·{" "}
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              {inMainCount} overlapping
            </span>{" "}
            with Main Deck.
          </p>
        </div>

        {/* Search, Slot Branch Filter & View Mode */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pedigree skills…"
            className="w-36 sm:w-44 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-zinc-400 dark:focus:border-zinc-600 shadow-2xs"
          />

          {/* Slot Branch Toggle */}
          <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 text-xs font-medium shadow-2xs">
            <button
              type="button"
              onClick={() => setSlotFilter("all")}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                slotFilter === "all"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSlotFilter("p1")}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                slotFilter === "p1"
                  ? "bg-emerald-600 text-white font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              P1 Branch
            </button>
            <button
              type="button"
              onClick={() => setSlotFilter("p2")}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                slotFilter === "p2"
                  ? "bg-blue-600 text-white font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              P2 Branch
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 text-xs font-medium shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("parent")}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                viewMode === "parent"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Group by Parent
            </button>
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
          </div>
        </div>
      </div>

      {/* Filter Tabs Row */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
            filter === "all"
              ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 font-semibold"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          All ({pedigreeSkills.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("inherit_only")}
          className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
            filter === "inherit_only"
              ? "bg-indigo-600 text-white font-semibold shadow-xs"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          Inherit Only ({inheritOnlyCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("unique_target")}
          className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
            filter === "unique_target"
              ? "bg-emerald-600 text-white font-semibold"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          Unique Targets ({uniqueCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("in_main")}
          className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
            filter === "in_main"
              ? "bg-amber-600 text-white font-semibold"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          In Main Deck ({inMainCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("hint")}
          className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
            filter === "hint"
              ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 font-semibold"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          Innate
        </button>
        <button
          type="button"
          onClick={() => setFilter("event")}
          className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
            filter === "event"
              ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 font-semibold"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          Awakening / Events
        </button>
        <button
          type="button"
          onClick={() => setFilter("unique")}
          className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
            filter === "unique"
              ? "bg-amber-500 text-white font-semibold"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          Uniques
        </button>
        <button
          type="button"
          onClick={() => setFilter("factor")}
          className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
            filter === "factor"
              ? "bg-sky-600 text-white font-semibold"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          Factors
        </button>
      </div>

      {/* Content: Group by Parent vs Unified List */}
      {filteredSkills.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-zinc-400 dark:text-zinc-500 text-xs">
          No pedigree skills match the current filter or search criteria.
        </div>
      ) : viewMode === "parent" ? (
        <div className="space-y-4">
          {pedigreeSlots.map((slot) => {
            if (!slot.cardId) return null;
            if (slotFilter === "p1" && !slot.tag.startsWith("P1")) return null;
            if (slotFilter === "p2" && !slot.tag.startsWith("P2")) return null;

            const chara = charaByCardIdMap.get(slot.cardId);
            const charaId = chara ? chara.charId : getCharaIdFromCardId(slot.cardId);
            const avatarUrl = getCharacterImageUrl(charaId, slot.cardId);
            const charaName = chara?.nameEn || chara?.nameJp || `${slot.slotLabel} Character`;

            const slotSkills = filteredSkills.filter((s) =>
              s.grants?.some((g) => g.slotLabel === slot.slotLabel)
            );

            const isP1 = slot.tag.startsWith("P1");

            return (
              <div
                key={slot.tag}
                className={`rounded-xl border overflow-hidden shadow-2xs ${
                  isP1
                    ? "border-emerald-200/70 dark:border-emerald-900/50 bg-white dark:bg-zinc-900"
                    : "border-blue-200/70 dark:border-blue-900/50 bg-white dark:bg-zinc-900"
                }`}
              >
                {/* Parent / Grandparent Header */}
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b ${
                    isP1
                      ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40"
                      : "bg-blue-50/40 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-10 w-10 object-contain shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5 border border-zinc-200 dark:border-zinc-700"
                      loading="lazy"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {slot.slotLabel}: {charaName}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                            isP1
                              ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800/80"
                              : "bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-200/80 dark:border-blue-800/80"
                          }`}
                        >
                          {slot.isParent ? "Direct Parent" : "Grandparent"} ({slot.tag})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {slot.isParent
                            ? "Inherits unique skill, innate/awakening, events & bloodline factors"
                            : "Inherits unique skill & bloodline factors"}
                        </span>
                        {chara?.nameJp && (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-700">·</span>
                            <span className="text-[11px] text-zinc-400">{chara.nameJp}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <span
                      className={`rounded-full font-bold px-2.5 py-0.5 text-xs ${
                        isP1
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                      }`}
                    >
                      {slotSkills.length} skills inherited
                    </span>
                  </div>
                </div>

                {/* Skills List */}
                {slotSkills.length === 0 ? (
                  <p className="text-xs text-zinc-400 p-4 text-center">
                    No skills match the current filter for this parent.
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {slotSkills.map((s, idx) => {
                      const isBanned = isSkillBanned(s.id, activePvpEvent);
                      const isDupeInMain = s.isDuplicateInMain ?? mainSkillIdSet.has(s.id);
                      const activation =
                        activationMap.get(s.id) ??
                        evaluateSkillActivation(s.id, course, runningStyle, raceParams);
                      const canActivate = activation.activates;
                      const isUniqueTarget = isSkillUniqueTarget(s);
                      const slotGrant = s.grants?.find((g) => g.slotLabel === slot.slotLabel);
                      const otherGrants =
                        s.grants?.filter((g) => g.slotLabel !== slot.slotLabel) ?? [];
                      const otherGrantsBySlot = otherGrants.reduce<
                        Map<string, {
                          slotLabel: string;
                          slotTag?: string;
                          cardId?: number;
                          charId?: number;
                          avatarUrl?: string;
                          cardName: string;
                          sources: string[];
                        }>
                      >((map, g) => {
                        const key = g.slotTag || g.slotLabel || g.cardName;
                        const existing = map.get(key);
                        if (!existing) {
                          map.set(key, {
                            slotLabel: g.slotLabel || "",
                            slotTag: g.slotTag,
                            cardId: g.cardId,
                            charId: g.charId,
                            avatarUrl: g.avatarUrl,
                            cardName: g.cardName,
                            sources: [g.source],
                          });
                        } else {
                          if (!existing.sources.includes(g.source)) {
                            existing.sources.push(g.source);
                          }
                        }
                        return map;
                      }, new Map());
                      const uniqueOtherGrants = Array.from(otherGrantsBySlot.values());

                      return (
                        <li
                          key={`${slot.tag}-${s.id}-${idx}`}
                          className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 ${
                            isBanned
                              ? "opacity-60 bg-rose-50/20 dark:bg-rose-950/10"
                              : !canActivate
                              ? "opacity-75 bg-zinc-50/40 dark:bg-zinc-900/40"
                              : isDupeInMain
                              ? "bg-amber-50/20 dark:bg-amber-950/10"
                              : ""
                          }`}
                        >
                          {/* Left Column Badges */}
                          <div className="mt-0.5 flex flex-col gap-1 flex-none">
                            {isBanned && (
                              <span
                                className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs text-center"
                                title="Banned by Special Rule"
                              >
                                BANNED
                              </span>
                            )}
                            {rarityBadge(s.rarity)}
                            {sourceBadge(s.source)}
                          </div>

                          {/* Right Column: SkillItem */}
                          <div className="min-w-0 flex-1">
                            <SkillItem
                              skill={{ ...s, cardName: slotGrant ? `Via: ${slotGrant.source}` : s.sourceLabel }}
                              size="sm"
                              isBanned={isBanned}
                              isParentMode={true}
                              trailing={
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {(s.isEvolInherit || slotGrant?.isEvolInherit) && (
                                    <span
                                      className="inline-flex items-center gap-1 rounded bg-purple-100 dark:bg-purple-950/70 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-800"
                                      title="Evolved Inherit: Enhanced succession skill (+0.15 Speed, +0.20 Accel) unlocked via direct Parent"
                                    >
                                      <SparklesIcon className="h-2.5 w-2.5" />
                                      <span>Evolved Inherit</span>
                                    </span>
                                  )}

                                  {(s.evolSkillAvailable || slotGrant?.evolSkillAvailable) && (
                                    <span
                                      className="inline-flex items-center gap-1 rounded bg-violet-100 dark:bg-violet-950/70 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-violet-800 dark:text-violet-200 border border-violet-300 dark:border-violet-800 cursor-help"
                                      title="Evolves to enhanced inherit skill (+0.15 Speed, +0.20 Accel) when placed as direct Parent (P1/P2) and owning this character"
                                    >
                                      <SparklesIcon className="h-2.5 w-2.5" />
                                      <span>Evol Available</span>
                                    </span>
                                  )}

                                  {isUniqueTarget && (
                                    <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
                                      <StarIcon className="h-2.5 w-2.5" />
                                      <span>Unique Target</span>
                                    </span>
                                  )}

                                  {!canActivate && (
                                    <span
                                      className="inline-flex items-center gap-1 rounded bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                                      title={activation.reason || "This skill cannot activate on the selected course or running style"}
                                    >
                                      <AlertTriangleIcon className="h-2.5 w-2.5" />
                                      <span>{activation.reason?.toLowerCase().includes("rank") ? "Rank Trap" : "No Activation"}</span>
                                    </span>
                                  )}

                                  {isDupeInMain && (
                                    <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-amber-950 dark:text-amber-100 border border-amber-400 dark:border-amber-700">
                                      <AlertTriangleIcon className="h-2.5 w-2.5" />
                                      <span>In Main Deck</span>
                                    </span>
                                  )}
                                  {s.isInheritOnly && (
                                    <span
                                      className="inline-flex items-center gap-1 rounded bg-indigo-100 dark:bg-indigo-950/60 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80"
                                      title="Inherit Only: Cannot be obtained from any Support Card in your decks; only inherited from Uma lineage"
                                    >
                                      <span>Inherit Only</span>
                                    </span>
                                  )}
                                </div>
                              }
                            >
                              {s.descEn && (
                                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                                  {s.descEn}
                                </p>
                              )}
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-zinc-400">
                                <span>{s.sourceLabel}</span>
                                {s.originalGoldSkill && (
                                  <span>· via {s.originalGoldSkill.nameEn} (Gold)</span>
                                )}
                                {s.originalUniqueSkill && (
                                  <span>· via {s.originalUniqueSkill.nameEn} (Unique)</span>
                                )}
                                {uniqueOtherGrants.length > 0 && (
                                  <span className="flex items-center gap-1 flex-wrap">
                                    <span>· Also in:</span>
                                    <span className="inline-flex items-center gap-1">
                                      {uniqueOtherGrants.map((g, gIdx) =>
                                        g.avatarUrl ? (
                                          <img
                                            key={gIdx}
                                            src={g.avatarUrl}
                                            alt={g.cardName}
                                            title={`${g.slotLabel}: ${g.cardName} (${g.sources.join(", ")})`}
                                            className="h-4.5 w-4.5 rounded-full object-cover object-top bg-zinc-100 dark:bg-zinc-800 shrink-0 border border-zinc-200 dark:border-zinc-700 shadow-2xs hover:scale-110 hover:border-zinc-400 dark:hover:border-zinc-500 transition-transform cursor-pointer"
                                            loading="lazy"
                                          />
                                        ) : null
                                      )}
                                    </span>
                                  </span>
                                )}
                                <span>·</span>
                                <span>#{s.id}</span>
                              </div>
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
        <ul className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 overflow-hidden shadow-xs divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {filteredSkills.map((s, idx) => {
            const isBanned = isSkillBanned(s.id, activePvpEvent);
            const isDupeInMain = s.isDuplicateInMain ?? mainSkillIdSet.has(s.id);
            const activation = activationMap.get(s.id) ?? evaluateSkillActivation(s.id, course, runningStyle, raceParams);
            const canActivate = activation.activates;
            const isUniqueTarget = isSkillUniqueTarget(s);

            return (
              <li
                key={`${s.id}-${s.source}-${idx}`}
                className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 ${
                  isBanned
                    ? "opacity-60 bg-rose-50/20 dark:bg-rose-950/10"
                    : !canActivate
                    ? "opacity-75 bg-zinc-50/40 dark:bg-zinc-900/40"
                    : isDupeInMain
                    ? "bg-amber-50/20 dark:bg-amber-950/10"
                    : ""
                }`}
              >
                {/* Left Column Badges */}
                <div className="mt-0.5 flex flex-col gap-1 flex-none">
                  {isBanned && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs text-center"
                      title="Banned by Special Rule"
                    >
                      BANNED
                    </span>
                  )}
                  {rarityBadge(s.rarity)}
                  {sourceBadge(s.source)}
                </div>

                {/* Right Column: SkillItem */}
                <div className="min-w-0 flex-1">
                  <SkillItem
                    skill={{ ...s, cardName: s.sourceLabel }}
                    size="sm"
                    isBanned={isBanned}
                    isParentMode={true}
                    trailing={
                      <div className="flex flex-wrap items-center gap-1.5">
                        {s.isEvolInherit && (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-purple-100 dark:bg-purple-950/70 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-800"
                            title="Evolved Inherit: Enhanced succession skill (+0.15 Speed, +0.20 Accel) unlocked via direct Parent"
                          >
                            <SparklesIcon className="h-2.5 w-2.5" />
                            <span>Evolved Inherit</span>
                          </span>
                        )}

                        {s.evolSkillAvailable && (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-violet-100 dark:bg-violet-950/70 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-violet-800 dark:text-violet-200 border border-violet-300 dark:border-violet-800 cursor-help"
                            title="Evolves to enhanced inherit skill (+0.15 Speed, +0.20 Accel) when placed as direct Parent (P1/P2) and owning this character"
                          >
                            <SparklesIcon className="h-2.5 w-2.5" />
                            <span>Evol Available</span>
                          </span>
                        )}

                        {isUniqueTarget && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
                            <StarIcon className="h-2.5 w-2.5" />
                            <span>Unique Target</span>
                          </span>
                        )}

                        {!canActivate && (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                            title={activation.reason || "This skill cannot activate on the selected course or running style"}
                          >
                            <AlertTriangleIcon className="h-2.5 w-2.5" />
                            <span>{activation.reason?.toLowerCase().includes("rank") ? "Rank Trap" : "No Activation"}</span>
                          </span>
                        )}

                        {isDupeInMain && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-amber-950 dark:text-amber-100 border border-amber-400 dark:border-amber-700">
                            <AlertTriangleIcon className="h-2.5 w-2.5" />
                            <span>In Main Deck</span>
                          </span>
                        )}
                        {s.isInheritOnly && (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-indigo-100 dark:bg-indigo-950/60 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80"
                            title="Inherit Only: Cannot be obtained from any Support Card in your decks; only inherited from Uma lineage"
                          >
                            <span>Inherit Only</span>
                          </span>
                        )}
                      </div>
                    }
                  >
                    {s.descEn && (
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                        {s.descEn}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-zinc-400">
                      <span>{s.sourceLabel}</span>
                      {s.originalGoldSkill && (
                        <span>· via {s.originalGoldSkill.nameEn} (Gold)</span>
                      )}
                      {s.originalUniqueSkill && (
                        <span>· via {s.originalUniqueSkill.nameEn} (Unique)</span>
                      )}
                      {s.grants && s.grants.length > 0 && (
                        <span className="flex items-center gap-1 flex-wrap">
                          <span>· Granted by:</span>
                          <span className="inline-flex items-center gap-1.5 flex-wrap">
                            {s.grants.map((g, gIdx) => (
                              <span
                                key={gIdx}
                                className="inline-flex items-center gap-1"
                                title={`${g.slotLabel ?? ""}: ${g.cardName} (${g.source})`}
                              >
                                {g.avatarUrl && (
                                  <img
                                    src={g.avatarUrl}
                                    alt={g.cardName}
                                    className="h-4.5 w-4.5 rounded-full object-cover object-top bg-zinc-100 dark:bg-zinc-800 shrink-0 border border-zinc-200 dark:border-zinc-700 shadow-2xs hover:scale-110 transition-transform cursor-pointer"
                                    loading="lazy"
                                  />
                                )}
                                <span>{g.cardName} ({g.source})</span>
                              </span>
                            ))}
                          </span>
                        </span>
                      )}
                      <span>·</span>
                      <span>#{s.id}</span>
                    </div>
                  </SkillItem>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
