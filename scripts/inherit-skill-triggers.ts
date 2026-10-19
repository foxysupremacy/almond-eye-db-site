// Inherited-unique (white) skill triggers from master.mdb `skill_data`.
//
// scripts/generate_inherit_skills.py builds skills-inherit.json (names, icons,
// descriptions, unique-inherit-map.json). This module owns the numeric part of
// each entry: `conditionGroups` and `activation`, mapped 1:1 from skill_data in
// the same shape as the shipped skills.json (GameTora) entries:
//
//   group  = { condition, precondition (null when empty), base_time, effects }
//            one per detail whose condition_N is non-empty (detail 1 also when it
//            only has effects). base_time is the raw
//            float_ability_time_N, so instant heals (0) and passives (-1) are kept.
//   effect = the k-th ability with ability_type != 0, keys in skills.json order:
//            additional_activation (when != 0), target + target_details
//            (target_type when not 0/1, with target_value even when 0), type, value,
//            value_scale (ability_value_usage, when != 1)
//   activation = activate_lot
//
// Refresh the shipped file without touching names/icons (read-only mdb):
//
//   bun scripts/inherit-skill-triggers.ts [path/to/master.mdb]
//
// The default path is $UMAMUSUME_MDB_PATH. Run after generate_inherit_skills.py.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const SITE_ROOT = path.resolve(path.dirname(__filename), "..");
export const SKILLS_INHERIT_PATH = path.resolve(SITE_ROOT, "lib/data/generated/skills-inherit.json");

export type MdbRow = Record<string, unknown>;
/** The subset of node:sqlite DatabaseSync / bun:sqlite Database used here. */
export interface MdbLike { prepare(sql: string): { all(...params: never[]): unknown[] } }

export interface InheritEffect {
  additional_activation?: number;
  target?: number;
  target_details?: number;
  type: number;
  value: number;
  value_scale?: number;
}
export interface InheritConditionGroup {
  condition: string;
  precondition: string | null;
  base_time: number;
  effects: InheritEffect[];
}

const N_DETAILS = 2;
const N_ABILITIES = 3;
const num = (v: unknown) => Number(v ?? 0) || 0;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** skill_data columns read by {@link mdbConditionGroups} and {@link mdbActivation}. */
export const TRIGGER_COLUMNS: readonly string[] = (() => {
  const cols = ["id", "activate_lot"];
  for (let d = 1; d <= N_DETAILS; d++) {
    cols.push(`precondition_${d}`, `condition_${d}`, `float_ability_time_${d}`);
    for (let a = 1; a <= N_ABILITIES; a++) {
      cols.push(
        `ability_type_${d}_${a}`, `float_ability_value_${d}_${a}`, `target_type_${d}_${a}`,
        `target_value_${d}_${a}`, `ability_value_usage_${d}_${a}`, `additional_activate_type_${d}_${a}`,
      );
    }
  }
  return cols;
})();

export function mdbConditionGroups(row: MdbRow): InheritConditionGroup[] {
  const groups: InheritConditionGroup[] = [];
  for (let d = 1; d <= N_DETAILS; d++) {
    const condition = text(row[`condition_${d}`]);
    const effects: InheritEffect[] = [];
    for (let a = 1; a <= N_ABILITIES; a++) {
      const type = num(row[`ability_type_${d}_${a}`]);
      if (!type) continue;
      const additional = num(row[`additional_activate_type_${d}_${a}`]);
      const target = num(row[`target_type_${d}_${a}`]);
      const targetDetails = num(row[`target_value_${d}_${a}`]);
      const usage = num(row[`ability_value_usage_${d}_${a}`]);
      // Key order matches skills.json.
      effects.push({
        ...(additional ? { additional_activation: additional } : {}),
        ...(target && target !== 1 ? { target, target_details: targetDetails } : targetDetails ? { target_details: targetDetails } : {}),
        type,
        value: num(row[`float_ability_value_${d}_${a}`]),
        ...(usage && usage !== 1 ? { value_scale: usage } : {}),
      });
    }
    // Detail 1 with no condition but with effects (scenario/passive rows) still forms a group, as in skills.json.
    if (!condition && !(d === 1 && effects.length)) continue;
    groups.push({
      condition,
      precondition: text(row[`precondition_${d}`]) || null,
      base_time: num(row[`float_ability_time_${d}`]),
      effects,
    });
  }
  return groups;
}

