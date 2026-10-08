import { api, flattenCourse } from "@/lib/api";
import type { LandingData, LandingDemoData } from "./types";

const SAMPLE_CARD_IDS = [30242, 30028, 30016, 30010, 30024, 30029] as const;
const SAMPLE_CHARACTER_IDS = [112901, 106801, 100101, 101301, 100301, 101701, 100401] as const;
const SAMPLE_SKILL_IDS = [200332, 200362, 210292] as const;

async function loadDemo(): Promise<LandingDemoData> {
  const [track, skills] = await Promise.all([
    api.racetrack(10006),
    Promise.all(SAMPLE_SKILL_IDS.map((id) => api.skill(id))),
  ]);
  const course = track.courses.find((entry) => entry.id === 10604);
  if (!course || skills.some((skill) => !skill.conditionGroups.length)) {
    throw new Error("The landing demo's course or skill conditions are unavailable.");
  }
  return {
    course: flattenCourse(course),
    skills: skills.map(({ id, nameEn, nameJp, iconId, conditionGroups }) => ({
      id, nameEn, nameJp, iconId,
      conditionGroups: conditionGroups.map(({ condition, precondition }) => ({ condition, precondition })),
    })),
  };
}

/** Server-rendered curation; only the small demo projection reaches the client. */
export async function loadLandingData(): Promise<LandingData> {
  const [cardsResult, charactersResult, demoResult] = await Promise.allSettled([
    api.listCardIndex(),
    api.listCharacters(),
    loadDemo(),
  ]);
  const cards = cardsResult.status === "fulfilled" ? cardsResult.value : [];
  const characters = charactersResult.status === "fulfilled" ? charactersResult.value : [];
  return {
    cards: SAMPLE_CARD_IDS.flatMap((id) => {
      const card = cards.find((entry) => entry.id === id);
      return card ? [{ id: card.id, nameEn: card.nameEn, nameJp: card.nameJp, imgUrl: card.imgUrl, type: card.type }] : [];
    }),
    characters: SAMPLE_CHARACTER_IDS.flatMap((id) => {
      const character = characters.find((entry) => entry.id === id);
      return character ? [{
        id: character.id,
        nameEn: character.nameEn,
        nameJp: character.nameJp,
        portraitUrl: character.imgUrl,
      }] : [];
    }),
    demo: demoResult.status === "fulfilled" ? demoResult.value : null,
  };
}
