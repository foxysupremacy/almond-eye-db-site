import type { AutoPickCard } from "./cards";
import type { SkillValue } from "./values";

export interface PickedSkill { skillId: number; value: number; flat: boolean; source: "hint" | "event"; eventId?: number; choiceIndex?: number }
export interface PickedCard {
  cardId: number; locked: boolean; gain: number;
  /** Borrowed (not owned): fills the deck's rental slot. At most `maxRental` picks are rentals. */
  rental: boolean;
  /** Only skills with value > 0 that were not covered before this card, highest value first. */
  skills: PickedSkill[];
  /**
   * `${cardId}:${eventId}` → choice index, for every event of the card that has 2+ choices (raw count,
   * with or without resolved skills) and whose chosen choice credits at least one skill. Events where
   * every choice credits nothing get no key, so the user's existing (or default) choice stays.
   */
  chainChoices: Record<string, number>;
}
export interface AutoPickResult { picks: PickedCard[]; total: number }

const EPS = 1e-9;

/** Negative when `a` should be preferred over `b` on a tie. */
function tieCompare(a: AutoPickCard, b: AutoPickCard): number {
  if (a.rarity !== b.rarity) return b.rarity - a.rarity;
  if (a.release !== b.release) {
    if (a.release === null) return 1;
    if (b.release === null) return -1;
    return a.release < b.release ? 1 : -1;
  }
  return a.cardId - b.cardId;
}

interface Evaluation { picks: PickedCard[]; total: number }

export function pickParentDeck(input: {
  cards: readonly AutoPickCard[];
  values: ReadonlyMap<number, SkillValue>;
  coveredSkillIds: ReadonlySet<number>;
  locked: AutoPickCard | null;
  deckSize?: number;
  maxSwapPasses?: number;
  /** Cards the user would have to borrow (not owned). Omit for owned-only picking. */
  rentalCardIds?: ReadonlySet<number>;
  /** Rentals allowed in the deck (the game allows one borrowed card per career). */
  maxRental?: number;
}): AutoPickResult {
  const { values, coveredSkillIds, locked } = input;
  const deckSize = input.deckSize ?? 6;
  const maxSwapPasses = input.maxSwapPasses ?? 20;
  const maxRental = input.maxRental ?? 1;
  const isRental = (c: AutoPickCard) => input.rentalCardIds?.has(c.cardId) ?? false;
  const rentalsIn = (list: readonly AutoPickCard[], skip = -1) => list.reduce((n, c, i) => n + (i !== skip && isRental(c) ? 1 : 0), 0);
  // On equal value an owned card beats a rental, so the rental is spent only when it adds value.
  const prefer = (a: AutoPickCard, b: AutoPickCard) => (isRental(a) !== isRental(b) ? (isRental(a) ? 1 : -1) : tieCompare(a, b));

  const valueOf = (id: number) => values.get(id);

  function evaluate(order: readonly AutoPickCard[]): Evaluation {
    const covered = new Set(coveredSkillIds);
    const picks: PickedCard[] = [];
    let total = 0;
    for (const card of order) {
      const skills: PickedSkill[] = [];
      const chainChoices: Record<string, number> = {};
      const take = (id: number, extra: Pick<PickedSkill, "source" | "eventId" | "choiceIndex">) => {
        if (covered.has(id)) return;
        covered.add(id);
        const v = valueOf(id);
        if (v && v.value > 0) skills.push({ skillId: id, value: v.value, flat: v.flat, ...extra });
      };
      for (const id of card.hintSkillIds) take(id, { source: "hint" });
      for (const id of card.looseEventSkillIds) take(id, { source: "event" });
      for (const ev of card.events) {
        let best: (typeof ev.choices)[number] | null = null;
        let bestSum = -1;
        for (const ch of ev.choices) {
          let sum = 0;
          for (const id of new Set(ch.skillIds)) if (!covered.has(id)) sum += valueOf(id)?.value ?? 0;
          if (sum > bestSum + EPS || (Math.abs(sum - bestSum) <= EPS && best !== null && ch.index < best.index)) {
            best = ch;
            bestSum = sum;
          }
        }
        if (!best) continue;
        // Every choice credits nothing: take nothing and leave the user's (or the default) choice alone.
        if (bestSum <= EPS) continue;
        if (ev.choices.length >= 2) chainChoices[`${card.cardId}:${ev.eventId}`] = best.index;
        for (const id of best.skillIds) take(id, { source: "event", eventId: ev.eventId, choiceIndex: best.index });
      }
      skills.sort((a, b) => b.value - a.value || a.skillId - b.skillId);
      const gain = skills.reduce((t, s) => t + s.value, 0);
      total += gain;
      picks.push({ cardId: card.cardId, locked: locked !== null && card.cardId === locked.cardId, rental: isRental(card), gain, skills, chainChoices });
    }
    return { picks, total };
  }

  const candidates = input.cards
    .filter((c) => !locked || (c.cardId !== locked.cardId && c.characterKey !== locked.characterKey))
    .slice()
    .sort(tieCompare);

  const order: AutoPickCard[] = locked ? [locked] : [];
  const fixed = locked ? 1 : 0;
  const keysOf = (list: readonly AutoPickCard[], skip = -1) => new Set(list.filter((_, i) => i !== skip).map((c) => c.characterKey));

  // Greedy.
  let current = evaluate(order);
  while (order.length < deckSize) {
    const keys = keysOf(order);
    const rentalFull = rentalsIn(order) >= maxRental;
    let best: AutoPickCard | null = null;
    let bestGain = EPS;
    for (const c of candidates) {
      if (order.includes(c) || keys.has(c.characterKey)) continue;
      if (rentalFull && isRental(c)) continue;
      const gain = evaluate([...order, c]).total - current.total;
      if (gain > bestGain + EPS || (best !== null && Math.abs(gain - bestGain) <= EPS && prefer(c, best) < 0)) {
        best = c;
        bestGain = gain;
      }
    }
    if (!best) break;
    order.push(best);
    current = evaluate(order);
  }

  // Swap passes.
  for (let pass = 0; pass < maxSwapPasses; pass++) {
    let bestSwap: { pos: number; card: AutoPickCard; total: number } | null = null;
    for (let pos = fixed; pos < order.length; pos++) {
      const keys = keysOf(order, pos);
      const rentalFull = rentalsIn(order, pos) >= maxRental;
      for (const c of candidates) {
        if (order.includes(c) || keys.has(c.characterKey)) continue;
        if (rentalFull && isRental(c)) continue;
        const next = order.slice();
        next[pos] = c;
        const total = evaluate(next).total;
        if (total <= current.total + EPS) continue;
        if (!bestSwap || total > bestSwap.total + EPS || (Math.abs(total - bestSwap.total) <= EPS && prefer(c, bestSwap.card) < 0)) {
          bestSwap = { pos, card: c, total };
        }
      }
    }
    if (!bestSwap) break;
    order[bestSwap.pos] = bestSwap.card;
    current = evaluate(order);
  }

  // Final order: locked first, others by gain desc (ties by card rules). Re-evaluating in that order
  // can re-allocate event choices; keep it only when it does not lower the optimized total.
  const gainById = new Map(current.picks.map((p) => [p.cardId, p.gain]));
  const rest = order.slice(fixed).sort((a, b) => (gainById.get(b.cardId)! - gainById.get(a.cardId)!) || tieCompare(a, b));
  const sorted = evaluate([...order.slice(0, fixed), ...rest]);
  return sorted.total >= current.total - EPS ? sorted : current;
}
