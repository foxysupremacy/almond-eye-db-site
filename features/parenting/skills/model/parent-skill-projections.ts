import type { ParentDeckSkill } from "@/lib/deck/types";
import {
  getInheritableSkillForGold,
  getRarityCategory,
  matchesRarityFilter,
  type RarityFilterKey,
} from "@/lib/skills/rarity";
import type { CardIndexEntry, CharacterIndexEntry, SkillDetail } from "@/lib/api";
import type { DisplayParentSkill } from "../../hooks/use-lineage-skills";

export type ParentSkillFilterTab =
  | "all"
  | "inherit_only"
  | "unique"
  | "duplicate"
  | "parent_duplicate"
  | "hint"
  | "event"
  | "parent_unique"
  | "factor";
export type ParentSkillSourceFilter = "all" | "cards" | "lineage" | "hard_to_get";

export interface ParentSkillFilterOptions {
  filter: ParentSkillFilterTab;
  sourceFilter: ParentSkillSourceFilter;
  rarityFilter: RarityFilterKey;
  search: string;
  uniqueTargetIds: ReadonlySet<number>;
  duplicateInParentIds: ReadonlySet<number>;
}

const NON_INHERITABLE_HARD_TO_GET_SKILLS = new Set([204262]);

/**
 * Find track-active skills that no support card grants but at least one Uma can
 * pass through lineage. Character grants use the same gold-to-white and unique
 * inherit mappings as the Parenting skill list.
 */
export function buildHardToGetSkills(
  skills: readonly SkillDetail[],
  cards: readonly CardIndexEntry[],
  characters: readonly CharacterIndexEntry[],
  canActivate: (skillId: number) => boolean,
): DisplayParentSkill[] {
  const cardSkillIds = new Set<number>();
  for (const card of cards) {
    for (const skillId of [...card.hintSkills, ...card.eventSkills]) {
      cardSkillIds.add(skillId);
      const inherited = getInheritableSkillForGold(skillId);
      if (inherited) cardSkillIds.add(inherited.whiteId);
    }
  }

  const characterGrants = new Map<number, DisplayParentSkill["grants"]>();
  const sourceBySkill = new Map<number, DisplayParentSkill["source"]>();
  const addCharacterGrant = (
    skillId: number,
    character: CharacterIndexEntry,
    grantSource: string,
    source: DisplayParentSkill["source"],
  ) => {
    if (!skillId) return;
    const grant = {
      cardName: character.nameEn || character.nameJp,
      source: grantSource,
      cardId: character.id,
      charId: character.charId,
    };
    const grants = characterGrants.get(skillId) ?? [];
    if (!grants.some((existing) => existing?.cardId === character.id && existing.source === grantSource)) {
      characterGrants.set(skillId, [...grants, grant]);
    }
    // Preserve the first source category for the existing skill filters.
    sourceBySkill.set(skillId, sourceBySkill.get(skillId) ?? source);
  };

  for (const character of characters) {
    for (const skillId of character.innateSkills ?? []) {
      const inherited = getInheritableSkillForGold(skillId);
      addCharacterGrant(inherited?.whiteId ?? skillId, character, "Innate", "hint");
    }
    for (const skillId of character.awakeningSkills ?? []) {
      const inherited = getInheritableSkillForGold(skillId);
      addCharacterGrant(inherited?.whiteId ?? skillId, character, "Awakening", "event");
    }
    for (const skillId of character.eventSkills ?? []) {
      const inherited = getInheritableSkillForGold(skillId);
      addCharacterGrant(inherited?.whiteId ?? skillId, character, "Event", "event");
    }
  }

  return skills.flatMap((skill) => {
    const grants = characterGrants.get(skill.id);
    if (
      !grants?.length ||
      cardSkillIds.has(skill.id) ||
      NON_INHERITABLE_HARD_TO_GET_SKILLS.has(skill.id) ||
      !canActivate(skill.id)
    ) return [];
    return [{
      id: skill.id,
      nameEn: skill.nameEn,
      nameJp: skill.nameJp,
      descEn: skill.descEn,
      rarity: skill.rarity,
      iconId: skill.iconId,
      source: sourceBySkill.get(skill.id) ?? "event",
      sourceLabel: "Uma source",
      isUniqueToParent: true,
      isDuplicateInMain: false,
      isInheritOnly: true,
      grants,
      parentDuplicateCount: grants.length,
    }];
  });
}

