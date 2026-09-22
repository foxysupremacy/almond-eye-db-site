/**
 * Build the tiny client-side race-impact prior table from local replay exports.
 *
 * The binary decoder below is a focused MIT-licensed adaptation of hakuraku's
 * RaceDataParser (https://github.com/sshz-org/hakuraku). It intentionally reads
 * only the stable global replay layout needed for SKILL events; raw replays are
 * never copied into lib/data or shipped to the browser.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

type DynamicKey = "blocked" | "overtake" | "nearby" | "surrounded" | "activate_count" | "other_skill" | "visibility";
type Prior = { key: DynamicKey; courseId?: number; groundCondition?: number; runningStyle?: number; racerCount?: number; opportunities: number; activations: number };
type Event = { type: number; params: number[] };
type Frame = { distances: number[]; blocked: number[] };

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE = path.resolve(SITE_ROOT, "..", "raceData");
const sourceDir = path.resolve(process.env.RACE_DATA_DIR || DEFAULT_SOURCE);
const outputPath = path.join(SITE_ROOT, "lib", "data", "race-impact-priors.json");

const patterns: Array<[DynamicKey, RegExp]> = [
  ["blocked", /blocked|is_blocked|block_front/i], ["overtake", /overtake|is_overtake/i],
  ["nearby", /near_count|nearby|near_/i], ["surrounded", /surrounded|surround/i],
  ["activate_count", /(?:^|[&_])activate_count(?:[<>=]|$)|is_activate_count/i],
  ["other_skill", /is_activate_other_skill_detail/i], ["visibility", /visible|vision/i],
];

function readSkillEvents(base64: string): Event[] {
  const bytes = zlib.gunzipSync(Buffer.from(base64, "base64"));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const readable = (offset: number, length: number) => offset >= 0 && offset + length <= view.byteLength;
  if (!readable(0, 8)) throw new Error("Replay header is truncated");
  const headerLength = view.getInt32(0, true);
  let offset = 4 + headerLength;
  if (!readable(offset, 16)) throw new Error("Replay race struct is truncated");
  const horseNum = view.getInt32(offset + 4, true);
  const horseFrameSize = view.getInt32(offset + 8, true);
  const horseResultSize = view.getInt32(offset + 12, true);
  if (horseNum < 1 || horseNum > 18 || horseFrameSize < 8 || horseResultSize < 20) return readJpSkillEvents(view, horseNum);
  offset += 16;
  if (!readable(offset, 4)) throw new Error("Replay padding is truncated");
  const padding1 = view.getInt32(offset, true); offset += 4 + padding1;
  if (!readable(offset, 8)) throw new Error("Replay frame header is truncated");
  const frameCount = view.getInt32(offset, true); const frameSize = view.getInt32(offset + 4, true); offset += 8 + frameCount * frameSize;
  if (!readable(offset, 4)) throw new Error("Replay frame padding is truncated");
  const padding2 = view.getInt32(offset, true); offset += 4 + padding2 + horseNum * horseResultSize;
  if (!readable(offset, 4)) throw new Error("Replay result padding is truncated");
  const padding3 = view.getInt32(offset, true); offset += 4 + padding3;
  if (!readable(offset, 4)) throw new Error("Replay event count is truncated");
  const eventCount = view.getInt32(offset, true); offset += 4;
  const events: Event[] = [];
  for (let index = 0; index < eventCount; index++) {
    if (!readable(offset, 2)) break;
    const size = view.getInt16(offset, true); offset += 2;
    if (size < 6 || !readable(offset, size)) break;
    const type = view.getInt8(offset + 4); const paramCount = view.getInt8(offset + 5);
    const params: number[] = [];
    for (let parameter = 0; parameter < paramCount && 6 + parameter * 4 + 4 <= size; parameter++) params.push(view.getInt32(offset + 6 + parameter * 4, true));
    if (type === 3 && params.length >= 2) events.push({ type, params });
    offset += size;
  }
  return events;
}

function readFrameTelemetry(base64: string): Frame[] {
  const bytes = zlib.gunzipSync(Buffer.from(base64, "base64"));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerLength = view.getInt32(0, true);
  const offset = 4 + headerLength;
  const horseNum = view.getInt32(offset + 4, true);
  const frameSize = 4 + horseNum * 12;
  const valid = (start: number) => {
    if (start < 0 || start + frameSize > view.byteLength) return false;
    const time = view.getFloat32(start, true);
    if (time < 0 || time > 200) return false;
    for (let horse = 0; horse < horseNum; horse++) {
      const cursor = start + 4 + horse * 12;
      const distance = view.getFloat32(cursor, true);
      if (distance < 0 || distance > 10_000 || view.getUint16(cursor + 4, true) > 20_000 || view.getUint16(cursor + 6, true) > 10_000 || view.getUint16(cursor + 8, true) > 6_000) return false;
    }
    return true;
  };
  let start = 32;
  while (!valid(start) && start + frameSize <= view.byteLength) start += 4;
  const frames: Frame[] = [];
  let lastTime = -1;
  while (valid(start)) {
    const time = view.getFloat32(start, true);
    if (time <= lastTime) break;
    lastTime = time;
    const distances: number[] = [];
    const blocked: number[] = [];
    for (let horse = 0; horse < horseNum; horse++) {
      const cursor = start + 4 + horse * 12;
      distances.push(view.getFloat32(cursor, true));
      blocked.push(view.getInt8(cursor + 11));
    }
    frames.push({ distances, blocked });
    start += frameSize;
  }
  if (!frames.length) throw new Error("No readable telemetry frames");
  return frames;
}

function frameProbability(key: DynamicKey, frames: Frame[], horseIndex: number, hasOtherSkillEvent: boolean): number | undefined {
  if (!frames.length) return undefined;
  if (key === "other_skill" || key === "activate_count") return hasOtherSkillEvent ? 1 : undefined;
  let matches = 0;
  let previousRank: number | null = null;
  for (const frame of frames) {
    const distance = frame.distances[horseIndex];
    const nearby = frame.distances.filter((other, index) => index !== horseIndex && Math.abs(other - distance) <= 5);
    if (key === "blocked") matches += Number(frame.blocked[horseIndex] >= 0);
    else if (key === "nearby") matches += Number(nearby.length > 0);
    else if (key === "surrounded") matches += Number(frame.distances.some((other) => other > distance && other - distance <= 5) && frame.distances.some((other) => other < distance && distance - other <= 5));
    else if (key === "visibility") matches += Number(nearby.length < frame.distances.length - 1);
    else if (key === "overtake") {
      const rank = 1 + frame.distances.filter((other) => other > distance).length;
      matches += Number(previousRank !== null && rank < previousRank);
      previousRank = rank;
    }
  }
  return matches / frames.length;
}

/** Japanese replay fallback: adapted from hakuraku's MIT RaceDataParser. */
function readJpSkillEvents(view: DataView, horseNum: number): Event[] {
  const frameSize = 4 + horseNum * 12;
  const inBounds = (offset: number, size: number) => offset >= 0 && offset + size <= view.byteLength;
  const validFrame = (offset: number) => {
    if (!inBounds(offset, frameSize)) return false;
    const time = view.getFloat32(offset, true);
    if (time < 0 || time > 200) return false;
    for (let horse = 0; horse < horseNum; horse++) {
      const start = offset + 4 + horse * 12;
      const distance = view.getFloat32(start, true);
      if (distance < 0 || distance > 10_000 || view.getUint16(start + 4, true) > 20_000 || view.getUint16(start + 6, true) > 10_000 || view.getUint16(start + 8, true) > 6_000) return false;
    }
    return true;
  };
  const findStart = (start: number, lastTime: number) => {
    for (let offset = start; offset <= view.byteLength - frameSize; offset += 4) {
      if (!validFrame(offset)) continue;
      const time = view.getFloat32(offset, true);
      if (time <= lastTime) continue;
      if (validFrame(offset + frameSize) || offset - frameSize < start) return offset;
    }
    return null;
  };
  let cursor = validFrame(32) ? 32 : findStart(32, -1);
  let lastTime = -1;
  let frames = 0;
  while (cursor !== null) {
    let read = 0;
    while (validFrame(cursor)) {
      const time = view.getFloat32(cursor, true);
      if (time <= lastTime) break;
      lastTime = time; frames++; read++; cursor += frameSize;
    }
    if (!read) break;
    cursor = findStart(cursor, lastTime);
  }
  const postFrameOffset = 32 + frames * frameSize;
  const readHorseResult = (offset: number) => {
    if (!inBounds(offset, 39)) return null;
    const order = view.getInt32(offset, true);
    const inactive = view.getInt32(offset + 35, true);
    if (order < 1 || order > horseNum || inactive < 0 || inactive > 512) return null;
    return offset + 39 + inactive * 5;
  };
  let resultsEnd: number | null = null;
  for (let start = postFrameOffset + 12; start < Math.min(postFrameOffset + 140, view.byteLength); start += 4) {
    let offset = start; let valid = true; const orders = new Set<number>();
    for (let horse = 0; horse < horseNum; horse++) {
      const next = readHorseResult(offset);
      if (next === null) { valid = false; break; }
      orders.add(view.getInt32(offset, true)); offset = next;
    }
    if (valid && orders.size === horseNum) { resultsEnd = offset; break; }
  }
  if (resultsEnd === null || !inBounds(resultsEnd, 10)) throw new Error("Unsupported JP replay event layout");
  const eventCount = view.getInt32(resultsEnd + 4, true);
  if (eventCount < 0 || eventCount > 5_000) throw new Error("Invalid JP event count");
  let best: Event[] = [];
  for (let padding = 0; padding <= 8; padding++) {
    const events: Event[] = []; let offset = resultsEnd + 10 + padding;
    for (let index = 0; index < eventCount && inBounds(offset, 9); index++) {
      const time = view.getFloat32(offset, true); const type = view.getUint8(offset + 4); const count = view.getUint8(offset + 5);
      if (time < 0 || time > 1_000 || count > 64 || !inBounds(offset + 6, count * 4 + 3)) break;
      const params: number[] = [];
      for (let parameter = 0; parameter < count; parameter++) params.push(view.getInt32(offset + 6 + parameter * 4, true));
      if (type === 3 && params.length >= 2) events.push({ type, params });
      offset += 6 + count * 4 + 3;
    }
    if (events.length > best.length) best = events;
  }
  return best;
}

