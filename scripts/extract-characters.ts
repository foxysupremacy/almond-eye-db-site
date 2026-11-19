// Playable-character extraction from master.mdb -> lib/data/generated/characters.json
// (+ skills.json backfill for skills referenced by characters but missing on the site).
//
// mdb-owned fields (overwritten for EVERY character): uniqueSkillId, innateSkills,
// awakeningSkills, aptitude, baseStats. New playable characters get a skeleton
// entry (JP names). GameTora-owned fields (nameEn, titleEn/Jp, eventSkills,
// urlName) are never touched here — crawl_gametora_characters.py fills those.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHARACTERS_PATH = path.resolve(__dirname, "../lib/data/generated/characters.json");
const SKILLS_PATH = path.resolve(__dirname, "../lib/data/generated/skills.json");

const EVOLUTIONS_PATH = path.resolve(__dirname, "../lib/data/generated/character-evolutions.json");
const GRADES = "XGFEDCBA"; // mdb proper_* 1..8 -> G..A
const N_ABILITIES = 3;

interface CharacterEntry {
  id: number;
  charId: number;
  variant: string;
  nameEn: string;
  nameJp: string;
  titleEn: string;
  titleJp: string;
  rarity: number;
  release: string | null;
  aptitude: string[];
  baseStats: number[];
  uniqueSkillId: number | null;
  innateSkills: number[];
  awakeningSkills: number[];
  eventSkills: number[];
  [key: string]: unknown;
}

type Row = Record<string, any>;

const text = (db: DatabaseSync, category: number, index: number): string =>
  String(
    (db.prepare('SELECT text FROM text_data WHERE category = ? AND "index" = ?').get(category, index) as Row | undefined)?.text ?? ""
  ).trim();

function jstDate(startDate: number): string | null {
  if (!startDate || startDate <= 0) return null;
  return new Date((startDate + 9 * 3600) * 1000).toISOString().slice(0, 10);
}

