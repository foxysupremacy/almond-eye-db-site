// Extracts card index + affinity/relation data + career G1 objectives directly
// from the game's master.mdb (SQLite) into lib/data/{cards,affinity,careers}.json.
//
// mdb-first pipeline: everything except English names and crawl results lives
// in master.mdb. cards.json is a MERGE — existing entries are preserved
// verbatim (their names/type/hints/events are GameTora-crawl-owned fields),
// mdb only contributes the index: new card rows, rarity, release date and
// JP names (text_data cat 75/76/77). English factor names still come from
// GameTora's factors.json overlay (text_data is Japanese-only).
//
// MDB path resolution: $UMAMUSUME_MDB_PATH, else the local CrossOver/Steam install.
import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_MDB_PATH =
  "/Users/fubuki/Library/Application Support/CrossOver/Bottles/Steam/drive_c/Program Files (x86)/Steam/steamapps/common/UmamusumePrettyDerby_Jpn/UmamusumePrettyDerby_Jpn_Data/Persistent/master/master.mdb";
const MDB_PATH = process.env.UMAMUSUME_MDB_PATH || DEFAULT_MDB_PATH;

const GAMETORA_DIR = path.resolve(__dirname, "../data-source/gametora");
const HACHIMI_PATH = path.resolve(__dirname, "../../hachimi_text_data.json");
const CHARACTERS_PATH = path.resolve(__dirname, "../lib/data/characters.json");
const CARDS_PATH = path.resolve(__dirname, "../lib/data/cards.json");
const OUTPUT_PATH = path.resolve(__dirname, "../lib/data/affinity.json");
const CAREERS_OUTPUT_PATH = path.resolve(__dirname, "../lib/data/careers.json");

interface GameToraFactor {
  id: string;
  type: number;
  name_en?: string;
  name_ja?: string;
}

interface CareerRace {
  saddleId?: number;
  raceId: number;
  nameEn: string;
  grade: number;
  trackId: number;
  distance: number;
  terrain: number;
  mustWin: boolean;
}

interface CourseRow {
  race_track_id: number;
  distance: number;
  ground: number;
}

function openMdb(): DatabaseSync {
  if (!fs.existsSync(MDB_PATH)) {
    throw new Error(
      `master.mdb not found at ${MDB_PATH} — set $UMAMUSUME_MDB_PATH or launch the game client once.`
    );
  }
  return new DatabaseSync(MDB_PATH, { readOnly: true });
}

