import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SITE_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(SITE_ROOT, "..");

const MDB_PATH =
  process.env.UMAMUSUME_MDB_PATH ||
  "/Users/fubuki/Library/Application Support/CrossOver/Bottles/Steam/drive_c/Program Files (x86)/Steam/steamapps/common/UmamusumePrettyDerby_Jpn/UmamusumePrettyDerby_Jpn_Data/Persistent/master/master.mdb";

if (!fs.existsSync(MDB_PATH)) {
  console.error("master.mdb not found at:", MDB_PATH);
  process.exit(1);
}

const db = new DatabaseSync(MDB_PATH, { readOnly: true });

// Load hachimi translations
const hachimiPath = path.resolve(REPO_ROOT, "hachimi_text_data.json");
const hachimi = fs.existsSync(hachimiPath)
  ? JSON.parse(fs.readFileSync(hachimiPath, "utf8"))
  : {};

const hachimiSkillNames = hachimi["47"] || {};
const hachimiSkillDescs = hachimi["48"] || {};
const hachimiEffectTypes = hachimi["151"] || {};
const hachimiUniqueEffects = hachimi["155"] || {};

// 1. Text data lookups from SQLite text_data
function getTextDataMap(category: number): Map<number, string> {
  const map = new Map<number, string>();
  const rows = db
    .prepare('SELECT "index", text FROM text_data WHERE category = ?')
    .all(category) as { index: number; text: string }[];
  for (const r of rows) {
    map.set(Number(r.index), r.text);
  }
  return map;
}

const jpSkillNames = getTextDataMap(47);
const jpSkillDescs = getTextDataMap(48);
const jpEffectTypes = getTextDataMap(151);
const jpUniqueEffects = getTextDataMap(155);
const jpCardNames = getTextDataMap(4);
const jpCharaNames = getTextDataMap(6);

console.log("Loaded text data caches.");

// ---------------------------------------------------------------------------
// 1. Extract Support Card Effects -> lib/data/card-effects.json
// ---------------------------------------------------------------------------
console.log("Extracting Support Card Effects...");

interface CardEffectEntry {
  type: number;
  nameEn: string;
  nameJp: string;
  values: number[]; // [0 LB, 1 LB, 2 LB, 3 LB, MLB]
}

interface CardUniqueEffectEntry {
  lv: number;
  textEn: string;
  textJp: string;
  effects: { type: number; nameEn: string; nameJp: string; value: number }[];
}

interface SupportCardEffectsBlob {
  cardId: number;
  rarity: number;
  effects: CardEffectEntry[];
  uniqueEffect?: CardUniqueEffectEntry;
}

const supportCardRows = db
  .prepare(
    "SELECT id, rarity, effect_table_id, unique_effect_id FROM support_card_data ORDER BY id ASC"
  )
  .all() as {
  id: number;
  rarity: number;
  effect_table_id: number;
  unique_effect_id: number;
}[];

const effectTableRows = db
  .prepare("SELECT * FROM support_card_effect_table")
  .all() as any[];

const effectTableMap = new Map<number, any[]>();
for (const row of effectTableRows) {
  const id = Number(row.id);
  const list = effectTableMap.get(id) || [];
  list.push(row);
  effectTableMap.set(id, list);
}

const uniqueEffectRows = db
  .prepare("SELECT * FROM support_card_unique_effect")
  .all() as any[];
const uniqueEffectMap = new Map<number, any>();
for (const u of uniqueEffectRows) {
  uniqueEffectMap.set(Number(u.id), u);
}

const allCardEffects: Record<number, SupportCardEffectsBlob> = {};

