import type { CardIndexEntry, CardSkills } from "../api";
import type { DeckSkill, DeckSkillGrant, ParentDeckSkill } from "./types";
import { getDefaultChoiceIndex } from "./event-choices";
import { getInheritableSkillForGold } from "../skill-rarity";

export function deriveSkillsForDeck(
  slotsArr: (CardIndexEntry | null)[],
  isParentDeck: boolean,
  skillsByCard: Record<number, CardSkills | null>,
  chainChoicesMap?: Record<string, number>,
): DeckSkill[] {
  const byId = new Map<number, DeckSkill>();

  slotsArr.forEach((card) => {
    if (!card) return;
    const cs = skillsByCard[card.id];
    if (!cs) return;
    const cardName = card.nameEn || card.nameJp;

    const push = (
      s: CardSkills["eventSkills"][number],
      source: "event" | "hint",
      originalGoldSkill?: { id: number; nameEn: string; nameJp: string },
    ) => {
      const grant: DeckSkillGrant = {
        cardId: card.id,
        cardName,
        source,
        eventMeta: s.eventMeta,
        originalGoldSkill,
      };
      const existing = byId.get(s.id);
      if (!existing) {
        byId.set(s.id, {
          id: s.id,
          nameJp: s.nameJp,
          nameEn: s.nameEn,
          descEn: s.descEn,
          rarity: s.rarity,
          source,
          cardId: card.id,
          cardName,
          iconId: s.iconId,
          eventMeta: s.eventMeta,
          grants: [grant],
        });
      } else {
        if (!existing.grants?.some((g) => g.cardId === card.id && g.source === source)) {
          existing.grants = [...(existing.grants ?? []), grant];
        }
      }
    };

    // Hints are always inheritable White skills
    cs.hintSkills.forEach((s) => push(s, "hint"));

    // Events: Filter by user's chosen branch (or default optimal choice)
    cs.eventSkills.forEach((s) => {
      if (s.eventMeta && card.eventDetails) {
        const evDetail = card.eventDetails.find((ev) => ev.eventId === s.eventMeta!.eventId);
        if (evDetail && evDetail.choices && evDetail.choices.length > 1) {
          const choiceKey = `${card.id}:${s.eventMeta.eventId}`;
          const selectedChoice =
            chainChoicesMap?.[choiceKey] ??
            chainChoicesMap?.[String(card.id)] ??
            getDefaultChoiceIndex(
              evDetail,
              (id) => skillsByCard[card.id]?.eventSkills.find((sk) => sk.id === id)?.rarity ?? 1,
            );
          if (s.eventMeta.choiceIndex !== selectedChoice) {
            return; // User/default choice excludes this skill
          }
        }
      }

      if (isParentDeck && s.rarity === 2) {
        const mapped = getInheritableSkillForGold(s.id);
        if (!mapped) return; // Skip uninheritable gold skills with no white counterpart
        push(
          {
            id: mapped.whiteId,
            nameEn: mapped.whiteNameEn,
            nameJp: mapped.whiteNameJp,
            descEn: s.descEn,
            rarity: 1,
            isRCard: s.isRCard,
            iconId: s.iconId,
            eventMeta: s.eventMeta,
          },
          "event",
          { id: s.id, nameEn: s.nameEn, nameJp: s.nameJp },
        );
      } else {
        push(s, "event");
      }
    });
  });

  return [...byId.values()].sort((a, b) => a.nameEn.localeCompare(b.nameEn));
}

export function deriveMainSkillIdSet(mainSkills: DeckSkill[]): Set<number> {
  const set = new Set<number>();
  mainSkills.forEach((s) => {
    set.add(s.id);
    // If main deck has a gold skill, also mark its base white skill as covered
    if (s.rarity === 2) {
      const mapped = getInheritableSkillForGold(s.id);
      if (mapped) set.add(mapped.whiteId);
    }
  });
  return set;
}

export function deriveMainGrantsBySkillId(mainSkills: DeckSkill[]): Map<number, DeckSkillGrant[]> {
  const map = new Map<number, DeckSkillGrant[]>();
  mainSkills.forEach((s) => {
    if (s.grants) {
      map.set(s.id, s.grants);
      if (s.rarity === 2) {
        const mapped = getInheritableSkillForGold(s.id);
        if (mapped && !map.has(mapped.whiteId)) {
          map.set(mapped.whiteId, s.grants);
        }
      }
    }
  });
  return map;
}

export function deriveParentSkills(
  rawParentSkills: DeckSkill[],
  mainSkillIdSet: Set<number>,
  mainGrantsBySkillId: Map<number, DeckSkillGrant[]>,
): ParentDeckSkill[] {
  return rawParentSkills.map((s) => {
    const isDuplicateInMain = mainSkillIdSet.has(s.id);
    const mainCardGrants = mainGrantsBySkillId.get(s.id);
    const parentDuplicateCount = s.grants?.length ?? 1;
    const isUniqueToParent = !isDuplicateInMain;
    const originalGoldSkill = s.grants?.find((g) => g.originalGoldSkill)?.originalGoldSkill;

    return {
      ...s,
      isDuplicateInMain,
      mainCardGrants,
      parentDuplicateCount,
      isUniqueToParent,
      originalGoldSkill,
    };
  });
}
