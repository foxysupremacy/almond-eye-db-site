import type { CardIndexEntry, RecommendedPvpSkill, SkillDetail } from "@/lib/api";
import type { Course, RaceParameters } from "@/lib/skill-engine/types";
import type { RunningStyle } from "@/lib/deck/types";
import { doesSkillFireOnCourse } from "@/lib/recommendation/engine";
import { matchesSkillEffectFilter, type SkillEffectCategory } from "@/lib/skills/effects";
import { getInheritableSkillForGold } from "@/lib/skills/rarity";

function inheritedSkillId(skillId: number, skillDetailMap: ReadonlyMap<number, SkillDetail>): number {
  const detail = skillDetailMap.get(skillId);
  return detail?.rarity === 2 ? getInheritableSkillForGold(skillId)?.whiteId ?? skillId : skillId;
}

export interface GameRecommendedCardRow {
  cardId: number;
  card: CardIndexEntry | null;
  skills: RecommendedPvpSkill[];
}

export interface GameRecommendedCardProjectionInput {
  skills: readonly RecommendedPvpSkill[];
  excludedSkillIds: ReadonlySet<number>;
  excludedCardIds: ReadonlySet<number>;
  effectFilter: readonly SkillEffectCategory[];
  skillDetailMap: ReadonlyMap<number, SkillDetail>;
  allCards: readonly CardIndexEntry[] | null;
}

/** Adds eligible registry cards so cards with track-active grants can appear without game recommendations. */
export function includeCardsWithAdditionalSkills(
  rows: readonly GameRecommendedCardRow[],
  allCards: readonly CardIndexEntry[] | null,
  excludedCardIds: ReadonlySet<number>,
): GameRecommendedCardRow[] {
  const rowById = new Map(rows.map((row) => [row.cardId, row]));
  for (const card of allCards ?? []) {
    if (!excludedCardIds.has(card.id) && !rowById.has(card.id)) {
      rowById.set(card.id, { cardId: card.id, card, skills: [] });
    }
  }
  return Array.from(rowById.values());
}

/** Returns other known skills granted by this card, excluding Ace/lineage and already listed recommendations. */
export function projectAdditionalCardSkills(
  card: CardIndexEntry,
  recommendedSkillIds: ReadonlySet<number>,
  excludedSkillIds: ReadonlySet<number>,
  skillDetailMap: ReadonlyMap<number, SkillDetail>,
): SkillDetail[] {
  const grantedSkillIds = new Map<number, number>();
  for (const sourceSkillId of [...card.eventSkills, ...card.hintSkills]) {
    const skillId = inheritedSkillId(sourceSkillId, skillDetailMap);
    grantedSkillIds.set(skillId, sourceSkillId);
  }
  return Array.from(grantedSkillIds, ([skillId, sourceSkillId]) => ({ skillId, sourceSkillId }))
    .filter(({ skillId, sourceSkillId }) => !recommendedSkillIds.has(skillId) && !recommendedSkillIds.has(sourceSkillId) && !excludedSkillIds.has(skillId) && !excludedSkillIds.has(sourceSkillId))
    .map(({ skillId, sourceSkillId }) => {
      const detail = skillDetailMap.get(skillId) ?? skillDetailMap.get(sourceSkillId);
      return detail && detail.id !== skillId ? { ...detail, id: skillId } : detail;
    })
    .filter((skill): skill is SkillDetail => Boolean(skill))
    .sort((a, b) => a.nameEn.localeCompare(b.nameEn, "en") || a.id - b.id);
}

/** Finds skills shared across eligible cards, including their additional card-granted skills. */
export function findDuplicateRecommendedCardSkillIds(
  rows: readonly GameRecommendedCardRow[],
  additionalSkillsByCard: ReadonlyMap<number, readonly SkillDetail[]> = new Map(),
): Set<number> {
  const cardCounts = new Map<number, number>();
  for (const row of rows) {
    const skillIds = new Set([
      ...row.skills.map((skill) => skill.skillId),
      ...(additionalSkillsByCard.get(row.cardId) ?? []).map((skill) => skill.id),
    ]);
    for (const skillId of skillIds) {
      cardCounts.set(skillId, (cardCounts.get(skillId) ?? 0) + 1);
    }
  }
  return new Set(
    Array.from(cardCounts, ([skillId, count]) => count > 1 ? skillId : null)
      .filter((skillId): skillId is number => skillId !== null),
  );
}

/** Hides skills shared by multiple eligible cards, then re-ranks by remaining skills. */
export function hideDuplicateRecommendedCardSkills(
  rows: readonly GameRecommendedCardRow[],
  additionalSkillsByCard: ReadonlyMap<number, readonly SkillDetail[]> = new Map(),
): GameRecommendedCardRow[] {
  const duplicateSkillIds = findDuplicateRecommendedCardSkillIds(rows, additionalSkillsByCard);
  return rows
    .map((row) => ({
      ...row,
      skills: row.skills.filter((skill) => !duplicateSkillIds.has(skill.skillId)),
    }))
    .filter((row) => row.skills.length > 0 || (additionalSkillsByCard.get(row.cardId) ?? []).some((skill) => !duplicateSkillIds.has(skill.id)))
    .sort((a, b) =>
      b.skills.length - a.skills.length ||
      (a.card?.nameEn ?? `Card ${a.cardId}`).localeCompare(b.card?.nameEn ?? `Card ${b.cardId}`, "en") ||
      a.cardId - b.cardId,
    );
}

