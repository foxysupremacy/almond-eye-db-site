import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { characters, charactersById } from "@/lib/data/registry";
import { DEFAULT_PARENTING_SETUP } from "@/lib/parenting/state";
import { ParentingLoopOptimizer } from "./loop-optimizer";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";

test("Parent Planning shows the Ace profile and actual Dirt warning only on its six P/GP slots", () => {
  const parent = { card_id: 103201, factor_info_array: [{ factor_id: 5000203 }] } as KyumaruVeteranItem;
  const markup = renderToStaticMarkup(<ParentingLoopOptimizer
    target={charactersById.get(106802)!} veterans={[]} roster={[]}
    setup={{ ...DEFAULT_PARENTING_SETUP, parent1: parent }} targetStage={null}
    course={{ id: 1, terrain: 1, distance: 4, length: 2500, turn: 1, inout: 1, corners: [], straights: [], slopes: [] }} runningStyle={2}
    onOpenPicker={() => {}} updateSetup={() => {}}
  />);
  expect(markup).toContain("Ace genetics: Turf · Long · Leader");
  expect(markup).not.toContain("planned risks");
  expect(markup).not.toContain("Pink boosts:");
  expect(markup).not.toContain("MDB gene catalog:");
  expect(markup).toContain('aria-label="P1 genetics: 1 unwanted genetics present"');
  for (const slot of ["P2", "P1 GP1", "P1 GP2", "P2 GP1", "P2 GP2"]) expect(markup).toContain(`aria-label="${slot} genetics:`);
  expect(markup).not.toContain('aria-label="P1 GP1 G1 genetics:');
});

test("Parent Planning keeps the pedigree controls without optimizer analysis clutter", () => {
  const markup = renderToStaticMarkup(<ParentingLoopOptimizer
    target={charactersById.get(106802)!} veterans={[]} roster={[]}
    setup={DEFAULT_PARENTING_SETUP} targetStage={<p>Target unique</p>}
    onOpenPicker={() => {}} updateSetup={() => {}}
  />);
  expect(markup).toContain(">Parent Planning<");
  expect(markup).not.toContain("Parenting loop optimizer");
  expect(markup).not.toContain("Analyze selected");
  expect(markup).not.toContain("Compare alternatives");
  expect(markup).not.toContain("Triple Crown tie-break");
  expect(markup).not.toContain("Tiara tie-break");
  expect(markup).not.toContain("MDB gene catalog:");
  expect(markup).not.toContain("Lineage and pink spark inputs");
  expect(markup).not.toContain("G1 ? · White");
  expect(markup).not.toContain("possible (RNG)");
  expect(markup).toContain("P1 GP1 GGP1 GGGP1 pink spark input");
  expect(markup).not.toContain("Choose P1 GP1 GGP1 GGGP1");
  expect(markup).not.toContain("Aptitude minmax goals");
  expect(markup).not.toContain("Target white factors");
  expect(markup).not.toContain("P1 GP1 GGP1 Target genetic");
  expect(markup).not.toContain("Blue factor:");
  expect(markup).not.toContain("controls & details");
  expect(markup).not.toContain("View Aptitudes");
  expect(markup).not.toContain(">GGP spark sources<");
  expect(markup).not.toContain(">GGGP pink sparks<");
  expect(markup).toContain("max-w-[4rem]");
  expect(markup).toContain('data-pedigree-connector="parent-to-grandparent"');
  expect(markup).toContain('data-pedigree-connector="grandparent-to-great-grandparent"');
  expect(markup).toContain('data-pedigree-connector="great-grandparent-to-great-great-grandparent"');
  expect(markup).not.toContain("Select the remaining");
  expect(markup).toContain("P1 GP1 Dirt: base ?, projected ?");
  expect(markup).not.toContain("P1 GP1 GGP1 Dirt:");
  expect(markup).toContain("P1 Turf: base ?, projected ?");
  expect(markup).toContain("P1 Target genetic");
  expect(markup).not.toContain("<select");
  expect(markup).toContain("grid grid-cols-2 items-stretch gap-0.5 sm:gap-2");
  expect(markup).toContain('aria-hidden="true" class="h-10 w-full"');
});

test("an empty Parent Planning setup keeps the target picker visible without pedigree slots", () => {
  const markup = renderToStaticMarkup(<ParentingLoopOptimizer
    target={null} veterans={[]} roster={[]}
    setup={DEFAULT_PARENTING_SETUP} targetStage={<button aria-label="Select target trainee">Select target trainee</button>}
    onOpenPicker={() => {}} updateSetup={() => {}}
  />);

  expect(markup).toContain('aria-label="Select target trainee"');
  expect(markup).toContain("Select a target Uma to build the pedigree.");
  expect(markup).not.toContain('aria-label="Choose P1"');
  expect(markup).not.toContain('aria-label="Choose P2"');
  expect(markup).not.toContain("MDB gene catalog:");
});

