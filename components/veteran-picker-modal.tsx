"use client";

import { useState, useMemo, useEffect } from "react";
import { type CharacterIndexEntry, getCharacterImageUrl } from "../lib/api";
import type { KyumaruVeteranItem } from "../lib/kyumaru-types";
import {
  calculateAffinity,
  getCharaIdFromCardId,
} from "../lib/affinity-engine";
import { decodeFactor, calculateLineageBlueStars } from "../lib/factor-decoder";
import type { LegacyCandidate } from "../lib/parenting";
import { PickerSearchBar } from "./shared/picker-search-bar";

export interface PickerRecommendations {
  owned: LegacyCandidate[];
  borrow: LegacyCandidate[];
  /** True when the run's single friend-borrow slot is already occupied. */
  borrowUsed: boolean;
  /** Which training run this slot belongs to, e.g. "P1 training run". */
  runLabel?: string;
  /** e.g. "with P1 — Special Week" for grandparent slots. */
  contextNote?: string;
}

interface VeteranPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVeteran: (vet: KyumaruVeteranItem) => void;
  onSelectCharacterTemplate?: (chara: CharacterIndexEntry) => void;
  onSelectCandidate?: (candidate: LegacyCandidate) => void;
  recommendations?: PickerRecommendations;
  targetCharaId: number | null;
  excludedCharId?: number | null;
  slotLabel: string;
  veterans: KyumaruVeteranItem[];
  characters: CharacterIndexEntry[];
  initialTab?: "recommended" | "veterans" | "templates";
}

type PickerTab = "recommended" | "veterans" | "templates";
type SortBy = "affinity" | "rank_score" | "blue_stars";

const TIER_CHIP_CLASSES: Record<string, string> = {
  "S+": "bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-400/50",
  S: "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-400/50",
  A: "bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-400/50",
  B: "bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border-sky-400/50",
  C: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700",
  D: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500 border-zinc-300 dark:border-zinc-700",
  F: "bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border-red-400/50",
};

function RecommendedRow({
  rank,
  candidate,
  isBorrow,
  borrowUsed,
  onSelect,
}: {
  rank: number;
  candidate: LegacyCandidate;
  isBorrow: boolean;
  borrowUsed: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-400/60 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 cursor-pointer transition-colors group"
    >
      <span className="w-5 text-right text-xs font-black text-zinc-400 shrink-0">{rank}.</span>

      <img
        src={getCharacterImageUrl(candidate.charId, candidate.cardId, "01")}
        alt={candidate.nameEn}
        className="w-9 h-9 rounded-full object-cover object-top bg-zinc-100 dark:bg-zinc-800 shrink-0 border border-zinc-200 dark:border-zinc-700"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
            {candidate.nameEn}
          </span>
          {isBorrow ? (
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                borrowUsed
                  ? "bg-zinc-400/60 text-white"
                  : "bg-amber-500/90 text-white"
              }`}
            >
              Borrow
            </span>
          ) : candidate.isUntrained ? (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/90 text-white shrink-0"
              title="Owned but not yet trained — train this Uma to use it here (no borrow needed)"
            >
              Untrained
            </span>
          ) : (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white shrink-0"
              title="Imported Hall of Fame veteran"
            >
              HoF{candidate.blueStarsTotal ? ` · ${candidate.blueStarsTotal}★` : ""}
            </span>
          )}
          {candidate.uniqueEval && (
            <span
              className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border shrink-0 ${
                TIER_CHIP_CLASSES[candidate.uniqueEval.tier] ?? TIER_CHIP_CLASSES.C
              }`}
              title={candidate.uniqueEval.explanation}
            >
              {candidate.uniqueEval.tier}
            </span>
          )}
        </div>
        {candidate.reasons.length > 0 && (
          <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
            {candidate.reasons.join(" · ")}
          </span>
        )}
        {isBorrow && borrowUsed && (
          <span className="block text-[10px] font-bold text-amber-600 dark:text-amber-400">
            ⚠ This run's friend borrow is already used
          </span>
        )}
      </div>

      <span className="text-base font-black text-amber-600 dark:text-amber-400 tabular-nums shrink-0">
        {candidate.totalScore}
      </span>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className="text-[10px] font-bold px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 group-hover:bg-emerald-600 group-hover:text-white shrink-0 cursor-pointer transition-colors"
      >
        Select →
      </button>
    </div>
  );
}

