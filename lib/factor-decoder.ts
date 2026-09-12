// Factor / Spark decoder for Umamusume veterans data.
// Maps numeric factor IDs to human-readable names, types (blue, pink, green, white), and star levels.

export type FactorType = "blue" | "pink" | "green" | "white";

export interface DecodedFactor {
  factorId: number;
  type: FactorType;
  name: string;
  stars: number; // 1, 2, or 3
}

const BLUE_STAT_NAMES: Record<number, string> = {
  1: "Speed",
  2: "Stamina",
  3: "Power",
  4: "Guts",
  5: "Wit",
};

const PINK_APTITUDE_NAMES: Record<number, string> = {
  11: "Turf",
  12: "Dirt",
  21: "Sprint",
  22: "Mile",
  23: "Med",
  24: "Long",
  31: "Runner",
  32: "Leader",
  33: "Betweener",
  34: "Chaser",
};

export function decodeFactor(factorId: number): DecodedFactor {
  const str = String(factorId);
  const stars = Number(str.slice(-1)) || 1;

  // 1. Blue Factors (101..503)
  if (factorId >= 101 && factorId <= 503) {
    const statIndex = Math.floor(factorId / 100);
    const name = BLUE_STAT_NAMES[statIndex] || "Stat";
    return { factorId, type: "blue", name, stars };
  }

  // 2. Pink Factors (1101..3403)
  if (factorId >= 1101 && factorId <= 3403) {
    const prefix = Math.floor(factorId / 100);
    const name = PINK_APTITUDE_NAMES[prefix] || "Aptitude";
    return { factorId, type: "pink", name, stars };
  }

  // 3. Green Factors (Unique Skills) - typically 7-8 digits matching card_id + 01..03
  if (str.length === 8 && (str.endsWith("01") || str.endsWith("02") || str.endsWith("03"))) {
    return { factorId, type: "green", name: "Unique", stars };
  }

  // 4. White Factors (Skills, Races, Scenarios)
  return { factorId, type: "white", name: "Factor", stars };
}

/** Compute total blue stars for a veteran including self and immediate parents */
export function calculateLineageBlueStars(veteran: {
  factor_info_array?: { factor_id: number }[];
  succession_chara_array?: { position_id: number; factor_info_array?: { factor_id: number }[] }[];
}): { total: number; self: number; parents: number } {
  let selfStars = 0;
  let parentsStars = 0;

  // Self blue factors
  for (const f of veteran.factor_info_array || []) {
    if (f.factor_id >= 101 && f.factor_id <= 503) {
      selfStars += Number(String(f.factor_id).slice(-1)) || 1;
    }
  }

  // Parents (position_id 10 and 20 are parent 1 and parent 2)
  for (const p of veteran.succession_chara_array || []) {
    if (p.position_id === 10 || p.position_id === 20) {
      for (const f of p.factor_info_array || []) {
        if (f.factor_id >= 101 && f.factor_id <= 503) {
          parentsStars += Number(String(f.factor_id).slice(-1)) || 1;
        }
      }
    }
  }

  return {
    self: selfStars,
    parents: parentsStars,
    total: selfStars + parentsStars,
  };
}

export const BLUE_STAT_NAMES_JA: Record<number, { full: string; short: string }> = {
  1: { full: "スピード", short: "スピ" },
  2: { full: "スタミナ", short: "スタ" },
  3: { full: "パワー", short: "パワ" },
  4: { full: "根性", short: "根性" },
  5: { full: "賢さ", short: "賢さ" },
};

export const PINK_APTITUDE_NAMES_JA: Record<number, string> = {
  11: "芝",
  12: "ダート",
  21: "短距離",
  22: "マイル",
  23: "中距離",
  24: "長距離",
  31: "逃げ",
  32: "先行",
  33: "差し",
  34: "追込",
};

export interface SlotPrimaryFactor {
  factorId: number;
  nameJa: string;
  nameEn: string;
  shortJa?: string;
  stars: number;
}

export interface SlotPrimaryFactors {
  blue?: SlotPrimaryFactor;
  pink?: SlotPrimaryFactor;
  green?: SlotPrimaryFactor;
}

/** Extract primary blue, pink, and green factor for in-game formation cards */
export function extractSlotPrimaryFactors(factorArray?: { factor_id: number }[]): SlotPrimaryFactors {
  const res: SlotPrimaryFactors = {};
  if (!factorArray || factorArray.length === 0) return res;

  for (const f of factorArray) {
    const id = f.factor_id;
    const str = String(id);
    const stars = Number(str.slice(-1)) || 1;

    // Blue Stat Factor (101..503)
    if (!res.blue && id >= 101 && id <= 503) {
      const idx = Math.floor(id / 100);
      const meta = BLUE_STAT_NAMES_JA[idx] || { full: "ステータス", short: "ステ" };
      res.blue = {
        factorId: id,
        nameJa: meta.full,
        shortJa: meta.short,
        nameEn: BLUE_STAT_NAMES[idx] || "Stat",
        stars,
      };
    }
    // Pink Aptitude Factor (1101..3403)
    else if (!res.pink && id >= 1101 && id <= 3403) {
      const prefix = Math.floor(id / 100);
      res.pink = {
        factorId: id,
        nameJa: PINK_APTITUDE_NAMES_JA[prefix] || "適性",
        nameEn: PINK_APTITUDE_NAMES[prefix] || "Aptitude",
        stars,
      };
    }
    // Green Unique Skill Factor (7-8 digits)
    else if (!res.green && (str.length === 8 && (str.endsWith("01") || str.endsWith("02") || str.endsWith("03")))) {
      res.green = {
        factorId: id,
        nameJa: "固有",
        nameEn: "Unique",
        stars,
      };
    }
  }

  return res;
}

export interface LineageStatBonuses {
  speed: number;
  stamina: number;
  power: number;
  guts: number;
  wiz: number;
}

/**
 * Calculates in-game starting stat bonuses from blue factors across all bloodline participants.
 * In Umamusume: 3★ = +21, 2★ = +12, 1★ = +5.
 */
export function calculateLineageStatBonuses(
  participants: ({ factor_info_array?: { factor_id: number }[] } | null | undefined)[]
): LineageStatBonuses {
  const totals: LineageStatBonuses = {
    speed: 0,
    stamina: 0,
    power: 0,
    guts: 0,
    wiz: 0,
  };

  const starBonus = (stars: number) => (stars === 3 ? 21 : stars === 2 ? 12 : stars === 1 ? 5 : 0);

  for (const p of participants) {
    if (!p?.factor_info_array) continue;
    for (const f of p.factor_info_array) {
      if (f.factor_id >= 101 && f.factor_id <= 503) {
        const statIdx = Math.floor(f.factor_id / 100);
        const stars = Number(String(f.factor_id).slice(-1)) || 1;
        const b = starBonus(stars);
        if (statIdx === 1) totals.speed += b;
        else if (statIdx === 2) totals.stamina += b;
        else if (statIdx === 3) totals.power += b;
        else if (statIdx === 4) totals.guts += b;
        else if (statIdx === 5) totals.wiz += b;
      }
    }
  }

  return totals;
}
