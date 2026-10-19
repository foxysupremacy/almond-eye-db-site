import type { SkillDetailInput } from "../evaluator/types";
import type { RaceImpactProfile, SkillScore } from "../race-impact/types";
import type { Course, RaceParameters } from "../skill-engine/types";

export type RankedStyle = 1 | 2 | 3 | 4;
export type AptitudeGrade = "S" | "A" | "B" | "C" | "D" | "E" | "F" | "G";
export interface EvolutionOption { skillId: number; baseSkillId: number; branchTag?: string }
export interface RankingCandidate {
  costumeId: number; charId: number;
  nameEn: string; nameJp: string; titleEn: string; titleJp: string; imgUrl: string; release: string | null;
  aptitude: string[]; // [turf, dirt, short, mile, medium, long, runner, leader, betweener, chaser]
  uniqueSkillId: number;
  slot1: EvolutionOption[]; // character-evolutions rank 3
  slot2: EvolutionOption[]; // character-evolutions rank 5
  slot3: EvolutionOption[]; // character-evolutions rank 7 (few costumes; usually empty)
}
/** The skill fields the ranking worker reads; R32 ignores the data's wisdom-check `activation` flag. */
export type RankingSkillInput = SkillDetailInput;
export interface RankingRequest {
  key: string; course: Course; raceParams: Partial<RaceParameters>; racerCount: number;
  profile: RaceImpactProfile;
  candidates: RankingCandidate[]; skills: Record<number, RankingSkillInput>;
}
/** Rankings score metric: "average" = expected Bashin over the activation zone; "best" = the best activation point (maxBashin). */
export type RankingMetric = "average" | "best";
export interface SlotScore {
  /** Picked by expected (average) Bashin. */
  chosen: SkillScore | null;
  /** Picked by maxBashin (Best case); the same object as one of `options`. */
  chosenMax: SkillScore | null;
  options: (SkillScore & { weakerThanBase: boolean })[];
}
export interface RankingRow {
  costumeId: number; style: RankedStyle;
  /** Sum of each slot's expected (average) Bashin. */
  total: number;
  /** Sum of each slot's maxBashin, every slot chosen by its max (Best case). */
  totalMax: number;
  unique: SkillScore; slot1: SlotScore; slot2: SlotScore; slot3: SlotScore;
  recoveryHpPercent: number | null;
  groundGrade: AptitudeGrade; distanceGrade: AptitudeGrade; styleGrade: AptitudeGrade;
}
export interface RankingResult { key: string; rows: RankingRow[]; computedMs: number; errors: { skillId: number; message: string }[] }
export type ProgressFn = (done: number, total: number) => void;
export type RankingsWorkerMessage =
  | { type: "progress"; key: string; done: number; total: number }
  | { type: "result"; result: RankingResult }
  | { type: "error"; key: string; message: string };