test("unique skill row uses dark surfaces in dark mode", () => {
  const tachyon = characters.find((character) => character.nameEn === "Agnes Tachyon")!;
  const setup = {
    ...DEFAULT_PARENTING_SETUP,
    loopConfig: {
      geneGoals: {},
      aptitudeGoals: {},
      slotAptitudeGoals: {},
      factorGoals: {},
      selectedSlots: { p1: `r:${tachyon.id}` },
      lockedSlots: {},
      includeTripleCrownAffinity: false,
      includeTiaraAffinity: false,
    },
  };
  const markup = renderToStaticMarkup(<ParentingLoopOptimizer
    target={charactersById.get(106802)!} veterans={[]} roster={[tachyon]}
    setup={setup} targetStage={<p>Target unique</p>}
    onOpenPicker={() => {}} updateSetup={() => {}}
  />);
  expect(markup).toContain("dark:bg-zinc-800/95");
  expect(markup).toContain("dark:border-zinc-700/80");
});

test("Parent Planning identity buttons use Trained Umas portrait and name styling at each selectable generation", () => {
  const tachyon = characters.find((character) => character.nameEn === "Agnes Tachyon")!;
  const setup = {
    ...DEFAULT_PARENTING_SETUP,
    loopConfig: {
      geneGoals: {},
      aptitudeGoals: {},
      slotAptitudeGoals: {},
      factorGoals: {},
      selectedSlots: {
        p1: `r:${tachyon.id}`,
        p1_gp1: `r:${tachyon.id}`,
        p1_gp1_g1: `r:${tachyon.id}`,
      },
      lockedSlots: {},
      includeTripleCrownAffinity: false,
      includeTiaraAffinity: false,
    },
  };
  const markup = renderToStaticMarkup(<ParentingLoopOptimizer
    target={charactersById.get(106802)!} veterans={[]} roster={[tachyon]}
    setup={setup} targetStage={<p>Target unique</p>}
    onOpenPicker={() => {}} updateSetup={() => {}}
  />);

  expect(markup).toContain('data-ancestor-identity="parent"');
  expect(markup).toContain('data-ancestor-identity="grandparent"');
  expect(markup).toContain('data-ancestor-identity="great-grandparent"');
  expect(markup).toContain("ring-[2.5px] ring-amber-400/95 dark:ring-amber-400/80");
  expect(markup).toContain("scale-[1.65] origin-top -translate-y-[17%]");
  expect(markup).toContain("group-hover/avatar:text-emerald-700 dark:group-hover/avatar:text-emerald-400");
  expect(markup.match(/Agnes Tachyon/g)?.length).toBeGreaterThanOrEqual(3);
  expect(markup).not.toContain("utx_txt_rank_");
  expect(markup).not.toContain("target factor");
  expect(markup).not.toContain("bg-gradient-to-b");
});

test("selected ancestor portrait layers the clipped image, circular frame, and upper arch in order", () => {
  const tachyon = characters.find((character) => character.nameEn === "Agnes Tachyon")!;
  const setup = {
    ...DEFAULT_PARENTING_SETUP,
    loopConfig: {
      geneGoals: {},
      aptitudeGoals: {},
      slotAptitudeGoals: {},
      factorGoals: {},
      selectedSlots: { p1: `r:${tachyon.id}` },
      lockedSlots: {},
      includeTripleCrownAffinity: false,
      includeTiaraAffinity: false,
    },
  };
  const markup = renderToStaticMarkup(<ParentingLoopOptimizer
    target={charactersById.get(106802)!} veterans={[]} roster={[tachyon]}
    setup={setup} targetStage={<p>Target unique</p>}
    onOpenPicker={() => {}} updateSetup={() => {}}
  />);
  const backLayer = markup.indexOf('data-portrait-layer="back"');
  const frameLayer = markup.indexOf('data-portrait-layer="frame"');
  const frontLayer = markup.indexOf('data-portrait-layer="front"');

  expect(backLayer).toBeGreaterThanOrEqual(0);
  expect(frameLayer).toBeGreaterThan(backLayer);
  expect(frontLayer).toBeGreaterThan(frameLayer);
  expect(markup).toContain("clip-path:polygon(50% -20%, 64% -16%, 78% -8%, 89% 5%, 96% 20%, 100% 41%, 0 41%");
  expect(markup).not.toContain("bg-gradient-to-b");
});

test("ancestor cards reserve extra top space for the portrait pop-out", () => {
  const markup = renderToStaticMarkup(<ParentingLoopOptimizer
    target={charactersById.get(106802)!} veterans={[]} roster={[]}
    setup={DEFAULT_PARENTING_SETUP} targetStage={<p>Target unique</p>}
    onOpenPicker={() => {}} updateSetup={() => {}}
  />);

  expect(markup).toContain("p-1 pt-3 sm:p-2 sm:pt-4");
  expect(markup).toContain("px-1 pb-1 pt-3");
});

