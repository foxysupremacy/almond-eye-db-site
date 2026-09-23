// Typed schema for the pre-processed datasets produced by scripts/generate-data.ts
// and scripts/extract-affinity.ts (see `bun run build:data`).
//
// This module is the contract between the data pipeline and the client. The
// pipeline's output shape is only "known" through these interfaces — keep them
// in sync when changing the generators.

// ---------------------------------------------------------------------------
// Support cards (lib/data/cards.json)
// ---------------------------------------------------------------------------

export interface CardEventChoice {
  index: number;
  textEn: string;
  textJp: string;
  skillIds: number[];
  statSummary?: string;
}

export interface CardEventDetail {
  eventId: number;
  nameEn: string;
  nameJp: string;
  eventType?: "chain" | "random";
  chainStep?: number;
  choices: CardEventChoice[];
}

export interface EventSkillMetadata {
  eventId: number;
  eventNameEn: string;
  eventNameJp: string;
  choiceIndex: number;
  choiceTextEn: string;
  choiceTextJp: string;
  totalChoices: number;
  eventType?: "chain" | "random";
  chainStep?: number;
  statSummary?: string;
}

export interface CardIndexEntry {
  id: number;
  nameJp: string;
  nameEn: string;
  charName?: string;
  titleEn?: string;
  titleJa?: string;
  rarity: 1 | 2 | 3;
  /** Training type — filled in by the GameTora card crawl; null until then. */
  type:
    | "speed"
    | "stamina"
    | "power"
    | "guts"
    | "intelligence"
    | "wit"
    | "friend"
    | "group"
    | null;
  release?: string | null;
  /** GameTora URL slug (e.g. "30308-almond-eye") used by the card crawler. */
  urlName?: string | null;
  imgUrl: string;
  portraitUrl: string;
  eventSkills: number[];
  hintSkills: number[];
  eventDetails?: CardEventDetail[];
}

export interface CardSkills {
  eventSkills: SkillSummary[];
  hintSkills: SkillSummary[];
}

// ---------------------------------------------------------------------------
// Playable characters (lib/data/characters.json)
// ---------------------------------------------------------------------------

export interface CharacterIndexEntry {
  id: number; // card_id, e.g. 100101
  charId: number; // char_id, e.g. 1001
  variant: string; // costume variant, e.g. "01"
  nameEn: string;
  nameJp: string;
  titleEn: string;
  titleJp: string;
  rarity: number; // base stars (1..3)
  release?: string | null;
  aptitude: string[];
  baseStats: number[];
  uniqueSkillId?: number | null;
  innateSkills?: number[];
  awakeningSkills?: number[];
  eventSkills?: number[];
  growthRates?: number[];
  imgUrl: string;
}

export interface CharacterEvolutionDetail {
  rank: number;
  baseSkillId: number;
  skillId: number;
  nameEn: string;
  nameJp: string;
  descEn?: string;
  descJp?: string;
  iconId: number | null;
  branchTag?: string;
  condition1?: string;
}

export interface CardEffectEntry {
  type: number;
  nameEn: string;
  nameJp: string;
  values: number[]; // [0 LB, 1 LB, 2 LB, 3 LB, MLB]
}

export interface CardUniqueEffectEntry {
  lv: number;
  textEn: string;
  textJp: string;
  effects: { type: number; nameEn: string; nameJp: string; value: number }[];
}

export interface SupportCardEffectsBlob {
  cardId: number;
  rarity: number;
  effects: CardEffectEntry[];
  uniqueEffect?: CardUniqueEffectEntry;
}

// ---------------------------------------------------------------------------
// Skills (lib/data/skills.json + lib/data/skills-inherit.json)
// ---------------------------------------------------------------------------

export interface SkillSummary {
  id: number;
  nameJp: string;
  nameEn: string;
  descEn?: string;
  rarity: number;
  isRCard?: 0 | 1;
  eventMeta?: EventSkillMetadata;
  iconId?: number | null;
}

export interface SkillConditionGroup {
  condition: string | null;
  precondition?: string | null;
  base_time?: number | null;
  effects: unknown[];
}

export interface SkillDetail extends SkillSummary {
  descJp?: string;
  descEn: string;
  iconId?: number | null;
  cost?: number;
  activation?: number;
  tags?: string[];
  versions?: number[];
  geneVersion?: unknown;
  evo?: unknown;
  conditionGroups: SkillConditionGroup[];
  grantingCards?: unknown[];
}

// ---------------------------------------------------------------------------
// Race-impact telemetry aggregate (lib/data/race-impact-priors.json)
// ---------------------------------------------------------------------------

