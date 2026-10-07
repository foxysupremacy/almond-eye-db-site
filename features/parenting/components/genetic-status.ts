import { aceGeneticTarget, type ParentingMinmaxContext, type SlotGeneticAssessment } from "@/lib/parenting/minmax";

export const GENETIC_TONE_CLASS = { warning: "text-amber-800 dark:text-amber-300", good: "text-emerald-700 dark:text-emerald-400", muted: "text-zinc-500 dark:text-zinc-400" } as const;

export function geneticStatus(assessment: SlotGeneticAssessment, context: ParentingMinmaxContext) {
  const guaranteed = assessment.forecasts.filter((entry) => entry.risk === "guaranteed").length;
  const frequent = assessment.forecasts.filter((entry) => entry.risk === "frequent").length;
  const unknown = assessment.forecasts.some((entry) => entry.risk === "unknown");
  const warning = assessment.actual.length > 0 || guaranteed + frequent > 0 || assessment.mismatchedTargets.length > 0;
  const active = assessment.forecasts.length > 0;
  const completeTarget = Object.values(aceGeneticTarget(context.course, context.runningStyle)).every(Boolean);
  const goodPlanning = completeTarget && active && !warning && !unknown && (!assessment.useActual || assessment.actualKnown);
  const text = assessment.actual.length ? `${assessment.actual.length} unwanted genetics present`
    : guaranteed ? `${guaranteed} guaranteed ${assessment.useActual ? "retrain" : "genetic"} risks`
    : frequent ? `${frequent} frequent ${assessment.useActual ? "retrain" : "genetic"} risks`
    : assessment.mismatchedTargets.length ? "Off-target genetic selected"
    : !active ? "Select course / style"
    : assessment.useActual && !assessment.actualKnown ? "Imported genetics unknown"
    : unknown ? assessment.useActual && assessment.actualKnown ? "No off-target genetics · retrain data incomplete" : "Genetic data incomplete"
    : goodPlanning ? "Good genetic planning" : "Select course / style";
  const alert = warning || unknown || !active || (assessment.useActual && !assessment.actualKnown);
  return { text, tone: warning ? "warning" as const : goodPlanning ? "good" as const : "muted" as const, alert };
}
