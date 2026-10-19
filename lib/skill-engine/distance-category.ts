// The game's distance category (distance_type) from course length in metres.
// Sprint <= 1400, Mile <= 1800, Medium <= 2400, Long above. master.mdb stores only
// metres; this rule matches uma-skill-tools course_data.json and in-game race
// labels (e.g. Tokyo 1400 m is Sprint). Pure: shared by the data generator
// (racetracks.json `distance`), the skill engine, rankings and parenting so there
// is one source of truth.

export type DistanceCategory = 1 | 2 | 3 | 4;

export function distanceCategoryForLength(length: number): DistanceCategory {
  return length <= 1400 ? 1 : length <= 1800 ? 2 : length <= 2400 ? 3 : 4;
}

/**
 * A course's category: its stored `distance` bucket when valid (racetracks.json derives it with
 * {@link distanceCategoryForLength}; lib/data/racetracks.distance.test.ts enforces that), else the length rule.
 */
export function courseDistanceCategory(course: { length?: number | null; distance?: number | null }): DistanceCategory {
  const d = course.distance ?? 0;
  if (d >= 1 && d <= 4) return d as DistanceCategory;
  return distanceCategoryForLength(course.length || 0);
}
