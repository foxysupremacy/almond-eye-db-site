import { charactersByCharId, charactersById } from "@/lib/data/registry";
import { getCharaIdFromCardId } from "@/lib/lineage/affinity-engine";
import type { Course } from "@/lib/skill-engine/types";
import { getParentInheritedUnique, hasMinimumParentSkillEffect } from "@/lib/parenting/unique-effect-filter";
import { evaluateUniqueSkill } from "@/lib/parenting/skill-evaluator";
import type { LegacyUniqueEval } from "@/lib/parenting/types";

interface EvaluationRequest {
  requestId?: number;
  cardIds: number[];
  course: Course | null;
  runningStyle: number | string | null;
}

interface EvaluationResponse {
  requestId?: number;
  eligibleCardIds: number[];
  uniqueEvals: Array<[number, LegacyUniqueEval]>;
  error?: string;
}

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<EvaluationRequest>) => void) | null;
  postMessage(value: EvaluationResponse): void;
};

workerScope.onmessage = ({ data }) => {
  const { requestId, ...params } = data;
  try {
    const eligibleCardIds: number[] = [];
    const uniqueEvals: Array<[number, LegacyUniqueEval]> = [];
    const eligibilityBySkill = new Map<number, boolean>();
    const evaluationBySkill = new Map<number, LegacyUniqueEval>();

    for (const cardId of params.cardIds) {
      const character = charactersById.get(cardId) ?? charactersByCharId.get(getCharaIdFromCardId(cardId));
      const skill = getParentInheritedUnique(character?.uniqueSkillId);
      if (!skill) continue;

      let eligible = eligibilityBySkill.get(skill.id);
      if (eligible === undefined) {
        eligible = hasMinimumParentSkillEffect(skill, params.course, params.runningStyle);
        eligibilityBySkill.set(skill.id, eligible);
      }
      if (eligible) eligibleCardIds.push(cardId);

      if (!params.course) continue;
      let evaluation = evaluationBySkill.get(skill.id);
      if (!evaluation) {
        evaluation = evaluateUniqueSkill(skill.id, params.course, params.runningStyle);
        evaluationBySkill.set(skill.id, evaluation);
      }
      uniqueEvals.push([cardId, evaluation]);
    }
    workerScope.postMessage({ requestId, eligibleCardIds, uniqueEvals });
  } catch (error) {
    workerScope.postMessage({
      requestId,
      eligibleCardIds: [],
      uniqueEvals: [],
      error: error instanceof Error ? error.message : "Could not evaluate picker candidates",
    });
  }
};
