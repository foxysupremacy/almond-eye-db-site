import type { CardIndexEntry } from "@/lib/api";
import type { CardRecommendation } from "@/lib/recommendation/engine";
import type { SkillEffectCategory } from "@/lib/skills/effects";

export type CardPickerType = "all" | "speed" | "stamina" | "power" | "guts" | "intelligence" | "friend" | "group";
export type CardPickerSort = "recommended" | "release" | "rarity" | "type" | "targetSkills";
export type PickerMode = "main" | "parent";
export type PickerCard = Pick<CardIndexEntry, "id" | "nameEn" | "nameJp" | "type" | "release" | "rarity">;

export const CARD_PICKER_TYPES: CardPickerType[] = [
  "all", "speed", "stamina", "power", "guts", "intelligence", "friend", "group",
];

const TYPE_ORDER: Record<CardPickerType, number> = {
  all: 0,
  speed: 1,
  stamina: 2,
  power: 3,
  guts: 4,
  intelligence: 5,
  friend: 6,
  group: 7,
};

export interface EvaluatedTargetSkill {
  id: number;
  nameEn: string;
  nameJp: string;
  source: "hint" | "event";
  eventMeta?: { eventNameEn: string; eventNameJp: string; choiceIndex: number };
  categories: SkillEffectCategory[];
}

interface CardFilterOptions<T extends PickerCard> {
  cards: readonly T[] | null;
  query: string;
  type: CardPickerType;
  selectedEffects: SkillEffectCategory[];
  cardEffectMap: ReadonlyMap<number, ReadonlySet<SkillEffectCategory>>;
  cardSkillNamesMap: ReadonlyMap<number, string>;
  parentCardTargetSkillsMap: ReadonlyMap<number, EvaluatedTargetSkill[]>;
  sort: CardPickerSort;
  mode: PickerMode;
  recommendationsMap: ReadonlyMap<number, Pick<CardRecommendation, "score">>;
  onlyOwned: boolean;
  isOwned: (cardId: number) => boolean;
  selectedSkillCount: number;
  skillMatchMode: "OR" | "AND";
  cardMatchedSelectedSkillsMap: ReadonlyMap<number, { count: number }>;
}

/** Apply picker filters and ordering without coupling the rules to React state. */
export function filterAndSortCards<T extends PickerCard>({
  cards,
  query,
  type,
  selectedEffects,
  cardEffectMap,
  cardSkillNamesMap,
  parentCardTargetSkillsMap,
  sort,
  mode,
  recommendationsMap,
  onlyOwned,
  isOwned,
  selectedSkillCount,
  skillMatchMode,
  cardMatchedSelectedSkillsMap,
}: CardFilterOptions<T>): T[] {
  if (!cards) return [];
  const normalizedQuery = query.trim().toLowerCase();
  let list = cards.filter((card) => {
    if (onlyOwned && !isOwned(card.id)) return false;
    if (type !== "all" && card.type !== type) return false;

    if (mode === "parent" && selectedSkillCount > 0) {
      const count = cardMatchedSelectedSkillsMap.get(card.id)?.count ?? 0;
      if (skillMatchMode === "AND" ? count < selectedSkillCount : count === 0) return false;
    }

    if (selectedEffects.length > 0) {
      if (mode === "parent") {
        const skills = parentCardTargetSkillsMap.get(card.id) ?? [];
        if (!skills.some((skill) => skill.categories.some((category) => selectedEffects.includes(category)))) {
          return false;
        }
      } else {
        const categories = cardEffectMap.get(card.id);
        if (!categories || !selectedEffects.some((category) => categories.has(category))) return false;
      }
    }

    if (normalizedQuery) {
      const cardNameMatch = `${card.nameEn} ${card.nameJp}`.toLowerCase().includes(normalizedQuery);
      const skillNameMatch = cardSkillNamesMap.get(card.id)?.includes(normalizedQuery);
      if (!cardNameMatch && !skillNameMatch) return false;
    }
    return true;
  });

  const byRecommendation = (a: PickerCard, b: PickerCard) => {
    const scoreA = recommendationsMap.get(a.id)?.score ?? -1;
    const scoreB = recommendationsMap.get(b.id)?.score ?? -1;
    return scoreB - scoreA || b.rarity - a.rarity || (a.type ?? "").localeCompare(b.type ?? "");
  };
  const byRelease = (a: PickerCard, b: PickerCard) => {
    const releaseA = a.release || "";
    const releaseB = b.release || "";
    return releaseB.localeCompare(releaseA) || b.rarity - a.rarity || b.id - a.id;
  };
  const byRarity = (a: PickerCard, b: PickerCard) =>
    b.rarity - a.rarity || (a.type ?? "").localeCompare(b.type ?? "");
  const byType = (a: PickerCard, b: PickerCard) =>
    (TYPE_ORDER[a.type as CardPickerType] ?? 99) - (TYPE_ORDER[b.type as CardPickerType] ?? 99) ||
    b.rarity - a.rarity;

  if (mode === "parent" && selectedSkillCount > 0) {
    list = [...list].sort((a, b) => {
      const countA = cardMatchedSelectedSkillsMap.get(a.id)?.count ?? 0;
      const countB = cardMatchedSelectedSkillsMap.get(b.id)?.count ?? 0;
      if (countA !== countB) return countB - countA;
      if (sort === "recommended") return byRecommendation(a, b);
      if (sort === "release") return byRelease(a, b);
      if (sort === "rarity") return byRarity(a, b);
      if (sort === "targetSkills") {
        const skillsA = parentCardTargetSkillsMap.get(a.id) ?? [];
        const skillsB = parentCardTargetSkillsMap.get(b.id) ?? [];
        return skillsB.length - skillsA.length || b.rarity - a.rarity;
      }
      return byType(a, b);
    });
    return list;
  }

  if (sort === "recommended") list = [...list].sort(byRecommendation);
  else if (sort === "release") list = [...list].sort(byRelease);
  else if (sort === "rarity") list = [...list].sort(byRarity);
  else if (sort === "targetSkills") {
    const countFor = (cardId: number) => {
      const skills = parentCardTargetSkillsMap.get(cardId) ?? [];
      return selectedEffects.length > 0
        ? skills.filter((skill) => skill.categories.some((category) => selectedEffects.includes(category))).length
        : skills.length;
    };
    list = [...list].sort(
      (a, b) => countFor(b.id) - countFor(a.id) || b.rarity - a.rarity || (a.type ?? "").localeCompare(b.type ?? ""),
    );
  } else if (sort === "type") list = [...list].sort(byType);
  return list;
}
