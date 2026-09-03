import goldToWhiteData from "./gold-to-white.json";

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
    badgeClass: "bg-zinc-100 text-zinc-700 border border-zinc-200",
    borderClass: "border-zinc-200/90",
    bgClass: "bg-white",
  },
  gold: {
    key: "gold",
    label: "Gold",
    badgeLabel: "Gold",
    badgeClass: "bg-amber-200/90 text-amber-950 font-bold border border-amber-300",
    borderClass: "border-amber-300/80 shadow-xs",
    bgStyle: {
      backgroundImage: "linear-gradient(to right, rgb(255, 255, 239), rgb(255, 190, 40))",
    },
  },
  unique: {
    key: "unique",
    label: "Unique",
    badgeLabel: "Unique",
    badgeClass: "bg-pink-100 text-pink-900 font-bold border border-pink-300",
    borderClass: "border-pink-300/80 shadow-xs",
    bgStyle: {
      backgroundImage: "linear-gradient(to right, rgb(255, 238, 239), rgb(255, 154, 211))",
    },
  },
  evolved: {
    key: "evolved",
    label: "Evolved",
    badgeLabel: "Evo",
    badgeClass: "bg-purple-100 text-purple-900 font-bold border border-purple-300",
    borderClass: "border-purple-300/80 shadow-xs",
    bgStyle: {
      backgroundImage: "linear-gradient(to right, rgb(255, 238, 239), rgb(255, 154, 211))",
    },
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
