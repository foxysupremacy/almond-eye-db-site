import type { Course } from "../skill-engine/types";
import { courseDistanceCategory } from "../skill-engine/distance-category";
import type { AptitudeGrade, RankedStyle, RankingCandidate } from "./types";

const ORDER: AptitudeGrade[] = ["S", "A", "B", "C", "D", "E", "F", "G"];
export function gradeAt(aptitude: string[], index: number): AptitudeGrade {
  const g = aptitude[index] as AptitudeGrade | undefined;
  return g && ORDER.includes(g) ? g : "G";
}
export const isAtLeastA = (g: AptitudeGrade) => g === "S" || g === "A";
export const groundIndex = (course: Course): 0 | 1 => (course.terrain === 1 ? 0 : 1);
export const distanceIndex = (course: Course): 2 | 3 | 4 | 5 => (courseDistanceCategory(course) + 1) as 2 | 3 | 4 | 5;
export const styleIndex = (style: RankedStyle): 6 | 7 | 8 | 9 => (style + 5) as 6 | 7 | 8 | 9;

export function rankedStylesFor(candidate: RankingCandidate): RankedStyle[] {
  const styles: RankedStyle[] = [1, 2, 3, 4];
  const grades = styles.map((s) => gradeAt(candidate.aptitude, styleIndex(s)));
  const strong = styles.filter((_, i) => isAtLeastA(grades[i]));
  if (strong.length) return strong;
  const best = Math.min(...grades.map((g) => ORDER.indexOf(g)));
  return styles.filter((_, i) => ORDER.indexOf(grades[i]) === best);
}