function matchesEffectFilter(
  skillId: number,
  effectFilter: readonly SkillEffectCategory[],
  skillDetailMap: ReadonlyMap<number, SkillDetail>,
): boolean {
  return matchesSkillEffectFilter(skillDetailMap.get(skillId), effectFilter);
}

export function filterRecommendedSkillsByEffect(
  skills: readonly RecommendedPvpSkill[],
  effectFilter: readonly SkillEffectCategory[],
  skillDetailMap: ReadonlyMap<number, SkillDetail>,
): RecommendedPvpSkill[] {
  if (effectFilter.length === 0) return [...skills];
  return skills.filter((skill) => matchesEffectFilter(skill.skillId, effectFilter, skillDetailMap));
}

/** Builds a course/style fallback from support-card grants when game recommendations are absent. */
export function projectTrackActiveFallbackSkills({
  allCards,
  course,
  runningStyle,
  raceParams,
  excludedSkillIds,
  parentSlots,
  skillDetailMap,
}: {
  allCards: readonly CardIndexEntry[] | null;
  course: Course | null;
  runningStyle: RunningStyle | null;
  raceParams?: Partial<RaceParameters>;
  excludedSkillIds: ReadonlySet<number>;
  parentSlots: readonly (CardIndexEntry | null)[];
  skillDetailMap: ReadonlyMap<number, SkillDetail>;
}): RecommendedPvpSkill[] {
  if (!course) return [];

  const selectedParentIds = new Set(parentSlots.flatMap((card) => card ? [card.id] : []));
  const parentSkillIds = new Set<number>();
  for (const card of allCards ?? []) {
    if (!selectedParentIds.has(card.id)) continue;
    for (const skill of projectAdditionalCardSkills(card, new Set(), new Set(), skillDetailMap)) {
      parentSkillIds.add(skill.id);
    }
  }

  const supportCardIdsBySkill = new Map<number, Set<number>>();
  for (const card of allCards ?? []) {
    if (selectedParentIds.has(card.id)) continue;
    const skills = projectAdditionalCardSkills(card, new Set(), excludedSkillIds, skillDetailMap);
    for (const skill of skills) {
      if (parentSkillIds.has(skill.id) || !doesSkillFireOnCourse(skill.id, course, runningStyle, raceParams)) continue;
      let sources = supportCardIdsBySkill.get(skill.id);
      if (!sources) {
        sources = new Set<number>();
        supportCardIdsBySkill.set(skill.id, sources);
      }
      sources.add(card.id);
    }
  }

  return Array.from(supportCardIdsBySkill, ([skillId, supportCardIds]) => ({
    skillId,
    supportCardIds: Array.from(supportCardIds).sort((a, b) => a - b),
    runningStyleValues: { nige: 1, senko: 1, sashi: 1, oikomi: 1 },
  })).sort((a, b) => a.skillId - b.skillId);
}

/** Groups eligible game recommendations by support card and orders by skill count. */
export function projectGameRecommendedCards({
  skills,
  excludedSkillIds,
  excludedCardIds,
  effectFilter,
  skillDetailMap,
  allCards,
}: GameRecommendedCardProjectionInput): GameRecommendedCardRow[] {
  const cardById = new Map((allCards ?? []).map((card) => [card.id, card]));
  const skillsByCard = new Map<number, Map<number, RecommendedPvpSkill>>();

  for (const skill of skills) {
    const skillId = inheritedSkillId(skill.skillId, skillDetailMap);
    if (excludedSkillIds.has(skill.skillId) || excludedSkillIds.has(skillId)) continue;
    if (!matchesEffectFilter(skill.skillId, effectFilter, skillDetailMap)) continue;

    for (const cardId of skill.supportCardIds) {
      if (excludedCardIds.has(cardId)) continue;
      let cardSkills = skillsByCard.get(cardId);
      if (!cardSkills) {
        cardSkills = new Map();
        skillsByCard.set(cardId, cardSkills);
      }
      cardSkills.set(skillId, { ...skill, skillId });
    }
  }

  return Array.from(skillsByCard, ([cardId, cardSkills]) => ({
    cardId,
    card: cardById.get(cardId) ?? null,
    skills: Array.from(cardSkills.values()),
  })).sort((a, b) =>
    b.skills.length - a.skills.length ||
    (a.card?.nameEn ?? `Card ${a.cardId}`).localeCompare(b.card?.nameEn ?? `Card ${b.cardId}`, "en") ||
    a.cardId - b.cardId,
  );
}
