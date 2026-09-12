// Skill Effect Classification & Card Indexer
// Classifies skills by gameplay mechanics: Target Speed, Current Speed, Acceleration,
// Recovery / Heal, Debuffs, Passive Stat buffs, etc., and maps skills to the cards granting them.

import type { CardIndexEntry, CharacterIndexEntry, SkillDetail, DataStore } from "./data-store";
import { GOLD_TO_WHITE_MAP } from "./skill-rarity";
import type { KyumaruVeteranItem } from "./kyumaru-types";

export type SkillEffectCategory =
  | "target_speed"
  | "current_speed"
  | "acceleration"
  | "heal"
  | "debuff"
  | "passive"
  | "other";

export interface EffectCategoryMeta {
  id: SkillEffectCategory;
  label: string;
  badge: string;
  dotColor: string;
  description: string;
}

export const EFFECT_CATEGORIES: EffectCategoryMeta[] = [
  {
    id: "target_speed",
    label: "Target Speed",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    dotColor: "bg-amber-500",
    description: "Raises top speed ceiling during the race",
  },
  {
    id: "current_speed",
    label: "Current Speed",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    dotColor: "bg-rose-500",
    description: "Instantly modifies speed without waiting for acceleration",
  },
  {
    id: "acceleration",
    label: "Acceleration",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    dotColor: "bg-orange-500",
    description: "Accelerates faster up to target speed (spurt / start)",
  },
  {
    id: "heal",
    label: "Recovery (Heal)",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    dotColor: "bg-blue-500",
    description: "Restores stamina percentage to sustain top speed longer",
  },
  {
    id: "debuff",
    label: "Debuff",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    dotColor: "bg-purple-500",
    description: "Drains stamina, slows down opponents, or delays start",
  },
  {
    id: "passive",
    label: "Passive (Green)",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    dotColor: "bg-emerald-500",
    description: "Conditional flat stat additions (Speed, Stamina, Power, Guts, Wit)",
  },
  {
    id: "other",
    label: "Other",
    badge: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
    dotColor: "bg-zinc-400",
    description: "Lane repositioning, clairvoyance/field of view, etc.",
  },
];

export const EFFECT_CATEGORY_MAP = new Map<SkillEffectCategory, EffectCategoryMeta>(
  EFFECT_CATEGORIES.map((cat) => [cat.id, cat])
);

/**
 * Classify a skill's effect types into categories.
 * A skill can have multiple categories (e.g. Speed + Acceleration).
 */
export function classifySkillEffects(skill: SkillDetail): SkillEffectCategory[] {
  const categories = new Set<SkillEffectCategory>();

  if (!skill.conditionGroups || skill.conditionGroups.length === 0) {
    return ["other"];
  }

  for (const group of skill.conditionGroups) {
    const effects = (group.effects || []) as Array<{
      type: number;
      value: number;
      target?: number;
      target_details?: number;
    }>;

    for (const eff of effects) {
      const type = eff.type;
      const val = eff.value ?? 0;
      const target = eff.target ?? 0;

      // Debuffs target opponents or inflict negative effects
      const isOpponentTarget = target === 9 || target === 10 || target === 18;
      const isNegativeValue = val < 0;

      if (isOpponentTarget || isNegativeValue || type === 10 || type === 14) {
        categories.add("debuff");
        continue;
      }

      // Normal positive buffs
      if (type === 27) {
        categories.add("target_speed");
      } else if (type === 21 || type === 22) {
        categories.add("current_speed");
      } else if (type === 31) {
        categories.add("acceleration");
      } else if (type === 9) {
        categories.add("heal");
      } else if (type >= 1 && type <= 5) {
        categories.add("passive");
      } else {
        categories.add("other");
      }
    }
  }

  if (categories.size === 0) {
    categories.add("other");
  }

  return Array.from(categories);
}

export interface GrantingCardInfo {
  card: CardIndexEntry;
  source: "event" | "hint";
  eventName?: string;
  choiceIndex?: number;
  choiceText?: string;
  isChain?: boolean;
}

/**
 * Retrieve all support cards that grant a specific skill, including whether it's
 * an event skill (with event/choice details) or a hint skill.
 */