for (const sc of supportCardRows) {
  const cardId = Number(sc.id);
  const rarity = Number(sc.rarity);
  const tableRows = effectTableMap.get(Number(sc.effect_table_id)) || [];

  const effects: CardEffectEntry[] = [];
  for (const tr of tableRows) {
    const type = Number(tr.type);
    let values: number[] = [];
    if (rarity === 3) {
      // SSR: 30, 35, 40, 45, 50
      values = [
        Number(tr.limit_lv30),
        Number(tr.limit_lv35),
        Number(tr.limit_lv40),
        Number(tr.limit_lv45),
        Number(tr.limit_lv50),
      ];
    } else if (rarity === 2) {
      // SR: 25, 30, 35, 40, 45
      values = [
        Number(tr.limit_lv25),
        Number(tr.limit_lv30),
        Number(tr.limit_lv35),
        Number(tr.limit_lv40),
        Number(tr.limit_lv45),
      ];
    } else {
      // R: 20, 25, 30, 35, 40
      values = [
        Number(tr.limit_lv20),
        Number(tr.limit_lv25),
        Number(tr.limit_lv30),
        Number(tr.limit_lv35),
        Number(tr.limit_lv40),
      ];
    }

    let currentVal = 0;
    const resolvedValues: number[] = [];
    for (const v of values) {
      if (v !== -1) {
        currentVal = v;
      }
      resolvedValues.push(currentVal);
    }

    effects.push({
      type,
      nameEn: hachimiEffectTypes[String(type)] || jpEffectTypes.get(type) || `Effect ${type}`,
      nameJp: jpEffectTypes.get(type) || "",
      values: resolvedValues,
    });
  }

  let uniqueEffect: CardUniqueEffectEntry | undefined;
  if (sc.unique_effect_id && uniqueEffectMap.has(Number(sc.unique_effect_id))) {
    const u = uniqueEffectMap.get(Number(sc.unique_effect_id));
    const subEffects: { type: number; nameEn: string; nameJp: string; value: number }[] = [];
    if (u.type_0) {
      subEffects.push({
        type: Number(u.type_0),
        nameEn: hachimiEffectTypes[String(u.type_0)] || jpEffectTypes.get(Number(u.type_0)) || `Effect ${u.type_0}`,
        nameJp: jpEffectTypes.get(Number(u.type_0)) || "",
        value: Number(u.value_0),
      });
    }
    if (u.type_1) {
      subEffects.push({
        type: Number(u.type_1),
        nameEn: hachimiEffectTypes[String(u.type_1)] || jpEffectTypes.get(Number(u.type_1)) || `Effect ${u.type_1}`,
        nameJp: jpEffectTypes.get(Number(u.type_1)) || "",
        value: Number(u.value_1),
      });
    }

    uniqueEffect = {
      lv: Number(u.lv),
      textEn: hachimiUniqueEffects[String(sc.unique_effect_id)] || jpUniqueEffects.get(Number(sc.unique_effect_id)) || "",
      textJp: jpUniqueEffects.get(Number(sc.unique_effect_id)) || "",
      effects: subEffects,
    };
  }

  allCardEffects[cardId] = {
    cardId,
    rarity,
    effects,
    uniqueEffect,
  };
}

fs.writeFileSync(
  path.resolve(SITE_ROOT, "lib/data/card-effects.json"),
  JSON.stringify(allCardEffects)
);
console.log(`Saved card-effects.json (${Object.keys(allCardEffects).length} cards).`);

// ---------------------------------------------------------------------------
// 2. Extract Character Growth Rates and Evolutions
// ---------------------------------------------------------------------------
console.log("Extracting Character Growth Rates & Evolutions...");

// Read existing characters.json
const charasPath = path.resolve(SITE_ROOT, "lib/data/characters.json");
const existingCharas: any[] = JSON.parse(fs.readFileSync(charasPath, "utf8"));
const charaMap = new Map<number, any>();
for (const c of existingCharas) {
  charaMap.set(c.id, c);
}

// Query card_data
const cardDataRows = db
  .prepare("SELECT * FROM card_data ORDER BY id ASC")
  .all() as any[];

// Query available_skill_set
const availSkillsRows = db
  .prepare("SELECT available_skill_set_id, skill_id, need_rank FROM available_skill_set ORDER BY need_rank ASC")
  .all() as any[];

const cardAvailSkills = new Map<number, { skillId: number; needRank: number }[]>();
for (const r of availSkillsRows) {
  const setKey = Number(r.available_skill_set_id);
  const list = cardAvailSkills.get(setKey) || [];
  list.push({ skillId: Number(r.skill_id), needRank: Number(r.need_rank) });
  cardAvailSkills.set(setKey, list);
}