export function extractAffinityData() {
  const db = openMdb();

  // 1. relation_type -> relation_point
  const relationPoints: Record<number, number> = {};
  for (const r of db.prepare("SELECT relation_type, relation_point FROM succession_relation").all()) {
    relationPoints[Number(r.relation_type)] = Number(r.relation_point);
  }

  // 2. chara_id -> relation_type[]
  const charaRelationTypes: Record<number, number[]> = {};
  for (const m of db
    .prepare("SELECT chara_id, relation_type FROM succession_relation_member")
    .all()) {
    const charaId = Number(m.chara_id);
    const relationType = Number(m.relation_type);
    const list = charaRelationTypes[charaId] ?? (charaRelationTypes[charaId] = []);
    if (!list.includes(relationType)) list.push(relationType);
  }

  // 3. Win saddles: flatten race_instance_id_1..8. G1 saddles are those whose
  //    single race instance falls in the G1 trophy range (100000..199999).
  const g1Saddles: number[] = [];
  const winSaddleToRaceInstance: Record<number, number> = {};
  const saddleRows = db
    .prepare(
      `SELECT id, ${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `race_instance_id_${n}`).join(", ")}
       FROM single_mode_wins_saddle`
    )
    .all() as Record<string, number>[];
  for (const s of saddleRows) {
    const saddleId = Number(s.id);
    const instanceIds = [1, 2, 3, 4, 5, 6, 7, 8]
      .map((n) => Number(s[`race_instance_id_${n}`]))
      .filter((v) => v > 0);
    if (instanceIds.length === 1 && instanceIds[0] >= 100000 && instanceIds[0] < 200000) {
      g1Saddles.push(saddleId);
    }
    for (const instanceId of instanceIds) {
      if (winSaddleToRaceInstance[saddleId] == null) {
        winSaddleToRaceInstance[saddleId] = instanceId;
      }
    }
  }

  // 4./5. text_data lookups: factor names (cat 147), saddle names (cat 111),
  //       race names (cat 28, indexed by race_instance_id).
  const textByCategory = (category: number): Map<number, string> => {
    const map = new Map<number, string>();
    for (const t of db
      .prepare('SELECT "index", text FROM text_data WHERE category = ?')
      .all(category)) {
      if (t.text) map.set(Number(t.index), String(t.text));
    }
    return map;
  };
  const factorNames: Record<number, string> = Object.fromEntries(textByCategory(147));
  const saddleNames: Record<number, string> = Object.fromEntries(textByCategory(111));
  const raceNameByInstanceId = textByCategory(28);

  // 6. English factor-name overlay from GameTora (mdb is JP-only).
  const gtFactorsPath = path.join(GAMETORA_DIR, "factors.json");
  let gtFactorNames = 0;
  if (fs.existsSync(gtFactorsPath)) {
    const gtFactors = JSON.parse(fs.readFileSync(gtFactorsPath, "utf-8")) as {
      blue?: GameToraFactor[];
      other?: GameToraFactor[];
    };
    for (const factor of [...(gtFactors.blue ?? []), ...(gtFactors.other ?? [])]) {
      const id = Number(factor.id);
      if (!Number.isFinite(id) || factorNames[id]) continue;
      const name = factor.name_en || factor.name_ja;
      if (name) {
        factorNames[id] = name;
        gtFactorNames++;
      }
    }
  }

  // 7. Career G1 objectives -> lib/data/careers.json.
  //    route (chara -> race_set) -> route_race (objective). condition_type 1
  //    objectives resolve to races; condition_type 3 is a fan-count target.
  //    condition_id resolution: a direct single_mode_program.id, or (for
  //    multi-race objectives like the JBC Classic venues) a race_group_id in
  //    single_mode_race_group. NB: the race_group.id column coincidentally
  //    overlaps condition ids of unrelated races — never join on it. Groups
  //    larger than 8 members are "win any of these scenario finals" conditions,
  //    not real objectives.
  const courses = new Map<number, CourseRow>();
  for (const c of db
    .prepare("SELECT id, race_track_id, distance, ground FROM race_course_set")
    .all()) {
    courses.set(Number(c.id), {
      race_track_id: Number(c.race_track_id),
      distance: Number(c.distance),
      ground: Number(c.ground),
    });
  }

  interface ProgramRace {
    raceInstanceId: number;
    reserveProgramId: number;
    raceId: number | null;
    grade: number | null;
    courseSet: number | null;
  }
  const programRace = new Map<number, ProgramRace>();
  for (const p of db
    .prepare(
      `SELECT p.id, p.race_instance_id, p.reserve_program_id, ri.race_id, r.grade, r.course_set
       FROM single_mode_program p
       LEFT JOIN race_instance ri ON ri.id = p.race_instance_id
       LEFT JOIN race r ON r.id = ri.race_id`
    )
    .all()) {
    programRace.set(Number(p.id), {
      raceInstanceId: Number(p.race_instance_id),
      reserveProgramId: Number(p.reserve_program_id),
      raceId: p.race_id == null ? null : Number(p.race_id),
      grade: p.grade == null ? null : Number(p.grade),
      courseSet: p.course_set == null ? null : Number(p.course_set),
    });
  }
  const raceGroupMembers = new Map<number, number[]>();
  for (const g of db
    .prepare(
      `SELECT race_group_id, race_program_id FROM single_mode_race_group
       WHERE race_group_id IN (
         SELECT race_group_id FROM single_mode_race_group GROUP BY race_group_id HAVING COUNT(*) <= 8
       )`
    )
    .all()) {
    const groupId = Number(g.race_group_id);
    const list = raceGroupMembers.get(groupId) ?? [];
    list.push(Number(g.race_program_id));
    raceGroupMembers.set(groupId, list);
  }

  const objectives = db
    .prepare(
      `SELECT rt.chara_id, rr.condition_value_1, rr.condition_id
       FROM single_mode_route rt
       JOIN single_mode_route_race rr ON rr.race_set_id = rt.race_set_id
       WHERE rt.chara_id > 0`
    )
    .all() as { chara_id: number; condition_value_1: number; condition_id: number }[];

  // raceId -> saddleId; prefer the smallest saddle id when several share a race.
  const saddleByRaceId = new Map<number, number>();
  for (const [saddleStr, instance] of Object.entries(winSaddleToRaceInstance)) {
    const raceId = Math.floor(instance / 100);
    const saddleId = Number(saddleStr);
    const prev = saddleByRaceId.get(raceId);
    if (prev === undefined || saddleId < prev) saddleByRaceId.set(raceId, saddleId);
  }

  const careers: Record<string, CareerRace[]> = {};
  const seenRaceIdsByCharId = new Map<number, Set<number>>();
  let g1Total = 0;
  let g1Mapped = 0;
  const emitG1 = (
    charaId: number,
    placeReq: number,
    program: ProgramRace,
    raceName: string | null
  ) => {
    if (program.grade !== 100 || program.raceId == null) return;
    const seenRaceIds = seenRaceIdsByCharId.get(charaId) ?? new Set<number>();
    seenRaceIdsByCharId.set(charaId, seenRaceIds);
    const raceId = program.raceId;
    const races = careers[String(charaId)] ?? (careers[String(charaId)] = []);
    const existing = races.find((r) => r.raceId === raceId);
    if (existing) {
      // The same race can appear in several objectives (e.g. "3rd or better"
      // then later "win it") — keep the strictest requirement.
      if (placeReq === 1) existing.mustWin = true;
      return;
    }
    seenRaceIds.add(raceId);
    g1Total++;
    const course = program.courseSet != null ? courses.get(program.courseSet) : undefined;
    const saddleId = saddleByRaceId.get(raceId);
    if (saddleId != null) g1Mapped++;
    races.push({
      saddleId,
      raceId,
      nameEn: raceName || `Race ${raceId}`,
      grade: 100,
      trackId: course?.race_track_id ?? 0,
      distance: course?.distance ?? 0,
      terrain: course?.ground ?? 0,
      mustWin: placeReq === 1,
    });
  };

  for (const obj of objectives) {
    const conditionId = Number(obj.condition_id);
    const programIds = programRace.has(conditionId)
      ? [conditionId]
      : (raceGroupMembers.get(conditionId) ?? []);
    for (const programId of programIds) {
      const program = programRace.get(programId);
      if (!program) continue;
      const raceName = raceNameByInstanceId.get(program.raceInstanceId) ?? null;
      emitG1(Number(obj.chara_id), Number(obj.condition_value_1), program, raceName);
      if (program.reserveProgramId > 0) {
        const reserve = programRace.get(program.reserveProgramId);
        if (reserve) emitG1(Number(obj.chara_id), Number(obj.condition_value_1), reserve, null);
      }
    }
  }

  fs.writeFileSync(CAREERS_OUTPUT_PATH, JSON.stringify(careers));
  const careersStats = fs.statSync(CAREERS_OUTPUT_PATH);
  let withCareer = 0;
  let rosterTotal = 0;
  if (fs.existsSync(CHARACTERS_PATH)) {
    const chars = JSON.parse(fs.readFileSync(CHARACTERS_PATH, "utf-8"));
    const charIds: number[] = [
      ...new Set<number>((Array.isArray(chars) ? chars : chars.default).map((c: any) => c.charId as number)),
    ];
    rosterTotal = charIds.length;
    withCareer = charIds.filter((c) => careers[String(c)]?.length).length;
  }
  const careerCoverage =
    `Career data: ${Object.keys(careers).length} characters (${withCareer}/${rosterTotal} on roster)` +
    ` → ${CAREERS_OUTPUT_PATH} (${(careersStats.size / 1024).toFixed(1)} KB)` +
    `; G1 saddle mapping ${g1Mapped}/${g1Total}`;

  // Coverage report against the playable character roster
  let coverage = "";
  if (fs.existsSync(CHARACTERS_PATH)) {
    const chars = JSON.parse(fs.readFileSync(CHARACTERS_PATH, "utf-8"));
    const charIds: number[] = [
      ...new Set<number>((Array.isArray(chars) ? chars : chars.default).map((c: any) => c.charId as number)),
    ];
    const missing = charIds.filter((c) => !charaRelationTypes[c]?.length);
    coverage = `Relation coverage: ${charIds.length - missing.length}/${charIds.length} characters` +
      (missing.length ? ` (missing: ${missing.join(", ")})` : " (complete)");
  }

  // 8. Support card index -> lib/data/cards.json (mdb-first merge).
  //    Existing entries are preserved verbatim — names/type/urlName and the
  //    crawl fields (hints/eventSkills/eventDetails) are owned by
  //    crawl_gametora_cards.py. mdb contributes the index: new cards,
  //    rarity, release date and JP names (text_data cat 75/76/77).
  const cardName = (category: number): Map<number, string> => {
    const map = new Map<number, string>();
    for (const t of db
      .prepare('SELECT "index", text FROM text_data WHERE category = ?')
      .all(category)) {
      if (t.text) map.set(Number(t.index), String(t.text));
    }
    return map;
  };
  const cardFullJp = cardName(75); // "[variant] chara"
  const cardVariant = cardName(76); // "[variant]"
  const cardCharJp = cardName(77); // chara

  // Sparse English card names from hachimi (cat 4); strip the [variant] group
  // to keep the project-wide bracket-free nameEn convention.
  const hachimiCards: Record<string, string> =
    fs.existsSync(HACHIMI_PATH) ? (JSON.parse(fs.readFileSync(HACHIMI_PATH, "utf-8"))["4"] ?? {}) : {};
  const stripVariant = (s: string) => s.replace(/^\s*\[[^\]]*\]\s*/, "").trim();

  const existingCards: any[] = fs.existsSync(CARDS_PATH) ? JSON.parse(fs.readFileSync(CARDS_PATH, "utf-8")) : [];
  const existingById = new Map<number, any>(existingCards.map((c) => [Number(c.id), c]));

  const mdbCardRows = db
    .prepare("SELECT id, rarity, start_date FROM support_card_data")
    .all();
  for (const row of mdbCardRows) {
    const id = Number(row.id);
    if (existingById.has(id)) continue;
    const fullJp = cardFullJp.get(id) ?? "";
    const variant = cardVariant.get(id) ?? "";
    const charJp = cardCharJp.get(id) ?? "";
    const startDate = Number(row.start_date);
    const releaseJst =
      startDate > 0
        ? new Date((startDate + 9 * 3600) * 1000).toISOString().slice(0, 10)
        : null;
    const hachimiName = hachimiCards[String(id)]?.trim();
    existingById.set(id, {
      id,
      nameEn: stripVariant(hachimiName || variant) || charJp || fullJp,
      nameJp: fullJp,
      charName: charJp,
      titleEn: variant,
      titleJa: variant,
      rarity: Number(row.rarity),
      type: null,
      release: releaseJst,
      urlName: null,
      eventSkills: [],
      hintSkills: [],
      eventDetails: [],
    });
  }

  const mergedCards = [...existingById.values()].sort((a, b) => {
    if ((b.rarity ?? 0) !== (a.rarity ?? 0)) return (b.rarity ?? 0) - (a.rarity ?? 0);
    const relA = a.release || "";
    const relB = b.release || "";
    if (relB !== relA) return relB.localeCompare(relA);
    return b.id - a.id;
  });
  fs.writeFileSync(CARDS_PATH, JSON.stringify(mergedCards));
  const addedCards = mergedCards.length - existingCards.length;
  console.log(
    `Card index: ${mergedCards.length} cards (+${addedCards} new from mdb) → ${CARDS_PATH}`
  );

  const payload = {
    relationPoints,
    charaRelationTypes,
    g1Saddles,
    winSaddleToRaceInstance,
    factorNames,
    saddleNames,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload));
  const stats = fs.statSync(OUTPUT_PATH);
  console.log(`Successfully generated ${OUTPUT_PATH} (${(stats.size / 1024).toFixed(1)} KB)`);
  console.log(`Factor names: ${Object.keys(factorNames).length} (JP from mdb, +${gtFactorNames} EN from GameTora)`);
  if (coverage) console.log(coverage);
  if (careerCoverage) console.log(careerCoverage);
}

extractAffinityData();
