import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { charactersById } from "@/lib/data/registry";
import { buildLoopCandidates, evaluateParentingBranch } from "@/lib/parenting/loop-planner";
import { AncestorTile } from "./ancestor-tile";

const assessment = evaluateParentingBranch("p1", {}, { geneGoals: {}, aptitudeGoals: {}, selectedSlots: {}, lockedSlots: {}, includeTripleCrownAffinity: false, includeTiaraAffinity: false });

test("empty parent tile is one labelled button with only the known race grades", () => {
  const html = renderToStaticMarkup(<AncestorTile slot="p1" candidate={null} assessment={assessment} factorPlan={{}} aptitudeKeys={["Turf", "Long"]} whiteTargetCount={0} genetic={{ text: "Select course / style", tone: "muted", alert: true }} onOpen={() => {}} />);
  expect(html).toContain('aria-label="Edit Parent 1"');
  expect(html.match(/>Add</g)).toHaveLength(1);
  expect(html.match(/data-tile-grade=/g)).toHaveLength(2);
  const id = html.match(/aria-describedby="([^"]+)"/)![1];
  const summary = html.match(new RegExp(`<span id="${id.replace(/:/g, "\:")}"[^>]*class="sr-only"[^>]*>([^<]*)</span>`))![1];
  expect(summary).toContain("Select course / style");
  expect(summary).toContain("Turf ?");
  expect(summary).toContain("Empty");
  expect(html).toContain("min-h-10");
});

test("no known course categories render no grade strip at all", () => {
  const html = renderToStaticMarkup(<AncestorTile slot="p2_gp1" candidate={null} assessment={assessment} factorPlan={{}} aptitudeKeys={[]} whiteTargetCount={0} onOpen={() => {}} />);
  expect(html).not.toContain("data-tile-grade");
  expect(html).toContain('aria-label="Edit GP · Parent 2 · left"');
});

test("selected tile keeps the §20 portrait layers", () => {
  const candidate = buildLoopCandidates([], [charactersById.get(106802)!])[0];
  const html = renderToStaticMarkup(<AncestorTile slot="p1" candidate={candidate} assessment={assessment} factorPlan={{ pink: "Turf", pinkStars: 3 }} aptitudeKeys={["Turf"]} whiteTargetCount={1} onOpen={() => {}} />);
  expect(html).toContain('data-portrait-layer="back"');
  expect(html).toContain('data-portrait-layer="frame"');
  expect(html).toContain("polygon(0 -100%, 100% -100%, 100% 0, 50% 50%, 0 0)");
});

test("great-grandparent tile shows deepest-row dots instead of grades", () => {
  const html = renderToStaticMarkup(<AncestorTile slot="p1_gp1_g1" candidate={null} assessment={assessment} factorPlan={{ pink: "Turf", pinkStars: 2 }} aptitudeKeys={["Turf"]} whiteTargetCount={0} childSparks={[{ pink: "Long", pinkStars: 1 }, {}]} onOpen={() => {}} />);
  expect(html).not.toContain("data-tile-grade");
  expect(html.match(/data-child-spark="set"/g)).toHaveLength(1);
  expect(html.match(/data-child-spark="unset"/g)).toHaveLength(1);
});

test("tile accessible name includes the chosen name; names wrap instead of truncating", () => {
  const candidate = buildLoopCandidates([], [charactersById.get(106802)!])[0];
  const html = renderToStaticMarkup(<AncestorTile slot="p1" candidate={candidate} assessment={assessment} factorPlan={{}} aptitudeKeys={[]} whiteTargetCount={0} onOpen={() => {}} />);
  expect(html).toContain(`aria-label="Edit Parent 1: ${candidate.name}"`);
  expect(html).toContain("line-clamp-2 break-words");
  const ggp = renderToStaticMarkup(<AncestorTile slot="p1_gp1_g1" candidate={candidate} assessment={assessment} factorPlan={{}} aptitudeKeys={[]} whiteTargetCount={0} onOpen={() => {}} />);
  expect(ggp).toContain(candidate.name);
  expect(ggp).toContain(`: ${candidate.name}"`);
});

test("tablet tile groups the grade strip 2 + 4 + 4 and enlarges portraits", () => {
  const keys = ["Turf", "Dirt", "Sprint", "Mile", "Medium", "Long", "Runner", "Leader", "Betweener", "Chaser"] as never;
  const html = renderToStaticMarkup(<AncestorTile tier="tablet" slot="p1" candidate={null} assessment={assessment} factorPlan={{}} aptitudeKeys={keys} whiteTargetCount={0} onOpen={() => {}} />);
  expect(html.match(/data-tile-grade-group=/g)).toHaveLength(3);
  expect(html).toContain("h-16 w-16");
  expect(html.match(/data-tile-grade=/g)).toHaveLength(10);
});
