// Downloads GameTora's succession-relation and factor master data into
// data-source/gametora/ so extract-affinity.ts can merge it offline.
// URLs contain content hashes that change when GameTora updates their dump —
// re-run `bun run fetch:gametora` (and update URLs here) when that happens.
//
// Also scrapes per-character career objectives ("objectiveData" embedded in the
// __NEXT_DATA__ blob of every GameTora character page) into objectives.json.
// Page HTML is cached in data-source/gametora/.page-cache/ (gitignored) so
// re-runs only fetch new/changed characters. If GameTora changes their page
// layout the parse below fails loudly; the last committed objectives.json
// keeps working until then.

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.resolve(__dirname, "../data-source/gametora");
const PAGE_CACHE_DIR = path.join(OUTPUT_DIR, ".page-cache");
// The character list page renders client-side with no embedded index; the
// sitemap is the only server-rendered enumeration of all character pages.
const SITEMAP_URL = "https://gametora.com/sitemap-0.xml";
const PAGE_FETCH_DELAY_MS = 250;
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const SOURCES: Array<{ file: string; url: string }> = [
  {
    file: "succession_relation.json",
    url: "https://gametora.com/data/umamusume/db-files/succession_relation.9c112bd2.json",
  },
  {
    file: "succession_relation_member.json",
    url: "https://gametora.com/data/umamusume/db-files/succession_relation_member.0cef075f.json",
  },
  {
    file: "factors.json",
    url: "https://gametora.com/data/umamusume/factors.05f8305a.json",
  },
];

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

export interface CharacterPageRef {
  cardId: number;
  path: string;
}

/** Extract deduped character page refs ("/umamusume/characters/<cardId>-<slug>") from the list page HTML. */
export function extractCharacterPaths(html: string): CharacterPageRef[] {
  const seen = new Set<number>();
  const refs: CharacterPageRef[] = [];
  const re = /\/umamusume\/characters\/(\d+)-[a-z0-9-]+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const cardId = Number(match[1]);
    if (!Number.isFinite(cardId) || seen.has(cardId)) continue;
    seen.add(cardId);
    refs.push({ cardId, path: match[0] });
  }
  return refs;
}

export interface ScrapedObjective {
  order: number;
  turn: number;
  /** Required placement: 1 = must win, 5 = 5th or better, … */
  condValue: number;
  races: Array<{
    id: number;
    nameEn: string;
    nameJp: string;
    grade: number;
    track: number;
    distance: number;
    terrain: number;
  }>;
}

export interface ScrapedCharacterObjectives {
  talentGroup: number;
  objectives: ScrapedObjective[];
}

/** Recursively find objects carrying "objectiveData"; grab talent_group from the same subtree. */
function findObjectiveContainers(
  value: unknown,
  out: ScrapedCharacterObjectives[]
): void {
  if (Array.isArray(value)) {
    for (const item of value) findObjectiveContainers(item, out);
    return;
  }
  if (!value || typeof value !== "object") return;
  const obj = value as Record<string, unknown>;
  const objectives = obj.objectiveData;
  if (Array.isArray(objectives) && objectives.length > 0) {
    const talentGroup = findTalentGroup(obj);
    if (talentGroup != null) {
      out.push({ talentGroup, objectives: objectives as never[] });
    }
  }
  for (const child of Object.values(obj)) findObjectiveContainers(child, out);
}

function findTalentGroup(value: unknown): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTalentGroup(item);
      if (found != null) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.talent_group === "number") return obj.talent_group;
  for (const child of Object.values(obj)) {
    const found = findTalentGroup(child);
    if (found != null) return found;
  }
  return null;
}

/** Parse the __NEXT_DATA__ blob of a character page into trimmed career objectives. */
export function parseCharacterPage(html: string): ScrapedCharacterObjectives | null {
  const match = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(
    html
  );
  if (!match) return null;
  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return null;
  }
  const containers: ScrapedCharacterObjectives[] = [];
  findObjectiveContainers(data, containers);
  if (containers.length === 0) return null;
  // One character per page; the first container wins.
  const container = containers[0];
  const objectives: ScrapedObjective[] = (container.objectives as any[]).map((o) => ({
    order: o.order ?? 0,
    turn: o.turn ?? 0,
    condValue: o.cond_value ?? 0,
    races: (o.races ?? []).map((r: any) => ({
      id: r.id,
      nameEn: r.name_en ?? "",
      nameJp: r.name_jp ?? "",
      grade: r.grade ?? 0,
      track: r.track ?? 0,
      distance: r.distance ?? 0,
      terrain: r.terrain ?? 0,
    })),
  }));
  return { talentGroup: container.talentGroup, objectives };
}

async function fetchObjectives(): Promise<void> {
  fs.mkdirSync(PAGE_CACHE_DIR, { recursive: true });
  process.stdout.write(`Fetching sitemap ${SITEMAP_URL} ... `);
  const sitemapXml = await fetchText(SITEMAP_URL);
  const refs = extractCharacterPaths(sitemapXml);
  console.log(`ok (${refs.length} character pages)`);

  const merged: Record<string, ScrapedObjective[]> = {};
  let fetched = 0;
  let parsed = 0;
  let index = 0;
  for (const ref of refs) {
    index++;
    const cachePath = path.join(PAGE_CACHE_DIR, `${ref.cardId}.html`);
    let html: string;
    if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 1000) {
      html = fs.readFileSync(cachePath, "utf-8");
    } else {
      html = await fetchText(`https://gametora.com${ref.path}`);
      fs.writeFileSync(cachePath, html);
      fetched++;
      await new Promise((r) => setTimeout(r, PAGE_FETCH_DELAY_MS));
    }
    const parsedPage = parseCharacterPage(html);
    if (!parsedPage) {
      console.warn(`  ⚠ no objectiveData found for ${ref.path} (page layout changed?)`);
      continue;
    }
    merged[String(parsedPage.talentGroup)] = parsedPage.objectives;
    parsed++;
    if (index % 25 === 0) {
      console.log(`  … ${index}/${refs.length} pages processed (${fetched} fetched)`);
    }
  }

  const outPath = path.join(OUTPUT_DIR, "objectives.json");
  fs.writeFileSync(outPath, JSON.stringify(merged));
  console.log(
    `Career objectives: ${parsed}/${refs.length} characters → ${outPath} (${fetched} pages fetched this run)`
  );
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const source of SOURCES) {
    process.stdout.write(`Fetching ${source.url} ... `);
    const text = await fetchText(source.url);
    const parsed = JSON.parse(text); // validate before writing
    const outPath = path.join(OUTPUT_DIR, source.file);
    fs.writeFileSync(outPath, JSON.stringify(parsed));
    const summary = Array.isArray(parsed)
      ? `${parsed.length} records`
      : `${Object.keys(parsed).length} top-level keys`;
    console.log(`ok → ${outPath} (${summary})`);
  }

  await fetchObjectives();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("fetch-gametora failed:", err.message);
    process.exit(1);
  });
}