function keysForSkill(skill: any): DynamicKey[] {
  const text = (skill.conditionGroups ?? []).map((group: any) => `${group.condition ?? ""}&${group.precondition ?? ""}`).join("&");
  return patterns.filter(([, pattern]) => pattern.test(text)).map(([key]) => key);
}

function resolveCourseId(replay: any, courses: any[]): number | undefined {
  const set = replay.raceCourseSet;
  const matches = courses.filter((course) => course.trackId === replay.raceTrack?.id && course.length === set?.distance && course.terrain === set?.ground && course.inout === set?.inout);
  return matches[0]?.id;
}

if (!fs.existsSync(sourceDir)) {
  console.error(`raceData directory not found: ${sourceDir}`);
  process.exit(1);
}
const skills = JSON.parse(fs.readFileSync(path.join(SITE_ROOT, "lib", "data", "skills.json"), "utf8"));
const skillById = new Map(skills.map((skill: any) => [Number(skill.id), skill]));
const tracks = JSON.parse(fs.readFileSync(path.join(SITE_ROOT, "lib", "data", "racetracks.json"), "utf8"));
const courses = tracks.flatMap((track: any) => track.courses ?? []);
const aggregates = new Map<string, Prior>();
let decodedFiles = 0;

for (const entry of fs.readdirSync(sourceDir).filter((name) => name.endsWith(".json"))) {
  try {
    const replay = JSON.parse(fs.readFileSync(path.join(sourceDir, entry), "utf8"));
    if (typeof replay.simDataBase64 !== "string") continue;
    const frames = readFrameTelemetry(replay.simDataBase64);
    let events: Event[] = [];
    try { events = readSkillEvents(replay.simDataBase64); } catch { /* frame telemetry remains usable */ }
    const courseId = resolveCourseId(replay, courses);
    const horses = replay.raceHorse ?? [];
    for (let horseIndex = 0; horseIndex < horses.length; horseIndex++) {
      const horse = horses[horseIndex]?.responseHorseData;
      if (!horse) continue;
      const style = Number(horse.running_style) || undefined;
      const skillIds = (horse.skill_array ?? []).map((skill: any) => Number(skill.skill_id)).filter(Number.isFinite);
      const activated = new Set(events.filter((event) => event.params[0] === horseIndex).map((event) => event.params[1]));
      for (const skillId of skillIds) {
        const skill = skillById.get(skillId);
        if (!skill) continue;
        for (const key of keysForSkill(skill)) {
          const observedRate = frameProbability(key, frames, horseIndex, activated.size > 0);
          if (observedRate === undefined) continue;
          for (const trackSpecific of [true, false]) {
            const prior: Prior = { key, courseId: trackSpecific ? courseId : undefined, runningStyle: style, racerCount: Number(replay.numRaceHorses) || horses.length, opportunities: 0, activations: 0 };
            const aggregateKey = `${key}:${prior.courseId ?? "global"}:${prior.runningStyle ?? "all"}:${prior.racerCount ?? "all"}`;
            const aggregate = aggregates.get(aggregateKey) ?? prior;
            aggregate.opportunities += frames.length;
            aggregate.activations += Math.round(observedRate * frames.length);
            aggregates.set(aggregateKey, aggregate);
          }
        }
      }
    }
    decodedFiles++;
  } catch (error) {
    console.warn(`Skipped ${entry}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const payload = { version: 1, generatedAt: new Date().toISOString(), priors: [...aggregates.values()].sort((a, b) => a.key.localeCompare(b.key) || (a.courseId ?? 0) - (b.courseId ?? 0)) };
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Decoded ${decodedFiles} replay(s); wrote ${payload.priors.length} race-impact priors to ${outputPath}`);
