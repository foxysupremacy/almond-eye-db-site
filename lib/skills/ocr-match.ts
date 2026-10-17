// Fuzzy skill-name matching for OCR output.
//
// OCR on game screenshots is noisy: spaces between glyphs, dropped "!",
// small/large kana swaps (ッ/ツ), long-vowel marks read as "一" or "-", and
// the occasional wrong kanji. Each OCR line is compared against every skill
// name with an approximate-substring edit distance, so a name is still found
// when it shares a line with other text or has a misread glyph or two.

export interface OcrMatchableSkill {
  id: number;
  nameJp: string;
  nameEn: string;
}

export interface OcrSkillMatch<T extends OcrMatchableSkill = OcrMatchableSkill> {
  skill: T;
  /** 0..1, 1 = exact line match. */
  score: number;
  /** The OCR line that produced the best score. */
  line: string;
}

const SMALL_KANA: Record<string, string> = {
  ぁ: "あ", ぃ: "い", ぅ: "う", ぇ: "え", ぉ: "お", っ: "つ", ゃ: "や", ゅ: "ゆ", ょ: "よ", ゎ: "わ",
  ァ: "ア", ィ: "イ", ゥ: "ウ", ェ: "エ", ォ: "オ", ッ: "ツ", ャ: "ヤ", ュ: "ユ", ョ: "ヨ", ヮ: "ワ",
};

const CJK = /[぀-ヿ㐀-鿿]/;

/** Canonical comparison form; applied identically to OCR text and skill names. */
export function normalizeOcrText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s!?・･、。,.「」『』()"'“”‘’…:;|_~〜*]/g, "")
    .replace(/[-‐‑–—―一ｰ]/g, "ー")
    .replace(/[ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ]/g, (kana) => SMALL_KANA[kana] ?? kana);
}

/** Edit distance of `needle` against the best-matching window of `haystack`. */
export function substringEditDistance(needle: string, haystack: string): number {
  const n = needle.length;
  if (n === 0) return 0;
  let previous = new Array<number>(haystack.length + 1).fill(0);
  for (let i = 1; i <= n; i += 1) {
    const current = new Array<number>(haystack.length + 1);
    current[0] = i;
    for (let j = 1; j <= haystack.length; j += 1) {
      const cost = needle[i - 1] === haystack[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return Math.min(...previous);
}

function scoreName(name: string, line: string): number {
  if (!name || !line) return 0;
  if (name === line) return 1;
  if (name.length > 2 && ![...name].some((char) => line.includes(char))) return 0;
  // Short and Latin-script names (e.g. "K.Speed") only count when they appear
  // verbatim; fuzzy matching them hits ordinary English UI text.
  const maxErrors = name.length <= 2 || !CJK.test(name) ? 0 : Math.floor(name.length / 3);
  const distance = substringEditDistance(name, line);
  if (distance > maxErrors) return 0;
  const similarity = 1 - distance / name.length;
  // Prefer names that cover most of the line over short names hiding inside it.
  const coverage = Math.min(name.length, line.length) / Math.max(name.length, line.length);
  return similarity * (0.8 + 0.2 * coverage);
}

function scoreTypedEnglish(name: string, query: string): number {
  if (!name || query.length < 3 || !name.includes(query)) return 0;
  return name === query ? 1 : 0.6 + 0.4 * (query.length / name.length);
}

/** OCR lines worth matching: normalized, de-duplicated, non-trivial. */
export function extractOcrLines(text: string): string[] {
  const lines = text.split(/\r?\n/).map(normalizeOcrText).filter((line) => line.length >= 2);
  return [...new Set(lines)];
}

export function matchSkillsFromOcrText<T extends OcrMatchableSkill>(
  text: string,
  skills: readonly T[],
  { limit = 8, minScore = 0.5 }: { limit?: number; minScore?: number } = {},
): OcrSkillMatch<T>[] {
  const lines = extractOcrLines(text);
  if (lines.length === 0) return [];

  const best = new Map<number, OcrSkillMatch<T>>();
  for (const skill of skills) {
    const jp = normalizeOcrText(skill.nameJp);
    const en = normalizeOcrText(skill.nameEn);
    for (const line of lines) {
      // Japanese lines are fuzzy-matched against Japanese names; Latin text is
      // treated as a typed English query and must appear inside the name.
      const score = CJK.test(line) ? scoreName(jp, line) : scoreTypedEnglish(en, line);
      if (score < minScore) continue;
      const current = best.get(skill.id);
      if (!current || score > current.score) best.set(skill.id, { skill, score, line });
    }
  }

  const ranked = [...best.values()].sort(
    (a, b) => b.score - a.score || a.skill.nameJp.length - b.skill.nameJp.length || a.skill.id - b.skill.id,
  );
  // A strong hit makes weak, incidental matches noise.
  const cutoff = (ranked[0]?.score ?? 0) * 0.6;
  return ranked.filter((match) => match.score >= cutoff).slice(0, limit);
}
