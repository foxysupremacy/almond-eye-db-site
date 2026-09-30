// Downloads the current skills, playable characters, tracks and factors into
// lib/data/source/gametora/. Resolve content hashes from GameTora's manifest
// so a full refresh follows new releases without hardcoded dataset URLs.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.resolve(__dirname, "../lib/data/source/gametora");
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const SOURCES = ["factors", "skills", "character-cards", "support-cards", "racetracks"];

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const manifest = JSON.parse(await fetchText("https://gametora.com/data/manifests/umamusume.json")) as Record<string, string>;

  for (const source of SOURCES) {
    const hash = manifest[source];
    if (!hash) throw new Error(`GameTora manifest is missing ${source}`);
    const url = `https://gametora.com/data/umamusume/${source}.${hash}.json`;
    process.stdout.write(`Fetching ${url} ... `);
    const text = await fetchText(url);
    const parsed = JSON.parse(text); // validate before writing
    const outPath = path.join(OUTPUT_DIR, `${source}.json`);
    fs.writeFileSync(outPath, JSON.stringify(parsed));
    const summary = Array.isArray(parsed)
      ? `${parsed.length} records`
      : `${Object.keys(parsed).length} top-level keys`;
    console.log(`ok → ${outPath} (${summary})`);
  }
}

main().catch((err) => {
  console.error("fetch-gametora failed:", err.message);
  process.exit(1);
});
