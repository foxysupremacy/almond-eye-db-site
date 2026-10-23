import { useState, useEffect, useMemo, useCallback } from "react";
import { api, type CharacterIndexEntry } from "@/lib/api";
import type { GrandparentSlot, ParentingSetup } from "@/lib/parenting/state";
import { useParentingSetup } from "@/features/parenting/hooks";
import { calculateLineageAffinity } from "@/lib/lineage/affinity-engine";
import { resolveTargetCharacter } from "@/lib/parenting/pedigree-resolvers";

export interface ParentDeckViewModelState {
  readonly characters: readonly CharacterIndexEntry[];
  readonly targetChara: CharacterIndexEntry | null;
  readonly p1Chara: CharacterIndexEntry | null;
  readonly p2Chara: CharacterIndexEntry | null;
  readonly p1_gp1: GrandparentSlot | null;
  readonly p1_gp2: GrandparentSlot | null;
  readonly p2_gp1: GrandparentSlot | null;
  readonly p2_gp2: GrandparentSlot | null;
  readonly affinityBreakdown: ReturnType<typeof calculateLineageAffinity>;
  readonly hasLineage: boolean;
  readonly setup: ParentingSetup;
}

export interface ParentDeckViewModelCommands {
  readonly navigateToParenting: () => void;
}

export interface ParentDeckViewModel {
  readonly state: ParentDeckViewModelState;
  readonly commands: ParentDeckViewModelCommands;
}

export function useParentDeckViewModel(onNavigateToParenting: () => void): ParentDeckViewModel {
  const { setup } = useParentingSetup();
  const [characters, setCharacters] = useState<CharacterIndexEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.listCharacters()
      .then((chars) => {
        if (!cancelled) setCharacters(chars);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, []);

  const charaByCharIdMap = useMemo(() => {
    return new Map<number, CharacterIndexEntry>(characters.map((c) => [c.charId, c]));
  }, [characters]);

  const charaByCardIdMap = useMemo(() => {
    return new Map<number, CharacterIndexEntry>(characters.map((c) => [c.id, c]));
  }, [characters]);

  const targetChara = useMemo(() => {
    return resolveTargetCharacter(setup, charaByCardIdMap, charaByCharIdMap);
  }, [setup, charaByCardIdMap, charaByCharIdMap]);

  const p1Chara = useMemo(() => {
    if (!setup.parent1) return null;
    return charaByCardIdMap.get(setup.parent1.card_id) || null;
  }, [setup.parent1, charaByCardIdMap]);

  const p2Chara = useMemo(() => {
    if (!setup.parent2) return null;
    return charaByCardIdMap.get(setup.parent2.card_id) || null;
  }, [setup.parent2, charaByCardIdMap]);

  // Grandparents resolution
  const p1_gp1 = useMemo((): GrandparentSlot | null => {
    if (setup.gpOverrides.p1_gp1 !== undefined) return setup.gpOverrides.p1_gp1;
    const gp = setup.parent1?.succession_chara_array?.find((p) => p.position_id === 10);
    return gp ? { card_id: gp.card_id, win_saddle_id_array: gp.win_saddle_id_array, factor_info_array: gp.factor_info_array } : null;
  }, [setup.gpOverrides.p1_gp1, setup.parent1]);

  const p1_gp2 = useMemo((): GrandparentSlot | null => {
    if (setup.gpOverrides.p1_gp2 !== undefined) return setup.gpOverrides.p1_gp2;
    const gp = setup.parent1?.succession_chara_array?.find((p) => p.position_id === 20);
    return gp ? { card_id: gp.card_id, win_saddle_id_array: gp.win_saddle_id_array, factor_info_array: gp.factor_info_array } : null;
  }, [setup.gpOverrides.p1_gp2, setup.parent1]);

  const p2_gp1 = useMemo((): GrandparentSlot | null => {
    if (setup.gpOverrides.p2_gp1 !== undefined) return setup.gpOverrides.p2_gp1;
    const gp = setup.parent2?.succession_chara_array?.find((p) => p.position_id === 10);
    return gp ? { card_id: gp.card_id, win_saddle_id_array: gp.win_saddle_id_array, factor_info_array: gp.factor_info_array } : null;
  }, [setup.gpOverrides.p2_gp1, setup.parent2]);

  const p2_gp2 = useMemo((): GrandparentSlot | null => {
    if (setup.gpOverrides.p2_gp2 !== undefined) return setup.gpOverrides.p2_gp2;
    const gp = setup.parent2?.succession_chara_array?.find((p) => p.position_id === 20);
    return gp ? { card_id: gp.card_id, win_saddle_id_array: gp.win_saddle_id_array, factor_info_array: gp.factor_info_array } : null;
  }, [setup.gpOverrides.p2_gp2, setup.parent2]);

  // Compatibility score
  const affinityBreakdown = useMemo(() => {
    return calculateLineageAffinity(
      setup.targetCharaId,
      setup.parent1,
      setup.parent2,
      { gp1: p1_gp1, gp2: p1_gp2 },
      { gp1: p2_gp1, gp2: p2_gp2 }
    );
  }, [setup.targetCharaId, setup.parent1, setup.parent2, p1_gp1, p1_gp2, p2_gp1, p2_gp2]);

  const hasLineage = Boolean(setup.targetCharaId || setup.parent1 || setup.parent2);

  const navigateToParenting = useCallback(() => {
    onNavigateToParenting();
  }, [onNavigateToParenting]);

  return {
    state: {
      characters,
      targetChara,
      p1Chara,
      p2Chara,
      p1_gp1,
      p1_gp2,
      p2_gp1,
      p2_gp2,
      affinityBreakdown,
      hasLineage,
      setup,
    },
    commands: {
      navigateToParenting,
    },
  };
}