// Query skill_upgrade_description
const upgradeRows = db
  .prepare("SELECT card_id, rank, skill_id FROM skill_upgrade_description ORDER BY card_id, rank, skill_id")
  .all() as any[];

const cardEvolMap = new Map<number, { rank: number; skillId: number }[]>();
for (const u of upgradeRows) {
  const cardId = Number(u.card_id);
  const list = cardEvolMap.get(cardId) || [];
  list.push({ rank: Number(u.rank), skillId: Number(u.skill_id) });
  cardEvolMap.set(cardId, list);
}

// Query skill_data for condition strings and tags
const allSkillDataRows = db
  .prepare("SELECT id, rarity, icon_id, condition_1, precondition_1, condition_2, precondition_2 FROM skill_data")
  .all() as any[];
const skillDataMap = new Map<number, any>();
for (const s of allSkillDataRows) {
  skillDataMap.set(Number(s.id), s);
}

// Helper to determine distance / condition tag
function detectEvolBranchTag(condStr: string): string | null {
  if (condStr.includes("distance_type==1")) return "Short";
  if (condStr.includes("distance_type==2")) return "Mile";
  if (condStr.includes("distance_type==3")) return "Medium";
  if (condStr.includes("distance_type==4")) return "Long";
  if (condStr.includes("ground_type==1")) return "Turf";
  if (condStr.includes("ground_type==2")) return "Dirt";
  if (condStr.includes("running_style==1")) return "Runner";
  if (condStr.includes("running_style==2")) return "Leader";
  if (condStr.includes("running_style==3")) return "Betweener";
  if (condStr.includes("running_style==4")) return "Chaser";
  return null;
}

export interface CharacterEvolutionDetail {
  rank: number;
  baseSkillId: number;
  skillId: number;
  nameEn: string;
  nameJp: string;
  descEn?: string;
  descJp?: string;
  iconId: number | null;
  branchTag?: string;
  condition1?: string;
}

const characterEvolutions: Record<number, CharacterEvolutionDetail[]> = {};

// Also load existing skills.json to ensure evolved skills are registered!
const skillsPath = path.resolve(SITE_ROOT, "lib/data/skills.json");
const existingSkills: any[] = JSON.parse(fs.readFileSync(skillsPath, "utf8"));
const skillsMap = new Map<number, any>();
for (const s of existingSkills) {
  skillsMap.set(s.id, s);
}

let newSkillsAdded = 0;

