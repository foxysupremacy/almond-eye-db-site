// Visualizer Skill Pool Composer — builds typed Main and Parent skill pools
// by combining support-card deck skills with character-specific Unique/EVO
// skills and lineage inherited Unique skills.
//
// This module is pure (no React, no side effects). It consumes registry data
// and the parenting setup to produce VisualizerSkill arrays with full
// provenance tracking.

import type { DeckSkill, ParentDeckSkill } from "./deck/types";
import type { ParentingSetup } from "./parenting-state";
import {
  charactersById,
  charactersByCharId,
  skillsById,
  evolvedSkillsByCharacterCardId,
  successionEvolvedSkillByParentCardId,
  getCharacterEvolutions,
} from "./data/registry";
import { resolveGrandparentSlot, resolveTargetCharacter } from "./parenting/pedigree-resolvers";
import { getInheritableSkillForUnique, getRarityCategory, type RarityFilterKey } from "./skill-rarity";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VisualizerFilterCategory = "white" | "gold" | "unique" | "evolved";
export type VisualizerAvailability = "deck" | "owned" | "candidate" | "guaranteed" | "possible";
export type VisualizerOriginKind =
  | "support-event"
  | "support-hint"
  | "trainee-unique"
  | "trainee-evo"
  | "parent-succession-evo"
  | "parent-unique"
  | "grandparent-unique";

export interface VisualizerSkillOrigin {
  kind: VisualizerOriginKind;
  label: string;
  availability: VisualizerAvailability;
  slotLabel?: string;
  originalUniqueSkillId?: number;
  evolvedFrom?: {
    id: number;
    nameEn: string;
    nameJp: string;
    iconId?: number | null;
  };
  cardId?: number;
}

export interface VisualizerSkill {
  id: number;
  nameEn: string;
  nameJp: string;
  descEn?: string;
  rarity: number;
  iconId?: number | null;
  filterCategory: VisualizerFilterCategory;
  origins: VisualizerSkillOrigin[];
}

