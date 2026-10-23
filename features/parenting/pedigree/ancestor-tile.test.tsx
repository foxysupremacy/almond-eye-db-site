import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { charactersById } from "@/lib/data/registry";
import { buildLoopCandidates, evaluateParentingBranch } from "@/lib/parenting/loop-planner";
import { AncestorTile } from "./ancestor-tile";

const assessment = evaluateParentingBranch("p1", {}, { geneGoals: {}, aptitudeGoals: {}, selectedSlots: {}, lockedSlots: {}, includeTripleCrownAffinity: false, includeTiaraAffinity: false });

test("empty parent tile is one labelled button with only the known race grades", () => {
  const html = renderToStaticMarkup(<AncestorTile slot="p1" candidate={null} assessment={assessment} factorPlan={{}} aptitudeKeys={["Turf", "Long"]} whiteTargets={[]} genetic={{ text: "Select course / style", tone: "muted", alert: true }} onOpen={() => {}} />);
  expect(html).toContain('aria-label="Edit Parent 1"');
  expect(html.match(/>Add</g)).toHaveLength(1);
  expect(html.match(/data-tile-grade=/g)).toHaveLength(2);
  const id = html.match(/aria-describedby="([^"]+)"/)![1];
  const summary = html.match(new RegExp(`<span id="${id.replace(/:/g, "\:")}"[^>]*class="sr-only"[^>]*>([^<]*)</span>`))![1];
  expect(summary).toContain("Select course / style");
  expect(summary).toContain("Turf ?");
  expect(summary).toContain("Empty");
  expect(summary).toContain("No white targets");
  expect(html).toContain("min-h-10");
});

test("no known course categories render no grade strip at all", () => {
  const html = renderToStaticMarkup(<AncestorTile slot="p2_gp1" candidate={null} assessment={assessment} factorPlan={{}} aptitudeKeys={[]} whiteTargets={[]} onOpen={() => {}} />);
  expect(html).not.toContain("data-tile-grade");
  expect(html).toContain('aria-label="Edit GP · Parent 2 · left"');
});

test("selected tile keeps the §20 portrait layers", () => {
  const candidate = buildLoopCandidates([], [charactersById.get(106802)!])[0];
  const html = renderToStaticMarkup(<AncestorTile slot="p1" candidate={candidate} assessment={assessment} factorPlan={{ pink: "Turf", pinkStars: 3 }} aptitudeKeys={["Turf"]} whiteTargets={["Turf"]} onOpen={() => {}} />);
  expect(html).toContain('data-portrait-layer="back"');
  expect(html).toContain('data-portrait-layer="frame"');
  expect(html).toContain("polygon(0 -100%, 100% -100%, 100% 0, 50% 50%, 0 0)");
});

test("great-grandparent tile shows no grade strip", () => {
  const html = renderToStaticMarkup(<AncestorTile slot="p1_gp1_g1" candidate={null} assessment={assessment} factorPlan={{ pink: "Turf", pinkStars: 2 }} aptitudeKeys={["Turf"]} whiteTargets={[]} onOpen={() => {}} />);
  expect(html).not.toContain("data-tile-grade");
});

test("tile accessible name includes the chosen name; names wrap instead of truncating", () => {
  const candidate = buildLoopCandidates([], [charactersById.get(106802)!])[0];
  const html = renderToStaticMarkup(<AncestorTile slot="p1" candidate={candidate} assessment={assessment} factorPlan={{}} aptitudeKeys={[]} whiteTargets={[]} onOpen={() => {}} />);
  expect(html).toContain(`aria-label="Edit Parent 1: ${candidate.name}"`);
  expect(html).toContain("line-clamp-2 break-words");
  const ggp = renderToStaticMarkup(<AncestorTile slot="p1_gp1_g1" candidate={candidate} assessment={assessment} factorPlan={{}} aptitudeKeys={[]} whiteTargets={[]} onOpen={() => {}} />);
  expect(ggp).toContain(candidate.name);
  expect(ggp).toContain(`: ${candidate.name}"`);
});

test("parent tile lists every selected white genetic by short name", () => {
  const html = renderToStaticMarkup(<AncestorTile slot="p1" candidate={null} assessment={assessment} factorPlan={{}} aptitudeKeys={[]} whiteTargets={["Turf", "Leader", "Medium"]} onOpen={() => {}} />);
  expect(html).toContain("Turf·Lead·Med");
  const id = html.match(/aria-describedby="([^"]+)"/)![1];
  const summary = html.match(new RegExp(`<span id="${id.replace(/:/g, "\:")}"[^>]*class="sr-only"[^>]*>([^<]*)</span>`))![1];
  expect(summary).toContain("White targets: Turf, Leader, Medium");
});

test("grade strip groups 2 + 4 + 4 at every tier and enlarges tablet portraits", () => {
  const keys = ["Turf", "Dirt", "Sprint", "Mile", "Medium", "Long", "Runner", "Leader", "Betweener", "Chaser"] as never;
  const phone = renderToStaticMarkup(<AncestorTile tier="phone" slot="p1" candidate={null} assessment={assessment} factorPlan={{}} aptitudeKeys={keys} whiteTargets={[]} onOpen={() => {}} />);
  expect(phone.match(/data-tile-grade-group=/g)).toHaveLength(3);
  expect(phone.match(/data-tile-grade=/g)).toHaveLength(10);
  expect(phone).toContain(">Turf<");
  expect(phone).toContain(">Spr<");
  const tablet = renderToStaticMarkup(<AncestorTile tier="tablet" slot="p1" candidate={null} assessment={assessment} factorPlan={{}} aptitudeKeys={keys} whiteTargets={[]} onOpen={() => {}} />);
  expect(tablet.match(/data-tile-grade-group=/g)).toHaveLength(3);
  expect(tablet).toContain("h-16 w-16");
  expect(tablet.match(/data-tile-grade=/g)).toHaveLength(10);
});
