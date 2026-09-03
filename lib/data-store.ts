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
  skills: SkillDetail[];
  racetracks: RacetrackDetail[];
  cardsById: Map<number, CardIndexEntry>;
  skillsById: Map<number, SkillDetail>;
  tracksById: Map<number, RacetrackDetail>;
  coursesById: Map<number, CourseRow>;

  getCard(id: number): CardIndexEntry | undefined;
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
    const [rawCardsMod, rawSkillsMod, rawTracksMod] = await Promise.all([
      import("./data/cards.json"),
      import("./data/skills.json"),
      import("./data/racetracks.json"),
    ]);

    const rawCards = (rawCardsMod.default || rawCardsMod) as any[];
    const rawSkills = (rawSkillsMod.default || rawSkillsMod) as any[];
    const rawTracks = (rawTracksMod.default || rawTracksMod) as any[];

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
      skills,
      racetracks,
      cardsById,
      skillsById,
      tracksById,
      coursesById,

      getCard(id: number) {
        return cardsById.get(id);
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
