// Static Data Registry — the single gateway to the pre-processed JSON datasets.
//
// Every module that needs synchronous access to game data imports from here;
// importing the JSON files directly is reserved for this module only.
// (racetracks.json is the exception — it stays a dynamic import inside
// lib/data-store.ts for code-splitting.)
//
// Hydrated entities carry deterministic CDN image URLs. Large lookups that
// lib/data-store.ts builds on top of this data (DataStore with getCardSkills
// etc.) live there; the maps below serve modules that cannot await an async
// init (pure engines called during render).

import rawCardsJson from "./cards.json";
import rawSkillsJson from "./skills.json";
import rawSkillsInheritJson from "./skills-inherit.json";
import rawCharactersJson from "./characters.json";
import rawAffinityJson from "./affinity.json";
import rawCareersJson from "./careers.json";
import rawUniqueInheritJson from "./unique-inherit-map.json";
import rawGoldToWhiteJson from "../gold-to-white.json";
import rawSkillMetaJson from "./skill-meta.json";

import type {
  AffinityDataPayload,
  CardIndexEntry,
  CareerG1Race,
  CardMeta,
  CharacterIndexEntry,
  MappedGoldSkill,
  SkillDetail,
  SkillMeta,
} from "./types";

export type {
  AffinityDataPayload,
  CareerG1Race,
  CardMeta,
  MappedGoldSkill,
  SkillMeta,
};

const CDN_BASE: string =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_CDN_URL) ||
  "https://cdn.almond-eye.tech";

/** Generate CDN image URLs for card artwork and square portrait icons. */
export function getCardImageUrl(cardId: number, variant: "art" | "portrait" = "art"): string {
  const code = variant === "portrait" ? "02" : "01";
  return `${CDN_BASE}/support/${cardId}/${cardId}/${code}.png`;
}

/** Generate CDN image URLs for playable character avatars and stands.
 * variant="01" -> full art / character stand (img field in manifest)
 * variant="02" -> support-card / character portrait (portrait field)
 * Format: https://cdn.almond-eye.tech/assets/chara_stand/{cardId}/{paddedBaseId}/{variant}.png
 */
export function getCharacterImageUrl(
  charId: number,
  cardId: number,
  variant: "01" | "02" = "01"
): string {
  const baseId = charId || Math.floor(cardId / 100);
  const paddedBaseId = String(baseId).padStart(6, "0");
  return `${CDN_BASE}/assets/chara_stand/${cardId}/${paddedBaseId}/${variant}.png`;
}

// ---------------------------------------------------------------------------
// Hydrated datasets
// ---------------------------------------------------------------------------

/** Support cards with hydrated CDN image URLs. */
export const cards: CardIndexEntry[] = (rawCardsJson as any[]).map((c) => ({
  id: c.id,
  nameEn: c.nameEn,
  nameJp: c.nameJp,
  charName: c.charName,
  titleEn: c.titleEn,
  titleJa: c.titleJa,
  rarity: c.rarity,
  type: c.type,
  release: c.release,
  urlName: c.urlName ?? null,
  imgUrl: getCardImageUrl(c.id, "art"),
  portraitUrl: getCardImageUrl(c.id, "portrait"),
  eventSkills: c.eventSkills || [],
  hintSkills: c.hintSkills || [],
  eventDetails: c.eventDetails || [],
}));

/** Playable characters with hydrated CDN avatar URLs. */
export const characters: CharacterIndexEntry[] = (rawCharactersJson as any[]).map((c) => ({
  id: c.id,
  charId: c.charId,
  variant: c.variant || String(c.id).slice(-2),
  nameEn: c.nameEn,
  nameJp: c.nameJp,
  titleEn: c.titleEn,
  titleJp: c.titleJp,
  rarity: c.rarity,
  release: c.release,
  aptitude: c.aptitude || [],
  baseStats: c.baseStats || [],
  uniqueSkillId: c.uniqueSkillId,
  innateSkills: c.innateSkills || [],
  awakeningSkills: c.awakeningSkills || [],
  eventSkills: c.eventSkills || [],
  imgUrl: getCharacterImageUrl(c.charId, c.id),
}));

// Inherited-unique (white) skill versions, generated from master.mdb —
// see scripts/generate_inherit_skills.py
export const skillsBase: SkillDetail[] = (rawSkillsJson as any[]).map((s) => ({
  id: s.id,
  nameEn: s.nameEn,
  nameJp: s.nameJp,
  descEn: s.descEn || "",
  descJp: s.descJp,
  rarity: s.rarity || 1,
  iconId: s.iconId,
  tags: s.tags || [],
  conditionGroups: s.conditionGroups || [],
}));

export const skillsInherit: SkillDetail[] = (rawSkillsInheritJson as any[]).map((s) => ({
  id: s.id,
  nameEn: s.nameEn,
  nameJp: s.nameJp,
  descEn: s.descEn || "",
  descJp: s.descJp,
  rarity: s.rarity || 1,
  iconId: s.iconId,
  tags: s.tags || [],
  conditionGroups: s.conditionGroups || [],
}));

