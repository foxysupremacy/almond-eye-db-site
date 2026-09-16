import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const ROOT_DIR = path.resolve(import.meta.dirname, "../..");
const HAKURAKU_GAMEDATA = path.join(ROOT_DIR, "hakuraku/public/data/gamedata.bin.gz");
const OUTPUT_FILE = path.resolve(import.meta.dirname, "../lib/data/course-shapes.json");
const RACETRACKS_FILE = path.resolve(import.meta.dirname, "../lib/data/racetracks.json");

export interface CompactShapeEntry {
  distance: number;
  baseRatio: number;
  points: [number, number][];
}

export type CourseShapesMap = Record<string, CompactShapeEntry>;

function main() {
  console.log("Reading Hakuraku gamedata from:", HAKURAKU_GAMEDATA);
  const compressedBuffer = fs.readFileSync(HAKURAKU_GAMEDATA);
  const decompressedString = zlib.gunzipSync(compressedBuffer).toString("utf-8");
  const gamedata = JSON.parse(decompressedString);

  const shapes = gamedata["tracks/course_shapes"] as Record<string, any>;
  const baseRatios = gamedata["tracks/course_base_ratios"] as Record<string, number>;

  if (!shapes) {
    throw new Error("tracks/course_shapes not found in gamedata.bin.gz");
  }

  const output: CourseShapesMap = {};

  for (const [courseId, entry] of Object.entries(shapes)) {
    const rawPoints = (entry.points ?? []) as [number, number][];
    const roundedPoints: [number, number][] = rawPoints.map(([x, z]) => [
      Math.round(x * 100) / 100,
      Math.round(z * 100) / 100,
    ]);

    const ratio = typeof baseRatios?.[courseId] === "number"
      ? Math.round(baseRatios[courseId] * 10000) / 10000
      : 1.0;

    output[courseId] = {
      distance: entry.distance,
      baseRatio: ratio,
      points: roundedPoints,
    };
  }

  console.log(`Processed ${Object.keys(output).length} course shapes.`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output), "utf-8");
  const stat = fs.statSync(OUTPUT_FILE);
  console.log(`Written to ${OUTPUT_FILE} (${Math.round(stat.size / 1024)} KB).`);

  // Update racetracks.json with official names for overseas tracks if missing
  if (fs.existsSync(RACETRACKS_FILE)) {
    const racetracks = JSON.parse(fs.readFileSync(RACETRACKS_FILE, "utf-8")) as any[];
    let updated = false;

    for (const track of racetracks) {
      if (track.id === 10201 && (!track.name || track.name[1] !== "Longchamp")) {
        track.name = ["ロンシャン", "Longchamp"];
        updated = true;
      } else if (track.id === 10202 && (!track.name || track.name[1] !== "Santa Anita Park")) {
        track.name = ["サンタアニタ", "Santa Anita Park"];
        updated = true;
      } else if (track.id === 10203 && (!track.name || track.name[1] !== "Del Mar")) {
        track.name = ["デルマー", "Del Mar"];
        updated = true;
      }
    }

    if (updated) {
      fs.writeFileSync(RACETRACKS_FILE, JSON.stringify(racetracks), "utf-8");
      console.log("Updated overseas track names in racetracks.json.");
    }
  }
}

main();
