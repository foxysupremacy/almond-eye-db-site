// Export the ordinary domestic training calendar separately from career objectives.
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.ts";

export function extractG1Calendar(db: DatabaseSync) {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const careerNames = new Map<number, string>();
  const careerData = JSON.parse(fs.readFileSync(path.resolve(directory, "../lib/data/generated/careers.json"), "utf8")) as Record<string, { raceId: number; nameEn: string }[]>;
  for (const races of Object.values(careerData)) for (const race of races) careerNames.set(race.raceId, race.nameEn);
  const defaults = new Set((db.prepare("SELECT program_group FROM single_mode_chara_program WHERE chara_id=0").all() as { program_group: number }[]).map((row) => row.program_group));
  const programs = db.prepare(`SELECT p.id AS programId, p.base_program_id AS baseProgramId,
    p.program_group AS programGroup, p.race_permission AS permission, p.month, p.half,
    p.need_fan_count AS needFans, p.filly_only_flag AS fillyOnly, ri.id AS instanceId,
    ri.race_id AS raceId, c.race_track_id AS trackId, c.distance, c.ground AS terrain,
    t.text AS nameJp
    FROM single_mode_program p JOIN race_instance ri ON ri.id=p.race_instance_id
    JOIN race r ON r.id=ri.race_id JOIN race_course_set c ON c.id=r.course_set
    LEFT JOIN text_data t ON t.category=28 AND t."index"=p.race_instance_id
    WHERE r.grade=100 AND p.race_permission BETWEEN 1 AND 4
      AND ri.race_id BETWEEN 1000 AND 8999 ORDER BY p.id`).all() as Record<string, number | string>[];
  const saddles = new Map<number, number>();
  for (const row of db.prepare("SELECT * FROM single_mode_wins_saddle").all()) {
    for (let i = 1; i <= 8; i++) {
      const instance = Number(row[`race_instance_id_${i}`]);
      if (instance > 0 && !saddles.has(instance)) saddles.set(instance, Number(row.id));
    }
  }
  const races = programs.map(({ programGroup, instanceId, permission, fillyOnly, ...row }) => ({
    ...row, nameEn: careerNames.get(Number(row.raceId)) ?? row.nameJp, grade: 100, saddleId: saddles.get(Number(instanceId)),
    defaultProgram: programGroup === 0 || defaults.has(Number(programGroup)),
    years: permission === 1 ? [1] : permission === 2 ? [2] : permission === 3 ? [2, 3] : [3],
    fillyOnly: Boolean(fillyOnly),
  }));
  const raceGroups = new Map<number, number[]>();
  for (const row of db.prepare("SELECT race_group_id,race_program_id FROM single_mode_race_group").all()) {
    const group = Number(row.race_group_id);
    raceGroups.set(group, [...(raceGroups.get(group) ?? []), Number(row.race_program_id)]);
  }
  const objectivesByCharId: Record<string, { turn: number; programIds: number[] }[]> = {};
  const programIds = new Set(db.prepare("SELECT id FROM single_mode_program").all().map((row) => Number(row.id)));
  for (const row of db.prepare(`SELECT rt.chara_id,rr.turn,rr.condition_id
    FROM single_mode_route rt JOIN single_mode_route_race rr ON rr.race_set_id=rt.race_set_id
    WHERE rt.scenario_id=0 AND rt.chara_id>0 AND rr.condition_type=1 AND rr.turn BETWEEN 1 AND 72
    ORDER BY rt.chara_id,rr.sort_id`).all()) {
    const key = String(row.chara_id);
    const group = raceGroups.get(Number(row.condition_id));
    // Large groups are scenario finals, not a fixed calendar objective.
    const objectiveIds = programIds.has(Number(row.condition_id)) ? [Number(row.condition_id)] : group && group.length <= 8 ? group : [];
    if (objectiveIds.length) (objectivesByCharId[key] ??= []).push({ turn: Number(row.turn), programIds: objectiveIds });
  }
  const output = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../lib/data/generated/g1-calendar.json");
  fs.writeFileSync(output, JSON.stringify({ races, objectivesByCharId }));
  console.log(`G1 calendar: ${races.length} ordinary program variants exported`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadEnv();
  if (!process.env.UMAMUSUME_MDB_PATH) throw new Error("Set UMAMUSUME_MDB_PATH before extracting the G1 calendar");
  const db = new DatabaseSync(process.env.UMAMUSUME_MDB_PATH, { readOnly: true });
  try { extractG1Calendar(db); } finally { db.close(); }
}