export interface VisualizerSkillPools {
  main: VisualizerSkill[];
  parent: VisualizerSkill[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Merge a skill into a map, deduplicating by skill id and appending origins. */
function upsertSkill(
  map: Map<number, VisualizerSkill>,
  base: { id: number; nameEn: string; nameJp: string; descEn?: string; rarity: number; iconId?: number | null },
  origin: VisualizerSkillOrigin,
  filterCategory: VisualizerFilterCategory,
): void {
  const existing = map.get(base.id);
  if (existing) {
    // Only add this origin if there isn't already one with the same kind+slotLabel+label
    const isDupe = existing.origins.some(
      (o) => o.kind === origin.kind && o.slotLabel === origin.slotLabel && o.label === origin.label,
    );
    if (!isDupe) existing.origins.push(origin);
    return;
  }
  map.set(base.id, {
    id: base.id,
    nameEn: base.nameEn,
    nameJp: base.nameJp,
    descEn: base.descEn,
    rarity: base.rarity,
    iconId: base.iconId,
    filterCategory,
    origins: [origin],
  });
}

/** Convert a DeckSkill or ParentDeckSkill to the visualizer model. */
function deckSkillToVisualizer(s: DeckSkill | ParentDeckSkill): VisualizerSkill {
  const filterCategory = getRarityCategory(s.rarity);
  const origins: VisualizerSkillOrigin[] = [];

  const grants = s.grants && s.grants.length > 0
    ? s.grants
    : [{ cardId: s.cardId, cardName: s.cardName, source: s.source }];

  for (const g of grants) {
    origins.push({
      kind: g.source === "event" ? "support-event" : "support-hint",
      label: g.cardName,
      availability: "deck",
      cardId: g.cardId,
    });
  }

  return {
    id: s.id,
    nameEn: s.nameEn,
    nameJp: s.nameJp,
    descEn: s.descEn,
    rarity: s.rarity,
    iconId: s.iconId,
    filterCategory,
    origins,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface BuildVisualizerPoolsInput {
  mainSkills: DeckSkill[];
  parentSkills: ParentDeckSkill[];
  setup: ParentingSetup;
}

/**
 * Compose the Main and Parent visualizer skill pools.
 *
 * Main pool:
 *   - All support-card skills from the main deck
 *   - The exact target trainee costume's full Unique skill
 *   - All character-specific EVO skills for that exact costume
 *
 * Parent pool:
 *   - All support-card skills from the parent deck
 *   - Parent-only succession EVO candidates for the 3 supported costumes
 *   - Inherited-white Unique from Parent 1 & Parent 2 (guaranteed)
 *   - Inherited-white Unique from all 4 grandparents (possible)
 */
export function buildVisualizerSkillPools(input: BuildVisualizerPoolsInput): VisualizerSkillPools {
  const { mainSkills, parentSkills, setup } = input;

  // --- Main pool ---
  const mainMap = new Map<number, VisualizerSkill>();
  const parentMap = new Map<number, VisualizerSkill>();

  // 1. Support-card skills
  for (const s of mainSkills) {
    const viz = deckSkillToVisualizer(s);
    for (const origin of viz.origins) {
      upsertSkill(mainMap, viz, origin, viz.filterCategory);
    }
  }

  // 2. Target trainee costume Unique skill and EVO candidates. Resolve the
  // exact costume first, while retaining the base-character fallback for
  // legacy setups that only persisted targetCharaId.
  const target = resolveTargetCharacter(setup, charactersById, charactersByCharId);
  if (target) {
    if (target?.uniqueSkillId) {
      const uniqueSkill = skillsById.get(target.uniqueSkillId);
      if (uniqueSkill) {
        upsertSkill(mainMap, uniqueSkill, {
          kind: "trainee-unique",
          label: `${target.nameEn} · Trainee Unique`,
          availability: "owned",
          cardId: target.id,
        }, "unique");
      }
    }

    // 3. Character-specific EVO candidates
    const evoSkills = evolvedSkillsByCharacterCardId.get(target.id) ?? [];
    for (const evo of evoSkills) {
      const evolutionMeta = getCharacterEvolutions(target.id).find((entry) => entry.skillId === evo.id);
      const baseSkill = evolutionMeta ? skillsById.get(evolutionMeta.baseSkillId) : undefined;
      upsertSkill(mainMap, evo, {
        kind: "trainee-evo",
        label: `${target.nameEn} · EVO`,
        availability: "candidate",
        ...(baseSkill
          ? {
              evolvedFrom: {
                id: baseSkill.id,
                nameEn: baseSkill.nameEn,
                nameJp: baseSkill.nameJp,
                iconId: baseSkill.iconId,
              },
            }
          : {}),
        cardId: target.id,
      }, "evolved");
    }
  }

  // --- Parent pool ---
  // 1. Support-card skills
  for (const s of parentSkills) {
    const viz = deckSkillToVisualizer(s);
    for (const origin of viz.origins) {
      upsertSkill(parentMap, viz, origin, viz.filterCategory);
    }
  }

  // 2. Direct-parent succession EVO candidates. These are intentionally
  // displayed for planning even when account ownership is not available to
  // the app. Grandparents never qualify for the upgraded succession skill.
  const directParents = [
    { slotLabel: "Parent 1", member: setup.parent1 },
    { slotLabel: "Parent 2", member: setup.parent2 },
  ];
  for (const slot of directParents) {
    if (!slot.member) continue;
    const successionEvo = successionEvolvedSkillByParentCardId.get(slot.member.card_id);
    if (!successionEvo) continue;
    const character = charactersById.get(slot.member.card_id);
    upsertSkill(parentMap, successionEvo, {
      kind: "parent-succession-evo",
      label: `${character?.nameEn ?? "Parent"} · ${slot.slotLabel} Succession EVO`,
      slotLabel: slot.slotLabel,
      availability: "candidate",
      cardId: slot.member.card_id,
    }, "evolved");
  }

  // 3. Six-slot lineage inherited Unique skills
  const p1Gp1 = resolveGrandparentSlot(setup.gpOverrides.p1_gp1, setup.parent1, 10);
  const p1Gp2 = resolveGrandparentSlot(setup.gpOverrides.p1_gp2, setup.parent1, 20);
  const p2Gp1 = resolveGrandparentSlot(setup.gpOverrides.p2_gp1, setup.parent2, 10);
  const p2Gp2 = resolveGrandparentSlot(setup.gpOverrides.p2_gp2, setup.parent2, 20);

  const lineage: Array<{
    slotLabel: string;
    member: { card_id: number } | null | undefined;
    availability: "guaranteed" | "possible";
  }> = [
    { slotLabel: "Parent 1", member: setup.parent1, availability: "guaranteed" },
    { slotLabel: "P1 - GP1", member: p1Gp1, availability: "possible" },
    { slotLabel: "P1 - GP2", member: p1Gp2, availability: "possible" },
    { slotLabel: "Parent 2", member: setup.parent2, availability: "guaranteed" },
    { slotLabel: "P2 - GP1", member: p2Gp1, availability: "possible" },
    { slotLabel: "P2 - GP2", member: p2Gp2, availability: "possible" },
  ];

  for (const slot of lineage) {
    if (!slot.member) continue;
    const character = charactersById.get(slot.member.card_id);
    if (!character?.uniqueSkillId) continue;
    const inheritId = getInheritableSkillForUnique(character.uniqueSkillId);
    if (!inheritId) continue;
    const inherited = skillsById.get(inheritId);
    if (!inherited) continue;
    const origin = {
      kind: slot.availability === "guaranteed" ? "parent-unique" : "grandparent-unique",
      label: `${character.nameEn} · ${slot.slotLabel}`,
      slotLabel: slot.slotLabel,
      availability: slot.availability,
      originalUniqueSkillId: character.uniqueSkillId,
      cardId: character.id,
    } satisfies VisualizerSkillOrigin;

    // Lineage skills are useful in both views: Main is the trainee's full
    // build-planning pool, while Parent remains the dedicated lineage view.
    upsertSkill(mainMap, inherited, origin, "unique");
    upsertSkill(parentMap, inherited, origin, "unique");
  }

  // Sort deterministically by nameEn, then id
  const sortFn = (a: VisualizerSkill, b: VisualizerSkill) =>
    a.nameEn.localeCompare(b.nameEn) || a.id - b.id;

  return {
    main: Array.from(mainMap.values()).sort(sortFn),
    parent: Array.from(parentMap.values()).sort(sortFn),
  };
}

/**
 * Filter a VisualizerSkill by its filterCategory instead of its raw rarity.
 * This ensures inherited-white Unique skills (rarity=1, filterCategory="unique")
 * appear under the Unique tab.
 */
export function matchesVisualizerFilter(
  skill: VisualizerSkill,
  filter: RarityFilterKey,
): boolean {
  return filter === "all" || skill.filterCategory === filter;
}

/**
 * Stable lineage display order used by the Unique/Evo tabs:
 * trainee, Parent 1, Parent 2, then the four grandparent slots.
 * A merged skill uses its earliest origin so duplicate lineage grants stay
 * near the first slot that can provide them.
 */
export function getVisualizerOriginOrder(skill: VisualizerSkill): number {
  return Math.min(
    ...skill.origins.map((origin) => {
      if (origin.kind === "trainee-unique" || origin.kind === "trainee-evo") return 0;
      if (origin.slotLabel === "Parent 1") return 1;
      if (origin.slotLabel === "Parent 2") return 2;
      if (origin.slotLabel === "P1 - GP1") return 3;
      if (origin.slotLabel === "P1 - GP2") return 4;
      if (origin.slotLabel === "P2 - GP1") return 5;
      if (origin.slotLabel === "P2 - GP2") return 6;
      return 99;
    }),
  );
}
