"use client";

import { AppSelect } from "@/app/common/ui/controls/app-select";
import { AppDialog } from "@/app/common/ui/controls/app-dialog";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { LoadingAnimation } from "@/app/common/ui/controls/loading-animation";
import { Tabs, TabList, Tab, TabPanel } from "react-aria-components/Tabs";
import { XIcon, StarIcon, AlertTriangleIcon } from "@/app/common/ui/primitives/icons";

import { useState, useMemo, useEffect, useRef } from "react";
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
import { getParentInheritedUnique } from "@/lib/parenting/unique-effect-filter";
import { getCareerG1Saddles } from "@/lib/parenting/career-engine";
import { useOwnedUmas } from "@/app/common/hooks/use-owned-umas";
import {
  charactersById,
  charactersByCharId,
} from "@/lib/api";
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
import { useVeteranPickerViewModel } from "../view-models/use-veteran-picker-view-model";

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
  minmaxEnabled?: boolean;
  initialTab?: "recommended" | "owned" | "veterans" | "templates";
}

interface ActiveTabProjection {
  eligibleCardIds: Set<number>;
  uniqueEvalByCardId: Map<number, LegacyUniqueEval>;
  ownedUmaEntries: OwnedUmaEntry[];
  unifiedVeterans: ReturnType<typeof projectVeteranGroups>;
  processedTemplates: CharacterIndexEntry[];
}

const EMPTY_ACTIVE_TAB_PROJECTION: ActiveTabProjection = {
  eligibleCardIds: new Set(),
  uniqueEvalByCardId: new Map(),
  ownedUmaEntries: [],
  unifiedVeterans: [],
  processedTemplates: [],
};

type PickerTab = VeteranPickerTab;
type SortBy = VeteranPickerSort;
const SORT_STORAGE_KEY = "almond_parent_picker_sort";
const TAB_STORAGE_KEY = "almond_parent_picker_tab";

