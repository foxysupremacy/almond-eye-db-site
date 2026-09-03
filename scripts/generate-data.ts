/**
 * Data Preprocessing & Generation Script
 *
 * Reads raw JSON files from the repository:
 * - support_cards.json
 * - skills.json
 * - data/racetracks_raw.json
 * - data/translations/track_names.json
 *
 * Prunes unused metadata (dropping unused translations, raw stat tables, etc.)
 * and exports lightweight JSON datasets into `lib/data/`:
 * - cards.json (~31 KB gzipped)
 * - skills.json (~105 KB gzipped)
 * - racetracks.json (~10 KB gzipped)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(SITE_ROOT, "..");

const cardsPath = path.join(REPO_ROOT, "support_cards.json");
const skillsPath = path.join(REPO_ROOT, "skills.json");
const tracksPath = path.join(REPO_ROOT, "data", "racetracks_raw.json");
const trackNamesPath = path.join(REPO_ROOT, "data", "translations", "track_names.json");
const outDir = path.join(SITE_ROOT, "lib", "data");

if (!fs.existsSync(cardsPath)) {
  console.error(`Error: support_cards.json not found at ${cardsPath}`);
  process.exit(1);
}
if (!fs.existsSync(skillsPath)) {
  console.error(`Error: skills.json not found at ${skillsPath}`);
  process.exit(1);
}
if (!fs.existsSync(tracksPath)) {
  console.error(`Error: racetracks_raw.json not found at ${tracksPath}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

console.log("Loading raw JSON sources...");
const rawCards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const rawSkills = JSON.parse(fs.readFileSync(skillsPath, "utf8"));
const rawTracks = JSON.parse(fs.readFileSync(tracksPath, "utf8"));
const trackNames = fs.existsSync(trackNamesPath)
  ? JSON.parse(fs.readFileSync(trackNamesPath, "utf8"))
  : {};

// ---------------------------------------------------------------------------
// 1. Process Support Cards
// ---------------------------------------------------------------------------
console.log(`Processing ${rawCards.length} support cards...`);
const cards = rawCards.map((c: any) => {
  const titleEn = c.title_en?.trim() || "";
  const charName = c.char_name?.trim() || "";
  const titleJa = c.title_ja?.trim() || "";
  const nameJp = c.name_jp?.trim() || "";

  const nameEn = charName
    ? titleEn
      ? `${titleEn} ${charName}`
      : charName
    : titleEn;
  const fullNameJp = titleJa ? `${titleJa} ${nameJp}` : nameJp;

  return {
    id: Number(c.support_id),
    nameEn: nameEn || nameJp,
    nameJp: fullNameJp,
    charName,
    titleEn,
    titleJa,
    rarity: Number(c.rarity),
    type: c.type,
    release: c.release || null,
    eventSkills: Array.isArray(c.event_skills) ? c.event_skills : [],
    hintSkills: Array.isArray(c.hints?.hint_skills) ? c.hints.hint_skills : [],
    eventDetails: Array.isArray(c.event_details) ? c.event_details : [],
  };
});

// Sort by rarity descending (SSR -> SR -> R), then release date descending, then id
cards.sort((a: any, b: any) => {
  if (b.rarity !== a.rarity) return b.rarity - a.rarity;
  const relA = a.release || "";
  const relB = b.release || "";
  if (relB !== relA) return relB.localeCompare(relA);
  return b.id - a.id;
});

const cardsOutPath = path.join(outDir, "cards.json");
fs.writeFileSync(cardsOutPath, JSON.stringify(cards));
console.log(`Wrote ${cards.length} cards to ${cardsOutPath} (${(fs.statSync(cardsOutPath).size / 1024).toFixed(1)} KB)`);

// ---------------------------------------------------------------------------
// 2. Process Skills
// ---------------------------------------------------------------------------
console.log(`Processing ${rawSkills.length} skills...`);
const skills = rawSkills.map((s: any) => {
  const nameEn = s.enname || s.name_en || s.en_name || "";
  const nameJp = s.jpname || s.name_jp || "";
  const descEn = s.desc_en || s.endesc || "";
  const descJp = s.desc_jp || s.jpdesc || "";

  const conditionGroups = Array.isArray(s.condition_groups)
    ? s.condition_groups.map((g: any) => ({
        condition: g.condition || "",
        precondition: g.precondition || null,
        base_time: g.base_time ?? null,
        effects: g.effects || [],
      }))
    : [];

  return {
    id: Number(s.id),
    nameEn: nameEn || nameJp,
    nameJp: nameJp || nameEn,
    descEn,
    descJp,
    rarity: Number(s.rarity || 1),
    iconId: s.iconid || s.icon_id || null,
    conditionGroups,
  };
});

const skillsOutPath = path.join(outDir, "skills.json");
fs.writeFileSync(skillsOutPath, JSON.stringify(skills));
console.log(`Wrote ${skills.length} skills to ${skillsOutPath} (${(fs.statSync(skillsOutPath).size / 1024).toFixed(1)} KB)`);

// ---------------------------------------------------------------------------
// 3. Process Racetracks & Courses
// ---------------------------------------------------------------------------
console.log(`Processing ${rawTracks.length} racetracks...`);
const racetracks = rawTracks.map((t: any) => {
  const id = Number(t.id);
  const names = trackNames[t.id] || {};
  const courses = Array.isArray(t.courses)
    ? t.courses.map((c: any) => ({
        id: Number(c.id),
        trackId: id,
        distance: c.distance,
        inout: c.inout,
        length: c.length,
        terrain: c.terrain,
        turn: c.turn,
        corners: c.corners || [],
        straights: c.straights || [],
        slopes: c.slopes || [],
        phases: c.phases,
        spurtStart: c.spurtStart,
        positionKeepEnd: c.positionKeepEnd,
        data: {
          corners: c.corners,
          straights: c.straights,
          slopes: c.slopes,
          phases: c.phases,
          spurtStart: c.spurtStart,
          positionKeepEnd: c.positionKeepEnd,
          laps: c.laps,
          noMansLand: c.noMansLand,
          overlaps: c.overlaps,
          statThresholds: c.statThresholds,
          terrainChanges: c.terrainChanges,
        },
      }))
    : [];

  return {
    id,
    nameJa: names.ja || `Venue ${id}`,
    nameEn: names.en || `Venue ${id}`,
    courseCount: courses.length,
    courses,
  };
});

const tracksOutPath = path.join(outDir, "racetracks.json");
fs.writeFileSync(tracksOutPath, JSON.stringify(racetracks));
console.log(`Wrote ${racetracks.length} racetracks to ${tracksOutPath} (${(fs.statSync(tracksOutPath).size / 1024).toFixed(1)} KB)`);

// ---------------------------------------------------------------------------
// 4. Sync assets to public/assets for static serving
// ---------------------------------------------------------------------------
const srcAssets = path.join(__dirname, "..", "assets");
const destAssets = path.join(__dirname, "..", "public", "assets");
if (fs.existsSync(srcAssets)) {
  function syncDir(src: string, dest: string) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, entry.name);
      const d = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        syncDir(s, d);
      } else if (!fs.existsSync(d) || fs.statSync(s).mtimeMs > fs.statSync(d).mtimeMs) {
        fs.copyFileSync(s, d);
      }
    }
  }
  syncDir(srcAssets, destAssets);
  console.log("Synchronized assets to public/assets");
}

console.log("Data preprocessing completed successfully.");

