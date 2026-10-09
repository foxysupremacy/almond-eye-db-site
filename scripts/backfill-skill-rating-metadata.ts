/** Retain rating metadata without replacing translations or fetching game data. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [path.join(root, "lib/data/source/gametora/skills.json"), path.join(root, "../skills.json")];
const sourcePath = candidates.find((candidate) => fs.existsSync(candidate));
if (!sourcePath) throw new Error("No local skill source available for metadata backfill");
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8")) as Array<{ id: number; condition_groups?: Array<Record<string, unknown>> }>;
const byId = new Map(source.map((skill) => [Number(skill.id), skill]));
const output = path.join(root, "lib/data/generated/skills.json");
const skills = JSON.parse(fs.readFileSync(output, "utf8")) as Array<{ id: number; conditionGroups: Array<Record<string, unknown>> }>;
let updated = 0;
for (const skill of skills) {
  const groups = byId.get(skill.id)?.condition_groups ?? [];
  for (const group of skill.conditionGroups) {
    const match = groups.find((candidate) => (candidate.condition ?? "") === (group.condition ?? "") && (candidate.precondition ?? null) === (group.precondition ?? null));
    if (!match) continue;
    for (const key of ["cd", "time_scale"] as const) {
      if (match[key] != null && group[key] !== match[key]) { group[key] = match[key]; updated++; }
    }
  }
}
fs.writeFileSync(output, JSON.stringify(skills));
console.log(`Retained ${updated} cooldown/duration metadata fields from ${path.relative(root, sourcePath)}.`);
