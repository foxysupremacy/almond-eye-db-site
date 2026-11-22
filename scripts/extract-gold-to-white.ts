// Gold skill -> inheritable white skill table (lib/data/generated/gold-to-white.json), derived from
// master.mdb. Called from extract-mdb.ts (build:data) and runnable on its own as a targeted refresh:
//
//   UMAMUSUME_MDB_PATH=... node --experimental-strip-types scripts/extract-gold-to-white.ts
//
// What a gold skill drops through inheritance is its skill group's white SPARK (succession_factor,
// factor_type 4). Every skill group has exactly one such factor, and it grants the ○ white
// (group_rate 1) — never the ◎ (group_rate 2) the gold upgrades from in training. So
// Moonlight Slash (201463) maps to Chaser's Corners ○ (201462), not Chaser's Corners ◎ (201461).
//
// Golds whose group has no white spark (e.g. scenario-exclusive golds) get no entry, so callers keep
// dropping them as uninheritable. Names come from lib/data/generated/skills.json; generate-data.ts
// overlays Hachimi EN names onto this file afterwards.
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLD_TO_WHITE_PATH = path.resolve(__dirname, "../lib/data/generated/gold-to-white.json");
const SKILLS_PATH = path.resolve(__dirname, "../lib/data/generated/skills.json");

interface GoldWhiteRow {
  gold_id: number;
  white_id: number;
  gold_name_jp: string | null;
  white_name_jp: string | null;
}

interface MappedGoldSkill {
  whiteId: number;
  whiteNameEn: string;
  whiteNameJp: string;
  goldNameEn: string;
  goldNameJp: string;
}

export function extractGoldToWhite(db: DatabaseSync): void {
  const rows = db
    .prepare(
      `SELECT g.id AS gold_id, w.id AS white_id, tg.text AS gold_name_jp, tw.text AS white_name_jp
       FROM skill_data g
       JOIN skill_data w ON w.group_id = g.group_id AND w.rarity = 1
       JOIN text_data tg ON tg.category = 47 AND tg."index" = g.id
       LEFT JOIN text_data tw ON tw.category = 47 AND tw."index" = w.id
       WHERE g.rarity = 2
         AND EXISTS (
           SELECT 1 FROM succession_factor_effect e
           JOIN succession_factor f ON f.factor_group_id = e.factor_group_id AND f.factor_type = 4
           WHERE e.target_type = 41 AND e.value_1 = w.id
         )
       GROUP BY g.id, w.id
       ORDER BY g.id, w.id`,
    )
    .all() as unknown as GoldWhiteRow[];

  const skills = JSON.parse(fs.readFileSync(SKILLS_PATH, "utf8")) as { id: number; nameEn?: string; nameJp?: string }[];
  const skillById = new Map(skills.map((s) => [s.id, s]));
  const previous: Record<string, MappedGoldSkill> = fs.existsSync(GOLD_TO_WHITE_PATH)
    ? JSON.parse(fs.readFileSync(GOLD_TO_WHITE_PATH, "utf8"))
    : {};

  const out: Record<string, MappedGoldSkill> = {};
  const ambiguous: number[] = [];
  for (const row of rows) {
    const key = String(row.gold_id);
    if (out[key]) {
      ambiguous.push(row.gold_id);
      continue; // keep the lowest white id; reported below
    }
    const gold = skillById.get(row.gold_id);
    const white = skillById.get(row.white_id);
    const prev = previous[key];
    out[key] = {
      whiteId: row.white_id,
      whiteNameEn: white?.nameEn || (prev?.whiteId === row.white_id ? prev.whiteNameEn : ""),
      whiteNameJp: row.white_name_jp ?? white?.nameJp ?? "",
      goldNameEn: gold?.nameEn ?? prev?.goldNameEn ?? "",
      goldNameJp: row.gold_name_jp ?? gold?.nameJp ?? "",
    };
  }

  const retargeted = Object.entries(out).filter(([k, v]) => previous[k] && previous[k].whiteId !== v.whiteId).length;
  const added = Object.keys(out).filter((k) => !previous[k]).length;
  const removed = Object.keys(previous).filter((k) => !out[k]).length;
  fs.writeFileSync(GOLD_TO_WHITE_PATH, JSON.stringify(out, null, 2));
  console.log(
    `Wrote ${Object.keys(out).length} gold->white mappings to ${GOLD_TO_WHITE_PATH} ` +
      `(${retargeted} retargeted, ${added} added, ${removed} removed).`,
  );
  if (ambiguous.length) console.warn(`  WARNING golds with more than one white spark: ${ambiguous.join(", ")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadEnv();
  const mdbPath = process.env.UMAMUSUME_MDB_PATH || "";
  if (!mdbPath || !fs.existsSync(mdbPath)) {
    console.error("UMAMUSUME_MDB_PATH is not set or does not exist (env var or repo-root .env).");
    process.exit(1);
  }
  const db = new DatabaseSync(mdbPath, { readOnly: true });
  try {
    extractGoldToWhite(db);
  } finally {
    db.close();
  }
}
