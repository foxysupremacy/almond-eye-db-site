"use client";

// Shared lineage-skill data: Parent 1/2 unique skills and bloodline factors,
// derived from the parenting setup. Used by ParentSkillList and the Ace
// Complement Finder so both agree on what the uma side contributes.

import { useEffect, useMemo, useState } from "react";
import { useParentingSetup } from "./parenting-state";
import { api, type CharacterIndexEntry } from "./api";
import { getCanonicalFactorName } from "./affinity-engine";
import { decodeFactor } from "./factor-decoder";
import { getInheritableSkillForUnique } from "./skill-rarity";

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
  parentDuplicateCount?: number;
  originalGoldSkill?: { nameEn: string };
  originalUniqueSkill?: { nameEn: string };
  grants?: { cardName: string; source: string; eventMeta?: any }[];
  mainCardGrants?: { cardName: string; source: string }[];
}

export function useLineageSkills() {
  const { setup } = useParentingSetup();
  const [characters, setCharacters] = useState<CharacterIndexEntry[]>([]);
  const [lineageUniqueSkills, setLineageUniqueSkills] = useState<DisplayParentSkill[]>([]);

  useEffect(() => {
    api.listCharacters().then(setCharacters).catch(console.error);
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

  // Load Parent 1 and Parent 2 Unique Skills
  useEffect(() => {
    async function loadUniqueSkills() {
      const skills: DisplayParentSkill[] = [];
      const parents = [
        { slotLabel: "Parent 1", vet: setup.parent1 },
        { slotLabel: "Parent 2", vet: setup.parent2 },
      ];

      for (const p of parents) {
        if (!p.vet) continue;
        const chara = charaByCardIdMap.get(p.vet.card_id);
        if (chara?.uniqueSkillId) {
          try {
            // Unique skills passed down a lineage tree use their WHITE inherit
            // version (separate skill id with weaker effects) — display &
            // evaluation (activation, exclusion) must use the mapped id, never
            // the original. Only the ace's own unique stays in full form.
            const inheritId = getInheritableSkillForUnique(chara.uniqueSkillId);
            const skillId = inheritId ?? chara.uniqueSkillId;
            const [skill, fullForm] = await Promise.all([
              api.skill(skillId),
              inheritId ? api.skill(chara.uniqueSkillId).catch(() => null) : Promise.resolve(null),
            ]);
            skills.push({
              id: skill.id,
              nameEn: skill.nameEn,
              nameJp: skill.nameJp,
              descEn: skill.descEn,
              rarity: skill.rarity ?? 1,
              iconId: skill.iconId,
              source: "unique",
              sourceLabel: `${p.slotLabel}: ${chara.nameEn}`,
              isUniqueToParent: true,
              isDuplicateInMain: false,
              grants: [{ cardName: `${chara.nameEn} (${p.slotLabel})`, source: "Unique" }],
              originalUniqueSkill: fullForm ? { nameEn: fullForm.nameEn } : undefined,
            });
          } catch {}
        }
      }

      setLineageUniqueSkills(skills);
    }

    if (characters.length > 0) {
      loadUniqueSkills();
    }
  }, [setup.parent1, setup.parent2, characters, charaByCardIdMap]);

  // Bloodline White Factors
  const bloodlineFactorSkills: DisplayParentSkill[] = useMemo(() => {
    const factorList: DisplayParentSkill[] = [];
    const seenIds = new Set<number>();

    const checkSlots = [
      { label: "P1", vet: setup.parent1 },
      { label: "P2", vet: setup.parent2 },
    ];

    for (const slot of checkSlots) {
      if (!slot.vet?.factor_info_array) continue;
      for (const f of slot.vet.factor_info_array) {
        if (f.factor_id >= 10000 && !seenIds.has(f.factor_id)) {
          seenIds.add(f.factor_id);
          const stars = Number(String(f.factor_id).slice(-1)) || 1;
          const name = getCanonicalFactorName(f.factor_id) || decodeFactor(f.factor_id).name;
          factorList.push({
            id: f.factor_id,
            nameEn: name,
            nameJp: name,
            descEn: `Inheritable bloodline factor (${"★".repeat(stars)}). May spark and be learned during training events.`,
            rarity: 1,
            iconId: null,
            source: "factor",
            sourceLabel: `Bloodline Factor (${slot.label})`,
            isUniqueToParent: true,
            isDuplicateInMain: false,
          });
        }
      }
    }

    return factorList;
  }, [setup.parent1, setup.parent2]);

  return {
    setup,
    characters,
    charaByCardIdMap,
    p1Chara,
    p2Chara,
    lineageUniqueSkills,
    bloodlineFactorSkills,
  };
}
