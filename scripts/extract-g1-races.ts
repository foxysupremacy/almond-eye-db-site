// Builds lib/data/generated/g1-races.json (Custom-map G1 quick picks).
//
// 1. GameTora races dataset, lib/data/source/gametora/races.json
//    (refresh with `bun run fetch:gametora`): course, season and time of day
//    taken as published. Kept: grade-100 races with a real season
//    (1 Spring … 5 Cherry blossom) on a course this site ships. Season 0 rows
//    are event-only copies; rows repeating another race's name, course and
//    season (scenario copies) keep the first.
// 2. master.mdb ($UMAMUSUME_MDB_PATH) extras GameTora lacks: the Breeders' Cup
//    G1s (text_data cat 32 names "BC…"). Course from race.course_set, time from
//    race_instance.time, season from the race_instance.date month.

import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "url";
import { loadEnv } from "./env.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(root, "lib/data/source/gametora/races.json");
const TRACKS = path.join(root, "lib/data/generated/racetracks.json");
const OUTPUT = path.join(root, "lib/data/generated/g1-races.json");

interface G1Race {
  id: number;
  raceId: number;
  nameEn: string;
  nameJa: string;
  trackId: number;
  courseId: number;
  distance: number;
  terrain: number;
  season: number;
  time: number;
}

interface GametoraRace {
  id: number;
  race_id: number;
  name_en: string;
  name_ja: string;
  grade: number;
  track: number;
  course_id: number;
  distance: number;
  terrain: number;
  season: number;
  time: number;
}

// master.mdb only carries Japanese names.
const BC_NAMES_EN: Record<string, string> = {
  "BCターフスプリント": "BC Turf Sprint",
  "BCマイル": "BC Mile",
  "BCフィリー＆メアターフ": "BC Filly & Mare Turf",
  "BCターフ": "BC Turf",
  "BCスプリント": "BC Sprint",
  "BCフィリー&メアスプリント": "BC Filly & Mare Sprint",
  "BCダートマイル": "BC Dirt Mile",
  "BCディスタフ": "BC Distaff",
  "BCクラシック": "BC Classic",
};

/** Calendar month → season index (1 Spring … 4 Winter). */
function seasonOfMonth(month: number): number {
  if (month >= 3 && month <= 5) return 1;
  if (month >= 6 && month <= 8) return 2;
  if (month >= 9 && month <= 11) return 3;
  return 4;
}

function gametoraRaces(): G1Race[] {
  const races = JSON.parse(fs.readFileSync(SOURCE, "utf8")) as GametoraRace[];
  return races
    .filter((race) => race.grade === 100 && race.season >= 1 && race.season <= 5 && race.time >= 1 && race.time <= 4)
    .map((race) => ({
      id: race.id,
      raceId: race.race_id,
      nameEn: race.name_en,
      nameJa: race.name_ja,
      trackId: race.track,
      courseId: race.course_id,
      distance: race.distance,
      terrain: race.terrain,
      season: race.season,
      time: race.time,
    }));
}

function mdbBreedersCupRaces(): G1Race[] {
  loadEnv();
  const mdbPath = process.env.UMAMUSUME_MDB_PATH;
  if (!mdbPath || !fs.existsSync(mdbPath)) throw new Error("Set UMAMUSUME_MDB_PATH to master.mdb before extracting G1 races");
  const db = new DatabaseSync(mdbPath, { readOnly: true });
  const rows = db.prepare(`
    SELECT ri.id AS id, r.id AS raceId, t.text AS nameJa, rcs.race_track_id AS trackId, rcs.id AS courseId,
           rcs.distance AS distance, rcs.ground AS terrain, ri.date AS date, ri.time AS time
    FROM race r
    JOIN text_data t ON t.category = 32 AND t."index" = r.id
    JOIN race_course_set rcs ON rcs.id = r.course_set
    JOIN race_instance ri ON ri.race_id = r.id
    WHERE r.grade = 100 AND t.text LIKE 'BC%'
    ORDER BY ri.id
  `).all() as unknown as (Omit<G1Race, "nameEn" | "season"> & { date: number })[];
  db.close();
  return rows.map(({ date, ...row }) => {
    const nameEn = BC_NAMES_EN[row.nameJa];
    if (!nameEn) throw new Error(`No English name for Breeders' Cup race ${row.raceId} ${row.nameJa}`);
    return { ...row, nameEn, season: seasonOfMonth(Math.floor(date / 100)) };
  });
}

const tracks = JSON.parse(fs.readFileSync(TRACKS, "utf8")) as { id: number; courses: { id: number }[] }[];
const courseIds = new Set(tracks.flatMap((track) => track.courses.map((course) => course.id)));

/** Keep one race per name, course and season — the first in `order`. */
function dedupe(races: G1Race[], order: (a: G1Race, b: G1Race) => number): G1Race[] {
  const seen = new Set<string>();
  return [...races].sort(order).filter((race) => {
    const key = `${race.nameJa}|${race.courseId}|${race.season}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// GameTora: the base program (lowest id) wins. mdb: the regular Breeders' Cup
// series (highest race id) wins over story-race copies such as race 18043.
const out = [
  ...dedupe(gametoraRaces(), (a, b) => a.id - b.id),
  ...dedupe(mdbBreedersCupRaces(), (a, b) => b.raceId - a.raceId).sort((a, b) => a.id - b.id),
].filter((race) => courseIds.has(race.courseId));

fs.writeFileSync(OUTPUT, JSON.stringify(out));
console.log(`g1-races: ${out.length} races → ${OUTPUT}`);
