import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * R33 (licence boundary, spec D11): umasim is a black-box numeric oracle. Its outputs may be committed as fixtures and
 * used to fit parameters, but no code, tables or structure may be taken from its source. This guard fails when an
 * umasim source identifier (class, function, field or file name), or the old transcribed state tables, appear in the
 * app source. "umasim" itself may still be named as the oracle whose RESULTS a test or a fit compares against.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIRS = ["lib", "app", "features", "tests", "scripts"];
const FORBIDDEN: ReadonlyArray<readonly [RegExp, string]> = [
  [/approximateConditions/, "umasim state table"],
  [/checkSpecialState/, "umasim condition checker"],
  [/SkillChecker/, "umasim class"],
  [/\bSkillEffect\b/, "umasim class"],
  [/calcValue/, "umasim function"],
  [/calcDuration/, "umasim function"],
  [/\bInvoke\b/, "umasim class"],
  [/coolDownId/, "umasim field"],
  [/RaceCalculator/, "umasim class"],
  [/\bRaceState\b/, "umasim class"],
  [/\bTrackDetail\b/, "umasim class"],
  [/calcConsumePerSecond/, "umasim function"],
  [/\bspMax\b/, "umasim field"],
  [/valueOnStart/, "umasim field"],
  [/modifiedSpeed/, "umasim field"],
  [/umaStatus/, "umasim field"],
  [/SkillActivateAdjustment/, "umasim enum"],
  [/RaceSettingWithPassive/, "umasim class"],
  [/applyLevel/, "umasim function"],
  [/fixRandom/, "umasim flag"],
  [/startPosition/, "umasim field"],
  [/SkillData\.kt|RaceState\.kt|data2\/|calc2\//, "umasim source path"],
  // The transcribed tables removed by R33.
  [/\bCHAINS\b|OVERTAKE_CHAIN|SIDE_BLOCK_CHAIN|startContinue\(|randomRates\(/, "transcribed umasim state table"],
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "generated" || entry.name === "fixtures") continue;
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx|mjs|md)$/.test(entry.name) && entry.name !== "provenance.test.ts") out.push(full);
  }
  return out;
}

describe("R33: no umasim source identifiers or tables in the app source", () => {
  const files = DIRS.flatMap((d) => sourceFiles(path.join(root, d)));

  test("the scan covers the race-impact engine", () => {
    expect(files.some((f) => f.endsWith(path.join("race-impact", "dynamic-placement.ts")))).toBe(true);
    expect(files.some((f) => f.endsWith(path.join("race-impact", "lanes.ts")))).toBe(true);
  });

  test("no file names an umasim class, function, field, source path or transcribed table", () => {
    const hits: string[] = [];
    for (const file of files) {
      const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        for (const [re, what] of FORBIDDEN) if (re.test(line)) hits.push(`${path.relative(root, file)}:${i + 1} (${what}): ${line.trim().slice(0, 120)}`);
      });
    }
    expect(hits).toEqual([]);
  });

  test("the lane and race-state models do not claim to reproduce umasim behaviour as observed", () => {
    for (const name of ["lanes.ts", "dynamic-placement.ts"]) {
      const text = fs.readFileSync(path.join(root, "lib", "race-impact", name), "utf8");
      expect(/as observed|reproduce[sd]? (umasim|its)|umasim classic.s isolated-horse/i.test(text)).toBe(false);
    }
  });
});
