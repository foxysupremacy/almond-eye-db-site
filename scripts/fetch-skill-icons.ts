// Fills in skill icons that public/assets/skills/ is missing, from GameTora.
//
// Every iconId used in lib/data/generated/skills.json is checked against the
// two file names SkillIcon tries (<id>.png, utx_ico_skill_<id>.png). Missing
// ones are fetched from GameTora's icon folder and saved as
// utx_ico_skill_<id>.png. Icons GameTora doesn't have yet are listed, so a
// re-run after GameTora updates picks them up.
//
// Usage: bun run fetch:skill-icons [--dry-run]

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { collectIconIds, gametoraIconUrl, isPng, localIconFileName, missingIconIds } from "./skill-icon-sync.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_JSON = path.resolve(__dirname, "../lib/data/generated/skills.json");
const ICON_DIR = path.resolve(__dirname, "../public/assets/skills");
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const REQUEST_GAP_MS = 250; // be polite to GameTora

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchIcon(iconId: number): Promise<Uint8Array | null> {
  const res = await fetch(gametoraIconUrl(iconId), { headers: { "User-Agent": BROWSER_UA } });
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  return isPng(bytes) ? bytes : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skills = JSON.parse(fs.readFileSync(SKILLS_JSON, "utf8")) as { iconId?: number | null }[];
  const iconIds = collectIconIds(skills);
  const missing = missingIconIds(iconIds, new Set(fs.readdirSync(ICON_DIR)));

  console.log(`${iconIds.length} icon ids referenced, ${missing.length} missing locally.`);
  if (missing.length === 0) return;
  if (dryRun) {
    console.log(`Missing: ${missing.join(", ")}`);
    return;
  }

  const saved: number[] = [];
  const unavailable: number[] = [];
  for (const iconId of missing) {
    const bytes = await fetchIcon(iconId).catch(() => null);
    if (bytes) {
      fs.writeFileSync(path.join(ICON_DIR, localIconFileName(iconId)), bytes);
      saved.push(iconId);
      console.log(`  saved ${localIconFileName(iconId)}`);
    } else {
      unavailable.push(iconId);
    }
    await sleep(REQUEST_GAP_MS);
  }

  console.log(`Saved ${saved.length} icon(s).`);
  if (unavailable.length > 0) {
    console.log(`Not on GameTora yet (${unavailable.length}): ${unavailable.join(", ")}`);
    console.log("Re-run after GameTora updates, or drop the PNGs into public/assets/skills/ by hand.");
  }
}

main().catch((err) => {
  console.error("fetch-skill-icons failed:", err.message);
  process.exit(1);
});
