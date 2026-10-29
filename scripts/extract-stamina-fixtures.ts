/**
 * Stamina simulator validation fixture (Task 7).
 *
 * Usage: bun scripts/extract-stamina-fixtures.ts "<dir of saved races>" lib/stamina-sim/fixtures/kyoto-2200.json
 *
 * Reads the owner's saved race exports (one JSON per race, all on one course set) and writes, per horse, the inputs
 * the simulator needs plus the real HP curve decoded from `simDataBase64`. The raw files carry trainer and uma names;
 * the fixture keeps no names, no ids and no skill lists. Raw files never enter the repo.
 *
 * simDataBase64 = gzip; header int32 LE horseNum @12, horseFrameSize @16, frameCount @24, frameSize @28; frames from
 * byte 32: float32 time, then per horse float32 distance, uint16 lane, uint16 speed x100, uint16 HP, int8 temptation,
 * int8 block. Frames are not evenly spaced (dense at the start, ~1 s apart later), so HP is interpolated by distance.
 */
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

type Letter = "S" | "A" | "B" | "C" | "D" | "E" | "F" | "G";
/** Game aptitude numbers 1 = G .. 8 = S. */
const LETTERS: Letter[] = ["G", "F", "E", "D", "C", "B", "A", "S"];
const STYLE_APTITUDE_KEYS = ["", "proper_running_style_nige", "proper_running_style_senko", "proper_running_style_sashi", "proper_running_style_oikomi"];
/** Ground condition names in the exports are the game's internal enum: Good 良 1, Soft 稍重 2, Hard 重 3, Bad 不良 4 (ruling R9). */
const GROUND_CONDITION: Record<string, number> = { Good: 1, Soft: 2, Hard: 3, Bad: 4 };

/**
 * Section boundaries sampled (k x L/24): every other one, plus every one across sections 11-16 (compete before
 * spurt, up to the late-race start at 2L/3 = boundary 16). Keeps the fixture small.
 */
const SECTION_BOUNDARIES = [0, 2, 4, 6, 8, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24];

interface Frame { t: number; meter: number; speed: number; hp: number; temptation: number; block: number }

export interface FixtureHorse {
  raw: { speed: number; stamina: number; power: number; guts: number; wisdom: number };
  motivationCoef: number;
  style: 1 | 2 | 3 | 4 | 5;
  styleEx: string;
  aptitude: { ground: Letter; distance: Letter; style: Letter };
  frame0Hp: number;
  /** [meter, HP] at 50/100/150/200 m and the SECTION_BOUNDARIES; HP interpolated by distance. */
  hpAtMeters: [number, number][];
  firstHealMeter: number | null;
  rushedSpans: [number, number][];
  /**
   * Extras for the calibration report: every heal meter, HP at the finish frame, first meter HP hit 0, and the median
   * unblocked speed from 300 m after the late-race start to the goal.
   */
  healMeters: number[];
  finalHp: number;
  zeroHpMeter: number | null;
  lateSpeedMedian: number | null;
}

function decodeFrames(simDataBase64: string): Frame[][] {
  const buf = gunzipSync(Buffer.from(simDataBase64, "base64"));
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const horseNum = dv.getInt32(12, true), horseFrameSize = dv.getInt32(16, true);
  const frameCount = dv.getInt32(24, true), frameSize = dv.getInt32(28, true);
  const out: Frame[][] = Array.from({ length: horseNum }, () => []);
  for (let f = 0; f < frameCount; f++) {
    const base = 32 + f * frameSize;
    const t = dv.getFloat32(base, true);
    for (let h = 0; h < horseNum; h++) {
      const o = base + 4 + h * horseFrameSize;
      out[h].push({
        t, meter: dv.getFloat32(o, true), speed: dv.getUint16(o + 6, true) / 100, hp: dv.getUint16(o + 8, true),
        temptation: dv.getInt8(o + 10), block: dv.getInt8(o + 11),
      });
    }
  }
  return out;
}

