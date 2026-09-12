"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { api, type CharacterIndexEntry, getCharacterImageUrl } from "../lib/api";
import { getAllVeterans, saveVeterans, clearVeterans } from "../lib/db/veterans-db";
import { type KyumaruVeteranItem } from "../lib/kyumaru-types";
import { decodeFactor, calculateLineageBlueStars } from "../lib/factor-decoder";
import { calculateAffinity, getCharaIdFromCardId } from "../lib/affinity-engine";
import { useParentingSetup } from "../lib/parenting-state";
import ImportModal from "./import-modal";

type SortOption = "rank_score" | "affinity" | "speed" | "stamina" | "power" | "blue_stars";

export default function VeteransView() {
  const [veterans, setVeterans] = useState<KyumaruVeteranItem[]>([]);
  const [characters, setCharacters] = useState<CharacterIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("rank_score");
  const [minBlueStars, setMinBlueStars] = useState<number>(0);
  const [, startTransition] = useTransition();
  const { setup, setParent1, setParent2 } = useParentingSetup();

  const loadData = async () => {
    try {
      const [vets, charas] = await Promise.all([getAllVeterans(), api.listCharacters()]);
      setVeterans(vets);
      setCharacters(charas);
    } catch (err) {
      console.error("Failed to load veterans:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      startTransition(() => {
        loadData();
      });
    };

    window.addEventListener("almondeye_veterans_updated", handleUpdate);
    return () => {
      window.removeEventListener("almondeye_veterans_updated", handleUpdate);
    };
  }, []);

  // Character Map for O(1) lookup
  const charaMap = useMemo(() => {
    return new Map<number, CharacterIndexEntry>(characters.map((c) => [c.id, c]));
  }, [characters]);

  const [expandedCharId, setExpandedCharId] = useState<number | null>(null);

  // Group and sort veterans by Uma
  const unifiedVeterans = useMemo(() => {
    const q = query.trim().toLowerCase();

    const groupsMap = new Map<number, KyumaruVeteranItem[]>();
    for (const vet of veterans) {
      const chara = charaMap.get(vet.card_id);
      const charId = getCharaIdFromCardId(vet.card_id);
      const nameEn = (chara?.nameEn || vet.name || "").toLowerCase();
      const nameJp = (chara?.nameJp || "").toLowerCase();
      const titleEn = (chara?.titleEn || "").toLowerCase();

      if (q && !nameEn.includes(q) && !nameJp.includes(q) && !titleEn.includes(q)) {
        continue;
      }

      if (minBlueStars > 0) {
        const lineage = calculateLineageBlueStars(vet);
        if (lineage.total < minBlueStars) continue;
      }

      const list = groupsMap.get(charId) ?? [];
      list.push(vet);
      groupsMap.set(charId, list);
    }

    const groups = Array.from(groupsMap.entries()).map(([charId, runs]) => {
      // Sort runs descending according to active sortBy
      runs.sort((a, b) => {
        if (sortBy === "affinity" && setup.targetCharaId) {
          const aAff = calculateAffinity(a, setup.targetCharaId).total;
          const bAff = calculateAffinity(b, setup.targetCharaId).total;
          return bAff - aAff || (b.rank_score || 0) - (a.rank_score || 0);
        }
        if (sortBy === "blue_stars") {
          const aStars = calculateLineageBlueStars(a).total;
          const bStars = calculateLineageBlueStars(b).total;
          return bStars - aStars || (b.rank_score || 0) - (a.rank_score || 0);
        }
        if (sortBy === "speed") return b.speed - a.speed;
        if (sortBy === "stamina") return b.stamina - a.stamina;
        if (sortBy === "power") return b.power - a.power;
        return (b.rank_score || 0) - (a.rank_score || 0);
      });

      const bestVet = runs[0];
      const chara = charaMap.get(bestVet.card_id);
      const affResult = setup.targetCharaId ? calculateAffinity(bestVet, setup.targetCharaId) : null;
      const maxBlueStars = Math.max(...runs.map((r) => calculateLineageBlueStars(r).total));
      const bestRankScore = Math.max(...runs.map((r) => r.rank_score || 0));

      return {
        charId,
        cardId: bestVet.card_id,
        nameEn: chara?.nameEn || bestVet.name || `Chara ${charId}`,
        nameJp: chara?.nameJp || "",
        titleEn: chara?.titleEn || chara?.titleJp,
        avatarUrl: chara ? getCharacterImageUrl(chara.charId, bestVet.card_id) : "",
        bestVet,
        runs,
        runCount: runs.length,
        maxBlueStars,
        bestRankScore,
        affinity: affResult?.total ?? null,
      };
    });

    groups.sort((a, b) => {
      if (sortBy === "affinity" && setup.targetCharaId) {
        return (b.affinity || 0) - (a.affinity || 0) || b.bestRankScore - a.bestRankScore;
      }
      if (sortBy === "blue_stars") {
        return b.maxBlueStars - a.maxBlueStars || b.bestRankScore - a.bestRankScore;
      }
      if (sortBy === "speed") return b.bestVet.speed - a.bestVet.speed;
      if (sortBy === "stamina") return b.bestVet.stamina - a.bestVet.stamina;
      if (sortBy === "power") return b.bestVet.power - a.bestVet.power;
      return b.bestRankScore - a.bestRankScore;
    });

    return groups;
  }, [veterans, charaMap, query, sortBy, minBlueStars, setup.targetCharaId]);

  // Handle direct file drag & drop into empty view
  const handleFileDrop = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        await saveVeterans(parsed as KyumaruVeteranItem[]);
        loadData();
      } else {
        alert("Expected a valid veterans.json file.");
      }
    } catch (err: any) {
      alert("Failed to read JSON: " + err.message);
    }
  };

  const handleClear = async () => {
    if (confirm("Are you sure you want to clear all uploaded veteran horses?")) {
      await clearVeterans();
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-zinc-400">Loading trained veteran horses from local database...</p>
      </div>
    );
  }

  // 1. Empty State (No Veterans uploaded yet)
  if (veterans.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="text-center mb-8">
          <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-3 py-1 text-xs font-bold uppercase tracking-wider">
            Hall of Fame
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mt-2 mb-1">
            Trained Umas (Veterans)
          </h2>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Upload your <code>veterans.json</code> dump generated by the Kyumaru in-game plugin to track and search your Hall of Fame horses.
          </p>
        </div>

        {/* Drag & Drop Card */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) handleFileDrop(e.dataTransfer.files[0]);
          }}
          className="rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 p-10 text-center shadow-xs hover:border-emerald-500 transition-colors cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 text-3xl shadow-2xs">
            🏆
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">
            Drag & Drop veterans.json here
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
            Located at <code>%USERPROFILE%\Documents\Kyumaru\veterans.json</code> on your PC.
          </p>

          <div className="flex items-center justify-center gap-3">
            <label className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-colors">
              <span>Select File</span>
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileDrop(e.target.files[0]);
                }}
                className="sr-only"
              />
            </label>

            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-medium rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              Open Sync Modal
            </button>
          </div>
        </div>

        {/* Feature Preview Banner */}
        <div className="mt-8 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 p-5 text-left text-xs text-zinc-500 space-y-2">
          <p className="font-semibold text-zinc-800 dark:text-zinc-200">
            What you can do with Trained Umas:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-zinc-600 dark:text-zinc-400">
            <li>Review final stats (Speed, Stamina, Power, Guts, Wit) and evaluation scores.</li>
            <li>Filter by high Blue Stat sparks (3★ Speed / 9★ total blue lineage).</li>
            <li>Inspect acquired skills and inheritance compatibility for future Parent Deck builds.</li>
          </ul>
        </div>

        <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
      </div>
    );
  }

  // 2. Active Roster View
  const highestScore = Math.max(...veterans.map((v) => v.rank_score || 0));

  return (
    <section className="flex flex-col gap-6">
      {/* Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Trained Umas (Hall of Fame)
            </h2>
            <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
              {veterans.length} Horses
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Locally stored veteran characters with complete 44 attributes, lineage, and inheritance sparks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-950/70 shadow-2xs cursor-pointer transition-colors"
          >
            <span>📥 Sync / Upload</span>
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 hover:text-red-500 text-xs font-medium cursor-pointer transition-colors"
            title="Clear all trained umas"
          >
            Clear Roster
          </button>
        </div>
      </div>

      {/* Roster Toolbar & Stats Shelf */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/70 p-3.5 shadow-2xs backdrop-blur-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search */}
          <div className="relative w-full sm:flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search veterans by character name or costume..."
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-hidden focus:border-emerald-500 transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <span className="text-xs text-zinc-400 shrink-0">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full sm:w-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 font-medium cursor-pointer"
            >
              <option value="rank_score">Score (High to Low)</option>
              {setup.targetCharaId && (
                <option value="affinity">Compatibility Affinity (High to Low)</option>
              )}
              <option value="blue_stars">Lineage Blue Stars (High to Low)</option>
              <option value="speed">Speed (High to Low)</option>
              <option value="stamina">Stamina (High to Low)</option>
              <option value="power">Power (High to Low)</option>
            </select>
          </div>

          {/* Blue Stars Filter */}
          <div className="flex items-center gap-1 shrink-0 overflow-x-auto">
            <span className="text-xs text-zinc-400 mr-1">Lineage Blue:</span>
            {([0, 3, 6, 8, 9] as const).map((stars) => (
              <button
                key={stars}
                type="button"
                onClick={() => setMinBlueStars(stars)}
                className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  minBlueStars === stars
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {stars === 0 ? "All" : `${stars}★+`}
              </button>
            ))}
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
          <span>
            Showing <strong>{unifiedVeterans.length}</strong> Umas ({veterans.length} Total Runs)
          </span>
          <span>
            Top Evaluation:{" "}
            <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
              {highestScore.toLocaleString()} pts
            </strong>
          </span>
        </div>
      </div>

      {/* Veterans Grid */}
      {unifiedVeterans.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center text-zinc-500">
          No trained umas matched your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {unifiedVeterans.map((group) => {
            const vet = group.bestVet;
            const charId = group.charId;
            const chara = charaMap.get(vet.card_id);
            const avatarUrl = group.avatarUrl;
            const lineageStars = calculateLineageBlueStars(vet);
            const isExpanded = expandedCharId === charId;

            // Decode self blue and pink factors
            const selfFactors = (vet.factor_info_array || []).map((f) => decodeFactor(f.factor_id));
            const blueFactor = selfFactors.find((f) => f.type === "blue");
            const pinkFactor = selfFactors.find((f) => f.type === "pink");

            const rankPadded = String(vet.rank || 0).padStart(2, "0");
            const rankIconSrc = `/assets/statusrank/utx_ico_statusrank_${rankPadded}.png`;

            return (
              <div
                key={charId}
                className={`flex flex-col justify-between rounded-2xl border transition-all ${
                  isExpanded
                    ? "border-emerald-500/80 bg-emerald-50/10 dark:bg-emerald-950/15 shadow-md"
                    : "border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/90 shadow-2xs hover:shadow-xs"
                } p-4`}
              >
                <div>
                  {/* Upper Row: Avatar + Name + Rank Badge */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={group.nameEn}
                          className="h-full w-full object-contain filter drop-shadow-xs"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl">
                          🐎
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 justify-between">
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {group.nameEn}
                        </h4>
                        {group.runCount > 1 && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                            {group.runCount} Runs
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                        {group.titleEn || `Costume ${group.cardId}`}
                      </p>

                      <div className="flex items-center gap-1.5 mt-1">
                        <img
                          src={rankIconSrc}
                          alt={`Rank ${vet.rank}`}
                          className="h-4 w-auto object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                        <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                          {vet.rank_score?.toLocaleString()} pts
                        </span>
                        {group.affinity !== null && (
                          <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            +{group.affinity} Aff
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 5 Stats Display */}
                  <div className="grid grid-cols-5 gap-1.5 mb-3 text-center bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div>
                      <div className="text-[10px] text-zinc-400 uppercase font-bold">SPD</div>
                      <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        {vet.speed}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-400 uppercase font-bold">STA</div>
                      <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        {vet.stamina}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-400 uppercase font-bold">PWR</div>
                      <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        {vet.power}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-400 uppercase font-bold">GUT</div>
                      <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        {vet.guts}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-400 uppercase font-bold">WIT</div>
                      <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        {vet.wiz}
                      </div>
                    </div>
                  </div>

                  {/* Sparks & Factors Summary */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {/* Lineage Blue Stars */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                      <span>🔵</span>
                      <span>{lineageStars.total}★ Blue Lineage</span>
                    </span>

                    {/* Self Blue Factor */}
                    {blueFactor && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        <span>{blueFactor.name}</span>
                        <span className="text-blue-500 font-bold">{"★".repeat(blueFactor.stars)}</span>
                      </span>
                    )}

                    {/* Self Pink Factor */}
                    {pinkFactor && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-pink-500/10 text-pink-700 dark:text-pink-300 border border-pink-500/20">
                        <span>🌸 {pinkFactor.name}</span>
                        <span className="font-bold">{"★".repeat(pinkFactor.stars)}</span>
                      </span>
                    )}

                    {/* Learned Skills Count */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 ml-auto">
                      {vet.skill_array?.length || 0} Skills
                    </span>
                  </div>
                </div>

                {/* Footer / Lineage Info & Quick Assign */}
                <div className="pt-2 mt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span>Parent Blue: {lineageStars.parents}★</span>
                    <span>Self Blue: {lineageStars.self}★</span>
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    {group.runCount > 1 && (
                      <button
                        type="button"
                        onClick={() => setExpandedCharId(isExpanded ? null : charId)}
                        className="px-2 py-0.5 rounded-md font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                      >
                        {isExpanded ? "▲ Hide Runs" : `▼ ${group.runCount} Runs`}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setParent1(vet);
                        alert(`Assigned ${group.nameEn} as Parent 1 in Parenting Hub!`);
                      }}
                      className="px-2 py-0.5 rounded-md font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 cursor-pointer transition-colors"
                      title="Set as Parent 1 in Parenting"
                    >
                      + P1
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setParent2(vet);
                        alert(`Assigned ${group.nameEn} as Parent 2 in Parenting Hub!`);
                      }}
                      className="px-2 py-0.5 rounded-md font-bold bg-pink-500/10 hover:bg-pink-500/20 text-pink-700 dark:text-pink-300 border border-pink-500/30 cursor-pointer transition-colors"
                      title="Set as Parent 2 in Parenting"
                    >
                      + P2
                    </button>
                  </div>
                </div>

                {/* Expandable Accordion: All Runs for this Uma */}
                {isExpanded && group.runCount > 1 && (
                  <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-2 animate-in fade-in duration-200 ease-out-quart">
                    <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                      All {group.runCount} Training Runs for {group.nameEn}:
                    </p>
                    <div className="flex flex-col gap-2">
                      {group.runs.map((run, idx) => {
                        const runLineage = calculateLineageBlueStars(run);
                        const runFactors = (run.factor_info_array || []).map((f) => decodeFactor(f.factor_id));
                        const runBlue = runFactors.find((f) => f.type === "blue");
                        const runPink = runFactors.find((f) => f.type === "pink");
                        const runRankPadded = String(run.rank || 0).padStart(2, "0");
                        const runRankIcon = `/assets/statusrank/utx_ico_statusrank_${runRankPadded}.png`;

                        return (
                          <div
                            key={run.trained_chara_id || idx}
                            className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between gap-1 text-[11px]">
                              <div className="flex items-center gap-1.5 font-bold text-zinc-700 dark:text-zinc-300">
                                <span>Run #{idx + 1}</span>
                                {idx === 0 && (
                                  <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400">
                                    (Top Run)
                                  </span>
                                )}
                                <div className="flex items-center gap-1 ml-1">
                                  <img
                                    src={runRankIcon}
                                    alt={`Rank ${run.rank}`}
                                    className="h-3.5 w-auto object-contain"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                  <span>{run.rank_score?.toLocaleString()} pts</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setParent1(run);
                                    alert(`Assigned ${group.nameEn} (Run #${idx + 1}) as Parent 1!`);
                                  }}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/25 text-blue-700 dark:text-blue-300 border border-blue-500/25 cursor-pointer"
                                >
                                  + P1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setParent2(run);
                                    alert(`Assigned ${group.nameEn} (Run #${idx + 1}) as Parent 2!`);
                                  }}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-500/10 hover:bg-pink-500/25 text-pink-700 dark:text-pink-300 border border-pink-500/25 cursor-pointer"
                                >
                                  + P2
                                </button>
                              </div>
                            </div>

                            {/* Run stats mini strip */}
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                              <span>S:{run.speed}</span>
                              <span>St:{run.stamina}</span>
                              <span>P:{run.power}</span>
                              <span>G:{run.guts}</span>
                              <span>W:{run.wiz}</span>
                              <span className="ml-auto font-bold text-blue-600 dark:text-blue-400">
                                🔵 {runLineage.total}★
                              </span>
                              {runBlue && <span>{runBlue.name} {runBlue.stars}★</span>}
                              {runPink && <span className="text-pink-600 dark:text-pink-400">🌸 {runPink.name}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Import Modal */}
      <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
    </section>
  );
}
