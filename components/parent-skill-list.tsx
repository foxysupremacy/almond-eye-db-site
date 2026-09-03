import { useMemo, useState } from "react";
import { useDeck, type ParentDeckSkill } from "./store";
import {
  matchesRarityFilter,
  getSkillRarityStyle,
  type RarityFilterKey,
} from "../lib/skill-rarity";
import SkillIcon from "./skill-icon";

type FilterTab = "all" | "unique" | "duplicate" | "hint" | "event";

function sourceBadge(source: ParentDeckSkill["source"]) {
  return source === "event" ? (
    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 border border-violet-200/80">
      event
    </span>
  ) : (
    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 border border-emerald-200/80">
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            Parent Skill Pool <span className="text-sm font-normal text-zinc-400">({parentSkills.length})</span>
          </h2>
          <p className="text-sm text-zinc-500">
            {hasParentDeck ? (
              <>
                <span className="font-semibold text-emerald-700">{uniqueCount} new targets</span> to farm ·{" "}
                <span className="font-semibold text-amber-700">{duplicateCount} overlapping</span> with Main Deck.
                <span className="ml-1 text-xs text-zinc-400 font-normal">
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
            className="w-40 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-zinc-400 shadow-2xs"
          />

          {/* Rarity Tabs */}
          <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5 text-xs font-medium shadow-2xs">
            <button
              onClick={() => setRarityFilter("all")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                rarityFilter === "all" ? "bg-zinc-900 text-white font-semibold" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setRarityFilter("white")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                rarityFilter === "white" ? "bg-zinc-800 text-white font-semibold" : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              White ({whiteCount})
            </button>
            <button
              onClick={() => setRarityFilter("gold")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                rarityFilter === "gold"
                  ? "bg-amber-500 text-amber-950 font-bold shadow-2xs"
                  : "text-amber-800 hover:bg-amber-50"
              }`}
            >
              Gold ({goldCount})
            </button>
            <button
              onClick={() => setRarityFilter("unique")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                rarityFilter === "unique"
                  ? "bg-pink-500 text-white font-bold shadow-2xs"
                  : "text-pink-700 hover:bg-pink-50"
              }`}
            >
              Unique ({uniqueRarityCount})
            </button>
            <button
              onClick={() => setRarityFilter("evolved")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                rarityFilter === "evolved"
                  ? "bg-purple-600 text-white font-bold shadow-2xs"
                  : "text-purple-700 hover:bg-purple-50"
              }`}
            >
              Evo ({evolvedCount})
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5 text-xs font-medium shadow-2xs">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                filter === "all" ? "bg-zinc-700 text-white font-semibold" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unique")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                filter === "unique" ? "bg-emerald-700 text-white font-semibold" : "text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              ★ Unique ({uniqueCount})
            </button>
            <button
              onClick={() => setFilter("duplicate")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                filter === "duplicate" ? "bg-amber-700 text-white font-semibold" : "text-amber-700 hover:bg-amber-50"
              }`}
            >
              ⚠ In Main ({duplicateCount})
            </button>
            <button
              onClick={() => setFilter("hint")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                filter === "hint" ? "bg-zinc-700 text-white font-semibold" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              Hints
            </button>
            <button
              onClick={() => setFilter("event")}
              className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                filter === "event" ? "bg-zinc-700 text-white font-semibold" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              Events
            </button>
          </div>
        </div>
      </div>

      {/* Skill List Body */}
      {loading && !hasParentDeck ? (
        <p className="mt-4 text-sm text-zinc-400">Loading cards…</p>
      ) : !hasParentDeck ? (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-400">
          No cards in Parent Deck yet. Add cards above or from recommendations to view the skill pool.
        </div>
      ) : filtered.length === 0 ? (
        (rarityFilter === "unique" || rarityFilter === "evolved") ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-6 text-center">
            <p className="text-sm font-semibold text-zinc-700">
              No {rarityFilter === "unique" ? "Unique" : "Evolved"} Skills in Parent Support Deck
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Unique skills can be inherited directly from Parent characters (separately from deck), not support cards.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-400">No skills match the selected filter.</p>
        )
      ) : (
        <ul className="mt-4 space-y-2">
          {filtered.map((s) => {
            const rStyle = getSkillRarityStyle(s.rarity);
            const mappedGold = s.originalGoldSkill || s.grants?.find((g) => g.originalGoldSkill)?.originalGoldSkill;

            return (
              <li
                key={s.id}
                style={rStyle.bgStyle}
                className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all ${
                  rStyle.borderClass
                } ${s.isDuplicateInMain ? "bg-amber-50/20" : rStyle.bgClass ?? ""}`}
              >
                <div className="mt-0.5 flex flex-col gap-1 flex-none">
                  {rarityBadge(s.rarity)}
                  {sourceBadge(s.source)}
                </div>

                <div className="min-w-0 flex-1">
                  {/* Title & Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <SkillIcon iconId={s.iconId} name={s.nameEn} className="h-5 w-5 rounded object-contain flex-none" />
                      <span className="text-sm font-semibold text-zinc-900">{s.nameEn}</span>
                    </div>
                    <span className="text-xs text-zinc-500">{s.nameJp}</span>

                    {s.isUniqueToParent ? (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 border border-emerald-200/80">
                        ★ Unique Target
                      </span>
                    ) : (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 border border-amber-300">
                        ⚠ In Main Deck
                      </span>
                    )}

                    {s.parentDuplicateCount > 1 && (
                      <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 border border-sky-200">
                        x{s.parentDuplicateCount} in Parent Deck
                      </span>
                    )}

                    {mappedGold && (
                      <span className="rounded bg-amber-100/90 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 border border-amber-300/80" title={`In game, this card grants Gold skill ${mappedGold.nameEn}, which downgrades to ${s.nameEn} for inheritance factor farming.`}>
                        via {mappedGold.nameEn} (Gold)
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {s.descEn && (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-700">{s.descEn}</p>
                  )}

                  {/* Card Attribution */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                    <span>
                      via Parent:{" "}
                      <span className="text-zinc-700 font-medium">
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
                            className="inline-flex items-center gap-1 rounded bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-800 border border-violet-200/80"
                            title={`Event: ${em.eventNameJp} (${em.eventNameEn})\nChoice ${em.choiceIndex}: ${em.choiceTextJp}`}
                          >
                            <span className="font-bold">{eventTitle}</span>
                            <span className="text-violet-400">•</span>
                            <span>
                              Choice {em.choiceIndex}: <span className="font-semibold text-violet-900">{choiceText}</span>
                            </span>
                          </span>
                        );
                      })}

                    {s.isDuplicateInMain && s.mainCardGrants && s.mainCardGrants.length > 0 && (
                      <span className="text-amber-800 font-medium">
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
