import type { CardIndexEntry, CardMeta } from "../data/types";
import { cardCharacterKey } from "../deck/card-constraints";
import { getInheritableSkillForGold } from "../skills/rarity";

export interface AutoPickEvent { eventId: number; choices: { index: number; skillIds: number[] }[] }
export interface AutoPickCard {
  cardId: number; characterKey: string; rarity: number; release: string | null;
  hintSkillIds: number[];
  /** Events with at least one skill, each choice's skills resolved and de-duplicated. */
  events: AutoPickEvent[];
  /** Event skills listed in meta.events but in no eventDetails choice. */
  looseEventSkillIds: number[];
}

/** Gold -> inheritable white id (null when a gold has no white version); other ids unchanged. */
export function resolveSkillId(rawId: number, rarityOf: (id: number) => number | undefined): number | null {
  if (rarityOf(rawId) === 2) return getInheritableSkillForGold(rawId)?.whiteId ?? null;
  return rawId;
}

function resolveAll(ids: readonly number[] | undefined, rarityOf: (id: number) => number | undefined): number[] {
  const out = new Set<number>();
  for (const id of ids ?? []) {
    const resolved = resolveSkillId(id, rarityOf);
    if (resolved !== null) out.add(resolved);
  }
  return [...out];
}

export function buildAutoPickCard(card: CardIndexEntry, meta: CardMeta | undefined, rarityOf: (id: number) => number | undefined): AutoPickCard {
  const events: AutoPickEvent[] = [];
  const inChoices = new Set<number>();
  for (const detail of meta?.eventDetails ?? []) {
    const choices = detail.choices.map((c) => ({ index: c.index, skillIds: resolveAll(c.skillIds, rarityOf) }));
    if (!choices.some((c) => c.skillIds.length > 0)) continue;
    for (const c of choices) for (const id of c.skillIds) inChoices.add(id);
    events.push({ eventId: detail.eventId, choices });
  }
  return {
    cardId: card.id,
    characterKey: cardCharacterKey(card),
    rarity: card.rarity,
    release: card.release ?? null,
    hintSkillIds: resolveAll(meta?.hints, rarityOf),
    events,
    looseEventSkillIds: resolveAll(meta?.events, rarityOf).filter((id) => !inChoices.has(id)),
  };
}

/**
 * Skills a deck actually grants: hints, loose event skills, and for each event only the choice in use
 * (`choiceOf` returns the deck's chosen or default index). A single-choice event is always granted,
 * matching the deck's resolver.
 */
export function grantedSkillIds(cards: readonly AutoPickCard[], choiceOf: (cardId: number, eventId: number) => number): number[] {
  const out = new Set<number>();
  for (const c of cards) {
    for (const id of c.hintSkillIds) out.add(id);
    for (const id of c.looseEventSkillIds) out.add(id);
    for (const e of c.events) {
      const chosen = e.choices.length <= 1 ? e.choices[0] : e.choices.find((ch) => ch.index === choiceOf(c.cardId, e.eventId));
      for (const id of chosen?.skillIds ?? []) out.add(id);
    }
  }
  return [...out].sort((a, b) => a - b);
}

export function collectSkillIds(cards: readonly AutoPickCard[]): number[] {
  const out = new Set<number>();
  for (const c of cards) {
    for (const id of c.hintSkillIds) out.add(id);
    for (const id of c.looseEventSkillIds) out.add(id);
    for (const e of c.events) for (const ch of e.choices) for (const id of ch.skillIds) out.add(id);
  }
  return [...out].sort((a, b) => a - b);
}
