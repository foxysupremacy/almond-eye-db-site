import { useMemo, useState } from "react";
import { useDeck, RUNNING_STYLE_OPTIONS, type DeckSkill } from "./store";
import {
  matchesRarityFilter,
  getSkillRarityStyle,
  type RarityFilterKey,
} from "../lib/skill-rarity";
import SkillIcon from "./skill-icon";
import SkillHoverCard from "./skill-hover-card";

function sourceBadge(source: DeckSkill["source"]) {
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

export default function SkillList() {
  const { skills, slots, loading, runningStyle, setRunningStyle } = useDeck();
  const [sourceFilter, setSourceFilter] = useState<"all" | "event" | "hint">("all");
  const [rarityFilter, setRarityFilter] = useState<RarityFilterKey>("all");
  const [search, setSearch] = useState("");

  const whiteCount = useMemo(() => skills.filter((s) => (s.rarity ?? 1) === 1).length, [skills]);
  const goldCount = useMemo(() => skills.filter((s) => s.rarity === 2).length, [skills]);
  const uniqueCount = useMemo(() => skills.filter((s) => [3, 4, 5].includes(s.rarity)).length, [skills]);
  const evolvedCount = useMemo(() => skills.filter((s) => s.rarity === 6).length, [skills]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return skills.filter((s) => {
      if (sourceFilter !== "all" && s.source !== sourceFilter) return false;
      if (!matchesRarityFilter(s.rarity, rarityFilter)) return false;
      if (q && !`${s.nameEn} ${s.nameJp} ${s.descEn ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [skills, sourceFilter, rarityFilter, search]);

  const hasDeck = slots.some(Boolean);

  return (
    <section className="mt-8">
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Skills <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500">({skills.length})</span>
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
              All ({skills.length})
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
        </div>
      </div>

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
      ) : (
        <ul className="mt-4 space-y-2">
          {filtered.map((s) => {
            const rStyle = getSkillRarityStyle(s.rarity);
            return (
              <li
                key={s.id}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${
                  rStyle.borderClass
                } ${rStyle.bgClass ?? ""}`}
              >
                <div className="mt-0.5 flex flex-col gap-1 flex-none">
                  {rarityBadge(s.rarity)}
                  {sourceBadge(s.source)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
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
                  </div>
                  {s.descEn && (
                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-zinc-700 dark:text-zinc-300">{s.descEn}</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span>
                      via{" "}
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {s.grants && s.grants.length > 1
                          ? s.grants.map((g) => `${g.cardName} (${g.source})`).join(", ")
                          : s.cardName}
                      </span>
                    </span>

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
