import { g1Calendar } from "../data/registry";
import type { CalendarG1Race, G1CalendarData } from "../data/types";
import type { AptitudeProjection, FarmAptitude, FarmRank } from "./loop-planner";

export interface G1RaceAssessment {
  race: CalendarG1Race;
  year: number;
  turn: number;
  /** "excluded" = the race needs an aptitude toggled off in Farm focus. */
  status: "eligible" | "aptitude-blocked" | "unknown" | "career-blocked" | "excluded";
  requirements: { aptitude: FarmAptitude; required: FarmRank | null; actual: string; status: "met" | "unmet" | "unknown" | "excluded" }[];
  conditions: string[];
}
export interface G1CalendarAssessment {
  races: G1RaceAssessment[];
  eligibleCount: number;
  schedulableCount: number;
  scheduledSaddles: number[];
  unknown: boolean;
}
const RANKS = ["G", "F", "E", "D", "C", "B", "A", "S"];
const cache = new Map<string, G1CalendarAssessment>();

/** Assess ordinary-calendar opportunities, not a promise of fan counts or wins.
 * A goal omitted for an aptitude marks races that need it as excluded. */
export function evaluateG1Calendar(charId: number | undefined, projections: AptitudeProjection[], goals: Partial<Record<FarmAptitude, FarmRank>>, data: G1CalendarData = g1Calendar): G1CalendarAssessment {
  if (charId == null) return { races: [], eligibleCount: 0, schedulableCount: 0, scheduledSaddles: [], unknown: true };
  const cacheKey = data === g1Calendar ? `${charId}:${["Turf", "Dirt", "Sprint", "Mile", "Medium", "Long"].map((aptitude) => {
    const entry = projections.find((projection) => projection.aptitude === aptitude);
    return `${entry?.projected ?? "?"}/${entry?.confidence === "unknown" ? "?" : "k"}/${goals[aptitude as FarmAptitude]}`;
  }).join("|")}` : null;
  if (cacheKey && cache.has(cacheKey)) return cache.get(cacheKey)!;
  const objectives = data.objectivesByCharId[String(charId)] ?? [];
  const objectivePrograms = new Set(objectives.flatMap((entry) => entry.programIds));
  const programs = data.races.filter((race) => race.defaultProgram || objectivePrograms.has(race.programId));
  const seen = new Set<string>();
  const races = programs.flatMap((race): G1RaceAssessment[] => race.years.flatMap((year) => {
    const turn = (year - 1) * 24 + (race.month - 1) * 2 + race.half;
    const objective = objectives.find((entry) => entry.turn === turn);
    const replacement = objective && data.races.find((entry) => objective.programIds.includes(entry.programId) && entry.baseProgramId === race.programId);
    if (replacement) return [];
    const identity = `${race.saddleId ?? race.raceId}:${turn}`;
    if (seen.has(identity)) return [];
    seen.add(identity);
    const surface: FarmAptitude = race.terrain === 2 ? "Dirt" : "Turf";
    const distance: FarmAptitude = race.distance <= 1400 ? "Sprint" : race.distance <= 1800 ? "Mile" : race.distance <= 2400 ? "Medium" : "Long";
    const requirements = [surface, distance].map((aptitude) => {
      const projection = projections.find((entry) => entry.aptitude === aptitude);
      const actual = projection?.projected ?? "?";
      const knownBase = RANKS.includes(actual);
      const required = goals[aptitude] ?? null;
      if (required == null) return { aptitude, required, actual, status: "excluded" as const };
      const met = knownBase && RANKS.indexOf(actual) >= RANKS.indexOf(required);
      return { aptitude, required, actual, status: met ? "met" as const : !knownBase || projection?.confidence === "unknown" ? "unknown" as const : "unmet" as const };
    });
    const careerBlocked = Boolean(objective && !objective.programIds.includes(race.programId));
    const conditions = [
      ...(race.needFans > 0 ? [`Fans ≥ ${race.needFans.toLocaleString("en-US")} · not confirmed`] : []),
      ...(careerBlocked ? ["Career objective occupies this turn"] : objective ? ["Career objective"] : []),
      ...(race.fillyOnly ? ["Tiara race"] : []),
    ];
    const status = requirements.some((entry) => entry.status === "excluded") ? "excluded"
      : careerBlocked ? "career-blocked"
      : requirements.some((entry) => entry.status === "unmet") ? "aptitude-blocked"
      : requirements.some((entry) => entry.status === "unknown") ? "unknown" : "eligible";
    return [{ race, year, turn, status, requirements, conditions }];
  })).sort((a, b) => a.turn - b.turn || a.race.programId - b.race.programId);
  // Maximum bipartite matching: one trophy per unique G1, one race per turn.
  // Repeated Classic/Senior occurrences can resolve a calendar conflict but
  // cannot inflate the number of distinct G1 wins used in an affinity plan.
  const opportunities = new Map<number, number[]>();
  for (const entry of races) if (entry.status === "eligible") {
    const key = entry.race.saddleId ?? entry.race.raceId;
    opportunities.set(key, [...new Set([...(opportunities.get(key) ?? []), entry.turn])]);
  }
  const assigned = new Map<number, number>();
  function assign(trophy: number, visited: Set<number>): boolean {
    for (const turn of opportunities.get(trophy) ?? []) {
      if (visited.has(turn)) continue;
      visited.add(turn);
      const prior = assigned.get(turn);
      if (prior == null || assign(prior, visited)) { assigned.set(turn, trophy); return true; }
    }
    return false;
  }
  for (const trophy of opportunities.keys()) assign(trophy, new Set());
  const assessment = { races, eligibleCount: opportunities.size, schedulableCount: assigned.size, scheduledSaddles: [...assigned.values()], unknown: races.some((entry) => entry.status === "unknown") };
  if (cacheKey) {
    if (cache.size >= 1024) cache.clear();
    cache.set(cacheKey, assessment);
  }
  return assessment;
}
