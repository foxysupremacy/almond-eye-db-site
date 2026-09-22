"use client";

// The Parenting Hub for AlmondEye DB — rebuilt around branch compatibility:
// - Target Trainee stage + live lineage affinity header (◎ / ◯ / △)
// - Two parent slots with auto-resolved grandparent chips (from succession history)
// - GameTora-style compatibility lists: best legacies + per-branch sub-legacies,
//   ranked by affinity and filtered by unique-skill track/style suitability.

import { useState, useEffect, useMemo, useTransition } from "react";
import { api, type CharacterIndexEntry } from "../../lib/api";
import { useDeck } from "../store";
import {
  useParentingSetup,
  serializeParentingToHash,
  getRunBorrowState,
  type GrandparentSlot,
  type PickerSlotKey,
} from "../../lib/parenting-state";
import { getAllVeterans } from "../../lib/db/veterans-db";
import type { KyumaruVeteranItem } from "../../lib/kyumaru-types";
import {
  calculateLineageAffinity,
  getCharaIdFromCardId,
} from "../../lib/affinity-engine";
import {
  calculateLineageStatBonuses,
  extractSlotPrimaryFactors,
  type SlotPrimaryFactors,
} from "../../lib/factor-decoder";
import {
  candidateToVeteran,
  evaluateAptitudePatch,
  getSlotRecommendations,
  type LegacyCandidate,
} from "../../lib/parenting";
import CharacterPickerModal from "../character-picker-modal";
import VeteranPickerModal, { type PickerRecommendations } from "../veteran-picker-modal";
import InheritedSkillsModal from "../inherited-skills-modal";
import type { ParticipantSlot } from "../../lib/parenting/types";
import { LineageAffinityHeader } from "./lineage-affinity-header";
import { TraineeSpotlight } from "./trainee-spotlight";
import { PedigreeSlotCard } from "./pedigree-slot-card";
import { resolveGrandparentSlot, buildParticipantsList, resolveTargetCharacter } from "../../lib/parenting/pedigree-resolvers";
import { PedigreeSkillsSection } from "./pedigree-skills-section";

export interface ParentingViewProps {
  onNavigateToParentDeck?: () => void;
}

const STYLE_LABELS: Record<number, string> = {
  1: "Runner",
  2: "Leader",
  3: "Betweener",
  4: "Chaser",
};