function RecommendedTabContent({
  recommendations,
  onSelect,
}: {
  recommendations: PickerRecommendations;
  onSelect: (candidate: LegacyCandidate) => void;
}) {
  const { owned, borrow, borrowUsed, runLabel, contextNote } = recommendations;

  const borrowBadgeLabel = borrowUsed
    ? `1/1 borrow used${runLabel ? ` · ${runLabel}` : ""}`
    : `1 borrow available${runLabel ? ` · ${runLabel}` : ""}`;

  if (owned.length === 0 && borrow.length === 0) {
    return (
      <div className="py-16 text-center text-xs text-zinc-500">
        No recommended candidates. All characters may be filtered out by the track/style rule.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {contextNote && (
        <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2.5 py-1.5">
          {contextNote}
        </p>
      )}

      <section>
        <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
          Your Umas <span className="text-zinc-400 font-medium">({owned.length})</span>
        </h4>
        {owned.length === 0 ? (
          <p className="text-[11px] text-zinc-400 px-1 py-1.5">
            No imported veterans or promising untrained Umas for this slot. Use a friend borrow below.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {owned.map((c, i) => (
              <RecommendedRow
                key={c.charId}
                rank={i + 1}
                candidate={c}
                isBorrow={false}
                borrowUsed={false}
                onSelect={() => onSelect(c)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-1.5">
          <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
            Friend Borrow <span className="text-zinc-400 font-medium">({borrow.length})</span>
          </h4>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              borrowUsed
                ? "bg-zinc-400/60 text-white"
                : "bg-amber-500/90 text-white"
            }`}
          >
            {borrowBadgeLabel}
          </span>
        </div>
        {borrow.length === 0 ? (
          <p className="text-[11px] text-zinc-400 px-1 py-1.5">
            No borrow candidates with affinity data for this slot.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {borrow.map((c, i) => (
              <RecommendedRow
                key={c.charId}
                rank={i + 1}
                candidate={c}
                isBorrow
                borrowUsed={borrowUsed}
                onSelect={() => onSelect(c)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function VeteranPickerModal({
  isOpen,
  onClose,
  onSelectVeteran,
  onSelectCharacterTemplate,
  onSelectCandidate,
  recommendations,
  targetCharaId,
  excludedCharId,
  slotLabel,
  veterans,
  characters,
  initialTab,
}: VeteranPickerModalProps) {
  const [activeTab, setActiveTab] = useState<PickerTab>(
    initialTab || (recommendations ? "recommended" : "veterans")
  );

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || (recommendations ? "recommended" : "veterans"));
    }
  }, [initialTab, isOpen, recommendations]);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("affinity");
  const [expandedCharId, setExpandedCharId] = useState<number | null>(null);

  const charaMap = useMemo(() => {
    return new Map<number, CharacterIndexEntry>(characters.map((c) => [c.id, c]));
  }, [characters]);

  // Group and sort Veterans by Uma
  const unifiedVeterans = useMemo(() => {
    const q = search.trim().toLowerCase();

    // 1. Group by charId
    const groupsMap = new Map<number, KyumaruVeteranItem[]>();
    for (const vet of veterans) {
      const charId = getCharaIdFromCardId(vet.card_id);
      // In-game rule: cannot duplicate target trainee or the other parent
      if (targetCharaId && charId === targetCharaId) continue;
      if (excludedCharId && charId === excludedCharId) continue;

      const chara = charaMap.get(vet.card_id);
      const nameEn = (chara?.nameEn || vet.name || "").toLowerCase();
      const nameJp = (chara?.nameJp || "").toLowerCase();
      const titleEn = (chara?.titleEn || "").toLowerCase();

      if (q && !nameEn.includes(q) && !nameJp.includes(q) && !titleEn.includes(q)) {
        continue;
      }

      const list = groupsMap.get(charId) ?? [];
      list.push(vet);
      groupsMap.set(charId, list);
    }

    // 2. Build unified structures
    const groups = Array.from(groupsMap.entries()).map(([charId, runs]) => {
      // Sort runs descending: best blue stars, then rank score
      runs.sort((a, b) => {
        const aStars = calculateLineageBlueStars(a).total;
        const bStars = calculateLineageBlueStars(b).total;
        return bStars - aStars || (b.rank_score || 0) - (a.rank_score || 0);
      });

      const bestVet = runs[0];
      const chara = charaMap.get(bestVet.card_id);
      const affResult = targetCharaId ? calculateAffinity(bestVet, targetCharaId) : null;
      const maxBlueStars = Math.max(...runs.map((r) => calculateLineageBlueStars(r).total));
      const bestRankScore = Math.max(...runs.map((r) => r.rank_score || 0));

      return {
        charId,
        cardId: bestVet.card_id,
        nameEn: chara?.nameEn || bestVet.name || `Chara ${charId}`,
        nameJp: chara?.nameJp || "",
        titleEn: chara?.titleEn || chara?.titleJp,
        avatarUrl: getCharacterImageUrl(charId, bestVet.card_id),
        bestVet,
        runs,
        runCount: runs.length,
        maxBlueStars,
        bestRankScore,
        affinity: affResult?.total ?? null,
      };
    });

    // 3. Sort groups
    groups.sort((a, b) => {
      if (sortBy === "affinity" && targetCharaId) {
        return (b.affinity || 0) - (a.affinity || 0) || b.bestRankScore - a.bestRankScore;
      }
      if (sortBy === "blue_stars") {
        return b.maxBlueStars - a.maxBlueStars || b.bestRankScore - a.bestRankScore;
      }
      return b.bestRankScore - a.bestRankScore;
    });

    return groups;
  }, [veterans, charaMap, search, sortBy, targetCharaId, excludedCharId]);

  // Filter Character Templates
  const processedTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = characters.filter((c) => {
      if (targetCharaId && c.charId === targetCharaId) return false;
      if (excludedCharId && c.charId === excludedCharId) return false;

      const nameEn = (c.nameEn || "").toLowerCase();
      const nameJp = (c.nameJp || "").toLowerCase();
      const titleEn = (c.titleEn || "").toLowerCase();

      if (q && !nameEn.includes(q) && !nameJp.includes(q) && !titleEn.includes(q)) {
        return false;
      }
      return true;
    });

    if (sortBy === "affinity" && targetCharaId) {
      list.sort((a, b) => {
        const aAff = calculateAffinity({ card_id: a.id }, targetCharaId).total;
        const bAff = calculateAffinity({ card_id: b.id }, targetCharaId).total;
        return bAff - aAff;
      });
    }

    return list;
  }, [characters, search, sortBy, targetCharaId, excludedCharId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="flex flex-col w-full max-w-3xl max-h-[85vh] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Select {slotLabel}
              </h3>
              <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                {activeTab === "veterans" ? `${unifiedVeterans.length} Umas (${veterans.length} Runs)` : `${processedTemplates.length} Characters`}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {targetCharaId
                ? "Sorted by compatibility affinity with the selected Trainee."
                : "Select a horse from your Hall of Fame or character roster."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Source Tabs & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/40">
          <div className="flex items-center gap-1.5 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60 p-1">
            {recommendations && (
              <button
                type="button"
                onClick={() => setActiveTab("recommended")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === "recommended"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                ⭐ Recommended
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("veterans")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === "veterans"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              My Hall of Fame ({veterans.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("templates")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === "templates"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              All Character Templates
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <PickerSearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by name..."
              inputClassName="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-zinc-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 cursor-pointer"
            >
              <option value="affinity" disabled={!targetCharaId}>
                Compatibility Affinity
              </option>
              <option value="rank_score">Evaluation Score</option>
              <option value="blue_stars">Lineage Blue Stars</option>
            </select>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "recommended" && recommendations ? (
            <RecommendedTabContent
              recommendations={recommendations}
              onSelect={(candidate) => {
                if (onSelectCandidate) {
                  onSelectCandidate(candidate);
                  onClose();
                }
              }}
            />
          ) : activeTab === "veterans" ? (
            unifiedVeterans.length === 0 ? (
              <div className="py-16 text-center text-xs text-zinc-500">
                No veterans match the search or criteria.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {unifiedVeterans.map((group) => {
                  const vet = group.bestVet;
                  const charId = group.charId;
                  const avatarUrl = group.avatarUrl;
                  const lineage = calculateLineageBlueStars(vet);
                  const selfFactors = (vet.factor_info_array || []).map((f) => decodeFactor(f.factor_id));
                  const blueFactor = selfFactors.find((f) => f.type === "blue");
                  const pinkFactor = selfFactors.find((f) => f.type === "pink");
                  const rankPadded = String(vet.rank || 0).padStart(2, "0");
                  const rankIconSrc = `/assets/statusrank/utx_ico_statusrank_${rankPadded}.png`;
                  const isExpanded = expandedCharId === charId;

                  return (
                    <div
                      key={charId}
                      className={`rounded-2xl border transition-all ${
                        isExpanded
                          ? "border-emerald-500/80 bg-emerald-50/15 dark:bg-emerald-950/15 shadow-sm"
                          : "border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-2xs"
                      }`}
                    >
                      {/* Primary Uma Header Card */}
                      <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                            <img
                              src={avatarUrl}
                              alt={group.nameEn}
                              className="h-full w-full object-contain filter drop-shadow-2xs"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.opacity = "0";
                              }}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                {group.nameEn}
                              </h4>
                              {group.affinity !== null && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                  +{group.affinity} Aff
                                </span>
                              )}
                              {group.runCount > 1 && (
                                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                                  {group.runCount} Runs in HoF
                                </span>
                              )}
                            </div>

                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                              {group.titleEn || `Costume ${group.cardId}`}
                            </p>

                            {/* Representative factors */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <div className="flex items-center gap-1">
                                <img
                                  src={rankIconSrc}
                                  alt={`Rank ${vet.rank}`}
                                  className="h-3.5 w-auto object-contain"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                                <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
                                  {vet.rank_score?.toLocaleString()} pts
                                </span>
                              </div>

                              <span className="px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                🔵 {lineage.total}★ Blue
                              </span>
                              {blueFactor && (
                                <span className="px-1.5 py-0.2 rounded-md text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                  {blueFactor.name} {"★".repeat(blueFactor.stars)}
                                </span>
                              )}
                              {pinkFactor && (
                                <span className="px-1.5 py-0.2 rounded-md text-[10px] font-medium bg-pink-500/10 text-pink-700 dark:text-pink-300">
                                  🌸 {pinkFactor.name} {"★".repeat(pinkFactor.stars)}
                                </span>
                              )}
                              <span className="text-[10px] text-zinc-400">
                                🏆 {vet.win_saddle_id_array?.length || 0} Wins
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions: Select or Expand */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {group.runCount > 1 && (
                            <button
                              type="button"
                              onClick={() => setExpandedCharId(isExpanded ? null : charId)}
                              className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 cursor-pointer transition-colors"
                            >
                              {isExpanded ? "▲ Hide Runs" : `▼ View ${group.runCount} Runs`}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              onSelectVeteran(vet);
                              onClose();
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all ease-out-quart duration-150"
                          >
                            {group.runCount > 1 ? "Select Best Run →" : "Select →"}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Accordion: List all runs for this Uma */}
                      {isExpanded && group.runCount > 1 && (
                        <div className="border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/40 p-3 flex flex-col gap-2 animate-in fade-in duration-200 ease-out-quart">
                          <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 px-1">
                            Select a specific training run for {group.nameEn}:
                          </p>
                          <div className="grid grid-cols-1 gap-2">
                            {group.runs.map((run, idx) => {
                              const runLineage = calculateLineageBlueStars(run);
                              const runSelfFactors = (run.factor_info_array || []).map((f) => decodeFactor(f.factor_id));
                              const runBlue = runSelfFactors.find((f) => f.type === "blue");
                              const runPink = runSelfFactors.find((f) => f.type === "pink");
                              const runRankPadded = String(run.rank || 0).padStart(2, "0");
                              const runRankIcon = `/assets/statusrank/utx_ico_statusrank_${runRankPadded}.png`;
                              const isPrimary = idx === 0;

                              return (
                                <div
                                  key={run.trained_chara_id || idx}
                                  className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-500/60 shadow-2xs transition-all"
                                >
                                  <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                                    <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 w-14 shrink-0">
                                      Run #{idx + 1}
                                      {isPrimary && (
                                        <span className="ml-1 text-[9px] text-emerald-600 dark:text-emerald-400 font-extrabold">
                                          (Best)
                                        </span>
                                      )}
                                    </span>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <img
                                        src={runRankIcon}
                                        alt={`Rank ${run.rank}`}
                                        className="h-3.5 w-auto object-contain"
                                        onError={(e) => {
                                          e.currentTarget.style.display = "none";
                                        }}
                                      />
                                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                        {run.rank_score?.toLocaleString()} pts
                                      </span>
                                    </div>

                                    <span className="px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 shrink-0">
                                      🔵 {runLineage.total}★ Blue
                                    </span>

                                    {runBlue && (
                                      <span className="px-1.5 py-0.2 rounded-md text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shrink-0">
                                        {runBlue.name} {"★".repeat(runBlue.stars)}
                                      </span>
                                    )}

                                    {runPink && (
                                      <span className="px-1.5 py-0.2 rounded-md text-[10px] font-medium bg-pink-500/10 text-pink-700 dark:text-pink-300 shrink-0">
                                        🌸 {runPink.name} {"★".repeat(runPink.stars)}
                                      </span>
                                    )}

                                    <span className="text-[10px] text-zinc-400 shrink-0">
                                      🏆 {run.win_saddle_id_array?.length || 0} Wins
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      onSelectVeteran(run);
                                      onClose();
                                    }}
                                    className="px-3 py-1 rounded-lg bg-emerald-600/15 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-all cursor-pointer shrink-0 ml-2"
                                  >
                                    Use Run #{idx + 1}
                                  </button>
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
            )
          ) : (
            processedTemplates.length === 0 ? (
              <div className="py-16 text-center text-xs text-zinc-500">
                No character templates match the search.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {processedTemplates.map((chara) => {
                  const avatarUrl = getCharacterImageUrl(chara.charId, chara.id);
                  const affResult = targetCharaId
                    ? calculateAffinity({ card_id: chara.id }, targetCharaId)
                    : null;

                  return (
                    <button
                      key={chara.id}
                      type="button"
                      onClick={() => {
                        if (onSelectCharacterTemplate) {
                          onSelectCharacterTemplate(chara);
                        } else {
                          // convert character to minimal veteran stub
                          onSelectVeteran({
                            card_id: chara.id,
                            name: chara.nameEn,
                            win_saddle_id_array: [],
                            trained_chara_id: chara.id,
                          } as any);
                        }
                        onClose();
                      }}
                      className="group flex items-center gap-2.5 p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 hover:border-emerald-500/70 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-left transition-all cursor-pointer shadow-2xs"
                    >
                      <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                        <img
                          src={avatarUrl}
                          alt={chara.nameEn}
                          className="h-full w-full object-contain filter drop-shadow-2xs group-hover:scale-105 transition-transform duration-200 ease-out-quart"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.opacity = "0";
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                            {chara.nameEn}
                          </h4>
                          {affResult && (
                            <span className="shrink-0 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              +{affResult.total}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                          {chara.titleEn || chara.titleJp || `Costume ${chara.variant}`}
                        </p>
                        <span className="text-[10px] font-semibold text-amber-500">
                          {"★".repeat(chara.rarity)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
