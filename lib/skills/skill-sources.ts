// Every known way to obtain a skill, flattened from the local datasets.
//
// Builds on the card/character grant indexers in skill-grants.ts and adds the
// trainee-side grants (innate, awakening/potential, trainee events). Scenario
// rewards are not part of the shipped datasets, so they are never reported.

import type { CardIndexEntry, CharacterIndexEntry, SkillDetail } from "../data/types";
import { getCardsGrantingSkill, getCharactersGrantingSkill } from "./skill-grants";

export type SkillSourceKind =
  | "card-hint"
  | "card-event"
  | "card-chain"
  | "character-unique"
  | "character-innate"
  | "character-awakening"
  | "character-event";

export interface CardSkillSource {
  kind: "card-hint" | "card-event" | "card-chain";
  card: CardIndexEntry;
  eventName?: string;
  choiceIndex?: number;
  choiceText?: string;
  chainStep?: number;
}

export interface CharacterSkillSource {
  kind: "character-unique" | "character-innate" | "character-awakening" | "character-event";
  character: CharacterIndexEntry;
  /** Potential level (2–5) for awakening grants. */
  awakeningLevel?: number;
}

export type SkillSource = CardSkillSource | CharacterSkillSource;

export const SKILL_SOURCE_LABELS: Record<SkillSourceKind, string> = {
  "card-chain": "Chain event",
  "card-event": "Support event",
  "card-hint": "Support hint",
  "character-unique": "Unique skill",
  "character-innate": "Trainee innate",
  "character-awakening": "Potential level",
  "character-event": "Trainee event",
};

/** Display order for grouped source lists. */
export const SKILL_SOURCE_ORDER: SkillSourceKind[] = [
  "card-chain",
  "card-event",
  "card-hint",
  "character-unique",
  "character-event",
  "character-awakening",
  "character-innate",
];

export function collectSkillSources(
  skillId: number,
  cards: CardIndexEntry[],
  characters: CharacterIndexEntry[],
  skillsById?: Map<number, SkillDetail>,
): SkillSource[] {
  const sources: SkillSource[] = [];

  for (const grant of getCardsGrantingSkill(skillId, cards)) {
    sources.push({
      kind: grant.source === "hint" ? "card-hint" : grant.isChain ? "card-chain" : "card-event",
      card: grant.card,
      eventName: grant.eventName,
      choiceIndex: grant.choiceIndex,
      choiceText: grant.choiceText,
      chainStep: grant.chainStep,
    });
  }

  for (const { character } of getCharactersGrantingSkill(skillId, characters, skillsById)) {
    sources.push({ kind: "character-unique", character });
  }

  for (const character of characters) {
    if (character.eventSkills?.includes(skillId)) sources.push({ kind: "character-event", character });
    const awakeningIndex = character.awakeningSkills?.indexOf(skillId) ?? -1;
    if (awakeningIndex >= 0) sources.push({ kind: "character-awakening", character, awakeningLevel: awakeningIndex + 2 });
    if (character.innateSkills?.includes(skillId)) sources.push({ kind: "character-innate", character });
  }

  return sources;
}

export function groupSkillSources(sources: SkillSource[]): { kind: SkillSourceKind; sources: SkillSource[] }[] {
  return SKILL_SOURCE_ORDER
    .map((kind) => ({ kind, sources: sources.filter((source) => source.kind === kind) }))
    .filter((group) => group.sources.length > 0);
}
