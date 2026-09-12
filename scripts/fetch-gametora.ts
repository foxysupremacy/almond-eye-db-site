// Downloads GameTora's English factor names into data-source/gametora/ so
// extract-affinity.ts can overlay them onto the Japanese names from
// master.mdb (master.mdb text_data is Japanese-only).
//
// The factors URL contains a content hash that changes when GameTora updates
// their dump — update the URL below when the fetch starts failing.
//
// Everything else in the affinity/careers pipeline now comes from master.mdb
// directly (see extract-affinity.ts).

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.resolve(__dirname, "../data-source/gametora");
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const SOURCES: Array<{ file: string; url: string }> = [
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
}

main().catch((err) => {
  console.error("fetch-gametora failed:", err.message);
  process.exit(1);
});
