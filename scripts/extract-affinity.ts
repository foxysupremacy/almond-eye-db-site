import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HAKURAKU_UMDB_PATH = path.resolve(__dirname, "../../hakuraku/public/data/umdb.json");
const GAMETORA_DIR = path.resolve(__dirname, "../data-source/gametora");
const CHARACTERS_PATH = path.resolve(__dirname, "../lib/data/characters.json");
const OUTPUT_PATH = path.resolve(__dirname, "../lib/data/affinity.json");
const CAREERS_OUTPUT_PATH = path.resolve(__dirname, "../lib/data/careers.json");

interface RawUMDB {
  successionRelation: Array<{ relationType?: number; relationPoint?: number }>;
  successionRelationMember: Array<{ charaId?: number; relationType?: number }>;
  singleModeWinsSaddle: Array<{ id?: number; raceInstanceId?: number; raceInstanceIds?: number[] }>;
  textData: Array<{ category?: number; index?: number; text?: string }>;
}

interface GameToraRelation {
  relation_type: number;
  relation_point: number;
}

interface GameToraRelationMember {
  chara_id: number;
  relation_type: number;
}

interface GameToraFactor {
  id: string;
  type: number;
  name_en?: string;
  name_ja?: string;
}

// Trimmed schema written by fetch-gametora.ts (data-source/gametora/objectives.json)
interface GameToraObjective {
  order?: number;
  turn?: number;
  condValue?: number;
  races?: Array<{
    id: number;
    nameEn?: string;
    nameJp?: string;
    grade?: number;
    track?: number;
    distance?: number;
    terrain?: number;
  }>;
}

interface CareerRace {
  saddleId?: number;
  raceId: number;
  nameEn: string;
  grade: number;
  trackId: number;
  distance: number;
  terrain: number;
  mustWin: boolean;
}

