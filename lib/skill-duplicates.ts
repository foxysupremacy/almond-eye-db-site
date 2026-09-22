/**
 * UI-neutral duplicate-skill indexing. Views decide which cards and grants
 * participate; this module only preserves that input as a skill -> providers
 * lookup for indicators and popovers.
 */
export interface DuplicateSkillCard {
  cardId: number;
  cardName: string;
  cardNameJp?: string;
  rarity?: number;
  type?: string | null;
  portraitUrl?: string;
  imgUrl?: string;
  source?: string;
  eventMeta?: {
    eventNameEn?: string;
    eventNameJp?: string;
    choiceIndex?: number;
    choiceTextEn?: string;
    choiceTextJp?: string;
  } | null;
  originalGoldSkill?: {
    id: number;
    nameEn: string;
    nameJp: string;
  };
}

export interface DuplicateSkillGrant {
  id: number;
  source?: string;
  eventMeta?: DuplicateSkillCard["eventMeta"];
  originalGoldSkill?: DuplicateSkillCard["originalGoldSkill"];
}

export interface DuplicateSkillProvider {
  card: Omit<DuplicateSkillCard, "source" | "eventMeta" | "originalGoldSkill">;
  grants: Iterable<DuplicateSkillGrant>;
}

export type DuplicateSkillIndex = Map<number, DuplicateSkillCard[]>;

export function buildDuplicateSkillIndex(providers: Iterable<DuplicateSkillProvider>): DuplicateSkillIndex {
  const index: DuplicateSkillIndex = new Map();

  for (const { card, grants } of providers) {
    const seen = new Set<number>();
    for (const grant of grants) {
      if (seen.has(grant.id)) continue;
      seen.add(grant.id);

      const entries = index.get(grant.id) ?? [];
      // A card can be encountered more than once by a view (for example if a
      // stale preset contains it in multiple slots). It is still one provider.
      if (entries.some((entry) => entry.cardId === card.cardId)) continue;
      entries.push({
        ...card,
        source: grant.source,
        eventMeta: grant.eventMeta ?? null,
        originalGoldSkill: grant.originalGoldSkill,
      });
      index.set(grant.id, entries);
    }
  }

  return index;
}

export function getDuplicateSkillIds(index: DuplicateSkillIndex): Set<number> {
  const duplicates = new Set<number>();
  index.forEach((cards, skillId) => {
    if (cards.length > 1) duplicates.add(skillId);
  });
  return duplicates;
}
