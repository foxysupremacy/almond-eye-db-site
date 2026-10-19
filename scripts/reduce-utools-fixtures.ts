/**
 * Reduce raw U-tools ranking captures (ウマ娘.攻略.tools /race/.../effects, ~140 KB each) to the compact numbers the
 * race-impact benchmark needs: per row the costume, style, U-tools total, unique score and the option U-tools picks in
 * each evolution slot. Output: lib/race-impact/fixtures/utools/<venue>-<courseId>.json (a few KB each).
 *
 * Usage: bun scripts/reduce-utools-fixtures.ts <dir with utools-*-cards.json> [outDir]
 * File names are utools-<venue>-<courseId>-cards.json; utools-chm2-cards.json is the Oct CM (Kyoto 10808).
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

type RawOption = { id: number; score: number; low?: boolean };
type RawCard = { id: string; style: number; score: number; unique: { id: number; score: number }; ups: { base: string; opts: RawOption[] }[] };

const SPECIAL: Record<string, { venue: string; courseId: number }> = { chm2: { venue: "kyoto", courseId: 10808 } };
const RACER_COUNT = 9;
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

export interface ReducedRow {
  /** Costume (card) id. */ c: number;
  /** Running style 1-4. */ s: number;
  /** U-tools total. */ t: number;
  /** Unique skill [id, score]. */ u: [number, number];
  /** Per evolution slot, the option U-tools picks: [id, score] (score 0.58 floor rows end with 1). */ p: ([number, number] | [number, number, 1])[];
}

function reduce(raw: { cards: RawCard[] }): ReducedRow[] {
  return raw.cards.map((card) => ({
    c: Number(card.id), s: card.style, t: r4(card.score), u: [card.unique.id, r4(card.unique.score)],
    p: card.ups.filter((up) => up.opts.length).map((up) => {
      const best = up.opts.reduce((a, b) => (b.score > a.score ? b : a));
      return best.low ? [best.id, r4(best.score), 1] : [best.id, r4(best.score)];
    }),
  }));
}

if (import.meta.main) {
  const [src, out = "lib/race-impact/fixtures/utools"] = process.argv.slice(2);
  if (!src) throw new Error("usage: bun scripts/reduce-utools-fixtures.ts <srcDir> [outDir]");
  mkdirSync(out, { recursive: true });
  let bytes = 0;
  const files = readdirSync(src).filter((f) => /^utools-.+-cards\.json$/.test(f)).sort();
  for (const f of files) {
    const tag = f.replace(/^utools-|-cards\.json$/g, "");
    const m = /^([a-z]+)-(\d+)$/.exec(tag);
    const meta = SPECIAL[tag] ?? (m ? { venue: m[1], courseId: Number(m[2]) } : null);
    if (!meta) throw new Error(`cannot map ${f} to a course`);
    const rows = reduce(JSON.parse(readFileSync(join(src, f), "utf8")));
    const body = JSON.stringify({ courseId: meta.courseId, racerCount: RACER_COUNT, source: f, rows });
    const name = `${meta.venue}-${meta.courseId}.json`;
    writeFileSync(join(out, name), body + "\n");
    bytes += body.length + 1;
    console.log(name, rows.length, "rows");
  }
  console.log(files.length, "files,", bytes, "bytes");
}
