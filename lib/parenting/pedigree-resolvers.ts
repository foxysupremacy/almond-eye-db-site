import type { CharacterIndexEntry } from "../api";
import type { KyumaruVeteranItem } from "../kyumaru-types";
import type {
  ParentingSetup,
  GrandparentSlot,
} from "../parenting-state";
import type { ParticipantSlot } from "../../components/inherited-skills-modal";

/**
 * Resolves a grandparent slot from manual overrides or from parent veteran's succession history.
 */
export function resolveGrandparentSlot(
  override: GrandparentSlot | null | undefined,
  parentVet: KyumaruVeteranItem | null,
  positionId: 10 | 20,
): GrandparentSlot | null {
  if (override !== undefined) return override;
  const gp = parentVet?.succession_chara_array?.find((p) => p.position_id === positionId);
  return gp
    ? {
        card_id: gp.card_id,
        rank: gp.rank,
        rarity: gp.rarity,
        win_saddle_id_array: gp.win_saddle_id_array,
        factor_info_array: gp.factor_info_array,
      }
    : null;
}

export interface ResolvedGrandparents {
  p1_gp1: GrandparentSlot | null;
  p1_gp2: GrandparentSlot | null;
  p2_gp1: GrandparentSlot | null;
  p2_gp2: GrandparentSlot | null;
}

/**
 * Derives the 6 participant slots for the Inherited Skills modal.
 */
export function buildParticipantsList(
  setup: ParentingSetup,
  gps: ResolvedGrandparents,
  charaMap: Map<number, CharacterIndexEntry>,
): ParticipantSlot[] {
  return [
    {
      slotLabel: "Parent 1",
      subLabel: "Direct Parent",
      vet: setup.parent1,
      chara: setup.parent1 ? charaMap.get(setup.parent1.card_id) || null : null,
    },
    {
      slotLabel: "P1 - GP1",
      subLabel: "Grandparent 1",
      vet: gps.p1_gp1,
      chara: gps.p1_gp1 ? charaMap.get(gps.p1_gp1.card_id) || null : null,
    },
    {
      slotLabel: "P1 - GP2",
      subLabel: "Grandparent 2",
      vet: gps.p1_gp2,
      chara: gps.p1_gp2 ? charaMap.get(gps.p1_gp2.card_id) || null : null,
    },
    {
      slotLabel: "Parent 2",
      subLabel: "Direct Parent",
      vet: setup.parent2,
      chara: setup.parent2 ? charaMap.get(setup.parent2.card_id) || null : null,
    },
    {
      slotLabel: "P2 - GP1",
      subLabel: "Grandparent 1",
      vet: gps.p2_gp1,
      chara: gps.p2_gp1 ? charaMap.get(gps.p2_gp1.card_id) || null : null,
    },
    {
      slotLabel: "P2 - GP2",
      subLabel: "Grandparent 2",
      vet: gps.p2_gp2,
      chara: gps.p2_gp2 ? charaMap.get(gps.p2_gp2.card_id) || null : null,
    },
  ];
}
