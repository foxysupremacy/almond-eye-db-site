"use client";

// Shared lineage-skill data: Parent 1, Parent 2, and Grandparent skills,
// including Uniques, Innate, Awakening, Event skills, and Bloodline factors,
// derived from the parenting setup and evaluated against the user's active Main Deck.

import { useEffect, useMemo, useState } from "react";
import { useParentingSetup } from "./parenting-state";
import { useDeck } from "./deck/context";
import { api, type CharacterIndexEntry, type SkillDetail } from "./api";
import { getCanonicalFactorName } from "./affinity-engine";
import { decodeFactor } from "./factor-decoder";
import {
  getInheritableSkillForUnique,
  getInheritableSkillForGold,
} from "./skill-rarity";
import { resolveGrandparentSlot } from "./parenting/pedigree-resolvers";

export interface DisplayParentSkillGrant {
  cardName: string;
  source: string;
  slotLabel?: string;
  eventMeta?: any;
  originalGoldSkill?: { nameEn: string; nameJp?: string; id?: number };
}

export interface DisplayParentSkill {
  id: number;
  nameEn: string;
  nameJp: string;
  descEn?: string;
  rarity?: number;
  iconId?: number | null;
  source: "hint" | "event" | "unique" | "factor";
  sourceLabel: string;
  isUniqueToParent?: boolean;
  isDuplicateInMain?: boolean;
  isInheritOnly?: boolean;
  parentDuplicateCount?: number;
  originalGoldSkill?: { nameEn: string; nameJp?: string; id?: number };
  originalUniqueSkill?: { nameEn: string; nameJp?: string; id?: number };
  grants?: DisplayParentSkillGrant[];
  mainCardGrants?: { cardName: string; source: string }[];
}