export default function ParentingView({ onNavigateToParentDeck }: ParentingViewProps) {
  const { course, runningStyle } = useDeck();

  const {
    setup,
    setTargetChara,
    setParent1,
    setParent2,
    setP1IsBorrow,
    setP2IsBorrow,
    setGpOverride,
    resetParenting,
  } = useParentingSetup();

  const [veterans, setVeterans] = useState<KyumaruVeteranItem[]>([]);
  const [characters, setCharacters] = useState<CharacterIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & UI States
  const [isTraineeModalOpen, setIsTraineeModalOpen] = useState(false);
  const [activePickerSlot, setActivePickerSlot] = useState<PickerSlotKey | null>(null);
  const [isInheritedSkillsOpen, setIsInheritedSkillsOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [, startTransition] = useTransition();

  const loadData = async () => {
    try {
      const [vets, charas] = await Promise.all([getAllVeterans(), api.listCharacters()]);
      setVeterans(vets);
      setCharacters(charas);
    } catch (err) {
      console.error("Failed to load parenting data:", err);
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

  const charaMap = useMemo(() => {
    return new Map<number, CharacterIndexEntry>(characters.map((c) => [c.id, c]));
  }, [characters]);

  const charaByCharIdMap = useMemo(() => {
    return new Map<number, CharacterIndexEntry>(characters.map((c) => [c.charId, c]));
  }, [characters]);

  const targetChara = useMemo(() => {
    return resolveTargetCharacter(setup, charaMap, charaByCharIdMap);
  }, [setup, charaMap, charaByCharIdMap]);

  // Grandparents resolution (auto-fills from Parent veteran training history unless overridden)
  const p1_gp1 = useMemo(
    () => resolveGrandparentSlot(setup.gpOverrides.p1_gp1, setup.parent1, 10),
    [setup.gpOverrides.p1_gp1, setup.parent1]
  );
  const p1_gp2 = useMemo(
    () => resolveGrandparentSlot(setup.gpOverrides.p1_gp2, setup.parent1, 20),
    [setup.gpOverrides.p1_gp2, setup.parent1]
  );
  const p2_gp1 = useMemo(
    () => resolveGrandparentSlot(setup.gpOverrides.p2_gp1, setup.parent2, 10),
    [setup.gpOverrides.p2_gp1, setup.parent2]
  );
  const p2_gp2 = useMemo(
    () => resolveGrandparentSlot(setup.gpOverrides.p2_gp2, setup.parent2, 20),
    [setup.gpOverrides.p2_gp2, setup.parent2]
  );

  // Real-time Lineage Compatibility Calculation
  const affinityBreakdown = useMemo(() => {
    return calculateLineageAffinity(
      setup.targetCharaId,
      setup.parent1,
      setup.parent2,
      { gp1: p1_gp1, gp2: p1_gp2 },
      { gp1: p2_gp1, gp2: p2_gp2 }
    );
  }, [setup.targetCharaId, setup.parent1, setup.parent2, p1_gp1, p1_gp2, p2_gp1, p2_gp2]);

  // Floating Blue Stat Bonuses (Speed, Stamina, Power, Guts, Wit)
  const statBonuses = useMemo(() => {
    return calculateLineageStatBonuses([
      setup.parent1,
      p1_gp1,
      p1_gp2,
      setup.parent2,
      p2_gp1,
      p2_gp2,
    ]);
  }, [setup.parent1, p1_gp1, p1_gp2, setup.parent2, p2_gp1, p2_gp2]);

  // Primary factors for the 6 bloodline slots
  const p1Factors: SlotPrimaryFactors = useMemo(
    () => extractSlotPrimaryFactors(setup.parent1?.factor_info_array),
    [setup.parent1]
  );
  const p1Gp1Factors: SlotPrimaryFactors = useMemo(
    () => extractSlotPrimaryFactors(p1_gp1?.factor_info_array),
    [p1_gp1]
  );
  const p1Gp2Factors: SlotPrimaryFactors = useMemo(
    () => extractSlotPrimaryFactors(p1_gp2?.factor_info_array),
    [p1_gp2]
  );
  const p2Factors: SlotPrimaryFactors = useMemo(
    () => extractSlotPrimaryFactors(setup.parent2?.factor_info_array),
    [setup.parent2]
  );
  const p2Gp1Factors: SlotPrimaryFactors = useMemo(
    () => extractSlotPrimaryFactors(p2_gp1?.factor_info_array),
    [p2_gp1]
  );
  const p2Gp2Factors: SlotPrimaryFactors = useMemo(
    () => extractSlotPrimaryFactors(p2_gp2?.factor_info_array),
    [p2_gp2]
  );

  // Participants list for Inherited Skills modal
  const participantsList: ParticipantSlot[] = useMemo(() => {
    return buildParticipantsList(
      setup,
      { p1_gp1, p1_gp2, p2_gp1, p2_gp2 },
      charaMap
    );
  }, [setup, p1_gp1, p1_gp2, p2_gp1, p2_gp2, charaMap]);

  // Share URL Generator
  const handleShare = async () => {
    try {
      const hash = await serializeParentingToHash(setup);
      const url = `${window.location.origin}${window.location.pathname}#${hash}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error("Failed to copy share link:", err);
    }
  };

  // Compatibility recommendations (affinity-ranked, track/style-filtered)
  const courseLabel = course
    ? `${course.length}m ${course.terrain === 2 ? "Dirt" : "Turf"}${
        runningStyle ? ` · ${STYLE_LABELS[runningStyle] ?? ""}` : ""
      }`
    : null;

  // Per-slot recommendations for the picker's "Recommended" tab.
  // Parent slots score by trainee affinity; GP slots add affinity with the branch parent.
  const pickerRecommendations = useMemo<PickerRecommendations | null>(() => {
    if (!activePickerSlot || !setup.targetCharaId) return null;

    const branchPrefix = activePickerSlot.startsWith("p1_gp")
      ? "p1"
      : activePickerSlot.startsWith("p2_gp")
      ? "p2"
      : null;
    const branchParent =
      branchPrefix === "p1" ? setup.parent1 : branchPrefix === "p2" ? setup.parent2 : null;

    const excludedCharIds: number[] = [];
    if (activePickerSlot === "p1" && setup.parent2) {
      excludedCharIds.push(getCharaIdFromCardId(setup.parent2.card_id));
    } else if (activePickerSlot === "p2" && setup.parent1) {
      excludedCharIds.push(getCharaIdFromCardId(setup.parent1.card_id));
    } else if (branchPrefix) {
      if (setup.parent1) excludedCharIds.push(getCharaIdFromCardId(setup.parent1.card_id));
      if (setup.parent2) excludedCharIds.push(getCharaIdFromCardId(setup.parent2.card_id));
      const siblingKey = activePickerSlot.endsWith("gp1") ? "gp2" : "gp1";
      const sibling =
        branchPrefix === "p1"
          ? siblingKey === "gp1"
            ? p1_gp1
            : p1_gp2
          : siblingKey === "gp1"
          ? p2_gp1
          : p2_gp2;
      if (sibling) excludedCharIds.push(getCharaIdFromCardId(sibling.card_id));
    }

    const { owned, borrow } = getSlotRecommendations({
      targetCharaId: setup.targetCharaId,
      branchParent,
      excludedCharIds,
      course,
      runningStyle,
      veterans,
      supportCardIds: setup.supportCardIds,
    });

    const branchName = branchParent
      ? charaMap.get(branchParent.card_id)?.nameEn ?? branchParent.name ?? null
      : null;
    const contextNote = branchName
      ? `Grandparent slot — ranked by affinity with the trainee + ${branchName}${
          courseLabel ? ` · ${courseLabel}` : ""
        }`
      : `Parent slot — ranked by affinity with ${targetChara?.nameEn ?? "trainee"}${
          courseLabel ? ` · ${courseLabel}` : ""
        }`;

    const runBorrow = getRunBorrowState(setup, activePickerSlot);

    return {
      owned,
      borrow,
      borrowUsed: runBorrow.used,
      runLabel: runBorrow.runLabel,
      contextNote,
    };
  }, [
    activePickerSlot,
    setup.targetCharaId,
    setup.parent1,
    setup.parent2,
    setup.p1IsBorrow,
    setup.p2IsBorrow,
    setup.supportCardIds,
    p1_gp1,
    p1_gp2,
    p2_gp1,
    p2_gp2,
    course,
    runningStyle,
    veterans,
    charaMap,
    targetChara,
    courseLabel,
  ]);

  // The other fixed uma for the open picker slot: the other parent for P1/P2,
  // the branch parent for grandparent slots (drives shared-G1 context).
  const pickerContextParent = useMemo(() => {
    if (!activePickerSlot) return null;
    if (activePickerSlot === "p1") return setup.parent2;
    if (activePickerSlot === "p2") return setup.parent1;
    if (activePickerSlot.startsWith("p1_gp")) return setup.parent1;
    if (activePickerSlot.startsWith("p2_gp")) return setup.parent2;
    return null;
  }, [activePickerSlot, setup.parent1, setup.parent2]);

  const handleSelectCandidate = (candidate: LegacyCandidate) => {
    if (!activePickerSlot) return;
    // Untrained picks are owned Umas — they never consume the run's borrow.
    const isBorrow = !candidate.isVeteran && !candidate.isUntrained;
    const vet = candidateToVeteran(candidate);

    if (activePickerSlot === "p1") {
      setParent1(vet);
      setP1IsBorrow(isBorrow);
    } else if (activePickerSlot === "p2") {
      setParent2(vet);
      setP2IsBorrow(isBorrow);
    } else if (
      activePickerSlot === "p1_gp1" ||
      activePickerSlot === "p1_gp2" ||
      activePickerSlot === "p2_gp1" ||
      activePickerSlot === "p2_gp2"
    ) {
      setGpOverride(activePickerSlot, {
        card_id: candidate.cardId,
        name: candidate.nameEn,
        rank: candidate.veteran?.rank,
        rarity: candidate.veteran?.rarity,
        win_saddle_id_array: vet.win_saddle_id_array ?? [],
        trained_chara_id: candidate.veteran?.trained_chara_id ?? candidate.cardId,
        factor_info_array: candidate.veteran?.factor_info_array,
        isBorrow,
      });
    }
  };

  const handlePickerSelect = (vet: KyumaruVeteranItem) => {
    if (activePickerSlot === "p1") {
      setParent1(vet);
    } else if (activePickerSlot === "p2") {
      setParent2(vet);
    } else if (activePickerSlot) {
      setGpOverride(activePickerSlot, {
        card_id: vet.card_id,
        name: vet.name ?? undefined,
        rank: vet.rank,
        rarity: vet.rarity,
        win_saddle_id_array: vet.win_saddle_id_array,
        trained_chara_id: vet.trained_chara_id,
        factor_info_array: vet.factor_info_array,
        isBorrow: false,
      });
    }
  };

  const handlePickerTemplate = (chara: CharacterIndexEntry) => {
    const stub: KyumaruVeteranItem = {
      card_id: chara.id,
      name: chara.nameEn,
      win_saddle_id_array: [],
      trained_chara_id: chara.id,
    } as any;

    if (activePickerSlot === "p1") {
      setParent1(stub);
      setP1IsBorrow(true);
    } else if (activePickerSlot === "p2") {
      setParent2(stub);
      setP2IsBorrow(true);
    } else if (activePickerSlot) {
      setGpOverride(activePickerSlot, {
        card_id: chara.id,
        name: chara.nameEn,
        win_saddle_id_array: [],
        trained_chara_id: chara.id,
        isBorrow: true,
      });
    }
  };

  const getSlotAptitudeWarning = (cardId?: number | null): string | undefined => {
    if (!cardId || !course) return undefined;
    const patch = evaluateAptitudePatch(cardId, course);
    return patch.requiresPatch ? patch.warningMessage : undefined;
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <div className="w-9 h-9 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-zinc-400">Loading Parenting Hub & Inheritance Engine...</p>
      </div>
    );
  }

  return (
    <section className="w-full flex flex-col gap-6">
      {/* Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Parenting Hub
            </h2>
            <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-bold">
              Compatibility
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Affinity-ranked legacy recommendations, filtered by unique-skill timing on the selected track.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-2xs cursor-pointer transition-colors"
            title="Copy shareable link with current setup"
          >
            <span>{copiedLink ? "✓ Link Copied!" : "🔗 Share Plan"}</span>
          </button>
          <button
            type="button"
            onClick={resetParenting}
            className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-500 hover:text-red-500 hover:border-red-200 dark:hover:border-red-900/50 cursor-pointer transition-colors"
          >
            Reset Setup
          </button>
        </div>
      </div>

      {/* 1. TRAINEE STAGE + AFFINITY HEADER */}
      <div className="relative rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/75 dark:bg-zinc-900/75 p-4 sm:p-6 shadow-sm overflow-hidden backdrop-blur-md">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <LineageAffinityHeader
          affinityBreakdown={affinityBreakdown}
          onOpenInheritedSkills={() => setIsInheritedSkillsOpen(true)}
        />

        <TraineeSpotlight
          targetChara={targetChara}
          statBonuses={statBonuses}
          onSelectTrainee={() => setIsTraineeModalOpen(true)}
        />
      </div>

      {/* 2. PEDIGREE SLOTS (Parents + Auto-resolved Grandparents) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
        {/* Parent 1 branch */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Legacy 1
            </span>
            {setup.parent1 && (
              <button
                type="button"
                onClick={() => setP1IsBorrow(!setup.p1IsBorrow)}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-emerald-600 cursor-pointer transition-colors"
              >
                {setup.p1IsBorrow ? "Borrow" : "Your Uma"} ☔
              </button>
            )}
          </div>
          <div className="flex min-w-0 items-start justify-center gap-2">
            <PedigreeSlotCard
              slotLabel="P1"
              isParentSlot
              cardId={setup.parent1?.card_id}
              name={
                (setup.parent1 && charaMap.get(setup.parent1.card_id)?.nameEn) ||
                setup.parent1?.name ||
                "Select"
              }
              rank={setup.parent1?.rank}
              factors={p1Factors}
              isBorrow={setup.parent1 ? setup.p1IsBorrow : undefined}
              aptitudeWarning={getSlotAptitudeWarning(setup.parent1?.card_id)}
              onClick={() => setActivePickerSlot("p1")}
            />
            <div className="flex min-w-0 gap-1.5">
              <PedigreeSlotCard
                slotLabel="GP"
                cardId={p1_gp1?.card_id}
                name={(p1_gp1 && charaMap.get(p1_gp1.card_id)?.nameEn) || p1_gp1?.name || "GP 1"}
                rank={p1_gp1?.rank}
                factors={p1Gp1Factors}
                isBorrow={p1_gp1?.isBorrow}
                onClick={() => setActivePickerSlot("p1_gp1")}
              />
              <PedigreeSlotCard
                slotLabel="GP"
                cardId={p1_gp2?.card_id}
                name={(p1_gp2 && charaMap.get(p1_gp2.card_id)?.nameEn) || p1_gp2?.name || "GP 2"}
                rank={p1_gp2?.rank}
                factors={p1Gp2Factors}
                isBorrow={p1_gp2?.isBorrow}
                onClick={() => setActivePickerSlot("p1_gp2")}
              />
            </div>
          </div>
        </div>

        {/* Parent 2 branch */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Legacy 2
            </span>
            {setup.parent2 && (
              <button
                type="button"
                onClick={() => setP2IsBorrow(!setup.p2IsBorrow)}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-emerald-600 cursor-pointer transition-colors"
              >
                {setup.p2IsBorrow ? "Borrow" : "Your Uma"} ☔
              </button>
            )}
          </div>
          <div className="flex min-w-0 items-start justify-center gap-2">
            <PedigreeSlotCard
              slotLabel="P2"
              isParentSlot
              cardId={setup.parent2?.card_id}
              name={
                (setup.parent2 && charaMap.get(setup.parent2.card_id)?.nameEn) ||
                setup.parent2?.name ||
                "Select"
              }
              rank={setup.parent2?.rank}
              factors={p2Factors}
              isBorrow={setup.parent2 ? setup.p2IsBorrow : undefined}
              aptitudeWarning={getSlotAptitudeWarning(setup.parent2?.card_id)}
              onClick={() => setActivePickerSlot("p2")}
            />
            <div className="flex min-w-0 gap-1.5">
              <PedigreeSlotCard
                slotLabel="GP"
                cardId={p2_gp1?.card_id}
                name={(p2_gp1 && charaMap.get(p2_gp1.card_id)?.nameEn) || p2_gp1?.name || "GP 1"}
                rank={p2_gp1?.rank}
                factors={p2Gp1Factors}
                isBorrow={p2_gp1?.isBorrow}
                onClick={() => setActivePickerSlot("p2_gp1")}
              />
              <PedigreeSlotCard
                slotLabel="GP"
                cardId={p2_gp2?.card_id}
                name={(p2_gp2 && charaMap.get(p2_gp2.card_id)?.nameEn) || p2_gp2?.name || "GP 2"}
                rank={p2_gp2?.rank}
                factors={p2Gp2Factors}
                isBorrow={p2_gp2?.isBorrow}
                onClick={() => setActivePickerSlot("p2_gp2")}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. NAVIGATION BANNER TO PARENT DECK */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-zinc-50 to-blue-500/10 dark:from-emerald-950/20 dark:via-zinc-900/60 dark:to-blue-950/20 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🃏</span>
          <div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Ready to build your support cards & farm skills?
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Go to the Parent Deck tab to select 6 support cards and inspect all inheritable skills.
            </p>
          </div>
        </div>
        {onNavigateToParentDeck && (
          <button
            type="button"
            onClick={onNavigateToParentDeck}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm active:scale-95 cursor-pointer transition-all shrink-0"
          >
            Go to Parent Deck ➔
          </button>
        )}
      </div>

      {/* 4. PEDIGREE INHERITABLE SKILLS (Innate, Awakening, Events, Uniques, Factors) */}
      <PedigreeSkillsSection />

      {/* Trainee Character Picker Modal */}
      <CharacterPickerModal
        isOpen={isTraineeModalOpen}
        onClose={() => setIsTraineeModalOpen(false)}
        characters={characters}
        onSelect={(chara) => setTargetChara({ charId: chara.charId, cardId: chara.id })}
        title="Select Target Trainee"
      />

      {/* Veteran / Template Picker Modal (Recommended tab first) */}
      <VeteranPickerModal
        isOpen={activePickerSlot !== null}
        onClose={() => setActivePickerSlot(null)}
        slotLabel={
          activePickerSlot === "p1"
            ? "Parent 1"
            : activePickerSlot === "p2"
            ? "Parent 2"
            : "Sub-Parent (Grandparent)"
        }
        recommendations={pickerRecommendations ?? undefined}
        onSelectCandidate={handleSelectCandidate}
        targetCharaId={setup.targetCharaId}
        excludedCharId={
          activePickerSlot === "p1" && setup.parent2
            ? getCharaIdFromCardId(setup.parent2.card_id)
            : activePickerSlot === "p2" && setup.parent1
            ? getCharaIdFromCardId(setup.parent1.card_id)
            : null
        }
        veterans={veterans}
        characters={characters}
        contextParent={pickerContextParent}
        onSelectVeteran={handlePickerSelect}
        onSelectCharacterTemplate={handlePickerTemplate}
      />

      {/* Inherited Skills & Factors Modal */}
      <InheritedSkillsModal
        isOpen={isInheritedSkillsOpen}
        onClose={() => setIsInheritedSkillsOpen(false)}
        participants={participantsList}
      />
    </section>
  );
}
