"use client";

import { useState, useMemo } from "react";
import { useDeck } from "../store";
import { useLineageSkills, type DisplayParentSkill } from "../../lib/use-lineage-skills";
import { evaluateSkillActivation, type SkillActivationResult } from "../../lib/parenting/skill-evaluator";
import { getPvpRaceParameters, isSkillBanned } from "../../lib/pvp-events";
import { getSkillRarityStyle, matchesRarityFilter, type RarityFilterKey } from "../../lib/skill-rarity";
import SkillHoverCard from "../skill-hover-card";
import SkillIcon from "../skill-icon";
import { StarIcon, AlertTriangleIcon } from "../icons";

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
  const { pedigreeSkills, pedigreeSlots } = useLineageSkills();

  const [filter, setFilter] = useState<PedigreeFilterTab>("all");
  const [slotFilter, setSlotFilter] = useState<SlotFilter>("all");
  const [rarityFilter, setRarityFilter] = useState<RarityFilterKey>("all");
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
            (not in your active Main Deck) ·{" "}
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              {inMainCount} overlapping
            </span>{" "}
            with Main Deck.
          </p>
        </div>

        {/* Search & Slot Branch Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pedigree skills…"
            className="w-40 sm:w-48 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-zinc-400 dark:focus:border-zinc-600 shadow-2xs"
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

      {/* Skills Flat Single Surface (DESIGN.md compliant) */}
      {filteredSkills.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-zinc-400 dark:text-zinc-500 text-xs">
          No pedigree skills match the current filter or search criteria.
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 overflow-hidden shadow-xs divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {filteredSkills.map((s, idx) => {
            const isBanned = isSkillBanned(s.id, activePvpEvent);
            const activation = activationMap.get(s.id) ?? evaluateSkillActivation(s.id, course, runningStyle, raceParams);
            const canActivate = activation.activates;
            const isUniqueTarget = isSkillUniqueTarget(s);
            const rMeta = getSkillRarityStyle(s.rarity);

            return (
              <SkillHoverCard
                key={`${s.id}-${s.source}-${idx}`}
                skillId={s.id}
                fallbackSkill={s}
                isParentMode={true}
                className="w-full text-left"
              >
                <div
                  className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer ${
                    isBanned
                      ? "opacity-60 bg-rose-50/20 dark:bg-rose-950/10"
                      : !canActivate
                      ? "opacity-75 bg-zinc-50/40 dark:bg-zinc-900/40"
                      : s.isDuplicateInMain
                      ? "bg-amber-50/15 dark:bg-amber-950/10"
                      : ""
                  }`}
                >
                  {/* Vertically centered Skill Icon */}
                  <div className="flex-none flex items-center justify-center">
                    <SkillIcon
                      iconId={s.iconId}
                      name={s.nameEn}
                      className="h-7 w-7 object-contain flex-none"
                    />
                  </div>

                  {/* Bilingual 2-line Content + Attribution */}
                  <div className="min-w-0 flex-1 flex flex-col justify-center">
                    {/* Top line: English primary title */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {s.nameEn}
                      </span>
                    </div>

                    {/* Bottom line: Japanese subtitle */}
                    {s.nameJp && (
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal truncate">
                        {s.nameJp}
                      </span>
                    )}

                    {/* Grants Attribution & Sources */}
                    {s.grants && s.grants.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                        <span>Granted by:</span>
                        {s.grants.map((g, gIdx) => (
                          <span
                            key={gIdx}
                            className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 font-medium text-zinc-700 dark:text-zinc-300"
                          >
                            {g.cardName} ({g.source})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Trailing Badges & Status Chips */}
                  <div className="flex-none flex flex-wrap items-center justify-end gap-1.5 max-w-[45%]">
                    {/* Rarity & Source */}
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${rMeta.badgeClass}`}
                    >
                      {rMeta.badgeLabel}
                    </span>
                    {sourceBadge(s.source)}

                    {/* Inherit Only Badge (Indigo) */}
                    {s.isInheritOnly ? (
                      <span
                        className="inline-flex items-center gap-1 rounded bg-indigo-100 dark:bg-indigo-950/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 shadow-2xs"
                        title="Inherit Only: Not provided by any card in your active Main Deck. Only obtainable via Uma inheritance!"
                      >
                        <span>Inherit Only</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-950 dark:text-amber-100 border border-amber-400 dark:border-amber-700"
                        title="Already provided by a card in your active Main Deck"
                      >
                        <AlertTriangleIcon className="h-2.5 w-2.5" />
                        <span>In Main Deck</span>
                      </span>
                    )}

                    {/* Unique Target */}
                    {isUniqueTarget && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
                        <StarIcon className="h-2.5 w-2.5" />
                        <span>Unique Target</span>
                      </span>
                    )}

                    {/* Activation Trap / Warning */}
                    {!canActivate && (
                      <span
                        className="inline-flex items-center gap-1 rounded bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                        title={activation.reason || "This skill cannot activate on the selected course or running style"}
                      >
                        <AlertTriangleIcon className="h-2.5 w-2.5" />
                        <span>
                          {activation.reason?.toLowerCase().includes("style")
                            ? "Style Trap"
                            : activation.reason?.toLowerCase().includes("rank")
                            ? "Rank Trap"
                            : "No Activation"}
                        </span>
                      </span>
                    )}

                    {/* Banned under PvP rules */}
                    {isBanned && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs"
                        title="Banned by PvP special rule (No Debuffs)"
                      >
                        BANNED
                      </span>
                    )}
                  </div>
                </div>
              </SkillHoverCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
