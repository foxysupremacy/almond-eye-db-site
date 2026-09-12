// In-Memory Data Client for AlmondEye DB.
//
// Powered entirely by pre-processed static datasets in lib/data-store.ts.
// No remote API requests are made; all operations are fulfilled from memory.

import {
  initDataStore,
  getDataStore,
  getCardImageUrl,
  getCharacterImageUrl,
  flattenCourse,
  distanceLabel,
  terrainLabel,
  turnLabel,
  type CardIndexEntry,
  type CharacterIndexEntry,
  type SkillSummary,
  type CardSkills,
  type SkillConditionGroup,
  type SkillDetail,
  type Racetrack,
  type RacetrackDetail,
  type CourseRow,
  type CourseDataBlob,
} from "./data-store";

class ApiCallError extends Error {
  status: number;
  constructor(message: string, status: number = 404) {
    super(message);
    this.status = status;
  }
}

export const api = {
  async health(): Promise<{ ok: true }> {
    return { ok: true };
  },

  async listCardIndex(): Promise<CardIndexEntry[]> {
    const store = await initDataStore();
    return store.cards;
  },

  async listCharacters(): Promise<CharacterIndexEntry[]> {
    const store = await initDataStore();
    return store.characters;
  },

  async cardSkills(cardId: number): Promise<CardSkills> {
    const store = await initDataStore();
    return store.getCardSkills(cardId);
  },

  async listSkills(): Promise<SkillDetail[]> {
    const store = await initDataStore();
    return store.skills;
  },

  async skill(id: number): Promise<SkillDetail> {
    const store = await initDataStore();
    const s = store.getSkill(id);
    if (!s) throw new ApiCallError(`Skill ${id} not found in database`, 404);
    return s;
  },

  async listRacetracks(): Promise<Racetrack[]> {
    const store = await initDataStore();
    return store.racetracks.map((t) => ({
      id: t.id,
      nameJa: t.nameJa,
      nameEn: t.nameEn,
      courseCount: t.courseCount,
    }));
  },

  async racetrack(id: number): Promise<RacetrackDetail> {
    const store = await initDataStore();
    const t = store.getTrack(id);
    if (!t) throw new ApiCallError(`Racetrack ${id} not found in database`, 404);
    return t;
  },
};

export {
  initDataStore,
  getDataStore,
  getCardImageUrl,
  getCharacterImageUrl,
  flattenCourse,
  distanceLabel,
  terrainLabel,
  turnLabel,
  ApiCallError,
};

export type {
  CardIndexEntry,
  CharacterIndexEntry,
  SkillSummary,
  CardSkills,
  SkillConditionGroup,
  SkillDetail,
  Racetrack,
  RacetrackDetail,
  CourseRow,
  CourseDataBlob,
};
