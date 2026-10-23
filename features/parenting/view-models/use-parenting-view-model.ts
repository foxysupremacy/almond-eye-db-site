import { useState, useEffect, useMemo, useTransition, useRef, useCallback } from "react";
import { api, type CharacterIndexEntry } from "@/lib/api";
import { useDeck } from "@/features/deck/state";
import {
  serializeParentingToHash,
  deserializeParentingFromHash,
  getRunBorrowState,
  type GrandparentSlot,
  type PickerSlotKey,
  type ParentingSetup,
} from "@/lib/parenting/state";
import { useParentingSetup } from "../hooks";
import { usePedigreeTier } from "../hooks/use-pedigree-tier";
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
import { type PickerRecommendations, createCharacterVeteranTemplate } from "@/features/veterans";
import type { ParticipantSlot } from "@/lib/parenting/types";
import { resolveGrandparentSlot, buildParticipantsList, resolveTargetCharacter } from "@/lib/parenting/pedigree-resolvers";
import { resolveMinmaxPedigree } from "@/lib/parenting/minmax-context";
import { LOOP_ANCESTOR_SLOTS, type LoopAncestorSlot } from "@/lib/parenting/loop-planner";
import { querySlotRecommendations } from "../workers/slot-recommendations-client";

const STYLE_LABELS: Record<number, string> = {
  1: "Runner",
  2: "Leader",
  3: "Betweener",
  4: "Chaser",
};

export interface UseParentingViewModelOptions {
  onNavigateToParentDeck?: () => void;
}

export interface ParentingViewModelState {
  readonly loading: boolean;
  readonly veterans: KyumaruVeteranItem[];
  readonly characters: CharacterIndexEntry[];
  readonly targetChara: CharacterIndexEntry | null;
  readonly setup: ParentingSetup;
  readonly setupLoaded: boolean;
  readonly affinityBreakdown: ReturnType<typeof calculateLineageAffinity>;
  readonly statBonuses: ReturnType<typeof calculateLineageStatBonuses>;
  readonly participantsList: ParticipantSlot[];
  readonly isCompactPage: boolean;
  readonly isTraineeModalOpen: boolean;
  readonly activePickerSlot: PickerSlotKey | null;
  readonly pickerRecommendations: PickerRecommendations | null;
  readonly pickerRecommendationsLoading: boolean;
  readonly pickerRecommendationsError: string | null;
  readonly isInheritedSkillsOpen: boolean;
  readonly copiedLink: boolean;
  readonly pageRef: React.RefObject<HTMLElement | null>;
  readonly course: ReturnType<typeof useDeck>["course"];
  readonly runningStyle: ReturnType<typeof useDeck>["runningStyle"];
  readonly pickerContextParent: KyumaruVeteranItem | null;
  readonly activeSlotLabel: string;
  readonly excludedCharId: number | null;
}

export interface ParentingViewModelCommands {
  readonly openTraineeModal: () => void;
  readonly closeTraineeModal: () => void;
  readonly selectTrainee: (chara: CharacterIndexEntry) => void;
  readonly openPicker: (slot: LoopAncestorSlot) => void;
  readonly closePicker: () => void;
  readonly selectCandidate: (candidate: LegacyCandidate) => void;
  readonly selectVeteran: (vet: KyumaruVeteranItem) => void;
  readonly selectTemplate: (chara: CharacterIndexEntry) => void;
  readonly openInheritedSkills: () => void;
  readonly closeInheritedSkills: () => void;
  readonly handleShare: () => Promise<void>;
  readonly resetParenting: () => void;
  readonly updateSetup: (updater: (prev: ParentingSetup) => ParentingSetup) => void;
  readonly navigateToParentDeck?: () => void;
}

export interface ParentingViewModel {
  readonly state: ParentingViewModelState;
  readonly commands: ParentingViewModelCommands;
}

