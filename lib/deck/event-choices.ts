import type { CardEventDetail, CardIndexEntry, EventSkillMetadata, SkillSummary } from "../api";

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

export interface ActiveEventSource {
  /** False only when every granting choice is unpicked. */
  active: boolean;
  /** The granting source to attribute: the matching one when active, else the first. */
  meta?: EventSkillMetadata;
  /** True when every source sits in an event with more than one choice. */
  branching: boolean;
}

/**
 * Decide whether an event skill is granted under the current chain choices.
 * A skill is granted when ANY of its sources is a single-choice event or the
 * picked (or default) option of its branching event.
 */
export function resolveActiveEventSource(
  card: CardIndexEntry,
  skill: Pick<SkillSummary, "eventMeta" | "eventSources">,
  chainChoices: Record<string, number> | undefined,
  skillRarityLookup?: (id: number) => number,
): ActiveEventSource {
  const sources = skill.eventSources ?? (skill.eventMeta ? [skill.eventMeta] : []);
  if (sources.length === 0 || !card.eventDetails) {
    return { active: true, meta: skill.eventMeta, branching: false };
  }

  let branching = true;
  for (const source of sources) {
    const evDetail = card.eventDetails.find((ev) => ev.eventId === source.eventId);
    if (!evDetail || !evDetail.choices || evDetail.choices.length <= 1) {
      return { active: true, meta: source, branching: false };
    }
    const selectedChoice =
      chainChoices?.[`${card.id}:${source.eventId}`] ??
      chainChoices?.[String(card.id)] ??
      getDefaultChoiceIndex(evDetail, skillRarityLookup);
    if (source.choiceIndex === selectedChoice) {
      return { active: true, meta: source, branching };
    }
  }
  return { active: false, meta: sources[0], branching };
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
