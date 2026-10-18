import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FORBIDDEN = [/lib[\\/]data[\\/]registry/, /lib[\\/]api[\\/]/, /lib[\\/]evaluator[\\/]evaluator\.ts$/, /\.json$/];

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? path.join(ROOT, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
  if (!base) return null; // bare package
  for (const ext of ["", ".ts", ".tsx", "/index.ts"]) if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return base + ext;
  return null;
}

test("the rankings worker and lib/rankings graphs never reach the registry, api, evaluator.ts, or JSON", () => {
  // The lib barrel is a root too, so every lib/rankings module is walked
  // even if the worker stops importing it.
  const roots = ["features/rankings/workers/rankings.worker.ts", "lib/rankings/index.ts"].map((p) => path.join(ROOT, p));
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = fs.readFileSync(file, "utf8");
    // Type-only imports/exports are erased at build time, so they are not runtime edges.
    for (const m of src.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^"']*["']([^"']+)["']/gm)) {
      const target = resolveImport(file, m[1]);
      if (!target) {
        // Unresolvable relative/alias specs would silently hide an edge; JSON never resolves via extensions.
        if (/\.json$/.test(m[1])) throw new Error(`${path.relative(ROOT, file)} imports JSON: ${m[1]}`);
        continue;
      }
      const from = path.relative(ROOT, file);
      const to = path.relative(ROOT, target);
      for (const bad of FORBIDDEN) expect({ from, to, bad: bad.test(target) }).toEqual({ from, to, bad: false });
      stack.push(target);
    }
  }
  expect(seen.size).toBeGreaterThan(5);
  // The walk must actually reach the engine modules the worker scores with; otherwise a broken resolver (or a moved
  // file) would pass vacuously.
  const reached = new Set([...seen].map((f) => path.relative(ROOT, f).replaceAll("\\", "/")));
  for (const mod of [
    "lib/race-impact/lanes.ts",
    "lib/race-impact/scaling.ts",
    "lib/race-impact/dynamic-placement.ts",
    "lib/race-impact/adjusted-stats.ts",
    "lib/skill-engine/distance-category.ts",
    "lib/race-impact/generated/skill-level-coef.ts",
  ]) expect({ mod, reached: reached.has(mod) }).toEqual({ mod, reached: true });
});
