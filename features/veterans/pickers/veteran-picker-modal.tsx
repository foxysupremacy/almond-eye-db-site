"use client";

import { useState, useMemo, useEffect } from "react";
import { type CharacterIndexEntry, getCharacterImageUrl } from "@/lib/api";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";
import {
  calculateAffinity,
  countSharedG1Wins,
  getCharaIdFromCardId,
} from "@/lib/lineage/affinity-engine";
import { decodeFactor, calculateLineageBlueStars } from "@/lib/lineage/factor-decoder";
import type { LegacyCandidate } from "@/lib/parenting";
import type { LegacyUniqueEval } from "@/lib/parenting/types";
import { evaluateUniqueSkill, runningStyleToNum } from "@/lib/parenting/skill-evaluator";
import { getCareerG1Saddles } from "@/lib/parenting/career-engine";
import { useOwnedUmas } from "@/app/common/hooks/use-owned-umas";
import {
  charactersById,
  charactersByCharId,
  skillsById,
} from "@/lib/api";
import { getInheritableSkillForUnique } from "@/lib/skills/rarity";
import { useDeck } from "@/features/deck/state";
import SkillItem from "@/app/common/ui/skills/skill-item";
import { PickerSearchBar } from "@/app/common/ui/controls/picker-search-bar";
import { TIER_CHIP_CLASSES } from "@/app/common/ui/skills/skill-badges";
import { Badge } from "@/app/common/ui/primitives/badge";
import {
  compareUniqueTier,
  sortRecommended,
  uniqueFireState,
  type VeteranPickerSort,
  type WhiteUniqueInfo,
} from "@/features/veterans/model/picker-utils";
import {
  projectCharacterTemplates,
  projectOwnedUmaEntries,
  projectVeteranGroups,
  type OwnedUmaEntry,
} from "@/features/veterans/model/picker-projections";
import { createCharacterVeteranTemplate } from "@/features/veterans/model/character-template";
import { usePickerController } from "@/app/common/hooks/use-picker-controller";
import { veteranPickerAdapter, type VeteranPickerTab } from "@/features/veterans/model/picker-state";

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
  recommendationsLoading?: boolean;
  recommendationsError?: string | null;
  targetCharaId: number | null;
  excludedCharId?: number | null;
  slotLabel: string;
  veterans: KyumaruVeteranItem[];
  characters: CharacterIndexEntry[];
  /** The other fixed uma for shared-G1 context (branch parent for GP slots, other parent otherwise). */
  contextParent?: KyumaruVeteranItem | null;
  initialTab?: "recommended" | "owned" | "veterans" | "templates";
}

type PickerTab = VeteranPickerTab;
type SortBy = VeteranPickerSort;
const SORT_STORAGE_KEY = "almond_parent_picker_sort";
const TAB_STORAGE_KEY = "almond_parent_picker_tab";

function loadSort(): SortBy {
  try {
    const v = localStorage.getItem(SORT_STORAGE_KEY);
    if (
      v === "affinity" ||
      v === "rank_score" ||
      v === "blue_stars" ||
      v === "skill_effect" ||
      v === "unique_tier"
    ) {
      return v;
    }
  } catch {}
  return "affinity";
}

function loadTab(): PickerTab {
  try {
    const v = localStorage.getItem(TAB_STORAGE_KEY);
    if (v === "recommended" || v === "owned" || v === "veterans" || v === "templates") {
      return v;
    }
  } catch {}
  return "veterans";
}

/** White (inherit) version of a character's unique skill, from the generated inherit map. */
function resolveWhiteUnique(cardId: number): WhiteUniqueInfo | null {
  const chara =
    charactersById.get(cardId) ?? charactersByCharId.get(getCharaIdFromCardId(cardId));
  if (!chara?.uniqueSkillId) return null;
  const skillId = getInheritableSkillForUnique(chara.uniqueSkillId) ?? chara.uniqueSkillId;
  const raw = skillsById.get(skillId);
  if (!raw) return null;
  return {
    skillId,
    nameEn: raw.nameEn,
    nameJp: raw.nameJp,
    rarity: raw.rarity,
    iconId: raw.iconId ?? null,
  };
}

