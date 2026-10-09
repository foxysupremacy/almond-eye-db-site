import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SkillRatingSummary } from "./skill-rating-summary";
import { ConditionChips } from "./condition-chips";
import type { SkillRating } from "@/lib/skill-rating/types";
import { createApplicationRatingSession } from "@/lib/skill-rating/application";
import { loadRacetracks, skillsById } from "@/lib/data/registry";
import { flattenCourse } from "@/lib/api/course-format";
import { defaultRaceImpactProfile } from "@/lib/race-impact/profile";
import { conditionBranches } from "@/lib/skill-engine/describe";

function rating(overrides: Partial<SkillRating> = {}): SkillRating {
  return {
    originalSkillId: 1, evaluatedSkillId: 1, variant: "original", contextFingerprint: "test", modelVersion: "test",
    eligibility: { state: "eligible", reasons: [] }, scenarios: [], assumptions: [], warnings: [], partialReasons: [],
    score: 234.5, tier: "S", stars: 5, status: "provisional", contributions: [], selectedScenarioId: null, selectedPaths: [],
    simulatedBenefit: 2, timeGainSeconds: 0.25, benchmarkVersion: "test", breakdown: [], provenance: [], ...overrides,
  };
}

test("conditional score stays unbounded and is explicitly independent of activation probability", () => {
  const html = renderToStaticMarkup(<SkillRatingSummary rating={rating()} />);
  expect(html).toContain("234.5 pts");
  expect(html).toContain("Activation probability is excluded");
  expect(html).toContain('alt="S"');
  expect(html).toContain("Provisional model");
});

test("a partial value never renders full-skill stars or tier even if legacy fields contain them", () => {
  const html = renderToStaticMarkup(<SkillRatingSummary rating={rating({ status: "partial", partialReasons: ["Opponent effects are not modeled"] })} />);
  expect(html).toContain("modeled part");
  expect(html).toContain("234.5 pts");
  expect(html).toContain("Opponent effects are not modeled");
  expect(html).not.toContain('alt="S"');
  expect(html).not.toContain("out of 5 stars");
});

test("unavailable values do not turn the numeric compatibility fallback into a zero-point claim", () => {
  const html = renderToStaticMarkup(<SkillRatingSummary rating={rating({ status: "unavailable", score: 0 })} />);
  expect(html).toContain("Unavailable");
  expect(html).not.toContain("0 pts");
  expect(html).not.toContain("conditional time gain");
});

test("unknown style identifies the best case and shows separate style results", () => {
  const html = renderToStaticMarkup(<SkillRatingSummary rating={rating({ bestStyle: 3, styleRatings: [
    { style: 1, score: 0, eligibility: "ineligible", status: "complete", tier: "F", stars: 1 },
    { style: 3, score: 234.5, eligibility: "eligible", status: "provisional", tier: "S", stars: 5 },
  ] })} />);
  expect(html).toContain("best case for Betweener");
  expect(html).toContain("Runner:");
  expect(html).toContain("Betweener:");
});

test("only exact assumed clauses in the matching condition source are highlighted", () => {
  const html = renderToStaticMarkup(<ConditionChips
    branches={[["Position 1", "Final leg"]]} needsBranches={[["Position 1"]]}
    condition="order==1&phase==2" precondition="order==1"
    assumptions={[{ clause: "order==1", source: "condition", triggerIndex: 0, kind: "rank", description: "Assume first place" }]}
  />);
  expect(html).toContain("Assumed: order==1. Assume first place");
  expect(html.match(/uppercase">assumed/g)).toHaveLength(1);
  expect(html).not.toContain("Assumed: phase==2");
});

test("modeled last-spurt clause renders without assumed while rank remains highlighted", async () => {
  const course = flattenCourse((await loadRacetracks()).find(track => track.id === 10008)!.courses.find(course => course.id === 10810)!);
  const skill = skillsById.get(203561)!;
  const condition = `${skill.conditionGroups![0].condition}&order<=6`;
  const result = createApplicationRatingSession({ course, style: 3, racerCount: 9, profile: defaultRaceImpactProfile() })
    .evaluate({ skill: { ...skill, conditionGroups: skill.conditionGroups!.map(group => ({ ...group, condition })) } });
  const html = renderToStaticMarkup(<ConditionChips
    branches={conditionBranches(condition, 9).branches} condition={condition} assumptions={result.assumptions} racerCount={9}
  />);
  expect(result.score).toBeGreaterThan(0);
  expect(html).toContain("during the last spurt");
  expect(html).not.toContain("Assumed: is_lastspurt");
  expect(html).toContain("Assumed: order&lt;=6");
  expect(html.match(/uppercase">assumed/g)).toHaveLength(1);
});

test("zero results distinguish no activation from no modeled benefit", () => {
  const missingFire = renderToStaticMarkup(<SkillRatingSummary rating={rating({ score: 0, simulatedBenefit: 0, activationOutcome: "not-activated" })} />);
  expect(missingFire).toContain("No activation in the modeled timeline");
  expect(missingFire).not.toContain("no net benefit");
  const noBenefit = renderToStaticMarkup(<SkillRatingSummary rating={rating({ score: 0, simulatedBenefit: 0, activationOutcome: "activated" })} />);
  expect(noBenefit).toContain("Activated in the model; no net benefit");
  expect(noBenefit).not.toContain("No activation in the modeled timeline");
});

test("reserve value with zero physical gain is explained without a no-benefit verdict", () => {
  const recovery = {
    policyVersion: "recovery-policy-v1", distanceGate: 1, nominalHP: 60, receivedHP: 0, wastedHP: 60,
    weightedNominalHP: 30, simulationWeight: .5, nominalHPBenchmark: 60, rawSelfHealSimulationPoints: 0,
    signedCostAndOpponentPoints: 0, simulationPoints: 0, policyPoints: 50,
    activations: [{ triggerIndex: 0, time: 0, meter: 0, phase: 0, nominalHP: 60, receivedHP: 0, wastedHP: 60, weight: .5 }],
  };
  const html = renderToStaticMarkup(<SkillRatingSummary rating={rating({score:50,timeGainSeconds:0,simulatedBenefit:0,activationOutcome:"activated",recovery,policyVersion:recovery.policyVersion})} />);
  expect(html).toContain("Simulation points:");
  expect(html).toContain("Recovery reserve points:");
  expect(html).toContain("Early-race healing keeps 50%");
  expect(html).toContain("Wasted: 60");
  expect(html).toContain("no net simulated time benefit");
  expect(html).not.toContain("no net benefit for this profile");
  expect(html).toContain("recovery-policy-v1");
  const short = renderToStaticMarkup(<SkillRatingSummary rating={rating({recovery:{...recovery,distanceGate:0,policyPoints:0}})} />);
  expect(short).toContain("2000m or shorter");
  expect(short).toContain("HP recovery still applies");
});
