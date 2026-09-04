import { useMemo, useState } from "react";
import { useDeck, type ParentDeckSkill } from "./store";
import {
  matchesRarityFilter,
  getSkillRarityStyle,
  type RarityFilterKey,
} from "../lib/skill-rarity";
import SkillIcon from "./skill-icon";
import SkillHoverCard from "./skill-hover-card";

type FilterTab = "all" | "unique" | "duplicate" | "hint" | "event";

function sourceBadge(source: ParentDeckSkill["source"]) {
  return source === "event" ? (
    <span className="rounded bg-violet-100 dark:bg-violet-950/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800/80">
      event
    </span>
  ) : (
    <span className="rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
      hint
    </span>
  );
}

function rarityBadge(rarity?: number) {
  const meta = getSkillRarityStyle(rarity);
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.badgeClass}`}>
      {meta.badgeLabel}
    </span>
  );
}

export default function ParentSkillList() {
  const { parentSkills, parentSlots, loading } = useDeck();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [rarityFilter, setRarityFilter] = useState<RarityFilterKey>("all");
  const [search, setSearch] = useState("");

  const hasParentDeck = parentSlots.some(Boolean);

  const uniqueCount = useMemo(() => parentSkills.filter((s) => s.isUniqueToParent).length, [parentSkills]);
  const duplicateCount = useMemo(() => parentSkills.filter((s) => s.isDuplicateInMain).length, [parentSkills]);

  const whiteCount = useMemo(() => parentSkills.filter((s) => (s.rarity ?? 1) === 1).length, [parentSkills]);
  const goldCount = useMemo(() => parentSkills.filter((s) => s.rarity === 2).length, [parentSkills]);
  const uniqueRarityCount = useMemo(() => parentSkills.filter((s) => [3, 4, 5].includes(s.rarity)).length, [parentSkills]);
  const evolvedCount = useMemo(() => parentSkills.filter((s) => s.rarity === 6).length, [parentSkills]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parentSkills.filter((s) => {
      if (filter === "unique" && !s.isUniqueToParent) return false;
      if (filter === "duplicate" && !s.isDuplicateInMain) return false;
      if (filter === "hint" && s.source !== "hint") return false;
      if (filter === "event" && s.source !== "event") return false;

      if (!matchesRarityFilter(s.rarity, rarityFilter)) return false;

      if (q && !`${s.nameEn} ${s.nameJp} ${s.descEn ?? ""}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [parentSkills, filter, rarityFilter, search]);

  return (
    <section className="mt-8">
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Parent Skill Pool <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500">({parentSkills.length})</span>
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {hasParentDeck ? (
              <>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">{uniqueCount} new targets</span> to farm ·{" "}
                <span className="font-semibold text-amber-700 dark:text-amber-400">{duplicateCount} overlapping</span> with Main Deck.
                <span className="ml-1 text-xs text-zinc-400 dark:text-zinc-500 font-normal">
                  (Only inheritable White skills shown; Gold event skills mapped to white factor)
                </span>
              </>
            ) : (
              "Add cards to the Parent Deck to compare and inspect granted skills."
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills…"
            className="w-36 sm:w-44 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-zinc-400 dark:focus:border-zinc-600 shadow-2xs"
          />

          {/* Rarity Tabs */}
          <div className="flex overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 text-xs font-medium shadow-2xs scrollbar-none">
            <button
              onClick={() => setRarityFilter("all")}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer whitespace-nowrap ${
                rarityFilter === "all"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              All
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
              Unique ({uniqueRarityCount})
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

          {/* Filter Tabs */}
          <div className="flex overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 text-xs font-medium shadow-2xs scrollbar-none">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer whitespace-nowrap ${
                filter === "all"
                  ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unique")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer whitespace-nowrap ${
                filter === "unique"
                  ? "bg-emerald-700 text-white font-semibold"
                  : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              }`}
            >
              ★ Unique ({uniqueCount})
            </button>
            <button
              onClick={() => setFilter("duplicate")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer whitespace-nowrap ${
                filter === "duplicate"
                  ? "bg-amber-700 text-white font-semibold"
                  : "text-amber-950 dark:text-amber-100 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 font-medium"
              }`}
            >
              ⚠ In Main ({duplicateCount})
            </button>
            <button
              onClick={() => setFilter("hint")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer whitespace-nowrap ${
                filter === "hint"
                  ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Hints
            </button>
            <button
              onClick={() => setFilter("event")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer whitespace-nowrap ${
                filter === "event"
                  ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Events
            </button>
          </div>
        </div>
      </div>

      {/* Skill List Body */}
      {loading && !hasParentDeck ? (
        <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">Loading cards…</p>
      ) : !hasParentDeck ? (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-zinc-400 dark:text-zinc-500">
          No cards in Parent Deck yet. Add cards above or from recommendations to view the skill pool.
        </div>
      ) : filtered.length === 0 ? (
        (rarityFilter === "unique" || rarityFilter === "evolved") ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30 p-6 text-center">
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              No {rarityFilter === "unique" ? "Unique" : "Evolved"} Skills in Parent Support Deck
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Unique skills can be inherited directly from Parent characters (separately from deck), not support cards.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">No skills match the selected filter.</p>
        )
      ) : (
        <ul className="mt-4 space-y-2">
          {filtered.map((s) => {
            const rStyle = getSkillRarityStyle(s.rarity);
            const mappedGold = s.originalGoldSkill || s.grants?.find((g) => g.originalGoldSkill)?.originalGoldSkill;

            return (
              <li
                key={s.id}
                className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all ${
                  rStyle.borderClass
                } ${s.isDuplicateInMain ? "bg-amber-50/20 dark:bg-amber-950/10" : rStyle.bgClass ?? ""}`}
              >
                <div className="mt-0.5 flex flex-col gap-1 flex-none">
                  {rarityBadge(s.rarity)}
                  {sourceBadge(s.source)}
                </div>

                <div className="min-w-0 flex-1">
                  {/* Title & Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <SkillHoverCard
                      skillId={s.id}
                      fallbackSkill={s}
                      cardName={s.cardName}
                      className="group inline-flex items-center gap-1.5 min-w-0 cursor-pointer"
                    >
                      <SkillIcon iconId={s.iconId} name={s.nameEn} className="h-5 w-5 object-contain flex-none" />
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                        {s.nameEn}
                      </span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity">
                        ↗
                      </span>
                    </SkillHoverCard>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{s.nameJp}</span>

                    {s.isUniqueToParent ? (
                      <span className="rounded bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
                        ★ Unique Target
                      </span>
                    ) : (
                      <span className="rounded bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-950 dark:text-amber-100 border border-amber-400 dark:border-amber-700">
                        ⚠ In Main Deck
                      </span>
                    )}

                    {s.parentDuplicateCount > 1 && (
                      <span className="rounded bg-sky-50 dark:bg-sky-950/50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                        x{s.parentDuplicateCount} in Parent Deck
                      </span>
                    )}

                    {mappedGold && (
                      <span className="rounded bg-amber-200/90 dark:bg-amber-950/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-950 dark:text-amber-100 border border-amber-400/80 dark:border-amber-700" title={`In game, this card grants Gold skill ${mappedGold.nameEn}, which downgrades to ${s.nameEn} for inheritance factor farming.`}>
                        via {mappedGold.nameEn} (Gold)
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {s.descEn && (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-700 dark:text-zinc-300">{s.descEn}</p>
                  )}

                  {/* Card Attribution */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span>
                      via Parent:{" "}
                      <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                        {s.grants && s.grants.length > 1
                          ? s.grants.map((g) => `${g.cardName} (${g.source})`).join(", ")
                          : s.cardName}
                      </span>
                    </span>

                    {/* Event Choice Guidance */}
                    {s.grants
                      ?.filter((g) => g.eventMeta)
                      .map((g, idx) => {
                        const em = g.eventMeta!;
                        const eventTitle = em.eventNameEn || em.eventNameJp;
                        const choiceText = em.choiceTextEn || em.choiceTextJp;
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded bg-violet-50 dark:bg-violet-950/50 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800/80"
                            title={`Event: ${em.eventNameJp} (${em.eventNameEn})\nChoice ${em.choiceIndex}: ${em.choiceTextJp}`}
                          >
                            <span className="font-bold">{eventTitle}</span>
                            <span className="text-violet-400 dark:text-violet-600">•</span>
                            <span>
                              Choice {em.choiceIndex}: <span className="font-semibold text-violet-900 dark:text-violet-200">{choiceText}</span>
                            </span>
                          </span>
                        );
                      })}

                    {s.isDuplicateInMain && s.mainCardGrants && s.mainCardGrants.length > 0 && (
                      <span className="text-amber-950 dark:text-amber-200 font-medium">
                        (Also in Main: {s.mainCardGrants.map((g) => g.cardName).join(", ")})
                      </span>
                    )}

                    <span>· #{s.id}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