function TierChip({ tier, title }: { tier: string; title?: string }) {
  return <Badge size="compact" className={`font-black ${TIER_CHIP_CLASSES[tier] ?? TIER_CHIP_CLASSES.C}`} title={title}>
      {tier}
    </Badge>;
}

function RecommendedRow({
  rank,
  candidate,
  isBorrow,
  borrowUsed,
  whiteUnique,
  onSelect,
}: {
  rank: number;
  candidate: LegacyCandidate;
  isBorrow: boolean;
  borrowUsed: boolean;
  whiteUnique: WhiteUniqueInfo | null;
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
        <span className="block text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
          {candidate.nameEn}
        </span>
        {whiteUnique && (
          <SkillItem
            skill={{
              id: whiteUnique.skillId,
              nameEn: whiteUnique.nameEn,
              nameJp: whiteUnique.nameJp,
              rarity: whiteUnique.rarity,
              iconId: whiteUnique.iconId,
              cardName: `${candidate.nameEn} · white inherit`,
            }}
            size="xs"
            isParentMode
            titleClassName="!text-[10px]"
            subtitleClassName="!text-[8px]"
            className="mt-0.5"
          />
        )}
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

      <div className="flex items-center gap-1.5 shrink-0">
        {candidate.uniqueEval && (
          <TierChip tier={candidate.uniqueEval.tier} title={candidate.uniqueEval.explanation} />
        )}
        {isBorrow ? (
          <Badge size="compact" emphasis="solid" tone={borrowUsed ? "neutral" : "amber"} className="font-bold">
            Borrow
          </Badge>
        ) : candidate.isUntrained ? (
          <Badge size="compact" emphasis="solid" tone="indigo" className="font-bold" title="Owned but not yet trained — train this Uma to use it here (no borrow needed)">
            Untrained
          </Badge>
        ) : (
          <Badge size="compact" emphasis="solid" tone="emerald" className="font-bold" title="Imported Hall of Fame veteran">
            HoF{candidate.blueStarsTotal ? ` · ${candidate.blueStarsTotal}★` : ""}
          </Badge>
        )}

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
    </div>
  );
}

