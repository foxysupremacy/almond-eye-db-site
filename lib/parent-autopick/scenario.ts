import type { CardIndexEntry, ScenarioLinkEntry } from "../data/types";

export const SCENARIO_LABELS_EN: Record<number, string> = { 12: "Onsen", 13: "Beyond Dreams", 14: "Tracen-ken" };

export function scenarioLabel(entry: ScenarioLinkEntry): { en: string; jp: string } {
  return { en: SCENARIO_LABELS_EN[entry.scenarioId] ?? entry.nameJp, jp: entry.nameJp };
}

function newestFirst(a: CardIndexEntry, b: CardIndexEntry): number {
  const ra = a.release ?? "";
  const rb = b.release ?? "";
  if (ra !== rb) return ra < rb ? 1 : -1;
  return b.id - a.id;
}

/** Linked pal cards that exist in the card data: SSR before R, newer release first, then higher id. Main Deck membership is not checked (pal cards are exempt from the no-duplicate rule). */
export function palCardOptions(entry: ScenarioLinkEntry, cardsById: ReadonlyMap<number, CardIndexEntry>): CardIndexEntry[] {
  const out: CardIndexEntry[] = [];
  const seen = new Set<number>();
  for (const id of entry.palCardIds) {
    const card = cardsById.get(id);
    if (!card || seen.has(id)) continue;
    seen.add(id);
    out.push(card);
  }
  return out.sort((a, b) => {
    const sa = a.rarity === 3 ? 0 : 1;
    const sb = b.rarity === 3 ? 0 : 1;
    return sa - sb || newestFirst(a, b);
  });
}

/** preferredId when it is among the options; else newest owned SSR; else first option (newest SSR, else newest R); null when no options. */
export function resolvePalCard(options: readonly CardIndexEntry[], owned: Readonly<Record<string, number>>, preferredId?: number | null): CardIndexEntry | null {
  if (options.length === 0) return null;
  if (preferredId != null) {
    const preferred = options.find((c) => c.id === preferredId);
    if (preferred) return preferred;
  }
  const ownedSsr = options.find((c) => c.rarity === 3 && Object.prototype.hasOwnProperty.call(owned, String(c.id)));
  return ownedSsr ?? options[0];
}

/** Owned ids that exist in cardsById, minus Main Deck ids and minus lockedId. */
export function candidateCardIds(owned: Readonly<Record<string, number>>, cardsById: ReadonlyMap<number, CardIndexEntry>, mainDeckIds: ReadonlySet<number>, lockedId: number | null): number[] {
  const out: number[] = [];
  for (const key of Object.keys(owned)) {
    const id = Number(key);
    if (!Number.isFinite(id) || !cardsById.has(id) || mainDeckIds.has(id) || id === lockedId) continue;
    out.push(id);
  }
  return out;
}
