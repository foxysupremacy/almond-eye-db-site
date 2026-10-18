import { charactersByCharId, charactersById } from "@/lib/data/registry";
import { getCharaIdFromCardId } from "@/lib/lineage/affinity-engine";
import { createApplicationRatingSession } from "@/lib/skill-rating/application";
import type { RaceImpactProfile } from "@/lib/race-impact/types";
import type { Course, RaceParameters } from "@/lib/skill-engine/types";
import { getParentInheritedUnique, hasMinimumParentSkillEffect } from "@/lib/parenting/unique-effect-filter";
import { evaluateUniqueSkill, runningStyleToNum } from "@/lib/parenting/skill-evaluator";
import type { LegacyUniqueEval } from "@/lib/parenting/types";

interface EvaluationRequest {
  cardIds: number[];
  course: Course | null;
  runningStyle: number | string | null;
  raceParams: Partial<RaceParameters>;
  racerCount: number;
  raceImpactProfile: RaceImpactProfile;
}

interface EvaluationResponse {
  eligibleCardIds: number[];
  uniqueEvals: Array<[number, LegacyUniqueEval]>;
  error?: string;
}

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<EvaluationRequest>) => void) | null;
  postMessage(value: EvaluationResponse): void;
};

workerScope.onmessage = ({ data }) => {
  try {
    const eligibleCardIds: number[] = [];
    const uniqueEvals: Array<[number, LegacyUniqueEval]> = [];
    const style = runningStyleToNum(data.runningStyle);
    const session = data.course
      ? createApplicationRatingSession({
        course: data.course,
        style: style ?? null,
        racerCount: data.racerCount,
        raceParameters: data.raceParams,
        profile: data.raceImpactProfile,
      })
      : undefined;
    const eligibilityBySkill = new Map<number, boolean>();
    const evaluationBySkill = new Map<number, LegacyUniqueEval>();

    for (const cardId of data.cardIds) {
      const character = charactersById.get(cardId) ?? charactersByCharId.get(getCharaIdFromCardId(cardId));
      const skill = getParentInheritedUnique(character?.uniqueSkillId);
      if (!skill) continue;

      let eligible = eligibilityBySkill.get(skill.id);
      if (eligible === undefined) {
        eligible = hasMinimumParentSkillEffect(skill, data.course, data.runningStyle, {
          raceParams: { ...data.raceParams, numUmas: data.racerCount },
          raceImpactProfile: data.raceImpactProfile,
          session,
        });
        eligibilityBySkill.set(skill.id, eligible);
      }
      if (eligible) eligibleCardIds.push(cardId);

      if (!data.course) continue;
      let evaluation = evaluationBySkill.get(skill.id);
      if (!evaluation) {
        evaluation = evaluateUniqueSkill(skill.id, data.course, data.runningStyle, {
          raceImpactProfile: data.raceImpactProfile,
          raceParams: data.raceParams,
          racerCount: data.racerCount,
          session,
        });
        evaluationBySkill.set(skill.id, evaluation);
      }
      uniqueEvals.push([cardId, evaluation]);
    }
    workerScope.postMessage({ eligibleCardIds, uniqueEvals });
  } catch (error) {
    workerScope.postMessage({
      eligibleCardIds: [],
      uniqueEvals: [],
      error: error instanceof Error ? error.message : "Could not evaluate picker candidates",
    });
  }
};