export function useParentingViewModel({
  onNavigateToParentDeck,
}: UseParentingViewModelOptions = {}): ParentingViewModel {
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

  const loadData = useCallback(async () => {
    try {
      const [vets, charas] = await Promise.all([getAllVeterans(), api.listCharacters()]);
      setVeterans(vets);
      setCharacters(charas);
    } catch (err) {
      console.error("Failed to load parenting data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [loadData]);

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

  // Grandparents resolution
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

  // Lineage Compatibility Calculation
  const affinityBreakdown = useMemo(() => {
    return calculateLineageAffinity(
      setup.targetCharaId,
      setup.parent1,
      setup.parent2,
      { gp1: p1_gp1, gp2: p1_gp2 },
      { gp1: p2_gp1, gp2: p2_gp2 }
    );
  }, [setup.targetCharaId, setup.parent1, setup.parent2, p1_gp1, p1_gp2, p2_gp1, p2_gp2]);

  // Stat Bonuses
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

  const handleShare = useCallback(async () => {
    try {
      const hash = await serializeParentingToHash(setup);
      const url = `${window.location.origin}${window.location.pathname}#${hash}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error("Failed to copy share link:", err);
    }
  }, [setup]);

  const courseLabel = course
    ? `${course.length}m ${course.terrain === 2 ? "Dirt" : "Turf"}${
        runningStyle ? ` · ${STYLE_LABELS[runningStyle] ?? ""}` : ""
      }`
    : null;

  const selectedAncestorForPicker = useCallback((slot: string): KyumaruVeteranItem | null => {
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
  }, [setup.parent1, setup.parent2, p1_gp1, p1_gp2, p2_gp1, p2_gp2, setup.loopConfig?.selectedSlots, veterans, charaMap]);

  const minmaxPedigree = useMemo(() => resolveMinmaxPedigree(setup, veterans, characters), [setup, veterans, characters]);

  // Per-slot recommendations for the picker's "Recommended" tab
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
    setup.supportCardIds,
    selectedAncestorForPicker,
    course,
    runningStyle,
    veterans,
  ]);

  useEffect(() => {
    if (!activePickerSlot || !pickerRequest) {
      setPickerRecommendations(null);
      setPickerRecommendationsLoading(false);
      setPickerRecommendationsError(null);
      return;
    }

    setPickerRecommendations(null);
    setPickerRecommendationsError(null);
    setPickerRecommendationsLoading(true);

    const cancel = querySlotRecommendations(pickerRequest, {
      onResult: (recommendations) => {
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
        setPickerRecommendationsLoading(false);
      },
      onError: (error) => {
        console.error("Failed to calculate parenting recommendations:", error);
        setPickerRecommendationsError("Could not load recommendations. Close and reopen this picker to try again.");
        setPickerRecommendationsLoading(false);
      },
    });

    return () => {
      cancel();
    };
  }, [
    activePickerSlot,
    pickerRequest,
    setup,
    charaMap,
    courseLabel,
    targetChara,
  ]);

  const pickerContextParent = useMemo(() => {
    if (!activePickerSlot) return null;
    if (activePickerSlot === "p1") return setup.parent2;
    if (activePickerSlot === "p2") return setup.parent1;
    return selectedAncestorForPicker(activePickerSlot.slice(0, activePickerSlot.lastIndexOf("_")));
  }, [activePickerSlot, setup.parent1, setup.parent2, selectedAncestorForPicker]);

  const selectLoopSlot = useCallback((slot: LoopAncestorSlot, candidateKey: string, factors?: { factor_id: number }[]) => {
    updateSetup((prev) => {
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
  }, [updateSetup]);

  const handleSelectCandidate = useCallback((candidate: LegacyCandidate) => {
    if (!activePickerSlot) return;
    const isBorrow = !candidate.isVeteran && !candidate.isUntrained;
    const vet = candidateToVeteran(candidate);
    const loopKey = candidate.isVeteran
      ? `v:${candidate.veteran?.trained_chara_id ?? candidate.cardId}:${candidate.veteran?.create_time ?? ""}`
      : `${candidate.isUntrained ? "r" : "b"}:${candidate.cardId}`;

    selectLoopSlot(activePickerSlot as LoopAncestorSlot, loopKey, candidate.isVeteran ? vet.factor_info_array : undefined);

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
  }, [activePickerSlot, selectLoopSlot, setParent1, setP1IsBorrow, setParent2, setP2IsBorrow, setGpOverride]);

  const handlePickerSelect = useCallback((vet: KyumaruVeteranItem) => {
    if (!activePickerSlot) return;
    selectLoopSlot(activePickerSlot as LoopAncestorSlot, `v:${vet.trained_chara_id ?? vet.card_id}:${vet.create_time ?? ""}`, vet.factor_info_array);
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
  }, [activePickerSlot, selectLoopSlot, setParent1, setParent2, setGpOverride]);

  const handlePickerTemplate = useCallback((chara: CharacterIndexEntry) => {
    if (!activePickerSlot) return;
    const stub: KyumaruVeteranItem = createCharacterVeteranTemplate(chara);
    selectLoopSlot(activePickerSlot as LoopAncestorSlot, `b:${chara.id}`);

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
  }, [activePickerSlot, selectLoopSlot, setParent1, setP1IsBorrow, setParent2, setP2IsBorrow, setGpOverride]);

  const openPicker = useCallback((slot: LoopAncestorSlot) => {
    setPickerRecommendations(null);
    setPickerRecommendationsError(null);
    setPickerRecommendationsLoading(Boolean(setup.targetCharaId));
    setActivePickerSlot(slot);
  }, [setup.targetCharaId]);

  const closePicker = useCallback(() => {
    setActivePickerSlot(null);
  }, []);

  const openTraineeModal = useCallback(() => {
    setIsTraineeModalOpen(true);
  }, []);

  const closeTraineeModal = useCallback(() => {
    setIsTraineeModalOpen(false);
  }, []);

  const selectTrainee = useCallback((chara: CharacterIndexEntry) => {
    setTargetChara({ charId: chara.charId, cardId: chara.id });
    setIsTraineeModalOpen(false);
  }, [setTargetChara]);

  const openInheritedSkills = useCallback(() => {
    setIsInheritedSkillsOpen(true);
  }, []);

  const closeInheritedSkills = useCallback(() => {
    setIsInheritedSkillsOpen(false);
  }, []);

  const activeSlotLabel = useMemo(() => {
    if (!activePickerSlot) return "Ancestor";
    if (activePickerSlot === "p1") return "Parent 1";
    if (activePickerSlot === "p2") return "Parent 2";
    const depth = activePickerSlot.split("_").length;
    if (depth <= 2) return "Grandparent";
    if (depth === 3) return "Great-grandparent";
    return "Great-great-grandparent";
  }, [activePickerSlot]);

  const excludedCharId = useMemo(() => {
    if (activePickerSlot === "p1" && setup.parent2) {
      return getCharaIdFromCardId(setup.parent2.card_id);
    }
    if (activePickerSlot === "p2" && setup.parent1) {
      return getCharaIdFromCardId(setup.parent1.card_id);
    }
    return null;
  }, [activePickerSlot, setup.parent1, setup.parent2]);

  return {
    state: {
      loading,
      veterans,
      characters,
      targetChara,
      setup,
      setupLoaded,
      affinityBreakdown,
      statBonuses,
      participantsList,
      isCompactPage,
      isTraineeModalOpen,
      activePickerSlot,
      pickerRecommendations,
      pickerRecommendationsLoading,
      pickerRecommendationsError,
      isInheritedSkillsOpen,
      copiedLink,
      pageRef,
      course,
      runningStyle,
      pickerContextParent,
      activeSlotLabel,
      excludedCharId,
    },
    commands: {
      openTraineeModal,
      closeTraineeModal,
      selectTrainee,
      openPicker,
      closePicker,
      selectCandidate: handleSelectCandidate,
      selectVeteran: handlePickerSelect,
      selectTemplate: handlePickerTemplate,
      openInheritedSkills,
      closeInheritedSkills,
      handleShare,
      resetParenting,
      updateSetup,
      navigateToParentDeck: onNavigateToParentDeck,
    },
  };
}
