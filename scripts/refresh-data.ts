/**
 * Data refresh orchestrator — one command to pull the latest game data.
 *
 *   1. generate-data.ts            (optional; raw GameTora/JP dumps only exist
 *                                  in the legacy sibling workspace — skipped
 *                                  with a notice when they're absent)
 *   2. extract-mdb.ts              master.mdb -> cards.json index merge,
 *                                  affinity.json, careers.json
 *   3. crawl_gametora_characters.py  new playable characters: mdb index merge,
 *                                  GameTora merge, skill backfill into skills.json
 *   4. crawl_gametora_cards.py     GameTora -> English names, hints, events for
 *                                  new/uncrawled cards; recompiles skill-meta.json
 *   5. generate_inherit_skills.py  master.mdb -> skills-inherit.json,
 *                                  unique-inherit-map.json
 *   6. clean_card_names.py         strip bracketed title prefixes (idempotent)
 *   7. crawl_card_images.py        GameTora PNG assets (skips existing files)
 *
 * Config (mdb path, icon API key) lives in .env at the repo root — see .env.
 *
 * Usage:
 *   bun run data:refresh                 # full refresh incl. images
 *   bun run data:refresh -- --no-images  # text data only
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, "..");
loadEnv();

const noImages = process.argv.includes("--no-images");
const isBun = Boolean(process.versions.bun);
const tsScript = (name: string) =>
  isBun ? [path.join(__dirname, name)] : ["--experimental-strip-types", path.join(__dirname, name)];

function findPython(): string | null {
  // $PYTHON_EXE (env or .env) wins; then standard launchers; then common
  // Windows Miniconda/Anaconda locations. "python" may be a Microsoft Store
  // stub, so probe it must respond to --version.
  const candidates: Array<{ cmd: string; args?: string[] }> = [];
  if (process.env.PYTHON_EXE) candidates.push({ cmd: process.env.PYTHON_EXE });
  candidates.push(
    { cmd: "python" },
    { cmd: "python3" },
    { cmd: "py", args: ["-3"] },
    { cmd: "C:\\ProgramData\\miniconda3\\python.exe" },
    { cmd: "C:\\ProgramData\\anaconda3\\python.exe" },
  );
  for (const { cmd, args } of candidates) {
    const probe = spawnSync(cmd, [...(args ?? []), "--version"], { encoding: "utf8" });
    if (!probe.error && probe.status === 0) return cmd;
  }
  return null;
}

interface Step {
  name: string;
  cmd: string;
  args: string[];
  soft?: boolean; // warn and continue on failure instead of aborting
}

const python = findPython();
if (!python) {
  console.error("Error: no Python interpreter found. Set PYTHON_EXE in .env (repo root).");
  process.exit(1);
}
const py = (script: string, extra: string[] = []): string[] => {
  const full = path.join(__dirname, script);
  return python.endsWith("py.exe") || path.basename(python) === "py"
    ? ["-3", full, ...extra]
    : [full, ...extra];
};

const steps: Step[] = [];

// 1. Raw-dump preprocessing — only in the legacy sibling workspace layout.
const rawSkills = path.resolve(SITE_ROOT, "..", "skills.json");
if (fs.existsSync(rawSkills)) {
  steps.push({ name: "generate-data (raw dumps)", cmd: process.execPath, args: tsScript("generate-data.ts") });
} else {
  console.log(`[skip] generate-data: raw dumps not found at ${rawSkills} — using committed lib/data as base.`);
}

// 2. master.mdb extraction (mdb path from .env / $UMAMUSUME_MDB_PATH).
steps.push({ name: "extract-mdb", cmd: process.execPath, args: tsScript("extract-mdb.ts") });

// 3. Playable characters: mdb index merge + GameTora crawl + skill backfill
//    (must run before the card crawl, which recompiles skill-meta.json from
//    the updated skills.json).
steps.push({
  name: "populate characters (mdb + gametora)",
  cmd: python,
  args: py("crawl_gametora_characters.py"),
  soft: true,
});

// 4. GameTora card crawl (incremental) + skill-meta recompile.
steps.push({
  name: "crawl gametora cards (incremental)",
  cmd: python,
  args: py("crawl_gametora_cards.py", ["--new-only"]),
  soft: true,
});

// 5. Inherited-unique skills from master.mdb.
steps.push({ name: "generate inherit skills", cmd: python, args: py("generate_inherit_skills.py") });

// 6. Name cleanup (idempotent).
steps.push({ name: "clean card names", cmd: python, args: py("clean_card_names.py"), soft: true });

// 7. PNG assets (incremental; skips already-downloaded files).
if (!noImages) {
  steps.push({ name: "crawl card images", cmd: python, args: py("crawl_card_images.py"), soft: true });
}

let failed = 0;
for (const step of steps) {
  console.log(`\n=== ${step.name} ===`);
  const result = spawnSync(step.cmd, step.args, { stdio: "inherit", cwd: SITE_ROOT });
  if (result.status !== 0 || result.error) {
    if (step.soft) {
      console.warn(`[warn] ${step.name} failed (${result.status ?? result.error}) — continuing.`);
      failed++;
    } else {
      console.error(`[abort] ${step.name} failed (${result.status ?? result.error}).`);
      process.exit(1);
    }
  }
}

console.log(`\nData refresh finished (${steps.length - failed}/${steps.length} steps ok).`);
console.log("Review the lib/data diff, then commit to deploy the updated datasets.");