// Order-insensitive: GameTora lists skills in display order, mdb in id order;
// an identical set keeps the existing order so refreshes stay diff-free.
function sameSet(a: number[] | undefined, b: number[]): boolean {
  return Array.isArray(a) && a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

function sameArray(a: unknown[] | undefined, b: unknown[]): boolean {
  return Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
}

// Skills of one card from mdb. Rarity-3 skill_set holds the 3★ unique; 2★ cards
// are listed on GameTora with the 3★ unique id, so the unique always comes from
// the rarity-3 row.
function readMdbCharacter(db: DatabaseSync, cardId: number, rarity: number) {
  const innate: number[] = [];
  const awakening: number[] = [];
  const sets = db
    .prepare("SELECT skill_id, need_rank FROM available_skill_set WHERE available_skill_set_id = ? ORDER BY skill_id")
    .all(cardId) as Row[];
  for (const s of sets) {
    if (Number(s.need_rank) === 0) innate.push(Number(s.skill_id));
    else if (Number(s.need_rank) >= 2) awakening.push(Number(s.skill_id));
  }

  const rar = db
    .prepare(
      `SELECT speed, stamina, pow, guts, wiz,
              proper_distance_short, proper_distance_mile, proper_distance_middle, proper_distance_long,
              proper_running_style_nige, proper_running_style_senko, proper_running_style_sashi, proper_running_style_oikomi,
              proper_ground_turf, proper_ground_dirt
       FROM card_rarity_data WHERE card_id = ? AND rarity = ?`
    )
    .get(cardId, rarity) as Row | undefined;
  const aptitude = rar
    ? [
        rar.proper_ground_turf, rar.proper_ground_dirt,
        rar.proper_distance_short, rar.proper_distance_mile, rar.proper_distance_middle, rar.proper_distance_long,
        rar.proper_running_style_nige, rar.proper_running_style_senko, rar.proper_running_style_sashi, rar.proper_running_style_oikomi,
      ].map((v) => GRADES[Number(v)] ?? "G")
    : null;
  const baseStats = rar ? [rar.speed, rar.stamina, rar.pow, rar.guts, rar.wiz].map(Number) : null;

  const uniq = db
    .prepare(
      `SELECT ss.skill_id1 AS skillId FROM card_rarity_data r
       JOIN skill_set ss ON ss.id = r.skill_set
       WHERE r.card_id = ? AND r.rarity = 3`
    )
    .get(cardId) as Row | undefined;
  return { innate, awakening, aptitude, baseStats, uniqueSkillId: uniq?.skillId ? Number(uniq.skillId) : null };
}

export function extractCharacters(db: DatabaseSync): void {
  const characters: CharacterEntry[] = JSON.parse(fs.readFileSync(CHARACTERS_PATH, "utf-8"));
  const byId = new Map(characters.map((c) => [Number(c.id), c]));

  // 1. Skeleton entries for new playable base cards.
  const playable = db
    .prepare(
      `SELECT cd.id, cd.chara_id, cd.default_rarity, ch.start_date
       FROM card_data cd JOIN chara_data ch ON ch.id = cd.chara_id
       WHERE cd.id = cd.chara_id * 100 + 1 AND cd.id < 9000000`
    )
    .all() as Row[];
  let added = 0;
  for (const r of playable) {
    const id = Number(r.id);
    if (byId.has(id)) continue;
    const nameJp = text(db, 6, Number(r.chara_id));
    const entry: CharacterEntry = {
      id,
      charId: Number(r.chara_id),
      variant: "01",
      nameEn: nameJp,
      nameJp,
      titleEn: "",
      titleJp: "",
      rarity: Number(r.default_rarity),
      release: jstDate(Number(r.start_date)),
      aptitude: [],
      baseStats: [],
      uniqueSkillId: null,
      innateSkills: [],
      awakeningSkills: [],
      eventSkills: [],
    };
    characters.push(entry);
    byId.set(id, entry);
    added++;
    console.log(`  mdb characters: added ${id} (${nameJp || "?"})`);
  }

  // 2. mdb-owned fields for every character.
  const changes: Record<string, number> = { uniqueSkillId: 0, innateSkills: 0, awakeningSkills: 0, aptitude: 0, baseStats: 0 };
  for (const c of characters) {
    const m = readMdbCharacter(db, Number(c.id), Number(c.rarity));
    const note = (field: string, from: unknown, to: unknown) => {
      changes[field]++;
      console.log(`  mdb characters: ${c.id} ${c.nameEn} ${field}: ${JSON.stringify(from)} -> ${JSON.stringify(to)}`);
    };
    if (m.uniqueSkillId && c.uniqueSkillId !== m.uniqueSkillId) {
      if (c.uniqueSkillId) note("uniqueSkillId", c.uniqueSkillId, m.uniqueSkillId);
      c.uniqueSkillId = m.uniqueSkillId;
    }
    if (m.innate.length && !sameSet(c.innateSkills, m.innate)) {
      if (c.innateSkills?.length) note("innateSkills", c.innateSkills, m.innate);
      c.innateSkills = m.innate;
    }
    if (m.awakening.length && !sameSet(c.awakeningSkills, m.awakening)) {
      if (c.awakeningSkills?.length) note("awakeningSkills", c.awakeningSkills, m.awakening);
      c.awakeningSkills = m.awakening;
    }
    if (m.aptitude && !sameArray(c.aptitude, m.aptitude)) {
      if (c.aptitude?.length) note("aptitude", c.aptitude, m.aptitude);
      c.aptitude = m.aptitude;
    }
    if (m.baseStats && !sameArray(c.baseStats, m.baseStats)) {
      if (c.baseStats?.length) note("baseStats", c.baseStats, m.baseStats);
      c.baseStats = m.baseStats;
    }
  }

  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  // Same ordering as the Python crawler: rarity desc, nameEn, id.
  characters.sort(
    (a, b) =>
      Number(b.rarity || 0) - Number(a.rarity || 0) ||
      cmp(String(a.nameEn || ""), String(b.nameEn || "")) ||
      Number(a.id) - Number(b.id)
  );
  fs.writeFileSync(CHARACTERS_PATH, JSON.stringify(characters));
  const changed = Object.entries(changes).filter(([, n]) => n).map(([k, n]) => `${k}=${n}`).join(", ") || "none";
  console.log(`Characters: ${characters.length} entries (+${added} new from mdb); overwritten from mdb: ${changed}`);
}

// ---- skills.json backfill (ported from crawl_gametora_characters.py) ----------

function iconFromAbility(abilityType: number | null, rarity: number, value: number, target: number): number {
  const suffix = rarity === 1 ? 1 : rarity === 2 ? 2 : rarity === 6 ? 6 : 3;
  const debuff = value < 0 || [2, 3, 4, 5, 6, 7, 8, 9, 10].includes(target);
  if (debuff) {
    if ([21, 22, 27].includes(abilityType ?? -1)) return 30010 + suffix;
    if (abilityType === 9) return 30050 + suffix;
    if (abilityType === 31) return 30040 + suffix;
    return 30010 + suffix;
  }
  if ([21, 22, 27].includes(abilityType ?? -1)) return 20010 + suffix;
  if (abilityType === 9) return 20020 + suffix;
  if (abilityType === 31) return 20040 + suffix;
  if (abilityType === 28) return 20050 + suffix;
  if (abilityType === 1) return 10010 + (suffix === 1 ? 4 : suffix);
  if (abilityType === 2) return 10020 + suffix;
  if (abilityType === 3) return 10030 + suffix;
  if (abilityType === 4) return 10040 + suffix;
  if (abilityType === 5) return 10050 + suffix;
  return 20010 + suffix;
}

function resolveSkillIconId(row: Row): number {
  if (row.icon_id && Number(row.icon_id) !== 0) return Number(row.icon_id);
  return iconFromAbility(
    row.ability_type_1_1 ?? null,
    Number(row.rarity || 1),
    Number(row.float_ability_value_1_1 ?? 0),
    Number(row.target_type_1_1 ?? 1)
  );
}

function buildConditionGroups(row: Row) {
  const groups: Row[] = [];
  for (const d of [1, 2]) {
    const cond = row[`condition_${d}`];
    const baseTime = row[`float_ability_time_${d}`];
    if (!cond || !baseTime) continue;
    const effects: Row[] = [];
    for (let a = 1; a <= N_ABILITIES; a++) {
      const type = row[`ability_type_${d}_${a}`];
      if (!type) continue;
      const effect: Row = { type, value: row[`float_ability_value_${d}_${a}`] };
      const target = row[`target_type_${d}_${a}`];
      if (target !== 0 && target !== 1) effect.target = target;
      effects.push(effect);
    }
    if (!effects.length) continue;
    groups.push({ condition: cond, precondition: row[`precondition_${d}`] || null, base_time: baseTime, effects });
  }
  return groups;
}

// Run AFTER extractCharacters and patchCharacterEvolutions: every skill that a
// character (unique/innate/awakening/event) or one of its evolutions references
// must exist in skills.json.
export function backfillMissingSkills(db: DatabaseSync): void {
  const characters: CharacterEntry[] = JSON.parse(fs.readFileSync(CHARACTERS_PATH, "utf-8"));
  const skills: Row[] = JSON.parse(fs.readFileSync(SKILLS_PATH, "utf-8"));
  const known = new Set(skills.map((s) => Number(s.id)));
  const referenced = new Set<number>();
  for (const c of characters) {
    for (const k of ["uniqueSkillId", "innateSkills", "awakeningSkills", "eventSkills"] as const) {
      const v = c[k];
      for (const sid of Array.isArray(v) ? v : [v]) if (sid) referenced.add(Number(sid));
    }
  }
  const evolutions: Record<string, { skillId: number }[]> = JSON.parse(fs.readFileSync(EVOLUTIONS_PATH, "utf-8"));
  for (const list of Object.values(evolutions)) for (const e of list) if (e.skillId) referenced.add(Number(e.skillId));
  const missing = [...referenced].filter((id) => !known.has(id)).sort((a, b) => a - b);
  let added = 0;
  for (const sid of missing) {
    const row = db.prepare("SELECT * FROM skill_data WHERE id = ?").get(sid) as Row | undefined;
    if (!row) {
      console.log(`  [warn] skill ${sid} not in mdb skill_data — skipped`);
      continue;
    }
    const nameJp = text(db, 47, sid);
    skills.push({
      id: sid,
      nameEn: nameJp,
      nameJp,
      descEn: "",
      descJp: text(db, 48, sid),
      rarity: Number(row.rarity),
      iconId: resolveSkillIconId(row),
      tags: [],
      conditionGroups: buildConditionGroups(row),
    });
    added++;
    console.log(`  skill backfill: added ${sid} (${nameJp}) from mdb`);
  }
  if (added) fs.writeFileSync(SKILLS_PATH, JSON.stringify(skills));
  console.log(`Skills backfill: +${added} from mdb (${missing.length - added} unresolved)`);
}