test("empty Parent Planning character slots keep accessible pick labels and touch-sized triggers", () => {
  const markup = renderToStaticMarkup(<ParentingLoopOptimizer
    target={charactersById.get(106802)!} veterans={[]} roster={[]}
    setup={DEFAULT_PARENTING_SETUP} targetStage={<p>Target unique</p>}
    onOpenPicker={() => {}} updateSetup={() => {}}
  />);

  expect(markup).toContain('aria-label="Choose P1"');
  expect(markup).toContain('aria-label="Choose P1 GP1"');
  expect(markup).toContain('aria-label="Choose P1 GP1 GGP1"');
  expect(markup).toContain("min-h-9 max-w-full");
  expect(markup).toContain(">Select P1</span>");
  expect(markup).toContain(">Select P1 GP1</span>");
  expect(markup).toContain(">Select P1 GP1 GGP1</span>");
});

test("a selected factor does not highlight aptitude on the same Uma card", () => {
  const tachyon = characters.find((character) => character.nameEn === "Agnes Tachyon")!;
  const setup = {
    ...DEFAULT_PARENTING_SETUP,
    loopConfig: {
      geneGoals: {},
      aptitudeGoals: {},
      slotAptitudeGoals: {},
      selectedSlots: { p1_gp1: `r:${tachyon.id}` },
      lockedSlots: {},
      includeTripleCrownAffinity: false,
      includeTiaraAffinity: false,
      factorGoals: { p1_gp1: { pink: "Medium" as const, pinkStars: 3 } },
    },
  };
  const markup = renderToStaticMarkup(<ParentingLoopOptimizer
    target={charactersById.get(106802)!} veterans={[]} roster={[tachyon]}
    setup={setup} targetStage={<p>Target unique</p>}
    onOpenPicker={() => {}} updateSetup={() => {}}
  />);

  expect(markup).not.toContain("border-[#e4007f]");
  expect(markup).toContain("P1 GP1 Red factor: Medium");
});

test("GGGP factor controls show Set and three muted stars until a factor is chosen", () => {
  const setup = {
    ...DEFAULT_PARENTING_SETUP,
    loopConfig: {
      geneGoals: {},
      aptitudeGoals: {},
      slotAptitudeGoals: {},
      selectedSlots: {},
      lockedSlots: {},
      includeTripleCrownAffinity: false,
      includeTiaraAffinity: false,
      factorGoals: { p1_gp1_g1_g1: { pink: "Dirt" as const, pinkStars: 1 } },
    },
  };
  const markup = renderToStaticMarkup(<ParentingLoopOptimizer
    target={charactersById.get(106802)!} veterans={[]} roster={[]}
    setup={setup} targetStage={<p>Target unique</p>}
    onOpenPicker={() => {}} updateSetup={() => {}}
  />);

  expect(markup).toContain(">Set</span>");
  expect(markup).toContain(">Dirt</span>");
  expect(markup).toContain("text-pink-300");
  expect(markup).toContain("text-zinc-400/60 dark:text-zinc-600");
  expect(markup).not.toContain("border-t border-pink-800/40");
});

test("AptitudeCell displays boosted grade and highlights when pink sparks are supplied", () => {
  const { characters } = require("@/lib/data/registry");
  const { AptitudeCell } = require("./components/aptitude-controls");
  const { evaluateParentingBranch, buildLoopCandidates } = require("@/lib/parenting/loop-planner");

  const mcqueen = characters.find((c: any) => c.nameEn.includes("McQueen"));
  const candidates = buildLoopCandidates([], characters);
  const mcqueenCandidate = candidates.find((c: any) => c.charId === mcqueen.charId && c.source === "roster-goal");

  // With 12 stars of Mile across GGGP slots
  const config = {
    geneGoals: {},
    aptitudeGoals: {},
    slotAptitudeGoals: {},
    factorGoals: {
      p1_gp1_g1_g1: { pink: "Mile", pinkStars: 3 },
      p1_gp1_g1_g2: { pink: "Mile", pinkStars: 3 },
      p1_gp1_g2_g1: { pink: "Mile", pinkStars: 3 },
      p1_gp1_g2_g2: { pink: "Mile", pinkStars: 3 },
    },
    selectedSlots: { p1_gp1: mcqueenCandidate.key },
    lockedSlots: {},
    includeTripleCrownAffinity: false,
    includeTiaraAffinity: false,
  };

  const assessment = evaluateParentingBranch("p1_gp1", { p1_gp1: mcqueenCandidate }, config);
  const mileMarkup = renderToStaticMarkup(<AptitudeCell
    aptitude="Mile"
    assessment={assessment}
    label="P1 GP1"
    sources={[]}
  />);

  // Mejiro McQueen base Mile is F, +4 ranks from 12★ boosts to B
  expect(mileMarkup).toContain('alt="B"');
  expect(mileMarkup).toContain("ring-pink-500");
  expect(mileMarkup).toContain("Mile: Base F → Boosted B (12★)");
  expect(mileMarkup).toContain("P1 GP1 Mile: base F, projected ?");

  // Sprint is unboosted (base G)
  const sprintMarkup = renderToStaticMarkup(<AptitudeCell
    aptitude="Sprint"
    assessment={assessment}
    label="P1 GP1"
    sources={[]}
  />);
  expect(sprintMarkup).toContain('alt="G"');
  expect(sprintMarkup).not.toContain("ring-pink-500");
  expect(sprintMarkup).toContain("Sprint: Base G");
});