/** Combine card and lineage skills by id, preserving the existing card-first precedence. */
export function mergeParentSkills(
  parentSkills: readonly ParentDeckSkill[],
  pedigreeSkills: readonly DisplayParentSkill[],
): DisplayParentSkill[] {
  const byId = new Map<number, DisplayParentSkill>();

  for (const skill of parentSkills) {
    byId.set(skill.id, {
      id: skill.id,
      nameEn: skill.nameEn,
      nameJp: skill.nameJp,
      descEn: skill.descEn,
      rarity: skill.rarity,
      iconId: skill.iconId,
      source: skill.source === "event" ? "event" : "hint",
      sourceLabel: `Card (${skill.cardName})`,
      isUniqueToParent: skill.isUniqueToParent,
      isDuplicateInMain: skill.isDuplicateInMain,
      isInheritOnly: false,
      parentDuplicateCount: skill.parentDuplicateCount,
      originalGoldSkill: skill.originalGoldSkill,
      grants: skill.grants,
      mainCardGrants: skill.mainCardGrants,
    });
  }

  for (const pedigreeSkill of pedigreeSkills) {
    const existing = byId.get(pedigreeSkill.id);
    if (!existing) {
      byId.set(pedigreeSkill.id, { ...pedigreeSkill });
      continue;
    }

    existing.isInheritOnly = false;
    const grants = [...(existing.grants ?? [])];
    for (const grant of pedigreeSkill.grants ?? []) {
      if (!grants.some((item) => item.cardName === grant.cardName && item.source === grant.source)) {
        grants.push(grant);
      }
    }
    existing.grants = grants;
    existing.parentDuplicateCount = grants.length;
    if (!existing.originalUniqueSkill && pedigreeSkill.originalUniqueSkill) {
      existing.originalUniqueSkill = pedigreeSkill.originalUniqueSkill;
    }
  }

  return [...byId.values()];
}

export interface GoldOrigin {
  id?: number;
  nameEn: string;
  nameJp?: string;
}

interface GoldOriginCarrier {
  originalGoldSkill?: GoldOrigin;
  grants?: readonly { originalGoldSkill?: GoldOrigin }[];
}

/** The gold a parent white was downgraded from (parents pass on the white
 * counterpart), read from the row itself or from its card grant. */
export function goldOriginOf(skill: GoldOriginCarrier): GoldOrigin | undefined {
  return skill.originalGoldSkill ?? skill.grants?.find((g) => g.originalGoldSkill)?.originalGoldSkill;
}

export interface FarmingSortRules<T> {
  activates: (skillId: number) => boolean;
  isUniqueTarget: (skill: T) => boolean;
  isInMainDeck: (skill: T) => boolean;
}

/** Order skills for parent farming: gold (including whites inherited from a
 * gold), unique white targets, main-deck duplicates, other activating
 * skills, then No Activation / Rank Trap. Skills keep their original order
 * within each tier. */
export function sortParentSkillsForFarming<T extends { id: number; rarity?: number } & GoldOriginCarrier>(
  skills: readonly T[],
  rules: FarmingSortRules<T>,
): T[] {
  const tier = (skill: T) => {
    if (!rules.activates(skill.id)) return 4;
    if (getRarityCategory(skill.rarity) === "gold" || goldOriginOf(skill)) return 0;
    if (rules.isUniqueTarget(skill)) return 1;
    if (rules.isInMainDeck(skill)) return 2;
    return 3;
  };
  return skills
    .map((skill, index) => ({ skill, index, tier: tier(skill) }))
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .map(({ skill }) => skill);
}

/** Apply source, category, rarity, duplicate and text filters to the unified skill pool. */
export function filterParentSkills(
  skills: readonly DisplayParentSkill[],
  options: ParentSkillFilterOptions,
): DisplayParentSkill[] {
  const query = options.search.trim().toLowerCase();
  return skills.filter((skill) => {
    const parentDuplicate = options.duplicateInParentIds.has(skill.id);
    if (options.sourceFilter === "cards" && (skill.source === "unique" || skill.source === "factor")) return false;
    if (options.sourceFilter === "lineage" && (skill.source === "hint" || skill.source === "event")) return false;

    switch (options.filter) {
      case "inherit_only": if (!skill.isInheritOnly) return false; break;
      case "unique": if (!options.uniqueTargetIds.has(skill.id)) return false; break;
      case "duplicate": if (!skill.isDuplicateInMain) return false; break;
      case "parent_duplicate": if (!parentDuplicate) return false; break;
      case "hint": if (skill.source !== "hint") return false; break;
      case "event": if (skill.source !== "event") return false; break;
      case "parent_unique": if (skill.source !== "unique") return false; break;
      case "factor": if (skill.source !== "factor") return false; break;
      case "all": break;
    }

    if (!matchesRarityFilter(skill.rarity, options.rarityFilter)) return false;
    if (query && !`${skill.nameEn} ${skill.nameJp} ${skill.descEn ?? ""}`.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });
}