for (const cd of cardDataRows) {
  const cardId = Number(cd.id);
  const charId = Number(cd.chara_id);
  if (cardId > 9000000) continue; // skip mob / npc / placeholder cards

  const growthRates = [
    Number(cd.talent_speed || 0),
    Number(cd.talent_stamina || 0),
    Number(cd.talent_pow || 0),
    Number(cd.talent_guts || 0),
    Number(cd.talent_wiz || 0),
  ];

  // If character already in characters.json, update growthRates
  let charEntry = charaMap.get(cardId);
  if (charEntry) {
    charEntry.growthRates = growthRates;
  } else {
    // New character (e.g. 114901 Phalaenopsis)
    const rawCardName = jpCardNames.get(cardId) || "";
    // e.g. "[絶佳の暁闇]ファレノプシス"
    const titleMatch = rawCardName.match(/^\[(.*?)\](.*)$/);
    const titleJp = titleMatch ? titleMatch[1] : "";
    const nameJp = jpCharaNames.get(charId) || (titleMatch ? titleMatch[2] : "");
    const titleEn = titleJp || "New Costume";
    const nameEn = nameJp; // Fallback or transliteration

    // Get skills from available_skill_set
    const setKey = Number(cd.available_skill_set_id);
    const aList = cardAvailSkills.get(setKey) || [];
    const innateSkills = aList.filter((a) => a.needRank === 0).map((a) => a.skillId);
    const awakeningSkills = aList.filter((a) => a.needRank > 0).map((a) => a.skillId);

    charEntry = {
      id: cardId,
      charId,
      variant: "01",
      nameEn: nameEn,
      nameJp: nameJp,
      titleEn: titleEn,
      titleJp: titleJp,
      rarity: Number(cd.default_rarity || 3),
      aptitude: ["A", "G", "G", "A", "A", "G", "G", "A", "A", "G"],
      baseStats: [95, 90, 95, 90, 90],
      uniqueSkillId: Number(`10${charId}1`),
      innateSkills,
      awakeningSkills,
      eventSkills: [],
      growthRates,
      imgUrl: `https://gametora.com/images/umamusume/characters/thumb/chara_stand_${charId}_01.png`,
    };
    charaMap.set(cardId, charEntry);
    existingCharas.push(charEntry);
    console.log(`Added missing character: ${cardId} (${nameJp})`);
  }

  // Process Evolutions for this card
  const evolList = cardEvolMap.get(cardId) || [];
  const evolDetails: CharacterEvolutionDetail[] = [];

  const aList = cardAvailSkills.get(Number(cd.available_skill_set_id)) || [];
  const rankToGoldSkill = new Map<number, number>();
  for (const a of aList) {
    if (a.needRank > 0) rankToGoldSkill.set(a.needRank, a.skillId);
  }

  for (const ev of evolList) {
    const sData = skillDataMap.get(ev.skillId);
    const condStr = sData ? `${sData.condition_1 || ""} ${sData.precondition_1 || ""}` : "";
    const branchTag = detectEvolBranchTag(condStr) || undefined;
    const baseSkillId = rankToGoldSkill.get(ev.rank) || 0;

    const nameEn = hachimiSkillNames[String(ev.skillId)] || jpSkillNames.get(ev.skillId) || `Skill ${ev.skillId}`;
    const nameJp = jpSkillNames.get(ev.skillId) || "";
    const descEn = hachimiSkillDescs[String(ev.skillId)] || jpSkillDescs.get(ev.skillId) || "";
    const descJp = jpSkillDescs.get(ev.skillId) || "";
    const iconId = sData?.icon_id ? Number(sData.icon_id) : null;

    evolDetails.push({
      rank: ev.rank,
      baseSkillId,
      skillId: ev.skillId,
      nameEn,
      nameJp,
      descEn,
      descJp,
      iconId,
      branchTag,
      condition1: sData?.condition_1 || undefined,
    });

    // Register in existingSkills if not present
    if (!skillsMap.has(ev.skillId)) {
      const condGroups: any[] = [];
      if (sData?.condition_1) {
        condGroups.push({
          condition: sData.condition_1,
          precondition: sData.precondition_1 || null,
          effects: [],
        });
      }
      if (sData?.condition_2) {
        condGroups.push({
          condition: sData.condition_2,
          precondition: sData.precondition_2 || null,
          effects: [],
        });
      }

      const newSkill = {
        id: ev.skillId,
        nameEn,
        nameJp,
        descEn,
        descJp,
        rarity: 3, // Evolved skills treated as highest/pink/gold rarity
        iconId,
        conditionGroups: condGroups,
      };
      existingSkills.push(newSkill);
      skillsMap.set(ev.skillId, newSkill);
      newSkillsAdded++;
    }
  }

  if (evolDetails.length > 0) {
    characterEvolutions[cardId] = evolDetails;
  }
}

// Write updated characters.json
fs.writeFileSync(charasPath, JSON.stringify(existingCharas, null, 2));
console.log(`Updated characters.json (${existingCharas.length} characters).`);

// Write character-evolutions.json
fs.writeFileSync(
  path.resolve(SITE_ROOT, "lib/data/character-evolutions.json"),
  JSON.stringify(characterEvolutions, null, 2)
);
console.log(`Saved character-evolutions.json (${Object.keys(characterEvolutions).length} characters with evolutions).`);

// Write updated skills.json if new skills added
if (newSkillsAdded > 0) {
  fs.writeFileSync(skillsPath, JSON.stringify(existingSkills, null, 2));
  console.log(`Updated skills.json with ${newSkillsAdded} new evolved skills.`);
}

console.log("All collection data extraction completed successfully!");