function loadSort(minmaxEnabled = false): SortBy {
  try {
    const v = localStorage.getItem(SORT_STORAGE_KEY);
    if (v === "minmax" && minmaxEnabled) return v;
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
  return minmaxEnabled ? "minmax" : "affinity";
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

/**
 * A modal must paint before its active source tab evaluates every candidate.
 * This key covers every input that influences the expensive eligibility/unique
 * evaluation while deliberately excluding search and sort, which only change
 * the inexpensive final projection.
 */
function activeTabEvaluationKey({
  activeTab,
  targetCharaId,
  excludedCharId,
  contextParent,
  courseId,
  runningStyle,
  veterans,
  characters,
  ownedUmas,
}: {
  activeTab: PickerTab;
  targetCharaId: number | null;
  excludedCharId?: number | null;
  contextParent?: KyumaruVeteranItem | null;
  courseId?: number;
  runningStyle: unknown;
  veterans: KyumaruVeteranItem[];
  characters: CharacterIndexEntry[];
  ownedUmas: Record<string, [number, number]>;
}) {
  return JSON.stringify({
    activeTab,
    targetCharaId,
    excludedCharId: excludedCharId ?? null,
    contextParent: contextParent ? {
      cardId: contextParent.card_id,
      trainedCharaId: contextParent.trained_chara_id ?? null,
      wins: contextParent.win_saddle_id_array ?? [],
    } : null,
    courseId: courseId ?? null,
    runningStyle,
    veterans: veterans.map((veteran) => ({
      cardId: veteran.card_id,
      trainedCharaId: veteran.trained_chara_id ?? null,
      createdAt: veteran.create_time ?? null,
      rank: veteran.rank ?? null,
      rankScore: veteran.rank_score ?? null,
      wins: veteran.win_saddle_id_array ?? [],
      factors: veteran.factor_info_array?.map((factor) => factor.factor_id) ?? [],
    })),
    characterIds: characters.map((character) => character.id),
    ownedUmas,
  });
}

function cacheProjection<T>(cache: Map<string, T>, key: string, value: T): T {
  // Search/sort combinations are finite in normal use; retain enough recent
  // contexts for re-opening a picker without allowing an unbounded session cache.
  if (cache.size >= 48) cache.clear();
  cache.set(key, value);
  return value;
}

/** White (inherit) version of a character's unique skill, from the generated inherit map. */
function resolveWhiteUnique(cardId: number): WhiteUniqueInfo | null {
  const chara =
    charactersById.get(cardId) ?? charactersByCharId.get(getCharaIdFromCardId(cardId));
  if (!chara?.uniqueSkillId) return null;
  const raw = getParentInheritedUnique(chara.uniqueSkillId);
  if (!raw) return null;
  return {
    skillId: raw.id,
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
        {candidate.geneticWarnings && candidate.geneticWarnings.length > 0 && <p className="mt-0.5 text-[10px] text-amber-800 dark:text-amber-300" title={candidate.geneticWarnings.join("; ")}>
          <AlertTriangleIcon className="mr-1 inline h-3 w-3 shrink-0" />{candidate.geneticWarnings[0]}{candidate.geneticWarnings.length > 1 ? ` (+${candidate.geneticWarnings.length - 1})` : ""}
        </p>}
        {isBorrow && borrowUsed && (
          <span className="block text-[10px] font-bold text-amber-600 dark:text-amber-400">
            ⚠ This run's friend borrow is already used
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {candidate.uniqueEval && (
          <TierChip tier={candidate.uniqueEval.tier ?? "Unrated"} title={candidate.uniqueEval.explanation} />
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

        <AppButton
          variant="quiet"
          onPress={onSelect}
          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 group-hover:bg-emerald-600 group-hover:text-white shrink-0 cursor-pointer transition-colors"
        >
          Select →
        </AppButton>
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
          <TierChip tier={entry.uniqueEval.tier ?? "Unrated"} title={entry.uniqueEval.explanation} />
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

        <AppButton
          variant="quiet"
          onPress={onSelect}
          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 group-hover:bg-emerald-600 group-hover:text-white shrink-0 cursor-pointer transition-colors"
        >
          Select →
        </AppButton>
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
    <AppButton
      variant="quiet"
      onPress={onClick}
      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
    >
      Show more
    </AppButton>
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
  minmaxEnabled = false,
}: VeteranPickerModalProps) {
  const { state: vmState, commands: vmCommands } = useVeteranPickerViewModel({
    isOpen,
    targetCharaId,
    excludedCharId,
    contextParent,
    veterans,
    characters,
    minmaxEnabled,
    initialTab,
  });

  const {
    activeTab,
    sortBy: savedSortBy,
    search,
    normalizedSearch,
    activeTabProjection,
    isProjectionReady,
    evaluationError,
    charaMap,
    course,
    runningStyle,
    expandedCharId,
  } = vmState;

  const {
    setActiveTab,
    setSortBy,
    setSearch,
    setExpandedCharId,
  } = vmCommands;

  const hasRecommendations = Boolean(recommendations || recommendationsLoading || recommendationsError);
  const sortBy = savedSortBy === "minmax" && activeTab !== "recommended" ? "affinity" : savedSortBy;
  const [visibleLimit, setVisibleLimit] = useState(36);

  useEffect(() => {
    setVisibleLimit(36);
  }, [activeTab, normalizedSearch]);

  const { ownedUmaEntries, unifiedVeterans, processedTemplates, uniqueEvalByCardId } = activeTabProjection;
  const tabContentError = activeTab !== "recommended" ? evaluationError : null;
  const tabContentLoading = activeTab !== "recommended" && !isProjectionReady && !tabContentError;

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

  if (!isOpen) return null;

  return (
    <AppDialog
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={`Select ${slotLabel}`}
      ariaLabel={`Select ${slotLabel}`}
      size="lg"
      className="h-[85dvh]"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      header={
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Select {slotLabel}
              </h3>
              <Badge size="compact" tone="emerald" className="font-bold">
                {tabContentLoading ? "Loading…" : activeTab === "veterans"
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
          <AppButton
            variant="quiet"
            onPress={onClose}
            iconOnly
            aria-label="Close veteran picker"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <XIcon className="h-4 w-4" />
          </AppButton>
        </div>
      }
    >
      <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as PickerTab)} className="flex min-h-0 flex-1 flex-col">
        {/* Source Tabs & Controls */}
        <div className="flex flex-col gap-2 border-b border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800/80 dark:bg-zinc-950/40">
          <TabList aria-label="Candidate sources" className={`grid w-full grid-cols-2 gap-1 rounded-lg bg-zinc-200/60 p-0.5 dark:bg-zinc-800/60 ${hasRecommendations ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
            {hasRecommendations && (
              <Tab id="recommended"
                className={`flex min-h-8 min-w-0 items-center justify-center rounded-md px-2 py-1 text-center text-[11px] font-semibold leading-tight transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 ${
                  activeTab === "recommended"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                <StarIcon className="mr-1 inline h-3.5 w-3.5" /> Recommended
              </Tab>
            )}
            <Tab id="owned"
              className={`flex min-h-8 min-w-0 items-center justify-center rounded-md px-2 py-1 text-center text-[11px] font-semibold leading-tight transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 ${
                activeTab === "owned"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              Owned Umas
            </Tab>
            <Tab id="veterans"
              className={`flex min-h-8 min-w-0 items-center justify-center rounded-md px-2 py-1 text-center text-[11px] font-semibold leading-tight transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 ${
                activeTab === "veterans"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              My Hall of Fame ({veterans.length})
            </Tab>
            <Tab id="templates"
              className={`flex min-h-8 min-w-0 items-center justify-center rounded-md px-2 py-1 text-center text-[11px] font-semibold leading-tight transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 ${
                activeTab === "templates"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              All Character Templates
            </Tab>
          </TabList>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_13.5rem]">
            <PickerSearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by name..."
              inputClassName="min-h-8 w-full rounded-lg border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-900 outline-none placeholder-zinc-400 focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <AppSelect
              value={sortBy}
              onValueChange={(value) => setSortBy(value as SortBy)}
              className="w-full"
              label="Sort candidates"
              triggerLabel="Sort"
              options={[...(minmaxEnabled ? [{ value: "minmax", label: "Minmax Genetics", disabled: activeTab !== "recommended" }] : []), { value: "affinity", label: "Compatibility Affinity", disabled: !targetCharaId }, { value: "rank_score", label: "Evaluation Score" }, { value: "blue_stars", label: "Lineage Blue Stars" }, { value: "skill_effect", label: "Unique Skill Effect", disabled: !course }, { value: "unique_tier", label: "Unique Rating (S/A/B/C)", disabled: !course }]}
            />
          </div>
        </div>

        {/* Content Body */}
        <TabPanel id={activeTab} className="min-h-0 flex-1 overflow-y-auto p-4 outline-none">
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
            <LoadingAnimation
              active={recommendationsLoading}
              label="Ranking candidates for this slot…"
              size="md"
              fill={false}
              className="py-16"
            />
          ) : activeTab === "recommended" && recommendationsError ? (
            <div className="py-16 text-center text-xs text-rose-600 dark:text-rose-400" role="alert">
              {recommendationsError}
            </div>
          ) : tabContentError ? (
            <div className="py-16 text-center text-xs text-rose-600 dark:text-rose-400" role="alert">
              {tabContentError}
            </div>
          ) : tabContentLoading ? (
            <LoadingAnimation
              active={tabContentLoading}
              label="Preparing candidates…"
              size="md"
              fill={false}
              className="py-16"
            />
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
                                        tier={group.uniqueEval.tier ?? "Unrated"}
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
                            <AppButton
                              variant="quiet"
                              onPress={() => setExpandedCharId(isExpanded ? null : charId)}
                              className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 cursor-pointer transition-colors"
                            >
                              {isExpanded ? "▲ Hide Runs" : `▼ View ${group.runCount} Runs`}
                            </AppButton>
                          )}

                          <AppButton
                            variant="quiet"
                            onPress={() => {
                              onSelectVeteran(vet);
                              onClose();
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all ease-out-quart duration-150"
                          >
                            {group.runCount > 1 ? "Select Best Run →" : "Select →"}
                          </AppButton>
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

                                  <AppButton
                                    variant="quiet"
                                    onPress={() => {
                                      onSelectVeteran(run);
                                      onClose();
                                    }}
                                    className="px-3 py-1 rounded-lg bg-emerald-600/15 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-all cursor-pointer shrink-0 ml-2"
                                  >
                                    Use Run #{idx + 1}
                                  </AppButton>
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
                    <div
                      key={chara.id}
                      className="group grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2.5 p-2.5 border-b border-zinc-100 dark:border-zinc-800/80 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-left transition-colors"
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
                          />
                        )}
                      </div>
                      {whiteUnique && (
                        <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-1.5">
                          {uniqueEval && (
                            <TierChip tier={uniqueEval.tier ?? "Unrated"} title={uniqueEval.explanation} />
                          )}
                          <Badge size="compact" emphasis="solid" tone="indigo" className="font-bold" title="Owned but not yet trained">
                            Untrained
                          </Badge>
                        </div>
                      )}
                      <AppButton
                        variant="secondary"
                        className="col-span-2 w-full"
                        aria-label={`Select ${chara.nameEn} template`}
                      onPress={() => {
                        if (onSelectCharacterTemplate) {
                          onSelectCharacterTemplate(chara);
                        } else {
                          // convert character to minimal veteran stub
                          onSelectVeteran(createCharacterVeteranTemplate(chara));
                        }
                        onClose();
                      }}
                      >Select</AppButton>
                    </div>
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
        </TabPanel>
      </Tabs>
    </AppDialog>
  );
}