function hpAt(frames: Frame[], meter: number): number {
  if (meter <= frames[0].meter) return frames[0].hp;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    if (b.meter >= meter) return b.meter === a.meter ? b.hp : a.hp + ((b.hp - a.hp) * (meter - a.meter)) / (b.meter - a.meter);
  }
  return frames[frames.length - 1].hp;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function horseOf(h: any, frames: Frame[], L: number, lateStart: number): FixtureHorse {
  const p = h.raceParam, r = h.responseHorseData;
  const baseStyle = r.running_style as 1 | 2 | 3 | 4;
  const style = h.runningStyleEx === "Oonige" ? 5 : baseStyle;
  const meters = [50, 100, 150, 200, ...SECTION_BOUNDARIES.map((k) => (k * L) / 24)].sort((a, b) => a - b);
  // A heal shows as HP rising between two frames; it landed after the earlier frame's meter.
  const healMeters: number[] = [];
  for (let i = 1; i < frames.length; i++) if (frames[i].hp > frames[i - 1].hp) healMeters.push(round1(frames[i - 1].meter));
  const rushedSpans: [number, number][] = [];
  let open: number | null = null;
  for (const f of frames) {
    if (f.temptation !== 0 && open === null) open = f.meter;
    else if (f.temptation === 0 && open !== null) { rushedSpans.push([round1(open), round1(f.meter)]); open = null; }
  }
  if (open !== null) rushedSpans.push([round1(open), round1(frames[frames.length - 1].meter)]);
  const zero = frames.find((f) => f.hp === 0 && f.meter > 0);
  const late = frames.filter((f) => f.meter >= lateStart + 300 && f.meter <= L && f.block < 0).map((f) => f.speed);
  return {
    raw: { speed: p.rawSpeed, stamina: p.rawStamina, power: p.rawPow, guts: p.rawGuts, wisdom: p.rawWiz },
    motivationCoef: Math.round(p.motivationCoef * 100) / 100,
    style,
    styleEx: h.runningStyleEx,
    aptitude: { ground: h.activeProperGroundType, distance: h.activeProperDistance, style: LETTERS[r[STYLE_APTITUDE_KEYS[baseStyle]] - 1] },
    frame0Hp: frames[0].hp,
    hpAtMeters: meters.map((m) => [round1(m), Math.round(hpAt(frames, m))]),
    firstHealMeter: healMeters[0] ?? null,
    rushedSpans,
    healMeters,
    finalHp: frames[frames.length - 1].hp,
    zeroHpMeter: zero ? round1(zero.meter) : null,
    lateSpeedMedian: median(late),
  };
}

function round1(x: number): number { return Math.round(x * 10) / 10; }

function main(): void {
  const [dir, outPath] = process.argv.slice(2);
  if (!dir || !outPath) throw new Error("usage: bun scripts/extract-stamina-fixtures.ts <dir> <out.json>");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  let courseSetId = 0, groundCondition = 0;
  const horses: FixtureHorse[] = [];
  for (const file of files) {
    const race = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    const set = race.raceCourseSet.id as number;
    const ground = GROUND_CONDITION[race.groundCondition];
    if (!ground) throw new Error(`${file}: unmapped ground condition ${race.groundCondition}`);
    if (courseSetId && (set !== courseSetId || ground !== groundCondition)) throw new Error(`${file}: mixed course set or ground`);
    courseSetId = set; groundCondition = ground;
    const L = race.raceCourseSet.distance as number;
    const lateStart = race.phaseCalculator?.phaseEndStartDistance ?? (L * 2) / 3;
    const frames = decodeFrames(race.simDataBase64);
    // raceHorse[i] matches the i-th horse block of the sim data (horseIndex order).
    race.raceHorse.forEach((h: any, i: number) => horses.push(horseOf(h, frames[h.horseIndex ?? i], L, lateStart)));
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ courseSetId, groundCondition, horses }) + "\n");
  console.log(`${files.length} races, ${horses.length} horses -> ${outPath}`);
}

main();
