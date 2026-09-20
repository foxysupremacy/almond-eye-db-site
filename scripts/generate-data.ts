/**
 * Data Preprocessing & Generation Script
 *
 * Reads raw JSON files from the repository:
 * - skills.json
 * - characters.json
 * - data/racetracks_raw.json
 * - data/translations/track_names.json
 *
 * Prunes unused metadata and exports lightweight JSON datasets into
 * `lib/data/`. The support-card index (cards.json) is NOT generated here —
 * it comes from master.mdb via extract-mdb.ts and is maintained in place by
 * the GameTora card crawler (see scripts/crawl_gametora_cards.py).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(SITE_ROOT, "..");

const skillsPath = path.join(REPO_ROOT, "skills.json");
const tracksPath = path.join(REPO_ROOT, "data", "racetracks_raw.json");
const trackNamesPath = path.join(REPO_ROOT, "data", "translations", "track_names.json");
const charasPath = path.join(REPO_ROOT, "characters.json");
const hachimiPath = path.join(REPO_ROOT, "hachimi_text_data.json");
const outDir = path.join(SITE_ROOT, "lib", "data");

if (!fs.existsSync(skillsPath)) {
  console.error(`Error: skills.json not found at ${skillsPath}`);
  process.exit(1);
}
if (!fs.existsSync(tracksPath)) {
  console.error(`Error: racetracks_raw.json not found at ${tracksPath}`);
  process.exit(1);
}
if (!fs.existsSync(charasPath)) {
  console.error(`Error: characters.json not found at ${charasPath}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

console.log("Loading raw JSON sources...");
const rawSkills = JSON.parse(fs.readFileSync(skillsPath, "utf8"));
const rawTracks = JSON.parse(fs.readFileSync(tracksPath, "utf8"));
const trackNames = fs.existsSync(trackNamesPath)
  ? JSON.parse(fs.readFileSync(trackNamesPath, "utf8"))
  : {};
const hachimiData = fs.existsSync(hachimiPath)
  ? JSON.parse(fs.readFileSync(hachimiPath, "utf8"))
  : null;
const hachimiSkillNames: Record<string, string> = hachimiData?.["47"] || {};
if (hachimiData) {
  console.log(`Loaded ${Object.keys(hachimiSkillNames).length} skill translations from hachimi_text_data.json (cat 47).`);
} else {
  console.warn("Notice: hachimi_text_data.json not found, proceeding with Gametora translations only.");
}

// ---------------------------------------------------------------------------
// 1. Process Skills
// ---------------------------------------------------------------------------
console.log(`Processing ${rawSkills.length} skills...`);
let hachimiCount = 0;
let gametoraFallbackCount = 0;
let jpFallbackCount = 0;

function resolveSkillIconId(s: any, conditionGroups: any[]): number | null {
  const existing = s.iconid || s.icon_id;
  if (existing && Number(existing) !== 0) {
    return Number(existing);
  }

  const rarity = Number(s.rarity || 1);
  const suffix = rarity === 1 ? 1 : rarity === 2 ? 2 : rarity === 6 ? 6 : 3;

  let abilityType: number | null = null;
  let abilityVal = 0;
  let targetType = 1;

  for (const cg of conditionGroups || []) {
    for (const eff of cg.effects || []) {
      if (eff.type) {
        abilityType = eff.type;
        abilityVal = eff.value ?? 0;
        targetType = eff.target ?? 1;
        break;
      }
    }
    if (abilityType !== null) break;
  }

  const isDebuff = abilityVal < 0 || (targetType >= 2 && targetType <= 10);
  if (isDebuff) {
    if (abilityType === 21 || abilityType === 22 || abilityType === 27) return 30010 + suffix;
    if (abilityType === 9) return 30050 + suffix;
    if (abilityType === 31) return 30040 + suffix;
    return 30010 + suffix;
  }

  if (abilityType === 21 || abilityType === 22 || abilityType === 27) return 20010 + suffix;
  if (abilityType === 9) return 20020 + suffix;
  if (abilityType === 31) return 20040 + suffix;
  if (abilityType === 28) return 20050 + suffix;
  if (abilityType === 1) return 10010 + (suffix === 1 ? 4 : suffix);
  if (abilityType === 2) return 10020 + suffix;
  if (abilityType === 3) return 10030 + suffix;
  if (abilityType === 4) return 10040 + suffix;
  if (abilityType === 5) return 10050 + suffix;

  return 20010 + suffix;
}

const skills = rawSkills.map((s: any) => {
  const hachimiName = hachimiSkillNames[String(s.id)]?.trim();
  const gametoraName = (s.enname || s.name_en || s.en_name || "").trim();
  const jpName = (s.jpname || s.name_jp || "").trim();

  if (hachimiName) {
    hachimiCount++;
  } else if (gametoraName) {
    gametoraFallbackCount++;
  } else {
    jpFallbackCount++;
  }

  // Priority: 1. Hachimi TL, 2. Gametora TL, 3. Japanese name
  const nameEn = hachimiName || gametoraName || jpName;
  const nameJp = jpName || nameEn;
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
    nameEn,
    nameJp,
    descEn,
    descJp,
    rarity: Number(s.rarity || 1),
    iconId: resolveSkillIconId(s, conditionGroups),
    // Raw effect tags ("run"/"ldr"/"sho"/"mil"/"tur"…) — consumed by the
    // GameTora card crawler to build skill-meta.json tactical tags.
    tags: Array.isArray(s.type) ? s.type : [],
    conditionGroups,
  };
});

const skillsOutPath = path.join(outDir, "skills.json");
fs.writeFileSync(skillsOutPath, JSON.stringify(skills));
console.log(
  `Wrote ${skills.length} skills to ${skillsOutPath} (${(fs.statSync(skillsOutPath).size / 1024).toFixed(1)} KB) ` +
  `[Hachimi TL: ${hachimiCount}, Gametora TL: ${gametoraFallbackCount}, JP: ${jpFallbackCount}]`
);

// Also sync Hachimi skill names into gold-to-white.json
const goldToWhitePath = path.join(SITE_ROOT, "lib", "gold-to-white.json");
if (fs.existsSync(goldToWhitePath) && Object.keys(hachimiSkillNames).length > 0) {
  const g2w = JSON.parse(fs.readFileSync(goldToWhitePath, "utf8"));
  let g2wUpdated = 0;
  for (const [goldId, entry] of Object.entries<any>(g2w)) {
    const hGold = hachimiSkillNames[String(goldId)]?.trim();
    if (hGold && entry.goldNameEn !== hGold) {
      entry.goldNameEn = hGold;
      g2wUpdated++;
    }
    const hWhite = hachimiSkillNames[String(entry.whiteId)]?.trim();
    if (hWhite && entry.whiteNameEn !== hWhite) {
      entry.whiteNameEn = hWhite;
      g2wUpdated++;
    }
  }
  fs.writeFileSync(goldToWhitePath, JSON.stringify(g2w, null, 2));
  console.log(`Updated gold-to-white.json with Hachimi translations (${g2wUpdated} fields updated).`);
}

// Also sync Hachimi skill names into skill-meta.json
const skillMetaPath = path.join(outDir, "skill-meta.json");
if (fs.existsSync(skillMetaPath) && Object.keys(hachimiSkillNames).length > 0) {
  const skillMeta = JSON.parse(fs.readFileSync(skillMetaPath, "utf8"));
  let cardSkillUpdated = 0;
  for (const [sid, meta] of Object.entries<any>(skillMeta)) {
    const hName = hachimiSkillNames[sid]?.trim();
    if (hName && meta.nameEn !== hName) {
      meta.nameEn = hName;
      cardSkillUpdated++;
    }
  }
  fs.writeFileSync(skillMetaPath, JSON.stringify(skillMeta));
  console.log(`Updated skill-meta.json with Hachimi translations (${cardSkillUpdated} skills updated).`);
}

// ---------------------------------------------------------------------------
// 2. Process Racetracks & Courses
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
// 3. Process Playable Characters
// ---------------------------------------------------------------------------
console.log("Processing playable characters...");
const rawCharas = JSON.parse(fs.readFileSync(charasPath, "utf8"));
const characters = rawCharas.map((c: any) => {
  const titleEn = (c.title_en_gl || c.title || "").replace(/^\[|\]$/g, "").trim();
  const titleJp = (c.title_jp || "").replace(/^\[|\]$/g, "").trim();
  const nameEn = c.name_en?.trim() || "";
  const nameJp = c.name_jp?.trim() || "";
  const cardId = Number(c.card_id);
  const charId = Number(c.char_id);
  const variant = String(cardId).slice(-2);

  return {
    id: cardId,
    charId,
    variant,
    nameEn: nameEn || nameJp,
    nameJp: nameJp || nameEn,
    titleEn,
    titleJp,
    rarity: Number(c.rarity || 3),
    release: c.release || null,
    aptitude: Array.isArray(c.aptitude) ? c.aptitude : [],
    baseStats: Array.isArray(c.base_stats) ? c.base_stats : [],
    uniqueSkillId:
      Array.isArray(c.skills_unique) && c.skills_unique.length > 0
        ? Number(c.skills_unique[c.skills_unique.length - 1])
        : null,
    innateSkills: Array.isArray(c.skills_innate) ? c.skills_innate.map(Number) : [],
    awakeningSkills: Array.isArray(c.skills_awakening) ? c.skills_awakening.map(Number) : [],
    eventSkills: Array.isArray(c.skills_event) ? c.skills_event.map(Number) : [],
  };
});

// Sort by rarity descending, then nameEn, then id
characters.sort((a: any, b: any) => {
  if (b.rarity !== a.rarity) return b.rarity - a.rarity;
  return a.nameEn.localeCompare(b.nameEn) || a.id - b.id;
});

const charasOutPath = path.join(outDir, "characters.json");
fs.writeFileSync(charasOutPath, JSON.stringify(characters));
console.log(`Wrote ${characters.length} characters to ${charasOutPath} (${(fs.statSync(charasOutPath).size / 1024).toFixed(1)} KB)`);

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