function RecommendedTabContent({
  recommendations,
  sortBy,
  onSelect,
}: {
  recommendations: PickerRecommendations;
  sortBy: SortBy;
  onSelect: (candidate: LegacyCandidate) => void;
}) {
  const { borrowUsed, runLabel, contextNote } = recommendations;
  const owned = useMemo(
    () => sortRecommended(recommendations.owned, sortBy),
    [recommendations.owned, sortBy]
  );
  const borrow = useMemo(
    () => sortRecommended(recommendations.borrow, sortBy),
    [recommendations.borrow, sortBy]
  );

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
                whiteUnique={resolveWhiteUnique(c.cardId)}
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
          <Badge size="compact" emphasis="solid" tone={borrowUsed ? "neutral" : "amber"} className="font-bold">
            {borrowBadgeLabel}
          </Badge>
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
                whiteUnique={resolveWhiteUnique(c.cardId)}
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

/** One row in the Owned Umas tab — a collection-owned (not-yet-trained) uma. */
function OwnedUmaRow({
  entry,
  onSelect,
}: {
  entry: OwnedUmaEntry;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-400/60 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 cursor-pointer transition-colors group"
    >
      <img
        src={getCharacterImageUrl(entry.chara.charId, entry.chara.id, "01")}
        alt={entry.chara.nameEn}
        className="w-9 h-9 rounded-full object-cover object-top bg-zinc-100 dark:bg-zinc-800 shrink-0 border border-zinc-200 dark:border-zinc-700"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
            {entry.chara.nameEn}
          </span>
          <span className="text-[9px] font-semibold text-amber-500 shrink-0">
            {"★".repeat(entry.ownedRarity)}
          </span>
          <span
            className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 shrink-0"
            title="Talent level from your Collection"
          >
            T{entry.ownedTalent}
          </span>
        </div>

        {entry.whiteUnique && (
          <SkillItem
            skill={{
              id: entry.whiteUnique.skillId,
              nameEn: entry.whiteUnique.nameEn,
              nameJp: entry.whiteUnique.nameJp,
              rarity: entry.whiteUnique.rarity,
              iconId: entry.whiteUnique.iconId,
              cardName: `${entry.chara.nameEn} · white inherit`,
            }}
            size="xs"
            isParentMode
            titleClassName="!text-[10px]"
            subtitleClassName="!text-[8px]"
            className="mt-0.5"
          />
        )}

        <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
          🔗 {entry.sharedG1WithParent} G1 w/ parent · {entry.sharedG1WithTrainee} G1 w/ trainee · 🏆{" "}
          {entry.careerG1Count} Career G1s
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {entry.uniqueEval && (
          <TierChip tier={entry.uniqueEval.tier} title={entry.uniqueEval.explanation} />
        )}
        {entry.hasHofRuns ? (
          <Badge size="compact" emphasis="solid" tone="emerald" className="font-bold" title="This Uma also has imported Hall of Fame runs">
            HoF
          </Badge>
        ) : (
          <Badge size="compact" emphasis="solid" tone="indigo" className="font-bold" title="Owned but not yet trained — train this Uma to use it here (no borrow needed)">
            Untrained
          </Badge>
        )}

        <span className="text-base font-black text-amber-600 dark:text-amber-400 tabular-nums shrink-0">
          +{entry.affTotal}
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
    </div>
  );
}

function OwnedTabContent({
  entries,
  hasMore,
  hasTarget,
  onSelect,
  onShowMore,
}: {
  entries: OwnedUmaEntry[];
  hasMore: boolean;
  hasTarget: boolean;
  onSelect: (entry: OwnedUmaEntry) => void;
  onShowMore: () => void;
}) {
  if (!hasTarget) {
    return (
      <div className="py-16 text-center text-xs text-zinc-500">
        Select a target trainee first to score your owned Umas.
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="py-16 text-center text-xs text-zinc-500">
        No owned Umas match. Mark Umas as owned in the Collection to see them here.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2.5 py-1.5">
        Owned Umas from your Collection — scored as potential parents via their career G1
        schedule. Selecting one uses your own Uma (no friend borrow needed).
      </p>
      <div className="flex flex-col gap-1">
        {entries.map((entry) => (
          <OwnedUmaRow key={entry.chara.id} entry={entry} onSelect={() => onSelect(entry)} />
        ))}
      </div>
      {hasMore && <ShowMoreButton onClick={onShowMore} />}
    </div>
  );
}

function ShowMoreButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
    >
      Show more
    </button>
  );
}

