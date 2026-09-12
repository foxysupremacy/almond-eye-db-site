import goldToWhiteData from "./gold-to-white.json";
import inheritMapData from "./data/unique-inherit-map.json";

export type RarityFilterKey = "all" | "white" | "gold" | "unique" | "evolved";

export interface MappedGoldSkill {
  whiteId: number;
  whiteNameEn: string;
  whiteNameJp: string;
  goldNameEn: string;
  goldNameJp: string;
}

export const GOLD_TO_WHITE_MAP: Record<string, MappedGoldSkill> =
  goldToWhiteData as Record<string, MappedGoldSkill>;

export interface RarityStyleMeta {
  key: "white" | "gold" | "unique" | "evolved";
  label: string;
  badgeLabel: string;
  badgeClass: string;
  borderClass: string;
  bgStyle?: React.CSSProperties;
  bgClass?: string;
}

/**
 * Visual styling rules for skill cards according to specification:
 * - Gold: linear-gradient(to right, rgb(255, 255, 239), rgb(255, 190, 40))
 * - Unique: linear-gradient(to right, rgb(255, 238, 239), rgb(255, 154, 211))
 * - Evolved: linear-gradient(to right, rgb(255, 238, 239), rgb(255, 154, 211)) with purple/fuchsia accents
 * - White: clean neutral white background
 */
export const RARITY_STYLES: Record<"white" | "gold" | "unique" | "evolved", RarityStyleMeta> = {
  white: {
    key: "white",
    label: "White",
    badgeLabel: "White",
    badgeClass: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700",
    borderClass: "border-zinc-200/90 dark:border-zinc-800",
    bgClass: "bg-white dark:bg-zinc-900",
  },
  gold: {
    key: "gold",
    label: "Gold",
    badgeLabel: "Gold",
    badgeClass: "bg-amber-200/90 dark:bg-amber-950 text-amber-950 dark:text-amber-100 font-bold border border-amber-400/80 dark:border-amber-700",
    borderClass: "border-amber-300 dark:border-amber-700/80 shadow-xs",
    bgClass: "bg-amber-50/60 dark:bg-amber-950/30",
  },
  unique: {
    key: "unique",
    label: "Unique",
    badgeLabel: "Unique",
    badgeClass: "bg-pink-100 dark:bg-pink-950 text-pink-950 dark:text-pink-100 font-bold border border-pink-300 dark:border-pink-700/80",
    borderClass: "border-pink-300/80 dark:border-pink-700/80 shadow-xs",
    bgClass: "bg-pink-50/60 dark:bg-pink-950/30",
  },
  evolved: {
    key: "evolved",
    label: "Evolved",
    badgeLabel: "Evo",
    badgeClass: "bg-purple-100 dark:bg-purple-950 text-purple-950 dark:text-purple-100 font-bold border border-purple-300 dark:border-purple-700/80",
    borderClass: "border-purple-300/80 dark:border-purple-700/80 shadow-xs",
    bgClass: "bg-purple-50/60 dark:bg-purple-950/30",
  },
};

/**
 * Determine the rarity category from raw rarity number (1..6).
 * 1: White
 * 2: Gold
 * 3, 4, 5: Unique (3: 1-2★, 4: Inherited, 5: 3★+ Unique)
 * 6: Evolved
 */
export function getRarityCategory(rarity?: number): "white" | "gold" | "unique" | "evolved" {
  if (!rarity || rarity === 1) return "white";
  if (rarity === 2) return "gold";
  if (rarity === 6) return "evolved";
  return "unique";
}

/** Get visual styling meta for any skill based on its rarity integer. */
export function getSkillRarityStyle(rarity?: number): RarityStyleMeta {
  const cat = getRarityCategory(rarity);
  return RARITY_STYLES[cat];
}

/**
 * Checks whether a skill's rarity matches the active filter tab.
 */
export function matchesRarityFilter(rarity: number | undefined, filter: RarityFilterKey): boolean {
  if (filter === "all") return true;
  return getRarityCategory(rarity) === filter;
}

/**
 * Look up the inheritable White skill mapping for a Gold skill.
 * Returns the mapped data if available, or null if the skill has no inheritable version.
 */
export function getInheritableSkillForGold(goldSkillId: number): MappedGoldSkill | null {
  return GOLD_TO_WHITE_MAP[String(goldSkillId)] ?? null;
}

/**
 * Unique skills downgrade to a white inherit version when passed down a
 * lineage tree — a separate skill id, not a rarity change. Mapping generated
 * from master.mdb (skill_data.unique_skill_id_1/2), see
 * scripts/generate_inherit_skills.py.
 */
const UNIQUE_INHERIT_MAP: Record<string, number> = inheritMapData as Record<string, number>;

/** Get the white inherit skill id for a unique skill, or null if unmapped. */
export function getInheritableSkillForUnique(uniqueSkillId: number): number | null {
  return UNIQUE_INHERIT_MAP[String(uniqueSkillId)] ?? null;
}