export const mdbActivation = (row: MdbRow): number => num(row.activate_lot);

/** Inherited-unique rows (unique_skill_id_1 != 0), trigger columns only. */
export function readInheritRows(db: MdbLike): MdbRow[] {
  return db.prepare(`SELECT ${TRIGGER_COLUMNS.join(", ")} FROM skill_data WHERE unique_skill_id_1 != 0 ORDER BY id`).all() as MdbRow[];
}

/**
 * Replaces `conditionGroups` and `activation` on every entry that has an mdb row; every other field (names,
 * descriptions, rarity, icon) is kept verbatim. `activation` is placed after `rarity`, as in skills.json.
 */
export function patchInheritEntries(entries: MdbRow[], rows: MdbRow[]) {
  const byId = new Map(rows.map((r) => [num(r.id), r]));
  const changed: number[] = [];
  const notInMdb: number[] = [];
  const patched = entries.map((entry) => {
    const id = num(entry.id);
    const row = byId.get(id);
    if (!row) { notInMdb.push(id); return entry; }
    const next: MdbRow = {};
    for (const [k, v] of Object.entries(entry)) {
      if (k === "activation") continue;
      if (k === "conditionGroups") { next.conditionGroups = mdbConditionGroups(row); continue; }
      next[k] = v;
      if (k === "rarity") next.activation = mdbActivation(row);
    }
    if (!("activation" in next)) next.activation = mdbActivation(row);
    if (!("conditionGroups" in next)) next.conditionGroups = mdbConditionGroups(row);
    if (JSON.stringify(next) !== JSON.stringify(entry)) changed.push(id);
    return next;
  });
  const known = new Set(entries.map((e) => num(e.id)));
  const notInFile = rows.map((r) => num(r.id)).filter((id) => !known.has(id));
  return { entries: patched, changed, notInMdb, notInFile };
}

async function openMdbReadOnly(mdbPath: string): Promise<MdbLike & { close(): void }> {
  if (typeof (globalThis as { Bun?: unknown }).Bun !== "undefined") {
    const { Database } = (await import("bun:sqlite" as string)) as { Database: new (p: string, o: { readonly: boolean }) => MdbLike & { close(): void } };
    return new Database(mdbPath, { readonly: true });
  }
  const { DatabaseSync } = await import("node:sqlite");
  return new DatabaseSync(mdbPath, { readOnly: true }) as unknown as MdbLike & { close(): void };
}

export async function refreshInheritSkillTriggers(mdbPath: string): Promise<void> {
  const db = await openMdbReadOnly(mdbPath);
  const rows = readInheritRows(db);
  db.close();
  const raw = fs.readFileSync(SKILLS_INHERIT_PATH, "utf8");
  const { entries, changed, notInMdb, notInFile } = patchInheritEntries(JSON.parse(raw) as MdbRow[], rows);
  if (notInMdb.length) console.warn(`skills-inherit.json: ${notInMdb.length} entries have no skill_data row: ${notInMdb.join(", ")}`);
  if (notInFile.length) console.warn(`skills-inherit.json: ${notInFile.length} mdb rows missing (run generate_inherit_skills.py): ${notInFile.join(", ")}`);
  if (!changed.length) { console.log("skills-inherit.json triggers already match skill_data"); return; }
  fs.writeFileSync(SKILLS_INHERIT_PATH, JSON.stringify(entries));
  console.log(`skills-inherit.json: refreshed triggers on ${changed.length} of ${entries.length} entries`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const { loadEnv } = await import("./env.ts");
  loadEnv();
  const mdbPath = process.argv[2] || process.env.UMAMUSUME_MDB_PATH || "";
  if (!mdbPath || !fs.existsSync(mdbPath)) {
    console.error(`Error: master.mdb not found (${mdbPath || "pass a path or set UMAMUSUME_MDB_PATH"})`);
    process.exit(1);
  }
  await refreshInheritSkillTriggers(mdbPath);
}
