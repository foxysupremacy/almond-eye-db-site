// Per-course flags from master.mdb race_course_set merged into lib/data/generated/racetracks.json
// (engine step 4b). Called from extract-mdb.ts (build:data, after generate-data.ts wrote racetracks.json) and
// runnable on its own as a targeted refresh:
//
//   UMAMUSUME_MDB_PATH=... node --experimental-strip-types scripts/extract-course-flags.ts
//
// MERGE: every other course field is left exactly as generate-data.ts wrote it. Per course row:
//   - tightTrack: race_course_set.tight_track (0 / 1), read by the `is_tight_track` skill condition;
//   - runUp: race_course_set.run_up in metres, only written when > 0 (the start run-up, Santa Anita / Del Mar).
// Courses missing from the mdb keep no flag.
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACETRACKS_PATH = path.resolve(__dirname, "../lib/data/generated/racetracks.json");

type Row = Record<string, unknown>;

/** Course row with the two flags placed right after positionKeepEnd (stable key order). */
export function withCourseFlags(course: Row, flags: { tightTrack: number; runUp: number } | undefined): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(course)) {
    if (key === "tightTrack" || key === "runUp") continue;
    if (key === "data" && flags) {
      out.tightTrack = flags.tightTrack ? 1 : 0;
      if (flags.runUp > 0) out.runUp = flags.runUp;
    }
    out[key] = value;
  }
  return out;
}

export function patchRacetrackCourseFlags(db: DatabaseSync): void {
  const flags = new Map<number, { tightTrack: number; runUp: number }>();
  for (const r of db.prepare("SELECT id, tight_track, run_up FROM race_course_set").all() as Row[]) {
    flags.set(Number(r.id), { tightTrack: Number(r.tight_track), runUp: Number(r.run_up) });
  }
  const raw = fs.readFileSync(RACETRACKS_PATH, "utf8");
  const tracks = JSON.parse(raw) as { courses: Row[] }[];
  let tight = 0, runUp = 0, missing = 0;
  for (const track of tracks) {
    track.courses = track.courses.map((course) => {
      const f = flags.get(Number(course.id));
      if (!f) missing++;
      else { if (f.tightTrack) tight++; if (f.runUp > 0) runUp++; }
      return withCourseFlags(course, f);
    });
  }
  fs.writeFileSync(RACETRACKS_PATH, JSON.stringify(tracks) + (raw.endsWith("\n") ? "\n" : ""));
  console.log(`Course flags: ${tight} tight tracks, ${runUp} run-ups, ${missing} courses not in the mdb → ${RACETRACKS_PATH}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadEnv();
  const mdbPath = process.env.UMAMUSUME_MDB_PATH;
  if (!mdbPath) throw new Error("Set UMAMUSUME_MDB_PATH to the game's master.mdb");
  const db = new DatabaseSync(mdbPath, { readOnly: true });
  patchRacetrackCourseFlags(db);
  db.close();
}