export function getCardsGrantingSkill(
  skillId: number,
  allCards: CardIndexEntry[]
): GrantingCardInfo[] {
  const results: GrantingCardInfo[] = [];

  for (const card of allCards) {
    // Check Event Skills
    if (card.eventSkills && card.eventSkills.includes(skillId)) {
      let matchedEventName: string | undefined;
      let matchedChoiceIndex: number | undefined;
      let matchedChoiceText: string | undefined;
      let isChain = false;

      if (card.eventDetails) {
        for (const ev of card.eventDetails) {
          if (ev.choices) {
            for (const ch of ev.choices) {
              if (ch.skillIds && ch.skillIds.includes(skillId)) {
                matchedEventName = ev.nameEn || ev.nameJp;
                matchedChoiceIndex = ch.index;
                matchedChoiceText = ch.textEn || ch.textJp;
                isChain = ev.eventType === "chain";
                break;
              }
            }
          }
          if (matchedEventName) break;
        }
      }

      results.push({
        card,
        source: "event",
        eventName: matchedEventName,
        choiceIndex: matchedChoiceIndex,
        choiceText: matchedChoiceText,
        isChain,
      });
    }

    // Check Hint Skills
    if (card.hintSkills && card.hintSkills.includes(skillId)) {
      results.push({
        card,
        source: "hint",
      });
    }
  }

  // Sort by rarity desc, then release desc, then name
  return results.sort((a, b) => {
    if (b.card.rarity !== a.card.rarity) return b.card.rarity - a.card.rarity;
    const relA = a.card.release || "";
    const relB = b.card.release || "";
    if (relB !== relA) return relB.localeCompare(relA);
    return (a.card.nameEn || "").localeCompare(b.card.nameEn || "");
  });
}

export interface GrantingCharacterInfo {
  character: CharacterIndexEntry;
  uniqueSkillId: number;
}

/**
 * Retrieve all characters that have a specific unique skill (or its inherited white counterpart).
 */
export function getCharactersGrantingSkill(
  skillId: number,
  characters: CharacterIndexEntry[],
  allSkillsMap?: Map<number, SkillDetail>
): GrantingCharacterInfo[] {
  const targetSkill = allSkillsMap?.get(skillId);
  const targetName = targetSkill?.nameEn || targetSkill?.nameJp;

  return characters
    .filter((c) => {
      if (!c.uniqueSkillId) return false;
      if (c.uniqueSkillId === skillId) return true;
      if (c.uniqueSkillId - 90000 === skillId || c.uniqueSkillId - 99000 === skillId) return true;
      if (targetName && allSkillsMap) {
        const charSkill = allSkillsMap.get(c.uniqueSkillId);
        if (charSkill && (charSkill.nameEn === targetName || charSkill.nameJp === targetName)) {
          return true;
        }
      }
      return false;
    })
    .map((c) => ({
      character: c,
      uniqueSkillId: c.uniqueSkillId!,
    }));
}

/**
 * Checks if a skill is obtainable via any support card (events or hints).
 */
export function isSkillObtainableFromCards(
  skillId: number,
  cardSkillIdSet: Set<number>
): boolean {
  return cardSkillIdSet.has(skillId);
}

export interface RawCandidateSkill {
  skillId: number;
  source: "unique" | "innate" | "awakening" | "event" | "factor";
  originalGoldNameEn?: string;
}

/**
 * Collect all possible skills for a parent candidate (unique, innate, awakening, events, and veteran factors)
 * and convert any gold skills to their white counterparts.
 */
export function getAllParentWhiteSkills(
  character?: CharacterIndexEntry | null,
  veteran?: KyumaruVeteranItem | null
): RawCandidateSkill[] {
  const result: RawCandidateSkill[] = [];
  const seenSkillIds = new Set<number>();

  const addSkill = (id: number, source: RawCandidateSkill["source"]) => {
    if (!id) return;
    let whiteId = id;
    let originalGoldNameEn: string | undefined;

    // Check if gold skill needs downgrade
    const mapped = GOLD_TO_WHITE_MAP[String(id)];
    if (mapped) {
      whiteId = mapped.whiteId;
      originalGoldNameEn = mapped.goldNameEn;
    }

    if (!seenSkillIds.has(whiteId)) {
      seenSkillIds.add(whiteId);
      result.push({ skillId: whiteId, source, originalGoldNameEn });
    }
  };

  // 1. Unique skill
  if (character?.uniqueSkillId) {
    addSkill(character.uniqueSkillId, "unique");
  }

  // 2. Innate starter skills
  if (character?.innateSkills) {
    for (const sid of character.innateSkills) {
      addSkill(sid, "innate");
    }
  }

  // 3. Awakening skills (Golds converted to white)
  if (character?.awakeningSkills) {
    for (const sid of character.awakeningSkills) {
      addSkill(sid, "awakening");
    }
  }

  // 4. Scenario training event skills
  if (character?.eventSkills) {
    for (const sid of character.eventSkills) {
      addSkill(sid, "event");
    }
  }

  // 5. Veteran spark factors
  if (veteran?.factor_info_array) {
    for (const f of veteran.factor_info_array) {
      if (f.factor_id >= 10000) {
        addSkill(f.factor_id, "factor");
      }
    }
  }

  return result;
}


