"use client";

// The Parenting Hub for AlmondEye DB — rebuilt around branch compatibility:
// - Target Trainee stage + live lineage affinity header (◎ / ◯ / △)
// - Two parent slots with auto-resolved grandparent chips (from succession history)
// - GameTora-style compatibility lists: best legacies + per-branch sub-legacies,
//   ranked by affinity and filtered by unique-skill track/style suitability.

import { useState, useEffect, useMemo, useTransition, useRef } from "react";
import { api, type CharacterIndexEntry } from "@/lib/api";
import { useDeck } from "@/features/deck/state";
import {
  serializeParentingToHash,
  deserializeParentingFromHash,
  getRunBorrowState,
  type GrandparentSlot,
  type PickerSlotKey,
} from "@/lib/parenting/state";
import { useParentingSetup } from "./hooks";
import { usePedigreeTier } from "./hooks/use-pedigree-tier";
import { getAllVeterans } from "@/lib/IndexDB/veterans-db";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";
import {
  calculateLineageAffinity,
  getCharaIdFromCardId,
} from "@/lib/lineage/affinity-engine";
import {
  calculateLineageStatBonuses,
} from "@/lib/lineage/factor-decoder";
import {
  candidateToVeteran,
  type LegacyCandidate,
  type SlotRecommendations,
} from "@/lib/parenting";
import CharacterPickerModal from "@/features/parenting/components/character-picker-modal";
import { VeteranPickerModal, type PickerRecommendations, createCharacterVeteranTemplate } from "@/features/veterans";
import InheritedSkillsModal from "@/features/parenting/components/inherited-skills-modal";
import type { ParticipantSlot } from "@/lib/parenting/types";
import { LineageAffinityHeader } from "@/features/parenting/components/lineage-affinity-header";
import { TraineeSpotlight } from "@/features/parenting/components/trainee-spotlight";
import { resolveGrandparentSlot, buildParticipantsList, resolveTargetCharacter } from "@/lib/parenting/pedigree-resolvers";
import { PedigreeSkillsSection } from "@/features/parenting/components/pedigree-skills-section";
import { Badge } from "@/app/common/ui/primitives/badge";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { CheckIcon, LinkIcon } from "@/app/common/ui/primitives/icons";
import { ParentingLoopOptimizer } from "./loop-optimizer";
import { resolveMinmaxPedigree } from "@/lib/parenting/minmax-context";
import { LOOP_ANCESTOR_SLOTS, type LoopAncestorSlot } from "@/lib/parenting/loop-planner";

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
  const pageRef = useRef<HTMLElement>(null);
  const pageTier = usePedigreeTier(pageRef);
  const isCompactPage = pageTier !== "desktop";

  const {
    setup,
    loaded: setupLoaded,
    setTargetChara,
    setParent1,
    setParent2,
    setP1IsBorrow,
    setP2IsBorrow,
    setGpOverride,
    updateSetup,
    resetParenting,
  } = useParentingSetup();

  const [veterans, setVeterans] = useState<KyumaruVeteranItem[]>([]);
  const [characters, setCharacters] = useState<CharacterIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & UI States
  const [isTraineeModalOpen, setIsTraineeModalOpen] = useState(false);
  const [activePickerSlot, setActivePickerSlot] = useState<PickerSlotKey | null>(null);
  const [pickerRecommendations, setPickerRecommendations] = useState<PickerRecommendations | null>(null);
  const [pickerRecommendationsLoading, setPickerRecommendationsLoading] = useState(false);
  const [pickerRecommendationsError, setPickerRecommendationsError] = useState<string | null>(null);
  const [isInheritedSkillsOpen, setIsInheritedSkillsOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const restoredShareRef = useRef<string | null>(null);
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

  useEffect(() => {
    const hash = window.location.hash;
    if (!setupLoaded || loading || !hash.startsWith("#parenting=") || restoredShareRef.current === hash) return;
    restoredShareRef.current = hash;
    let cancelled = false;
    void deserializeParentingFromHash(hash, veterans).then((restored) => {
      if (cancelled) return;
      updateSetup(() => restored);
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#parenting`);
    }).catch((error) => {
      console.error("Could not restore Parenting share link:", error);
      restoredShareRef.current = null;
    });
    return () => { cancelled = true; };
  }, [setupLoaded, loading, veterans, updateSetup]);

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

  const selectedAncestorForPicker = (slot: string): KyumaruVeteranItem | null => {
    if (slot === "p1") return setup.parent1;
    if (slot === "p2") return setup.parent2;
    if (slot === "p1_gp1") return p1_gp1 as unknown as KyumaruVeteranItem | null;
    if (slot === "p1_gp2") return p1_gp2 as unknown as KyumaruVeteranItem | null;
    if (slot === "p2_gp1") return p2_gp1 as unknown as KyumaruVeteranItem | null;
    if (slot === "p2_gp2") return p2_gp2 as unknown as KyumaruVeteranItem | null;
    const selectedKey = setup.loopConfig?.selectedSlots[slot as LoopAncestorSlot];
    if (!selectedKey) return null;
    const [source, identityText] = selectedKey.split(":");
    const identity = Number(identityText);
    const veteran = source === "v"
      ? veterans.find((entry) => entry.trained_chara_id === identity || entry.card_id === identity)
      : null;
    if (veteran) return veteran;
    const character = charaMap.get(identity);
    return character ? { card_id: character.id, trained_chara_id: character.id, name: character.nameEn } as KyumaruVeteranItem : null;
  };

  const minmaxPedigree = useMemo(() => resolveMinmaxPedigree(setup, veterans, characters), [setup, veterans, characters]);

  // Per-slot recommendations for the picker's "Recommended" tab.
  // Parent slots score by trainee affinity; GP slots add affinity with the branch parent.
  const pickerRequest = useMemo(() => {
    if (!activePickerSlot || !setup.targetCharaId) return null;

    const branchPrefix = activePickerSlot.startsWith("p1") ? "p1" : activePickerSlot.startsWith("p2") ? "p2" : null;
    const isDescendant = activePickerSlot.split("_").length > 2;
    const parentSlot = activePickerSlot.slice(0, activePickerSlot.lastIndexOf("_"));
    const branchParent = isDescendant ? selectedAncestorForPicker(parentSlot) : branchPrefix === "p1" ? setup.parent1 : branchPrefix === "p2" ? setup.parent2 : null;

    const excludedCharIds: number[] = [];
    if (activePickerSlot === "p1" && setup.parent2) {
      excludedCharIds.push(getCharaIdFromCardId(setup.parent2.card_id));
    } else if (activePickerSlot === "p2" && setup.parent1) {
      excludedCharIds.push(getCharaIdFromCardId(setup.parent1.card_id));
    } else if (branchPrefix) {
      if (setup.parent1) excludedCharIds.push(getCharaIdFromCardId(setup.parent1.card_id));
      if (setup.parent2) excludedCharIds.push(getCharaIdFromCardId(setup.parent2.card_id));
      const finalSegment = activePickerSlot.slice(activePickerSlot.lastIndexOf("_") + 1);
      const siblingKey = isDescendant
        ? `${parentSlot}_${finalSegment === "g1" ? "g2" : "g1"}`
        : `${branchPrefix}_${finalSegment === "gp1" ? "gp2" : "gp1"}`;
      const sibling = selectedAncestorForPicker(siblingKey);
      if (sibling) excludedCharIds.push(getCharaIdFromCardId(sibling.card_id));
    }

    return {
      targetCharaId: setup.targetCharaId,
      minmax: { ancestors: minmaxPedigree.ancestors, config: minmaxPedigree.config, target: targetChara, slot: activePickerSlot },
      branchParent,
      excludedCharIds,
      course: course ?? null,
      runningStyle: runningStyle ?? null,
      veterans,
      supportCardIds: setup.supportCardIds,
    };
  }, [
    activePickerSlot,
    minmaxPedigree,
    targetChara,
    setup.targetCharaId,
    setup.parent1,
    setup.parent2,
    setup.p1IsBorrow,
    setup.p2IsBorrow,
    setup.supportCardIds,
    setup.loopConfig?.selectedSlots,
    p1_gp1,
    p1_gp2,
    p2_gp1,
    p2_gp2,
    course,
    runningStyle,
    veterans,
    charaMap,
  ]);

  useEffect(() => {
    if (!activePickerSlot || !pickerRequest) {
      setPickerRecommendations(null);
      setPickerRecommendationsLoading(false);
      setPickerRecommendationsError(null);
      return;
    }

    let cancelled = false;
    setPickerRecommendations(null);
    setPickerRecommendationsError(null);
    setPickerRecommendationsLoading(true);

    const worker = new Worker(
      new URL("./workers/slot-recommendations.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<{
      recommendations: SlotRecommendations;
      error?: string;
    }>) => {
      if (cancelled) return;
      const { error, recommendations } = event.data;
      if (error) {
        setPickerRecommendationsError(error);
      } else {
        const runBorrow = getRunBorrowState(setup, activePickerSlot);
        const branchParent = pickerRequest.branchParent;
        const generationLabel = activePickerSlot.split("_").length <= 2
          ? "Grandparent"
          : activePickerSlot.split("_").length === 3 ? "Great-grandparent" : "Great-great-grandparent";
        const branchName = branchParent
          ? charaMap.get(branchParent.card_id)?.nameEn ?? branchParent.name ?? null
          : null;
        const contextNote = branchName
          ? `${generationLabel} slot — ranked by aptitude, genetic risk, G1 and affinity with the trainee + ${branchName}${courseLabel ? ` · ${courseLabel}` : ""}`
          : `Parent slot — ranked by aptitude, genetic risk, G1 and affinity with ${targetChara?.nameEn ?? "trainee"}${courseLabel ? ` · ${courseLabel}` : ""}`;
        setPickerRecommendations({
          ...recommendations,
          borrowUsed: runBorrow.used,
          runLabel: runBorrow.runLabel,
          contextNote,
        });
      }
      setPickerRecommendationsLoading(false);
    };
    worker.onerror = (event) => {
      if (cancelled) return;
      console.error("Failed to calculate parenting recommendations:", event.message);
      setPickerRecommendationsError("Could not load recommendations. Close and reopen this picker to try again.");
      setPickerRecommendationsLoading(false);
    };
    worker.postMessage(pickerRequest);

    return () => {
      cancelled = true;
      worker.terminate();
    };
  }, [
    activePickerSlot,
    pickerRequest,
    setup,
    charaMap,
    courseLabel,
    targetChara,
  ]);

  // The other fixed uma for the open picker slot: the other parent for P1/P2,
  // the branch parent for grandparent slots (drives shared-G1 context).
  const pickerContextParent = useMemo(() => {
    if (!activePickerSlot) return null;
    if (activePickerSlot === "p1") return setup.parent2;
    if (activePickerSlot === "p2") return setup.parent1;
    return selectedAncestorForPicker(activePickerSlot.slice(0, activePickerSlot.lastIndexOf("_")));
  }, [activePickerSlot, setup.parent1, setup.parent2, setup.loopConfig?.selectedSlots, veterans, charaMap, p1_gp1, p1_gp2, p2_gp1, p2_gp2]);

  const loopKeyForCandidate = (candidate: LegacyCandidate) => candidate.isVeteran
    ? `v:${candidate.veteran?.trained_chara_id ?? candidate.cardId}:${candidate.veteran?.create_time ?? ""}`
    : `${candidate.isUntrained ? "r" : "b"}:${candidate.cardId}`;
  const selectLoopSlot = (slot: LoopAncestorSlot, candidateKey: string, factors?: { factor_id: number }[]) => updateSetup((prev) => {
    const factorGoals = { ...(prev.loopConfig?.factorGoals ?? {}) };
    const selectedSlots = { ...(prev.loopConfig?.selectedSlots ?? {}) };
    const lockedSlots = { ...(prev.loopConfig?.lockedSlots ?? {}) };
    if (selectedSlots[slot] && selectedSlots[slot] !== candidateKey) {
      for (const descendant of LOOP_ANCESTOR_SLOTS.filter((key) => key.startsWith(`${slot}_`))) {
        delete selectedSlots[descendant];
        delete lockedSlots[descendant];
        if (descendant.split("_").length < 4) delete factorGoals[descendant];
      }
    }
    if (factors) {
      const blueId = factors.find(({ factor_id }) => factor_id >= 101 && factor_id <= 503)?.factor_id;
      const pinkId = factors.find(({ factor_id }) => factor_id >= 1101 && factor_id <= 3403)?.factor_id;
      const pinkCode = pinkId == null ? 0 : Math.floor(pinkId / 100);
      const pink = ({ 11: "Turf", 12: "Dirt", 21: "Sprint", 22: "Mile", 23: "Medium", 24: "Long", 31: "Runner", 32: "Leader", 33: "Betweener", 34: "Chaser" } as const)[pinkCode as 11 | 12 | 21 | 22 | 23 | 24 | 31 | 32 | 33 | 34] ?? null;
      factorGoals[slot] = { blue: blueId == null ? null : Math.floor(blueId / 100), blueStars: blueId == null ? 0 : blueId % 10, pink, pinkStars: pinkId == null ? 0 : pinkId % 10 };
    } else delete factorGoals[slot];
    return {
      ...prev,
      loopConfig: {
        ...prev.loopConfig,
        geneGoals: prev.loopConfig?.geneGoals ?? {},
        factorGoals,
        selectedSlots: { ...selectedSlots, [slot]: candidateKey },
        lockedSlots: { ...lockedSlots, [slot]: candidateKey },
        aptitudeGoals: prev.loopConfig?.aptitudeGoals ?? {},
        includeTripleCrownAffinity: prev.loopConfig?.includeTripleCrownAffinity ?? false,
        includeTiaraAffinity: prev.loopConfig?.includeTiaraAffinity ?? false,
      },
    };
  });

  const handleSelectCandidate = (candidate: LegacyCandidate) => {
    if (!activePickerSlot) return;
    // Untrained picks are owned Umas — they never consume the run's borrow.
    const isBorrow = !candidate.isVeteran && !candidate.isUntrained;
    const vet = candidateToVeteran(candidate);
    selectLoopSlot(activePickerSlot, loopKeyForCandidate(candidate), candidate.isVeteran ? vet.factor_info_array : undefined);

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
    selectLoopSlot(activePickerSlot!, `v:${vet.trained_chara_id ?? vet.card_id}:${vet.create_time ?? ""}`, vet.factor_info_array);
    if (activePickerSlot === "p1") {
      setParent1(vet);
    } else if (activePickerSlot === "p2") {
      setParent2(vet);
    } else if (activePickerSlot === "p1_gp1" || activePickerSlot === "p1_gp2" || activePickerSlot === "p2_gp1" || activePickerSlot === "p2_gp2") {
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
    const stub: KyumaruVeteranItem = createCharacterVeteranTemplate(chara);
    selectLoopSlot(activePickerSlot!, `b:${chara.id}`);

    if (activePickerSlot === "p1") {
      setParent1(stub);
      setP1IsBorrow(true);
    } else if (activePickerSlot === "p2") {
      setParent2(stub);
      setP2IsBorrow(true);
    } else if (activePickerSlot === "p1_gp1" || activePickerSlot === "p1_gp2" || activePickerSlot === "p2_gp1" || activePickerSlot === "p2_gp2") {
      setGpOverride(activePickerSlot, {
        card_id: chara.id,
        name: chara.nameEn,
        win_saddle_id_array: [],
        trained_chara_id: chara.id,
        isBorrow: true,
      });
    }
  };

  const openPicker = (slot: LoopAncestorSlot) => {
    setPickerRecommendations(null);
    setPickerRecommendationsError(null);
    setPickerRecommendationsLoading(Boolean(setup.targetCharaId));
    setActivePickerSlot(slot);
  };

  if (loading) {
    // Keeps the same <section> element across loading -> loaded so pageRef stays observed.
    return (
      <section ref={pageRef} className="w-full">
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <div className="w-9 h-9 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-400">Loading Parenting Hub & Inheritance Engine...</p>
        </div>
      </section>
    );
  }

  const parentDeckBanner = (
    <div className={isCompactPage
      ? "rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-zinc-50 to-blue-500/10 dark:from-emerald-950/20 dark:via-zinc-900/60 dark:to-blue-950/20 p-3 flex items-center justify-between gap-3 shadow-xs"
      : "rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-zinc-50 to-blue-500/10 dark:from-emerald-950/20 dark:via-zinc-900/60 dark:to-blue-950/20 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs"}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">🃏</span>
        <div>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Ready to build your support cards & farm skills?
          </h4>
          {!isCompactPage && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Go to the Parent Deck tab to select 6 support cards and inspect all inheritable skills.
            </p>
          )}
        </div>
      </div>
      {onNavigateToParentDeck && (
        <AppButton
          variant="quiet"
          onPress={onNavigateToParentDeck}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm active:scale-95 cursor-pointer transition-all shrink-0"
        >
          Go to Parent Deck ➔
        </AppButton>
      )}
    </div>
  );

  return (
    <section ref={pageRef} className="w-full flex flex-col gap-6">
      {/* Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Parenting Hub
            </h2>
            <Badge size="standard" tone="emerald" className="font-bold">
              Compatibility
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Affinity-ranked legacy recommendations, filtered by unique-skill timing on the selected track.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <AppButton
            variant="quiet"
            onPress={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-2xs cursor-pointer transition-colors"
            title="Copy shareable link with current setup"
          >
            {copiedLink ? <CheckIcon className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
            <span>{copiedLink ? "Link Copied!" : "Share Plan"}</span>
          </AppButton>
          <AppButton
            variant="quiet"
            onPress={resetParenting}
            className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-500 hover:text-red-500 hover:border-red-200 dark:hover:border-red-900/50 cursor-pointer transition-colors"
          >
            Reset Setup
          </AppButton>
        </div>
      </div>

      {/* Unified 14-ancestor pedigree and loop planner */}
      <ParentingLoopOptimizer
        target={targetChara}
        course={course}
        runningStyle={runningStyle}
        targetStage={<div className="relative rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/75 dark:bg-zinc-900/75 p-4 sm:p-6 shadow-sm overflow-hidden backdrop-blur-md">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <LineageAffinityHeader affinityBreakdown={affinityBreakdown} onOpenInheritedSkills={() => setIsInheritedSkillsOpen(true)} />
          <TraineeSpotlight compact={isCompactPage} targetChara={targetChara} statBonuses={statBonuses} onSelectTrainee={() => setIsTraineeModalOpen(true)} />
        </div>}
        veterans={veterans}
        roster={characters}
        setup={setup}
        onOpenPicker={openPicker}
        updateSetup={updateSetup}
      />

      {/* 3. NAVIGATION BANNER TO PARENT DECK (desktop: before the skills section) */}
      {!isCompactPage && parentDeckBanner}

      {/* 4. PEDIGREE INHERITABLE SKILLS (Innate, Awakening, Events, Uniques, Factors) */}
      <PedigreeSkillsSection />

      {/* Phone/tablet: the banner moves after the skills section as a single row */}
      {isCompactPage && parentDeckBanner}

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
        minmaxEnabled
        onClose={() => setActivePickerSlot(null)}
        slotLabel={activePickerSlot === "p1" ? "Parent 1" : activePickerSlot === "p2" ? "Parent 2" : activePickerSlot ? activePickerSlot.split("_").length <= 2 ? "Grandparent" : activePickerSlot.split("_").length === 3 ? "Great-grandparent" : "Great-great-grandparent" : "Ancestor"}
        recommendations={pickerRecommendations ?? undefined}
        recommendationsLoading={pickerRecommendationsLoading}
        recommendationsError={pickerRecommendationsError}
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
