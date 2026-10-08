import type { CardIndexEntry } from "@/lib/api";
import type { Course } from "@/lib/skill-engine/types";

export interface LandingCharacter {
  id: number;
  nameEn: string;
  nameJp: string;
  portraitUrl: string;
}

export interface LandingDemoSkill {
  id: number;
  nameEn: string;
  nameJp: string;
  iconId?: number | null;
  conditionGroups: { condition: string | null; precondition?: string | null }[];
}

export interface LandingDemoData {
  course: Course;
  skills: LandingDemoSkill[];
}

export interface LandingData {
  cards: Pick<CardIndexEntry, "id" | "nameEn" | "nameJp" | "imgUrl" | "type">[];
  characters: LandingCharacter[];
  demo: LandingDemoData | null;
}
