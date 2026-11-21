// Pure projection from a (shared) veteran to Partner Card display rows.
// Shared by the DOM view and the canvas PNG renderer so both show the same data.

import { cardsById, charactersById, getCardImageUrl, getCharacterImageUrl, skillsById } from "@/lib/api";
import { g1Calendar } from "@/lib/data/registry";
import { decodeFactor, type DecodedFactor } from "@/lib/lineage/factor-decoder";
import { calculateAffinity, getCanonicalSaddleName, type AffinityCalculationResult } from "@/lib/lineage/affinity-engine";
import { ALL_PARTNER_SECTIONS, type PartnerSection } from "@/lib/veterans/share/partner-codec";
import { localizeSpark } from "@/lib/lineage/spark-names";
import type { KyumaruFactorInfo, KyumaruVeteranItem } from "@/lib/veterans/types";
import { veteranRankIconSrc } from "@/lib/veterans/rank-icon";

const GRADES = ["G", "F", "E", "D", "C", "B", "A", "S"] as const;
export type AptitudeGrade = (typeof GRADES)[number];

export function aptitudeLetter(value: number | undefined): AptitudeGrade {
  if (!value || value < 1) return "G";
  return GRADES[Math.min(value, 8) - 1];
}

export function ltbLabel(limitBreak: number): string {
  return limitBreak >= 4 ? "MLB" : `${Math.max(0, limitBreak)} LB`;
}

export interface PartnerAptitude {
  readonly label: string;
  readonly grade: AptitudeGrade;
}

export interface PartnerSupportCardRow {
  readonly id: number;
  readonly nameEn: string;
  readonly nameJp: string;
  readonly rarity: number;
  readonly lbLabel: string;
  readonly imageUrl: string;
}

export interface PartnerSkillRow {
  readonly id: number;
  readonly nameEn: string;
  readonly nameJp: string;
  readonly level: number;
  readonly rarity: number;
  readonly iconId: number | null;
}

export type SparkOwner = "self" | "parent1" | "parent2";

export interface PartnerSparkGroup {
  readonly owner: SparkOwner;
  readonly ownerName: string;
  readonly blue: DecodedFactor[];
  readonly pink: DecodedFactor[];
  readonly green: DecodedFactor[];
  readonly white: DecodedFactor[];
}

export interface PartnerWinRow {
  readonly id: number;
  readonly name: string;
  readonly nameJp: string;
}

export interface PartnerCardModel {
  readonly cardId: number;
  readonly nameEn: string;
  readonly nameJp: string;
  readonly titleEn: string;
  readonly portraitUrl: string;
  readonly rank: number;
  readonly rankIconSrc: string;
  readonly rarity: number;
  readonly stats: { readonly label: string; readonly value: number }[];
  readonly aptitudes: {
    readonly surface: PartnerAptitude[];
    readonly distance: PartnerAptitude[];
    readonly style: PartnerAptitude[];
  };
  readonly supportCards: PartnerSupportCardRow[];
  readonly skills: PartnerSkillRow[];
  readonly sparks: PartnerSparkGroup[];
  readonly wins: PartnerWinRow[];
}

let saddleNamesEn: Map<number, string> | null = null;
function englishSaddleName(saddleId: number): string | null {
  if (!saddleNamesEn) {
    saddleNamesEn = new Map();
    for (const race of g1Calendar.races) {
      if (race.saddleId != null && !saddleNamesEn.has(race.saddleId)) saddleNamesEn.set(race.saddleId, race.nameEn);
    }
  }
  return saddleNamesEn.get(saddleId) ?? null;
}

function characterLabel(cardId: number): { nameEn: string; nameJp: string; titleEn: string; charId: number } {
  const chara = charactersById.get(cardId);
  return {
    nameEn: chara?.nameEn || `Chara ${cardId}`,
    nameJp: chara?.nameJp || "",
    titleEn: chara?.titleEn || chara?.titleJp || "",
    charId: chara?.charId ?? Math.floor(cardId / 100),
  };
}

function groupSparks(owner: SparkOwner, ownerName: string, factors: KyumaruFactorInfo[]): PartnerSparkGroup {
  const group = { owner, ownerName, blue: [] as DecodedFactor[], pink: [] as DecodedFactor[], green: [] as DecodedFactor[], white: [] as DecodedFactor[] };
  for (const info of factors) {
    const f = localizeSpark(decodeFactor(info.factor_id));
    if (f.type === "blue") group.blue.push(f);
    else if (f.type === "pink") group.pink.push(f);
    else if (f.type === "green") group.green.push(f);
    else group.white.push(f);
  }
  group.white.sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
  return group;
}

