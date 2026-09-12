// Static Data Store for AlmondEye DB.
//
// Loads pre-processed JSON datasets via Vite dynamic imports with code-splitting.
// Provides fast O(1) in-memory Map lookups for cards, skills, and racetracks.
// Zero remote API fetching required.

import type { Course } from "./skill-engine/types";

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
// Type definitions
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
  type:
    | "speed"
    | "stamina"
    | "power"
    | "guts"
    | "intelligence"
    | "wit"
    | "friend"
    | "group";
  release?: string | null;
  imgUrl: string;
  portraitUrl: string;
  eventSkills: number[];
  hintSkills: number[];
  eventDetails?: CardEventDetail[];
}

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
  imgUrl: string;
}

export interface SkillSummary {
  id: number;
  nameJp: string;
  nameEn: string;
  descEn?: string;
  rarity: 1 | 2 | 3;
  isRCard?: 0 | 1;
  eventMeta?: EventSkillMetadata;
  iconId?: number | null;
}

export interface CardSkills {
  eventSkills: SkillSummary[];
  hintSkills: SkillSummary[];
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
// Store Interface & Singleton
// ---------------------------------------------------------------------------

export interface DataStore {
  cards: CardIndexEntry[];
  characters: CharacterIndexEntry[];
  skills: SkillDetail[];
  racetracks: RacetrackDetail[];
  cardsById: Map<number, CardIndexEntry>;
  charactersById: Map<number, CharacterIndexEntry>;
  skillsById: Map<number, SkillDetail>;
  tracksById: Map<number, RacetrackDetail>;
  coursesById: Map<number, CourseRow>;

