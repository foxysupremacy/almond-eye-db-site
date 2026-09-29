import type { ParentDeckSkill } from "@/lib/deck/types";
import { matchesRarityFilter, type RarityFilterKey } from "@/lib/skills/rarity";
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
export type ParentSkillSourceFilter = "all" | "cards" | "lineage";

export interface ParentSkillFilterOptions {
  filter: ParentSkillFilterTab;
  sourceFilter: ParentSkillSourceFilter;
  rarityFilter: RarityFilterKey;
  hideParentDuplicates: boolean;
  search: string;
  uniqueTargetIds: ReadonlySet<number>;
  duplicateInParentIds: ReadonlySet<number>;
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

/** Apply source, category, rarity, duplicate and text filters to the unified skill pool. */
export function filterParentSkills(
  skills: readonly DisplayParentSkill[],
  options: ParentSkillFilterOptions,
): DisplayParentSkill[] {
  const query = options.search.trim().toLowerCase();
  return skills.filter((skill) => {
    const parentDuplicate = options.duplicateInParentIds.has(skill.id);
    if (options.hideParentDuplicates && parentDuplicate) return false;

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