export function extractAffinityData() {
  if (!fs.existsSync(HAKURAKU_UMDB_PATH)) {
    throw new Error(`hakuraku umdb.json not found at ${HAKURAKU_UMDB_PATH}`);
  }

  const rawData: RawUMDB = JSON.parse(fs.readFileSync(HAKURAKU_UMDB_PATH, "utf-8"));

  // 1. relation_type -> relation_point
  const relationPoints: Record<number, number> = {};
  for (const r of rawData.successionRelation || []) {
    if (r.relationType != null && r.relationPoint != null) {
      relationPoints[r.relationType] = r.relationPoint;
    }
  }

  // 2. chara_id -> relation_type[]
  const charaRelationTypes: Record<number, number[]> = {};
  for (const m of rawData.successionRelationMember || []) {
    if (m.charaId != null && m.relationType != null) {
      if (!charaRelationTypes[m.charaId]) {
        charaRelationTypes[m.charaId] = [];
      }
      charaRelationTypes[m.charaId].push(m.relationType);
    }
  }

  // 3. G1 Saddles (raceInstanceId in 100000..199999) & WinSaddle -> RaceInstance
  const g1Saddles: number[] = [];
  const winSaddleToRaceInstance: Record<number, number> = {};
  for (const s of rawData.singleModeWinsSaddle || []) {
    if (s.id == null) continue;
    const rIds = s.raceInstanceIds && s.raceInstanceIds.length > 0
      ? s.raceInstanceIds
      : (s.raceInstanceId ? [s.raceInstanceId] : []);

    if (rIds.length === 1 && rIds[0] >= 100000 && rIds[0] < 200000) {
      g1Saddles.push(s.id);
    }
    if (s.raceInstanceId) {
      winSaddleToRaceInstance[s.id] = s.raceInstanceId;
    }
  }

  // 4. Factor Names (textData category 147)
  const factorNames: Record<number, string> = {};
  for (const t of rawData.textData || []) {
    if (t.category === 147 && t.index != null && t.text) {
      factorNames[t.index] = t.text;
    }
  }

  // 5. Saddle / Trophy Names (textData category 111)
  const saddleNames: Record<number, string> = {};
  for (const t of rawData.textData || []) {
    if (t.category === 111 && t.index != null && t.text) {
      saddleNames[t.index] = t.text;
    }
  }

  // 6. Merge GameTora succession data (newer master dump covering all released chars).
  const gtRelationPath = path.join(GAMETORA_DIR, "succession_relation.json");
  const gtMemberPath = path.join(GAMETORA_DIR, "succession_relation_member.json");
  const gtFactorsPath = path.join(GAMETORA_DIR, "factors.json");

  let gtRelations = 0;
  let gtMembers = 0;
  let gtFactorNames = 0;

  if (fs.existsSync(gtRelationPath) && fs.existsSync(gtMemberPath)) {
    // relation_point per type — GameTora wins on conflicts (newer dump)
    const gtRelation: GameToraRelation[] = JSON.parse(fs.readFileSync(gtRelationPath, "utf-8"));
    for (const r of gtRelation) {
      if (r.relation_type != null && r.relation_point != null) {
        relationPoints[r.relation_type] = r.relation_point;
        gtRelations++;
      }
    }

    // chara_id -> relation_type[] — union with umdb, only types with a known point
    const gtMember: GameToraRelationMember[] = JSON.parse(fs.readFileSync(gtMemberPath, "utf-8"));
    for (const m of gtMember) {
      if (m.chara_id == null || m.relation_type == null) continue;
      if (relationPoints[m.relation_type] == null) continue;
      const list = charaRelationTypes[m.chara_id] ?? (charaRelationTypes[m.chara_id] = []);
      if (!list.includes(m.relation_type)) {
        list.push(m.relation_type);
        gtMembers++;
      }
    }
  } else {
    console.warn("GameTora succession files not found — run `bun run fetch:gametora` to refresh.");
  }

  if (fs.existsSync(gtFactorsPath)) {
    // Fill factor names missing from umdb textData, preferring English names
    const gtFactors = JSON.parse(fs.readFileSync(gtFactorsPath, "utf-8")) as {
      blue?: GameToraFactor[];
      other?: GameToraFactor[];
    };
    for (const factor of [...(gtFactors.blue ?? []), ...(gtFactors.other ?? [])]) {
      const id = Number(factor.id);
      if (!Number.isFinite(id) || factorNames[id]) continue;
      const name = factor.name_en || factor.name_ja;
      if (name) {
        factorNames[id] = name;
        gtFactorNames++;
      }
    }
  }

  // 7. GameTora career objectives -> lib/data/careers.json (G1 races only).
  // Objective race ids map to umdb G1 saddles via winSaddleToRaceInstance
  // (raceInstanceId = <raceId><instance suffix>, so raceId = floor(/100)).
  const objectivesPath = path.join(GAMETORA_DIR, "objectives.json");
  let careerCoverage = "";
  if (fs.existsSync(objectivesPath)) {
    const objectivesByTalentGroup = JSON.parse(
      fs.readFileSync(objectivesPath, "utf-8")
    ) as Record<string, GameToraObjective[]>;

    // raceId -> saddleId; prefer the smallest saddle id when several share a race.
    const saddleByRaceId = new Map<number, number>();
    for (const [saddleStr, instance] of Object.entries(winSaddleToRaceInstance)) {
      const raceId = Math.floor(instance / 100);
      const saddleId = Number(saddleStr);
      const prev = saddleByRaceId.get(raceId);
      if (prev === undefined || saddleId < prev) saddleByRaceId.set(raceId, saddleId);
    }

    const careers: Record<string, CareerRace[]> = {};
    const seenRaceIdsByCharId = new Map<number, Set<number>>();
    let g1Total = 0;
    let g1Mapped = 0;
    for (const [talentGroupStr, objectives] of Object.entries(objectivesByTalentGroup)) {
      const talentGroup = Number(talentGroupStr);
      if (!Number.isFinite(talentGroup)) continue;
      const charId = Math.floor(talentGroup / 100);
      // Variant pages (100101/100102/…) share the same career; dedupe by race id per charId.
      const seenRaceIds = seenRaceIdsByCharId.get(charId) ?? new Set<number>();
      seenRaceIdsByCharId.set(charId, seenRaceIds);
      const races: CareerRace[] = [];
      for (const objective of objectives || []) {
        const mustWin = objective.condValue === 1;
        for (const race of objective.races || []) {
          if (race.grade !== 100) continue; // G1s only — everything else is schedule noise
          if (seenRaceIds.has(race.id)) continue;
          seenRaceIds.add(race.id);
          g1Total++;
          const saddleId = saddleByRaceId.get(race.id);
          if (saddleId != null) g1Mapped++;
          races.push({
            saddleId,
            raceId: race.id,
            nameEn: race.nameEn || race.nameJp || `Race ${race.id}`,
            grade: race.grade,
            trackId: race.track ?? 0,
            distance: race.distance ?? 0,
            terrain: race.terrain ?? 0,
            mustWin,
          });
        }
      }
      if (races.length > 0) {
        const key = String(charId);
        careers[key] = (careers[key] ?? []).concat(races);
      }
    }

    fs.writeFileSync(CAREERS_OUTPUT_PATH, JSON.stringify(careers));
    const careersStats = fs.statSync(CAREERS_OUTPUT_PATH);
    let withCareer = 0;
    let rosterTotal = 0;
    if (fs.existsSync(CHARACTERS_PATH)) {
      const chars = JSON.parse(fs.readFileSync(CHARACTERS_PATH, "utf-8"));
      const charIds: number[] = [
        ...new Set<number>((Array.isArray(chars) ? chars : chars.default).map((c: any) => c.charId as number)),
      ];
      rosterTotal = charIds.length;
      withCareer = charIds.filter((c) => careers[String(c)]?.length).length;
    }
    careerCoverage =
      `Career data: ${Object.keys(careers).length} characters (${withCareer}/${rosterTotal} on roster)` +
      ` → ${CAREERS_OUTPUT_PATH} (${(careersStats.size / 1024).toFixed(1)} KB)` +
      `; G1 saddle mapping ${g1Mapped}/${g1Total}`;
  } else {
    console.warn(
      "GameTora objectives.json not found — run `bun run fetch:gametora` to generate career data."
    );
  }

  // Coverage report against the playable character roster
  let coverage = "";
  if (fs.existsSync(CHARACTERS_PATH)) {
    const chars = JSON.parse(fs.readFileSync(CHARACTERS_PATH, "utf-8"));
    const charIds: number[] = [
      ...new Set<number>((Array.isArray(chars) ? chars : chars.default).map((c: any) => c.charId as number)),
    ];
    const missing = charIds.filter((c) => !charaRelationTypes[c]?.length);
    coverage = `Relation coverage: ${charIds.length - missing.length}/${charIds.length} characters` +
      (missing.length ? ` (missing: ${missing.join(", ")})` : " (complete)");
  }

  const payload = {
    relationPoints,
    charaRelationTypes,
    g1Saddles,
    winSaddleToRaceInstance,
    factorNames,
    saddleNames,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload));
  const stats = fs.statSync(OUTPUT_PATH);
  console.log(`Successfully generated ${OUTPUT_PATH} (${(stats.size / 1024).toFixed(1)} KB)`);
  console.log(
    `GameTora merge: +${gtRelations} relation points, +${gtMembers} member rows, +${gtFactorNames} factor names`
  );
  if (coverage) console.log(coverage);
  if (careerCoverage) console.log(careerCoverage);
}

extractAffinityData();