export type RaceImpactDynamicKey =
  | "blocked"
  | "overtake"
  | "nearby"
  | "surrounded"
  | "activate_count"
  | "other_skill"
  | "visibility";

export interface RaceImpactPrior {
  key: RaceImpactDynamicKey;
  courseId?: number;
  groundCondition?: number;
  runningStyle?: number;
  racerCount?: number;
  opportunities: number;
  activations: number;
}

export interface RaceImpactPriorsPayload {
  version: 1;
  generatedAt: string;
  priors: RaceImpactPrior[];
}

// ---------------------------------------------------------------------------
// Racetracks (lib/data/racetracks.json)
// ---------------------------------------------------------------------------

export interface Racetrack {
  id: number;
  nameJa: string;
  nameEn: string;
  courseCount: number;
}

export interface CourseDataBlob {
  corners?: { start: number; end: number; number?: number }[];
  laps?: { start: number; end: number; lap: number }[];
  slopes?: { start: number; end: number; slope: number }[];
  phases?: { id: number; start: number; end: number }[];
  straights?: { start: number; end: number; frontType: number }[];
  spurtStart?: { meters?: number; lap?: number; location?: string[] };
  positionKeepEnd?: number;
  noMansLand?: { start: number; end: number }[];
  overlaps?: string[];
  statThresholds?: unknown[];
  terrainChanges?: unknown[];
}

export interface CourseRow {
  id: number;
  trackId: number;
  distance: 1 | 2 | 3 | 4;
  inout: number;
  length: number;
  terrain: 1 | 2;
  turn: 1 | 2 | 4;
  corners?: { start: number; end: number; number?: number }[];
  straights?: { start: number; end: number; frontType: number }[];
  slopes?: { start: number; end: number; slope: number }[];
  phases?: { id: number; start: number; end: number }[];
  spurtStart?: { meters?: number; lap?: number; location?: string[] };
  positionKeepEnd?: number;
  data: CourseDataBlob;
}

export interface RacetrackDetail extends Racetrack {
  courses: CourseRow[];
}

// ---------------------------------------------------------------------------
// Affinity (lib/data/affinity.json — generated by scripts/extract-affinity.ts)
// ---------------------------------------------------------------------------

export interface AffinityDataPayload {
  relationPoints: Record<string, number>;
  charaRelationTypes: Record<string, number[]>;
  g1Saddles: number[];
  winSaddleToRaceInstance: Record<string, number>;
  factorNames: Record<string, string>;
  saddleNames: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Career G1 schedules (lib/data/careers.json)
// ---------------------------------------------------------------------------

export interface CareerG1Race {
  /** Trophy/saddle id (umdb singleModeWinsSaddle) when the race maps to one. */
  saddleId?: number;
  /** GameTora career race id (e.g. 1003 Osaka Hai, 1023 Arima Kinen). */
  raceId: number;
  nameEn: string;
  /** Only G1 races (grade 100) are exported. */
  grade: number;
  trackId: number;
  distance: number;
  terrain: number;
  /** True when the objective requires winning the race (cond_value 1). */
  mustWin: boolean;
}

// ---------------------------------------------------------------------------
// Gold→white inherit mappings (lib/gold-to-white.json,
// lib/data/unique-inherit-map.json — generated by scripts/generate_inherit_skills.py)
// ---------------------------------------------------------------------------

export interface MappedGoldSkill {
  whiteId: number;
  whiteNameEn: string;
  whiteNameJp: string;
  goldNameEn: string;
  goldNameJp: string;
}

// ---------------------------------------------------------------------------
// Translation/merge metadata (lib/data/skill-meta.json — patched by
// scripts/generate-data.ts with Hachimi translations; card metadata is
// derived from lib/data/cards.json)
// ---------------------------------------------------------------------------

export interface SkillMeta {
  nameEn: string;
  nameJp: string;
  descEn?: string;
  rarity: number;
  styles: number[];     // 1: Runner, 2: Leader, 3: Betweener, 4: Chaser
  distances: number[];  // 1: Sprint, 2: Mile, 3: Medium, 4: Long
  surfaces: number[];   // 1: Turf, 2: Dirt
  isGeneric: boolean;
  conditions?: { condition: string; precondition?: string | null }[];
}

export interface CardMeta {
  hints: number[];
  events: number[];
  eventDetails?: CardEventDetail[];
  nameEn: string;
  nameJp: string;
  rarity: number;
  /** Training type; null while a card awaits its first GameTora crawl. */
  type: string | null;
  urlName: string;
}