  getCard(id: number): CardIndexEntry | undefined;
  getCharacter(id: number): CharacterIndexEntry | undefined;
  getSkill(id: number): SkillDetail | undefined;
  getTrack(id: number): RacetrackDetail | undefined;
  getCourse(id: number): CourseRow | undefined;
  getCardSkills(cardId: number): CardSkills;
}

let storeInstance: DataStore | null = null;
let storePromise: Promise<DataStore> | null = null;

export async function initDataStore(): Promise<DataStore> {
  if (storeInstance) return storeInstance;
  if (storePromise) return storePromise;

  storePromise = (async () => {
    const [rawCardsMod, rawSkillsMod, rawTracksMod, rawCharasMod, rawInheritSkillsMod] = await Promise.all([
      import("./data/cards.json"),
      import("./data/skills.json"),
      import("./data/racetracks.json"),
      import("./data/characters.json"),
      import("./data/skills-inherit.json"),
    ]);

    const rawCards = (rawCardsMod.default || rawCardsMod) as any[];
    // Inherited-unique (white) skill versions, generated from master.mdb —
    // see scripts/generate_inherit_skills.py
    const rawSkills = [
      ...((rawSkillsMod.default || rawSkillsMod) as any[]),
      ...((rawInheritSkillsMod.default || rawInheritSkillsMod) as any[]),
    ] as any[];
    const rawTracks = (rawTracksMod.default || rawTracksMod) as any[];
    const rawCharas = (rawCharasMod.default || rawCharasMod) as any[];

    // Hydrate cards with deterministic image URLs
    const cards: CardIndexEntry[] = rawCards.map((c) => ({
      id: c.id,
      nameEn: c.nameEn,
      nameJp: c.nameJp,
      charName: c.charName,
      titleEn: c.titleEn,
      titleJa: c.titleJa,
      rarity: c.rarity,
      type: c.type,
      release: c.release,
      imgUrl: getCardImageUrl(c.id, "art"),
      portraitUrl: getCardImageUrl(c.id, "portrait"),
      eventSkills: c.eventSkills || [],
      hintSkills: c.hintSkills || [],
      eventDetails: c.eventDetails || [],
    }));

    // Hydrate playable characters with CDN avatar URLs
    const characters: CharacterIndexEntry[] = rawCharas.map((c) => ({
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

    const skills: SkillDetail[] = rawSkills.map((s) => ({
      id: s.id,
      nameEn: s.nameEn,
      nameJp: s.nameJp,
      descEn: s.descEn || "",
      descJp: s.descJp,
      rarity: s.rarity || 1,
      iconId: s.iconId,
      conditionGroups: s.conditionGroups || [],
    }));

    const racetracks: RacetrackDetail[] = rawTracks as RacetrackDetail[];

    const cardsById = new Map<number, CardIndexEntry>(cards.map((c) => [c.id, c]));
    const charactersById = new Map<number, CharacterIndexEntry>(characters.map((c) => [c.id, c]));
    const skillsById = new Map<number, SkillDetail>(skills.map((s) => [s.id, s]));
    const tracksById = new Map<number, RacetrackDetail>(racetracks.map((t) => [t.id, t]));
    const coursesById = new Map<number, CourseRow>();
    for (const t of racetracks) {
      for (const c of t.courses) {
        coursesById.set(c.id, c);
      }
    }

    const store: DataStore = {
      cards,
      characters,
      skills,
      racetracks,
      cardsById,
      charactersById,
      skillsById,
      tracksById,
      coursesById,

      getCard(id: number) {
        return cardsById.get(id);
      },
      getCharacter(id: number) {
        return charactersById.get(id);
      },
      getSkill(id: number) {
        return skillsById.get(id);
      },
      getTrack(id: number) {
        return tracksById.get(id);
      },
      getCourse(id: number) {
        return coursesById.get(id);
      },
      getCardSkills(cardId: number): CardSkills {
        const c = cardsById.get(cardId);
        if (!c) return { eventSkills: [], hintSkills: [] };

        const eventMetaMap = new Map<number, EventSkillMetadata>();
        if (c.eventDetails) {
          for (const ev of c.eventDetails) {
            const totalChoices = ev.choices.length;
            for (const ch of ev.choices) {
              for (const sid of ch.skillIds) {
                if (!eventMetaMap.has(sid)) {
                  eventMetaMap.set(sid, {
                    eventId: ev.eventId,
                    eventNameEn: ev.nameEn,
                    eventNameJp: ev.nameJp,
                    choiceIndex: ch.index,
                    choiceTextEn: ch.textEn,
                    choiceTextJp: ch.textJp,
                    totalChoices,
                    eventType: ev.eventType,
                    chainStep: ev.chainStep,
                    statSummary: ch.statSummary,
                  });
                }
              }
            }
          }
        }

        const resolve = (id: number): SkillSummary => {
          const s = skillsById.get(id);
          if (!s) {
            return {
              id,
              nameEn: `Skill ${id}`,
              nameJp: `Skill ${id}`,
              rarity: 1,
            };
          }
          return {
            id: s.id,
            nameEn: s.nameEn,
            nameJp: s.nameJp,
            descEn: s.descEn,
            rarity: s.rarity,
            iconId: s.iconId,
          };
        };
        return {
          eventSkills: c.eventSkills.map((id) => {
            const summary = resolve(id);
            const meta = eventMetaMap.get(id);
            if (meta) {
              summary.eventMeta = meta;
            }
            return summary;
          }),
          hintSkills: c.hintSkills.map(resolve),
        };
      },
    };

    storeInstance = store;
    return store;
  })();

  return storePromise;
}

/** Synchronous accessor if data store is already initialized, otherwise returns null. */
export function getDataStore(): DataStore | null {
  return storeInstance;
}

// ---------------------------------------------------------------------------
// Course Flattening & Formatting Helpers
// ---------------------------------------------------------------------------

/** Promote the course geometry onto the row in the flat shape lib/skill-engine expects. */
export function flattenCourse(row: CourseRow): Course {
  const d = row.data ?? {};
  return {
    id: row.id,
    terrain: row.terrain,
    turn: row.turn,
    distance: row.distance,
    inout: row.inout,
    length: row.length,
    corners: row.corners ?? d.corners ?? [],
    straights: row.straights ?? d.straights ?? [],
    slopes: row.slopes ?? d.slopes ?? [],
    phases: row.phases ?? d.phases,
    spurtStart: row.spurtStart ?? d.spurtStart,
    positionKeepEnd: row.positionKeepEnd ?? d.positionKeepEnd,
    trackId: row.trackId,
  };
}

export function distanceLabel(distance: number, length: number): string {
  const tag =
    distance === 1
      ? "Sprint"
      : distance === 2
        ? "Mile"
        : distance === 3
          ? "Middle"
          : "Long";
  return `${tag} ${length}m`;
}

export function terrainLabel(terrain: number): string {
  return terrain === 1 ? "Turf" : terrain === 2 ? "Dirt" : "?";
}

export function turnLabel(turn: number): string {
  return turn === 1 ? "Right" : turn === 2 ? "Left" : turn === 4 ? "Straight" : "?";
}