export function buildPartnerCardModel(vet: KyumaruVeteranItem): PartnerCardModel {
  const self = characterLabel(vet.card_id);

  const supportCards = [...(vet.support_card_list ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((c): PartnerSupportCardRow => {
      const card = cardsById.get(c.support_card_id);
      return {
        id: c.support_card_id,
        nameEn: card?.nameEn || `Card ${c.support_card_id}`,
        nameJp: card?.nameJp || "",
        rarity: card?.rarity ?? 3,
        lbLabel: ltbLabel(c.limit_break_count),
        imageUrl: getCardImageUrl(c.support_card_id, "portrait"),
      };
    });

  const skills = (vet.skill_array ?? [])
    .map((item): PartnerSkillRow => {
      const skill = skillsById.get(item.skill_id);
      return {
        id: item.skill_id,
        nameEn: skill?.nameEn || `Skill ${item.skill_id}`,
        nameJp: skill?.nameJp || "",
        level: item.level,
        rarity: skill?.rarity ?? 1,
        iconId: skill?.iconId ?? null,
      };
    })
    .sort((a, b) => b.rarity - a.rarity || b.level - a.level || a.nameEn.localeCompare(b.nameEn));

  const sparks: PartnerSparkGroup[] = [];
  if (vet.factor_info_array) sparks.push(groupSparks("self", self.nameEn, vet.factor_info_array));
  for (const [owner, position] of [["parent1", 10], ["parent2", 20]] as const) {
    const parent = vet.succession_chara_array?.find((s) => s.position_id === position);
    if (parent?.factor_info_array) sparks.push(groupSparks(owner, characterLabel(parent.card_id).nameEn, parent.factor_info_array));
  }

  const wins = (vet.win_saddle_id_array ?? []).flatMap((id): PartnerWinRow[] => {
    const nameJp = getCanonicalSaddleName(id);
    if (!nameJp) return [];
    const nameEn = englishSaddleName(id);
    return [{ id, name: nameEn ?? nameJp, nameJp: nameEn ? nameJp : "" }];
  });

  const rank = vet.rank || 0;
  return {
    cardId: vet.card_id,
    nameEn: self.nameEn,
    nameJp: self.nameJp,
    titleEn: self.titleEn,
    portraitUrl: getCharacterImageUrl(self.charId, vet.card_id),
    rank,
    rankIconSrc: veteranRankIconSrc(rank),
    rarity: vet.rarity ?? 3,
    stats: [
      { label: "Speed", value: vet.speed },
      { label: "Stamina", value: vet.stamina },
      { label: "Power", value: vet.power },
      { label: "Guts", value: vet.guts },
      { label: "Wit", value: vet.wiz },
    ],
    aptitudes: {
      surface: [
        { label: "Turf", grade: aptitudeLetter(vet.proper_ground_turf) },
        { label: "Dirt", grade: aptitudeLetter(vet.proper_ground_dirt) },
      ],
      distance: [
        { label: "Sprint", grade: aptitudeLetter(vet.proper_distance_short) },
        { label: "Mile", grade: aptitudeLetter(vet.proper_distance_mile) },
        { label: "Medium", grade: aptitudeLetter(vet.proper_distance_middle) },
        { label: "Long", grade: aptitudeLetter(vet.proper_distance_long) },
      ],
      style: [
        { label: "Front", grade: aptitudeLetter(vet.proper_running_style_nige) },
        { label: "Pace", grade: aptitudeLetter(vet.proper_running_style_senko) },
        { label: "Late", grade: aptitudeLetter(vet.proper_running_style_sashi) },
        { label: "End", grade: aptitudeLetter(vet.proper_running_style_oikomi) },
      ],
    },
    supportCards,
    skills,
    sparks,
    wins,
  };
}

/** Sections shared by the sender that the viewer has not hidden, in canonical order. */
export function visiblePartnerSections(shared: readonly PartnerSection[], hidden: ReadonlySet<PartnerSection>): PartnerSection[] {
  return ALL_PARTNER_SECTIONS.filter((s) => shared.includes(s) && !hidden.has(s));
}

/** Affinity of this partner (with its own grandparents) for a trainee character id. */
export function computePartnerAffinity(vet: KyumaruVeteranItem, traineeCharaId: number | null): AffinityCalculationResult | null {
  if (!traineeCharaId) return null;
  return calculateAffinity(vet, traineeCharaId);
}