/** Base skills merged with their inherited-unique (white) versions. */
export const skills: SkillDetail[] = [...skillsBase, ...skillsInherit];

// ---------------------------------------------------------------------------
// Lookup maps
// ---------------------------------------------------------------------------

export const cardsById: Map<number, CardIndexEntry> = new Map(cards.map((c) => [c.id, c]));
export const charactersById: Map<number, CharacterIndexEntry> = new Map(
  characters.map((c) => [c.id, c])
);
export const skillsById: Map<number, SkillDetail> = new Map(skills.map((s) => [s.id, s]));
/** skill id -> icon id (convenience for translation metadata consumers). */
export const skillIconById: Map<number, number | null> = new Map(skills.map((s) => [s.id, s.iconId ?? null]));

/** First character variant for a char_id (the common "who is this character" lookup). */
export const charactersByCharId: Map<number, CharacterIndexEntry> = new Map(
  characters.map((c) => [c.charId, c])
);

/** All costume variants grouped by char_id. */
export const characterVariantsByCharId: Map<number, CharacterIndexEntry[]> = (() => {
  const map = new Map<number, CharacterIndexEntry[]>();
  for (const c of characters) {
    const list = map.get(c.charId) ?? [];
    list.push(c);
    map.set(c.charId, list);
  }
  return map;
})();

// ---------------------------------------------------------------------------
// Auxiliary datasets
// ---------------------------------------------------------------------------

/** Affinity/relation matrices from GameTora + hakuraku (see scripts/extract-affinity.ts). */
export const affinityData = rawAffinityJson as AffinityDataPayload;

/** Per-character career G1 objectives, keyed by char_id as string (JSON constraint). */
export const careersByCharId: Record<string, CareerG1Race[]> = rawCareersJson as Record<
  string,
  CareerG1Race[]
>;

/** Unique skill id -> inherited white skill id (string keys, JSON constraint). */
export const uniqueInheritMap: Record<string, number> = rawUniqueInheritJson as Record<string, number>;

/** Gold skill id -> inheritable white counterpart (string keys, JSON constraint). */
export const goldToWhiteMap: Record<string, MappedGoldSkill> = rawGoldToWhiteJson as Record<
  string,
  MappedGoldSkill
>;

/** Hachimi-translated skill metadata keyed by skill id string. */
export const skillMetaMap: Record<string, SkillMeta> = rawSkillMetaJson as Record<
  string,
  SkillMeta
>;

/** Card metadata (grant lists, url names) keyed by card id string — derived
 * from the hydrated cards dataset (formerly a separate card-data.json). */
export const cardMetaMap: Record<string, CardMeta> = Object.fromEntries(
  cards.map((c) => [
    String(c.id),
    {
      hints: c.hintSkills,
      events: c.eventSkills,
      eventDetails: c.eventDetails,
      nameEn: c.nameEn,
      nameJp: c.nameJp,
      rarity: c.rarity,
      type: c.type,
      urlName: c.urlName ?? "",
    } satisfies CardMeta,
  ])
);

// ---------------------------------------------------------------------------
// Character-specific EVO (rarity 6) skills, indexed by exact costume card id.
// Scenario-wide EVOs (e.g. id prefixes 407/408/409/410) are excluded because
// Math.trunc(skill.id / 1000) does not match any playable costume card_id.
// ---------------------------------------------------------------------------

/** Character-specific EVO skills grouped by costume card id. */
export const evolvedSkillsByCharacterCardId: Map<number, SkillDetail[]> = (() => {
  const index = new Map<number, SkillDetail[]>();
  for (const skill of skillsBase) {
    if (skill.rarity !== 6) continue;
    const cardId = Math.trunc(skill.id / 1000);
    if (!charactersById.has(cardId)) continue;
    const list = index.get(cardId) ?? [];
    list.push(skill);
    index.set(cardId, list);
  }
  for (const list of index.values()) list.sort((a, b) => a.id - b.id);
  return index;
})();

// ---------------------------------------------------------------------------
// Parent-only succession EVO skills from master.mdb's
// skill_upgrade_succession_skill table. These remain visible as planning
// candidates whenever the exact character costume occupies Parent 1 or 2;
// account ownership is a game-side eligibility rule, not a visualizer gate.
// ---------------------------------------------------------------------------

const SUCCESSION_EVO_SKILL_ID_BY_PARENT_CARD_ID = new Map<number, number>([
  [110902, 92111091], // Rhein Kraft
  [113501, 91101351], // Stay Gold
  [114101, 91101411], // Epiphaneia
]);

/** Exact direct-parent character card id -> succession EVO skill. */
export const successionEvolvedSkillByParentCardId: Map<number, SkillDetail> = (() => {
  const index = new Map<number, SkillDetail>();
  for (const [cardId, skillId] of SUCCESSION_EVO_SKILL_ID_BY_PARENT_CARD_ID) {
    const skill = skillsById.get(skillId);
    if (skill) index.set(cardId, skill);
  }
  return index;
})();
