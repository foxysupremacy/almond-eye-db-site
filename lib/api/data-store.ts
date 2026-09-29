// Static Data Store for AlmondEye DB.
//
// Thin async facade over ./registry.ts (the single JSON gateway):
// builds the O(1) Map lookups and per-card skill computation on top of the
// hydrated datasets. Large datasets remain code-split behind registry loaders.
// Zero remote API fetching required.

import {
  cards,
  characters,
  skills,
  getCardImageUrl,
  getCharacterImageUrl,
  getCharacterEvolutions,
  getCardSupportEffects,
  pvpRecommendations,
  loadRacetracks,
} from "../data/registry";

// Dataset schema — single source of truth in lib/data/types.ts.
export type {
  CardEventChoice,
  CardEventDetail,
  EventSkillMetadata,
  CardIndexEntry,
  CharacterIndexEntry,
  CharacterEvolutionDetail,
  SupportCardEffectsBlob,
  CardEffectEntry,
  CardUniqueEffectEntry,
  PvpRecommendationsPayload,
  SkillSummary,
  CardSkills,
  SkillConditionGroup,
  SkillDetail,
  Racetrack,
  CourseDataBlob,
  CourseRow,
  RacetrackDetail,
} from "../data/types";

// CDN URL builders live in the registry; re-exported here for compatibility.
export {
  getCardImageUrl,
  getCharacterImageUrl,
  getCharacterEvolutions,
  getCardSupportEffects,
};

import type {
  CardIndexEntry,
  CardSkills,
  CharacterIndexEntry,
  CharacterEvolutionDetail,
  SupportCardEffectsBlob,
  CourseRow,
  EventSkillMetadata,
  PvpRecommendationsPayload,
  RacetrackDetail,
  SkillDetail,
  SkillSummary,
} from "../data/types";

// ---------------------------------------------------------------------------
// Store Interface & Singleton
// ---------------------------------------------------------------------------

export interface DataStore {
  cards: CardIndexEntry[];
  characters: CharacterIndexEntry[];
  skills: SkillDetail[];
  pvpRecommendations: PvpRecommendationsPayload;
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
  getCharacterEvolutions(cardId: number): CharacterEvolutionDetail[];
  getCardSupportEffects(cardId: number): SupportCardEffectsBlob | undefined;
}

let storeInstance: DataStore | null = null;
let storePromise: Promise<DataStore> | null = null;

export async function initDataStore(): Promise<DataStore> {
  if (storeInstance) return storeInstance;
  if (storePromise) return storePromise;

  const pendingStore = (async () => {
    const racetracks = await loadRacetracks();

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
      pvpRecommendations,
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
      getCharacterEvolutions(cardId: number) {
        return getCharacterEvolutions(cardId);
      },
      getCardSupportEffects(cardId: number) {
        return getCardSupportEffects(cardId);
      },
    };

    storeInstance = store;
    return store;
  })();
  storePromise = pendingStore;

  try {
    return await pendingStore;
  } catch (error) {
    // Allow a later attempt if loading/normalizing a generated dataset failed.
    if (storePromise === pendingStore) storePromise = null;
    throw error;
  }
}

/** Synchronous accessor if data store is already initialized, otherwise returns null. */
export function getDataStore(): DataStore | null {
  return storeInstance;
}