export default function VeteranPickerModal({
  isOpen,
  onClose,
  onSelectVeteran,
  onSelectCharacterTemplate,
  onSelectCandidate,
  recommendations,
  recommendationsLoading = false,
  recommendationsError = null,
  targetCharaId,
  excludedCharId,
  slotLabel,
  veterans,
  characters,
  contextParent,
  initialTab,
}: VeteranPickerModalProps) {
  const [initialPickerPreferences] = useState(() => ({ initialTab: loadTab(), initialSort: loadSort() }));
  const pickerInput = {
    ...initialPickerPreferences,
    recommendationsAvailable: Boolean(recommendations || recommendationsLoading || recommendationsError),
  };
  const { state: pickerState, view: pickerView, dispatch } = usePickerController(veteranPickerAdapter, pickerInput);
  const { search, sortBy } = pickerState;
  const activeTab = pickerView.activeTab;
  const normalizedSearch = pickerView.normalizedSearch;
  const [visibleLimit, setVisibleLimit] = useState(36);

  useEffect(() => {
    setVisibleLimit(36);
  }, [activeTab, normalizedSearch]);

  // Remember the last-used tab across visits; fall back when the saved tab is
  // unavailable in this context (e.g. "recommended" with no recommendations).
  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        dispatch({ type: "tabSelected", tab: initialTab });
        return;
      }
      const saved = loadTab();
      dispatch({
        type: "tabSelected",
        tab: saved === "recommended" && !recommendations && !recommendationsLoading && !recommendationsError
          ? "veterans"
          : saved,
      });
    }
  }, [isOpen, initialTab, dispatch]);

  useEffect(() => {
    try {
      localStorage.setItem(TAB_STORAGE_KEY, pickerState.activeTab);
    } catch {}
  }, [pickerState.activeTab]);

  const { course, runningStyle } = useDeck();
  const { ownedUmas } = useOwnedUmas();

  const [expandedCharId, setExpandedCharId] = useState<number | null>(null);

  // Remember the sort mode across visits
  useEffect(() => {
    try {
      localStorage.setItem(SORT_STORAGE_KEY, pickerState.sortBy);
    } catch {}
  }, [pickerState.sortBy]);

  const charaMap = useMemo(() => {
    return new Map<number, CharacterIndexEntry>(characters.map((c) => [c.id, c]));
  }, [characters]);

  // White-unique track/style evaluation per card id (tier chips + skill_effect /
  // unique_tier sorting). Only computed while the modal is open and a course is
  // selected; deduped by white skill id since variants share the same unique.
  const uniqueEvalByCardId = useMemo(() => {
    const map = new Map<number, LegacyUniqueEval>();
    if (!isOpen || !course || !["veterans", "templates", "owned"].includes(activeTab)) return map;
    const styleNum = runningStyleToNum(runningStyle);
    const evalByWhiteId = new Map<number, LegacyUniqueEval>();
    const addCard = (cardId: number) => {
      if (map.has(cardId)) return;
      const white = resolveWhiteUnique(cardId);
      if (!white) return;
      let e = evalByWhiteId.get(white.skillId);
      if (!e) {
        e = evaluateUniqueSkill(white.skillId, course, styleNum);
        evalByWhiteId.set(white.skillId, e);
      }
      map.set(cardId, e);
    };
    if (activeTab === "veterans") {
      for (const vet of veterans) addCard(vet.card_id);
    }
    if (activeTab === "templates") {
      for (const c of characters) addCard(c.id);
    } else if (activeTab === "owned") {
      for (const cardIdStr of Object.keys(ownedUmas)) addCard(Number(cardIdStr));
    }
    return map;
  }, [isOpen, course, runningStyle, veterans, characters, activeTab, ownedUmas]);

  // Owned Umas tab: collection-owned characters scored as potential parents via
  // their career G1 schedule (same math as the recommender's untrained picks).
  const projectionDependencies = {
    getCharaIdFromCardId,
    getCareerG1Saddles,
    calculateAffinity: (veteran: { card_id: number; win_saddle_id_array?: number[] }, targetId: number) =>
      calculateAffinity(veteran, targetId),
    countSharedG1Wins,
    calculateBlueStars: (veteran: KyumaruVeteranItem) => calculateLineageBlueStars(veteran).total,
    getCharacterImageUrl,
    resolveWhiteUnique,
  };

  const ownedUmaEntries = useMemo(
    () => !isOpen || activeTab !== "owned" ? [] : projectOwnedUmaEntries({
      ownedUmas,
      charactersByCardId: charaMap,
      veterans,
      targetCharaId,
      excludedCharId,
      contextParent,
      search: normalizedSearch,
      sortBy,
      uniqueEvalByCardId,
      dependencies: projectionDependencies,
    }),
    [isOpen, activeTab, ownedUmas, charaMap, veterans, targetCharaId, excludedCharId, contextParent, normalizedSearch, sortBy, uniqueEvalByCardId],
  );

  const handleSelectOwnedUma = (entry: OwnedUmaEntry) => {
    if (onSelectCandidate) {
      // Untrained-style candidate: full career G1 saddle set, consumes no borrow.
      onSelectCandidate({
        charId: entry.chara.charId,
        cardId: entry.chara.id,
        nameEn: entry.chara.nameEn,
        nameJp: entry.chara.nameJp,
        titleEn: entry.chara.titleEn,
        avatarUrl: getCharacterImageUrl(entry.chara.charId, entry.chara.id),
        isVeteran: false,
        isUntrained: true,
        careerG1Count: entry.careerG1Count,
        affinityScore: entry.affBase,
        totalScore: entry.affTotal,
        uniqueEval: entry.uniqueEval,
        reasons: [],
      });
    } else if (onSelectCharacterTemplate) {
      onSelectCharacterTemplate(entry.chara);
    }
    onClose();
  };

  // Each tab has its own projection because the available metrics and fallback
  // sort rules differ by data source.
  const unifiedVeterans = useMemo(
    () => !isOpen || activeTab !== "veterans" ? [] : projectVeteranGroups({
      veterans,
      charactersByCardId: charaMap,
      targetCharaId,
      excludedCharId,
      search: normalizedSearch,
      sortBy,
      uniqueEvalByCardId,
      dependencies: projectionDependencies,
    }),
    [isOpen, activeTab, veterans, charaMap, targetCharaId, excludedCharId, normalizedSearch, sortBy, uniqueEvalByCardId],
  );

  const processedTemplates = useMemo(
    () => !isOpen || activeTab !== "templates" ? [] : projectCharacterTemplates({
      characters,
      targetCharaId,
      excludedCharId,
      search: normalizedSearch,
      sortBy,
      uniqueEvalByCardId,
      calculateAffinity: (cardId, targetId) => calculateAffinity({ card_id: cardId }, targetId).total,
    }),
    [isOpen, activeTab, characters, targetCharaId, excludedCharId, normalizedSearch, sortBy, uniqueEvalByCardId],
  );

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
              <Badge size="compact" tone="emerald" className="font-bold">
                {activeTab === "veterans"
                  ? `${unifiedVeterans.length} Umas (${veterans.length} Runs)`
                  : activeTab === "owned"
                  ? `${ownedUmaEntries.length} Owned`
                  : `${processedTemplates.length} Characters`}
              </Badge>
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
            {(recommendations || recommendationsLoading || recommendationsError) && (
              <button
                type="button"
                onClick={() => dispatch({ type: "tabSelected", tab: "recommended" })}
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
              onClick={() => dispatch({ type: "tabSelected", tab: "owned" })}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === "owned"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              Owned Umas
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "tabSelected", tab: "veterans" })}
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
              onClick={() => dispatch({ type: "tabSelected", tab: "templates" })}
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
              onChange={(value) => dispatch({ type: "searchChanged", value })}
              placeholder="Search by name..."
              inputClassName="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-zinc-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => dispatch({ type: "sortChanged", value: e.target.value as SortBy })}
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 cursor-pointer"
            >
              <option value="affinity" disabled={!targetCharaId}>
                Compatibility Affinity
              </option>
              <option value="rank_score">Evaluation Score</option>
              <option value="blue_stars">Lineage Blue Stars</option>
              <option value="skill_effect" disabled={!course}>
                Unique Skill Effect
              </option>
              <option value="unique_tier" disabled={!course}>
                Unique Rating (S/A/B/C)
              </option>
            </select>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "recommended" && recommendations ? (
            <RecommendedTabContent
              recommendations={recommendations}
              sortBy={sortBy}
              onSelect={(candidate) => {
                if (onSelectCandidate) {
                  onSelectCandidate(candidate);
                  onClose();
                }
              }}
            />
          ) : activeTab === "recommended" && recommendationsLoading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-xs text-zinc-500" role="status">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              Ranking candidates for this slot…
            </div>
          ) : activeTab === "recommended" && recommendationsError ? (
            <div className="py-16 text-center text-xs text-rose-600 dark:text-rose-400" role="alert">
              {recommendationsError}
            </div>
          ) : activeTab === "owned" ? (
            <OwnedTabContent
              entries={ownedUmaEntries.slice(0, visibleLimit)}
              hasMore={ownedUmaEntries.length > visibleLimit}
              hasTarget={targetCharaId !== null}
              onSelect={handleSelectOwnedUma}
              onShowMore={() => setVisibleLimit((count) => count + 36)}
            />
          ) : activeTab === "veterans" ? (
            unifiedVeterans.length === 0 ? (
              <div className="py-16 text-center text-xs text-zinc-500">
                No veterans match the search or criteria.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {unifiedVeterans.slice(0, visibleLimit).map((group) => {
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
                                <Badge size="standard" tone="blue" className="font-bold">
                                  {group.runCount} Runs in HoF
                                </Badge>
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

                            {/* Inheritable white unique (hover for full skill popover) + right-aligned rating / provenance */}
                            {group.whiteUnique && (
                              <SkillItem
                                skill={{
                                  id: group.whiteUnique.skillId,
                                  nameEn: group.whiteUnique.nameEn,
                                  nameJp: group.whiteUnique.nameJp,
                                  rarity: group.whiteUnique.rarity,
                                  iconId: group.whiteUnique.iconId,
                                  cardName: `${group.nameEn} · white inherit`,
                                }}
                                size="xs"
                                isParentMode
                                titleClassName="!text-[10px]"
                                subtitleClassName="!text-[8px]"
                                className="mt-1.5"
                                trailing={
                                  <>
                                    {group.uniqueEval && (
                                      <TierChip
                                        tier={group.uniqueEval.tier}
                                        title={group.uniqueEval.explanation}
                                      />
                                    )}
                                    <Badge size="compact" emphasis="solid" tone="emerald" className="font-bold" title="Imported Hall of Fame veteran">
                                      HoF
                                    </Badge>
                                  </>
                                }
                              />
                            )}
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
                {unifiedVeterans.length > visibleLimit && (
                  <ShowMoreButton onClick={() => setVisibleLimit((count) => count + 36)} />
                )}
              </div>
            )
          ) : (
            processedTemplates.length === 0 ? (
              <div className="py-16 text-center text-xs text-zinc-500">
                No character templates match the search.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {processedTemplates.slice(0, visibleLimit).map((chara) => {
                  const avatarUrl = getCharacterImageUrl(chara.charId, chara.id);
                  const affResult = targetCharaId
                    ? calculateAffinity({ card_id: chara.id }, targetCharaId)
                    : null;
                  const whiteUnique = resolveWhiteUnique(chara.id);
                  const uniqueEval = uniqueEvalByCardId.get(chara.id);

                  return (
                    <button
                      key={chara.id}
                      type="button"
                      onClick={() => {
                        if (onSelectCharacterTemplate) {
                          onSelectCharacterTemplate(chara);
                        } else {
                          // convert character to minimal veteran stub
                          onSelectVeteran(createCharacterVeteranTemplate(chara));
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
                        {whiteUnique && (
                          <SkillItem
                            skill={{
                              id: whiteUnique.skillId,
                              nameEn: whiteUnique.nameEn,
                              nameJp: whiteUnique.nameJp,
                              rarity: whiteUnique.rarity,
                              iconId: whiteUnique.iconId,
                              cardName: `${chara.nameEn} · white inherit`,
                            }}
                            size="xs"
                            isParentMode
                            titleClassName="!text-[10px]"
                            subtitleClassName="!text-[8px]"
                            className="mt-1"
                            trailing={
                              <>
                                {uniqueEval && (
                                  <TierChip
                                    tier={uniqueEval.tier}
                                    title={uniqueEval.explanation}
                                  />
                                )}
                                <Badge size="compact" emphasis="solid" tone="indigo" className="font-bold" title="Owned but not yet trained">
                                  Untrained
                                </Badge>
                              </>
                            }
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
                {processedTemplates.length > visibleLimit && (
                  <div className="col-span-full">
                    <ShowMoreButton onClick={() => setVisibleLimit((count) => count + 36)} />
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
