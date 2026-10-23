import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AptitudeTable, WhiteGeneticPicker, isProjectionBoosted, nextPinkStars, projectionDisplayGrade } from "./aptitude-controls";
import { PinkSparkPicker } from "./pink-spark-fields";
import { evaluateParentingBranch } from "@/lib/parenting/loop-planner";
import { charactersById } from "@/lib/data/registry";
const config = { geneGoals: {}, aptitudeGoals: {}, selectedSlots: {}, lockedSlots: {}, includeTripleCrownAffinity: false, includeTiaraAffinity: false };
test("pink star choice preserves 1–3 and defaults new choices to three", () => {
  expect([undefined, 0, 1, 2, 3, 4].map(nextPinkStars)).toEqual([3, 3, 1, 2, 3, 3]);
});
test("aptitude base stays visible while incomplete projection is unknown", () => {
  const assessment = evaluateParentingBranch("target", {}, config, charactersById.get(106802)!);
  const markup = renderToStaticMarkup(<AptitudeTable label="Target" assessment={assessment} sources={[]} onTargetChange={() => {}} />);
  for (const projection of assessment.projections) expect(markup).toContain(`base ${projection.base}, projected ?`);
  expect(markup).not.toContain("<select");
  expect(markup.match(/data-aptitude-group=/g)?.length).toBe(3);
});

test("compact aptitude cells are narrower and remain centered in their grid tracks", () => {
  const assessment = evaluateParentingBranch("target", {}, config, charactersById.get(106802)!);
  const { AptitudeCell } = require("./aptitude-controls");
  const markup = renderToStaticMarkup(<AptitudeCell
    aptitude="Turf"
    assessment={assessment}
    label="P1"
    sources={[]}
    compactCell
  />);
  expect(markup).toContain("max-w-[4rem] justify-self-center");
  expect(markup).toContain("min-h-8");
});
test("aptitude cells use full labels and responsive running-style and distance abbreviations", () => {
  const assessment = evaluateParentingBranch("target", {}, config, charactersById.get(106802)!);
  const { AptitudeCell } = require("./aptitude-controls");
  const render = (aptitude: "Sprint" | "Mile" | "Medium" | "Long" | "Runner" | "Leader" | "Betweener" | "Chaser") => renderToStaticMarkup(<AptitudeCell
    aptitude={aptitude}
    assessment={assessment}
    label="P1"
    sources={[]}
    compactCell
  />);
  for (const [aptitude, compact] of [
    ["Sprint", "SPR"], ["Mile", "MILE"], ["Medium", "MED"], ["Long", "LONG"],
    ["Runner", "RUN"], ["Leader", "LEAD"], ["Betweener", "BTWN"], ["Chaser", "CHASE"]
  ] as const) {
    const markup = render(aptitude);
    expect(markup).toContain(`>${aptitude}</span>`);
    expect(markup).toContain(`>${compact}</span>`);
    expect(markup).toContain("parenting-aptitude-label-has-compact");
    expect(markup).toContain(`aria-label="P1 ${aptitude}: base`);
  }
});
test("pink factor trigger stacks the full aptitude label above its star count", () => {
  const markup = renderToStaticMarkup(<PinkSparkPicker label="P1 GP1 GGP1 GGGP1" value="Medium" stars={3} onChange={() => {}} />);
  expect(markup).toContain("flex-col");
  expect(markup).toContain(">Medium</span>");
  expect(markup.match(/text-pink-600 dark:text-pink-400/g)?.length).toBe(3);
  expect(markup).toContain('aria-label="P1 GP1 GGP1 GGGP1 Red factor: Medium, 3 stars"');
});
test("unset pink factor shows Set with three muted stars", () => {
  const markup = renderToStaticMarkup(<PinkSparkPicker label="P1 GP1 GGP1 GGGP1" onChange={() => {}} />);
  expect(markup).toContain(">Set</span>");
  expect(markup.match(/text-zinc-400\/60 dark:text-zinc-600/g)?.length).toBe(3);
  expect(markup).toContain('aria-label="P1 GP1 GGP1 GGGP1 Red factor: Not set"');
});
test("white genetic selections list each target on the trigger; compact shrinks the row", () => {
  const assessment = evaluateParentingBranch("p1", {}, { ...config, factorGoals: { p1_gp1: { pink: "Medium", pinkStars: 3 }, p1_gp2: { pink: "Medium", pinkStars: 3 } } });
  const markup = renderToStaticMarkup(<WhiteGeneticPicker label="P1" assessment={assessment} targets={["Medium"]} onChange={() => {}} />);
  expect(markup).toContain("Target: Med");
  expect(markup).not.toContain("Medium · 6★ · 6★");
  expect(markup).toContain("h-10 min-h-10");
  expect(markup).toContain("dark:bg-violet-950/30");
  expect(markup).toContain('aria-label="P1 Target genetic"');
  const compact = renderToStaticMarkup(<WhiteGeneticPicker label="P1" assessment={assessment} targets={["Medium"]} onChange={() => {}} compact />);
  expect(compact).toContain("h-8 min-h-8");
  expect(compact).toContain("Target: Med");
  const chip = renderToStaticMarkup(<WhiteGeneticPicker label="P1" assessment={assessment} targets={["Medium"]} onChange={() => {}} chipOnly />);
  expect(chip).toContain("min-h-6");
  expect(chip).toContain(">Med</span>");
  expect(chip).toContain(">○</span>");
});

test("projection display grade and boost branches", () => {
  const p = (base: string, projected: string, availablePinkStars = 0) => ({ aptitude: "Turf" as const, base, projected, availablePinkStars, confidence: "projected" as const, needsOutputA: false });
  expect([isProjectionBoosted(p("?", "?")), projectionDisplayGrade(p("?", "?"))]).toEqual([false, "?"]);
  expect([isProjectionBoosted(p("B", "A")), projectionDisplayGrade(p("B", "A"))]).toEqual([true, "A"]);
  expect([isProjectionBoosted(p("B", "-", 1)), projectionDisplayGrade(p("B", "-", 1))]).toEqual([true, "B"]);
  expect([isProjectionBoosted(p("B", "?")), projectionDisplayGrade(p("B", "?"))]).toEqual([false, "B"]);
  expect([isProjectionBoosted(p("B", "B")), projectionDisplayGrade(p("B", "B"))]).toEqual([false, "B"]);
  expect(projectionDisplayGrade(p("?", "A", 1))).toBe("A");
});