export function useLineageSkills() {
  const { setup } = useParentingSetup();
  const { mainSkillIdSet } = useDeck();
  const [characters, setCharacters] = useState<CharacterIndexEntry[]>([]);
  const [skillsById, setSkillsById] = useState<Map<number, SkillDetail>>(new Map());

  useEffect(() => {
    api.listCharacters().then(setCharacters).catch(console.error);
    api.listSkills().then((skills) => {
      setSkillsById(new Map(skills.map((s) => [s.id, s])));
    }).catch(console.error);
  }, []);

  const charaByCardIdMap = useMemo(() => {
    return new Map<number, CharacterIndexEntry>(characters.map((c) => [c.id, c]));
  }, [characters]);

  const p1Chara = useMemo(() => {
    if (!setup.parent1) return null;
    return charaByCardIdMap.get(setup.parent1.card_id) || null;
  }, [setup.parent1, charaByCardIdMap]);

  const p2Chara = useMemo(() => {
    if (!setup.parent2) return null;
    return charaByCardIdMap.get(setup.parent2.card_id) || null;
  }, [setup.parent2, charaByCardIdMap]);

  // Grandparents resolution
  const p1_gp1 = useMemo(
    () => resolveGrandparentSlot(setup.gpOverrides.p1_gp1, setup.parent1, 10),
    [setup.gpOverrides.p1_gp1, setup.parent1]
  );
  const p1_gp2 = useMemo(
    () => resolveGrandparentSlot(setup.gpOverrides.p1_gp2, setup.parent1, 20),
    [setup.gpOverrides.p1_gp2, setup.parent1]
  );
  const p2_gp1 = useMemo(
    () => resolveGrandparentSlot(setup.gpOverrides.p2_gp1, setup.parent2, 10),
    [setup.gpOverrides.p2_gp1, setup.parent2]
  );
  const p2_gp2 = useMemo(
    () => resolveGrandparentSlot(setup.gpOverrides.p2_gp2, setup.parent2, 20),
    [setup.gpOverrides.p2_gp2, setup.parent2]
  );

  const pedigreeSlots = useMemo(() => [
    { slotLabel: "Parent 1", tag: "P1", isParent: true, vet: setup.parent1, cardId: setup.parent1?.card_id },
    { slotLabel: "P1 Grandparent 1", tag: "P1-GP1", isParent: false, vet: p1_gp1, cardId: p1_gp1?.card_id },
    { slotLabel: "P1 Grandparent 2", tag: "P1-GP2", isParent: false, vet: p1_gp2, cardId: p1_gp2?.card_id },
    { slotLabel: "Parent 2", tag: "P2", isParent: true, vet: setup.parent2, cardId: setup.parent2?.card_id },
    { slotLabel: "P2 Grandparent 1", tag: "P2-GP1", isParent: false, vet: p2_gp1, cardId: p2_gp1?.card_id },
    { slotLabel: "P2 Grandparent 2", tag: "P2-GP2", isParent: false, vet: p2_gp2, cardId: p2_gp2?.card_id },
  ], [setup.parent1, setup.parent2, p1_gp1, p1_gp2, p2_gp1, p2_gp2]);

  // Full Aggregated Pedigree Skills (Uniques + Innate + Awakening + Events + Bloodline Factors)
  const pedigreeSkills: DisplayParentSkill[] = useMemo(() => {
    if (skillsById.size === 0 || characters.length === 0) return [];

    const byId = new Map<number, DisplayParentSkill>();

    const pushSkill = (
      skillId: number,
      source: "hint" | "event" | "unique" | "factor",
      sourceLabel: string,
      grantCardName: string,
      grantSource: string,
      slotLabel: string,
      originalGold?: { nameEn: string; nameJp?: string; id?: number },
      originalUnique?: { nameEn: string; nameJp?: string; id?: number }
    ) => {
      const isDupeInMain = mainSkillIdSet.has(skillId);
      const isInheritOnly = !isDupeInMain;
      const grant: DisplayParentSkillGrant = {
        cardName: grantCardName,
        source: grantSource,
        slotLabel,
        originalGoldSkill: originalGold,
      };

      const existing = byId.get(skillId);
      if (!existing) {
        const skill = skillsById.get(skillId);
        if (!skill) return;

        byId.set(skillId, {
          id: skill.id,
          nameEn: skill.nameEn,
          nameJp: skill.nameJp,
          descEn: skill.descEn,
          rarity: skill.rarity ?? 1,
          iconId: skill.iconId,
          source,
          sourceLabel,
          isUniqueToParent: true,
          isDuplicateInMain: isDupeInMain,
          isInheritOnly,
          originalGoldSkill: originalGold,
          originalUniqueSkill: originalUnique,
          grants: [grant],
          parentDuplicateCount: 1,
        });
      } else {
        if (!existing.grants?.some((g) => g.cardName === grantCardName && g.source === grantSource)) {
          existing.grants = [...(existing.grants ?? []), grant];
          existing.parentDuplicateCount = existing.grants.length;
        }
      }
    };

    for (const slot of pedigreeSlots) {
      if (!slot.cardId) continue;
      const chara = charaByCardIdMap.get(slot.cardId);

      // 1. Unique Skill (Inherit version)
      if (chara?.uniqueSkillId) {
        const inheritId = getInheritableSkillForUnique(chara.uniqueSkillId);
        const skillId = inheritId ?? chara.uniqueSkillId;
        const fullForm = inheritId ? skillsById.get(chara.uniqueSkillId) : null;
        pushSkill(
          skillId,
          "unique",
          `${slot.slotLabel}: ${chara.nameEn}`,
          `${chara.nameEn} (${slot.tag})`,
          "Unique",
          slot.slotLabel,
          undefined,
          fullForm ? { nameEn: fullForm.nameEn, nameJp: fullForm.nameJp, id: chara.uniqueSkillId } : undefined
        );
      }

      // 2. Innate Skills
      if (chara?.innateSkills) {
        for (const sId of chara.innateSkills) {
          const mapped = getInheritableSkillForGold(sId);
          const targetId = mapped?.whiteId ?? sId;
          pushSkill(
            targetId,
            "hint",
            `${slot.slotLabel}: ${chara.nameEn} (Innate)`,
            `${chara.nameEn} (${slot.tag})`,
            "Innate",
            slot.slotLabel,
            mapped ? { nameEn: mapped.goldNameEn, nameJp: mapped.goldNameJp, id: sId } : undefined
          );
        }
      }

      // 3. Awakening Skills
      if (chara?.awakeningSkills) {
        for (const sId of chara.awakeningSkills) {
          const mapped = getInheritableSkillForGold(sId);
          const targetId = mapped?.whiteId ?? sId;
          pushSkill(
            targetId,
            "event",
            `${slot.slotLabel}: ${chara.nameEn} (Awakening)`,
            `${chara.nameEn} (${slot.tag})`,
            "Awakening",
            slot.slotLabel,
            mapped ? { nameEn: mapped.goldNameEn, nameJp: mapped.goldNameJp, id: sId } : undefined
          );
        }
      }

      // 4. Event Skills
      if (chara?.eventSkills) {
        for (const sId of chara.eventSkills) {
          const mapped = getInheritableSkillForGold(sId);
          const targetId = mapped?.whiteId ?? sId;
          pushSkill(
            targetId,
            "event",
            `${slot.slotLabel}: ${chara.nameEn} (Event)`,
            `${chara.nameEn} (${slot.tag})`,
            "Event",
            slot.slotLabel,
            mapped ? { nameEn: mapped.goldNameEn, nameJp: mapped.goldNameJp, id: sId } : undefined
          );
        }
      }

      // 5. Bloodline Factors
      if (slot.vet?.factor_info_array) {
        for (const f of slot.vet.factor_info_array) {
          if (f.factor_id >= 10000) {
            const stars = Number(String(f.factor_id).slice(-1)) || 1;
            const name = getCanonicalFactorName(f.factor_id) || decodeFactor(f.factor_id).name;
            const isDupeInMain = mainSkillIdSet.has(f.factor_id);
            const isInheritOnly = !isDupeInMain;
            const grant: DisplayParentSkillGrant = {
              cardName: `Factor (${slot.tag})`,
              source: "Bloodline Factor",
              slotLabel: slot.slotLabel,
            };

            const existing = byId.get(f.factor_id);
            if (!existing) {
              byId.set(f.factor_id, {
                id: f.factor_id,
                nameEn: name,
                nameJp: name,
                descEn: `Inheritable bloodline factor (${"★".repeat(stars)}). May spark and be learned during training events.`,
                rarity: 1,
                iconId: null,
                source: "factor",
                sourceLabel: `Bloodline Factor (${slot.tag})`,
                isUniqueToParent: true,
                isDuplicateInMain: isDupeInMain,
                isInheritOnly,
                grants: [grant],
                parentDuplicateCount: 1,
              });
            } else {
              if (!existing.grants?.some((g) => g.cardName === grant.cardName)) {
                existing.grants = [...(existing.grants ?? []), grant];
                existing.parentDuplicateCount = existing.grants.length;
              }
            }
          }
        }
      }
    }

    return Array.from(byId.values());
  }, [pedigreeSlots, skillsById, characters, charaByCardIdMap, mainSkillIdSet]);

  // Backwards compatible unique skills
  const lineageUniqueSkills = useMemo(() => {
    return pedigreeSkills.filter((s) => s.source === "unique");
  }, [pedigreeSkills]);

  // Backwards compatible bloodline factors
  const bloodlineFactorSkills = useMemo(() => {
    return pedigreeSkills.filter((s) => s.source === "factor");
  }, [pedigreeSkills]);

  return {
    setup,
    characters,
    charaByCardIdMap,
    p1Chara,
    p2Chara,
    pedigreeSlots,
    pedigreeSkills,
    lineageUniqueSkills,
    bloodlineFactorSkills,
  };
}
