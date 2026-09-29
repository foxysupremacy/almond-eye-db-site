import type { Course } from "../skill-engine/types";
import type { CourseRow } from "../data/types";

/** Promote course geometry onto the flat shape consumed by skill evaluation. */
export function flattenCourse(row: CourseRow): Course {
  const data = row.data ?? {};
  return {
    id: row.id,
    terrain: row.terrain,
    turn: row.turn,
    distance: row.distance,
    inout: row.inout,
    length: row.length,
    corners: row.corners ?? data.corners ?? [],
    straights: row.straights ?? data.straights ?? [],
    slopes: row.slopes ?? data.slopes ?? [],
    phases: row.phases ?? data.phases,
    spurtStart: row.spurtStart ?? data.spurtStart,
    positionKeepEnd: row.positionKeepEnd ?? data.positionKeepEnd,
    trackId: row.trackId,
  };
}

export function distanceLabel(distance: number, length: number): string {
  const tag = distance === 1 ? "Sprint" : distance === 2 ? "Mile" : distance === 3 ? "Middle" : "Long";
  return `${tag} ${length}m`;
}

export function terrainLabel(terrain: number): string {
  return terrain === 1 ? "Turf" : terrain === 2 ? "Dirt" : "?";
}

export function turnLabel(turn: number): string {
  return turn === 1 ? "Right" : turn === 2 ? "Left" : turn === 4 ? "Straight" : "?";
}
