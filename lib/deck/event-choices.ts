import type { CardEventDetail } from "../data-store";

export function getDefaultChoiceIndex(
  eventDetail: CardEventDetail,
  skillRarityLookup?: (id: number) => number,
): number {
  if (!eventDetail.choices || eventDetail.choices.length <= 1) return 1;

  let bestIndex = 1;
  let bestScore = -1;

  for (const ch of eventDetail.choices) {
    let score = 0;
    for (const sid of ch.skillIds) {
      const rarity = skillRarityLookup ? skillRarityLookup(sid) : (sid >= 200000 ? 1 : 1);
      score += rarity === 2 ? 10 : 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = ch.index;
    }
  }

  return bestIndex;
}

export function cleanChoices(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const res: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k === "string" && typeof v === "number" && Number.isFinite(v)) {
      res[k] = v;
    }
  }
  return Object.keys(res).length > 0 ? res : undefined;
}
