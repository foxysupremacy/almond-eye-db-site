// Pure recommendation engine for Uma Musume Parent Deck building.
// Ranks support cards based on skills matching the target race course & style
// that the Main Deck does NOT have, with priority boost for skills that
// activate on the selected course geometry.

import cardData from "./card-data.json";
import rawSkillsData from "./data/skills.json";
import type { Course } from "./skill-engine/types";
import { computeAllZones, horseForStrategy } from "./skill-engine/zones";
import { getInheritableSkillForGold } from "./skill-rarity";

const skillIconMap = new Map<number, number | null>((rawSkillsData as any[]).map((s) => [s.id, s.iconId]));

export interface SkillMeta {
  nameEn: string;
  nameJp: string;
  descEn?: string;
  rarity: number;
  styles: number[];     // 1: Runner, 2: Leader, 3: Betweener, 4: Chaser
  distances: number[];  // 1: Sprint, 2: Mile, 3: Medium, 4: Long
  surfaces: number[];   // 1: Turf, 2: Dirt
  isGeneric: boolean;
  conditions?: { condition: string; precondition?: string | null }[];
}

export interface CardEventChoice {
  index: number;
  textEn: string;
  textJp: string;
  skillIds: number[];
}

export interface CardEventDetail {
  eventId: number;
  nameEn: string;
  nameJp: string;
  choices: CardEventChoice[];
}

export interface EventSkillMetadata {
  eventId: number;
  eventNameEn: string;
  eventNameJp: string;
  choiceIndex: number;
  choiceTextEn: string;
  choiceTextJp: string;
  totalChoices: number;
}

export interface CardMeta {
  hints: number[];
  events: number[];
  eventDetails?: CardEventDetail[];
  nameEn: string;
  nameJp: string;
  rarity: number;
  type: string;
  urlName: string;
}

export interface NewSkillMatch {
  id: number;
  nameEn: string;
  nameJp: string;
  rarity?: number;
  iconId?: number | null;
  source: "hint" | "event";
  isSpecialized: boolean; // Matches specific style/track type
  firesOnCourse?: boolean; // Evaluated against active course geometry
  originalGoldName?: string;
  eventMeta?: EventSkillMetadata;
  choiceConflict?: boolean; // True if this skill comes from a choice branching event with competing matches
  isRecommendedChoice?: boolean; // True if this choice is the optimal scoring branch
}

export interface CardRecommendation {
  cardId: number;
  nameEn: string;
  nameJp: string;
  rarity: number;
  type: string;
  score: number;
  /** Skills provided by this card that are NOT in the Main Deck and match filters */
  newMatchingSkills: NewSkillMatch[];
  newHintCount: number;
  newEventCount: number;
  totalNewCount: number;
}

const cardMetaMap: Record<string, CardMeta> = cardData.cardMeta as Record<string, CardMeta>;
const skillMetaMap: Record<string, SkillMeta> = cardData.skillMeta as Record<string, SkillMeta>;

export { cardMetaMap, skillMetaMap };

export function isSkillMatchingFilter(
  skillId: number,
  style: number | null,
  distance: number | null,
  surface: number | null,
): { matches: boolean; isSpecialized: boolean } {
  const meta = skillMetaMap[skillId];
  if (!meta) return { matches: false, isSpecialized: false };

  let isSpecialized = false;

  // Running style check (1=Runner, 2=Leader, 3=Betweener, 4=Chaser, 5=Runaway)
  if (style !== null) {
    const checkStyle = style === 5 ? 1 : style; // Runaway uses Runner skills
    if (meta.styles.length > 0) {
      if (!meta.styles.includes(checkStyle)) return { matches: false, isSpecialized: false };
      isSpecialized = true;
    }
  }

  // Distance check (1=Sprint, 2=Mile, 3=Medium, 4=Long)
  if (distance !== null) {
    if (meta.distances.length > 0) {
      if (!meta.distances.includes(distance)) return { matches: false, isSpecialized: false };
      isSpecialized = true;
    }
  }

  // Surface check (1=Turf, 2=Dirt)
  if (surface !== null) {
    if (meta.surfaces.length > 0) {
      if (!meta.surfaces.includes(surface)) return { matches: false, isSpecialized: false };
      isSpecialized = true;
    }
  }

  return { matches: true, isSpecialized };
}

export function doesSkillFireOnCourse(
  skillId: number,
  course: Course,
  style: number | null,
): boolean | null {
  const meta = skillMetaMap[skillId];
  if (!meta || !meta.conditions || meta.conditions.length === 0) return null;

  const horse = style ? horseForStrategy(style) : undefined;
  try {
    const zones = computeAllZones(course, meta.conditions, horse);
    return zones.some((z) => z.regions.length > 0);
  } catch {
    return null;
  }
}

export function recommendCardsForParent({
  mainDeckSkillIds,
  equippedParentCardIds = [],
  course = null,
  style = null,
  distance = null,
  surface = null,
  limit = 12,
}: {
  mainDeckSkillIds: Set<number>;
  equippedParentCardIds?: (number | null)[];
  course?: Course | null;
  style?: number | null;
  distance?: number | null;
  surface?: number | null;
  limit?: number;
}): CardRecommendation[] {
  const equippedSet = new Set(equippedParentCardIds.filter((id): id is number => typeof id === "number"));
  const recommendations: CardRecommendation[] = [];

  // When a course is provided, derive target distance & surface directly from it
  const effDistance = course ? (course.distance as number) : distance;
  const effSurface = course ? (course.terrain as number) : surface;

  for (const [idStr, card] of Object.entries(cardMetaMap)) {
    const cardId = Number(idStr);
    if (equippedSet.has(cardId)) continue; // Skip cards already in parent slots

    const newMatchingSkills: NewSkillMatch[] = [];
    const seenSkillIds = new Set<number>();
    let score = 0;
    let newHintCount = 0;
    let newEventCount = 0;

    // Check hint skills (primary in parent farming)
    for (const sid of card.hints) {
      if (mainDeckSkillIds.has(sid) || seenSkillIds.has(sid)) continue;
      const filterCheck = isSkillMatchingFilter(sid, style, effDistance, effSurface);
      if (!filterCheck.matches) continue;

      const meta = skillMetaMap[sid];
      seenSkillIds.add(sid);
      newHintCount++;

      let firesOnCourse: boolean | undefined = undefined;
      let triggerBonus = 0;

      if (course) {
        const fires = doesSkillFireOnCourse(sid, course, style);
        if (fires === true) {
          firesOnCourse = true;
          triggerBonus = 4; // Substantial boost for skills activating on this exact track
        } else if (fires === false) {
          firesOnCourse = false;
          triggerBonus = -2; // Demote skills with zero activation zones on this course
        }
      }

      // Base score: 3 for specialized style/track hint, 1 for generic
      score += (filterCheck.isSpecialized ? 3 : 1) + triggerBonus;

      newMatchingSkills.push({
        id: sid,
        nameEn: meta?.nameEn || `Skill #${sid}`,
        nameJp: meta?.nameJp || "",
        rarity: meta?.rarity ?? 1,
        iconId: skillIconMap.get(sid) ?? null,
        source: "hint",
        isSpecialized: filterCheck.isSpecialized,
        firesOnCourse,
      });
    }

    // Helper to evaluate a candidate skill for parent recommendations
    const evaluateSkill = (
      rawSid: number,
    ): {
      sid: number;
      meta: SkillMeta;
      filterCheck: { matches: boolean; isSpecialized: boolean };
      originalGoldName?: string;
      firesOnCourse?: boolean;
      score: number;
    } | null => {
      const rawMeta = skillMetaMap[rawSid];
      let sid = rawSid;
      let originalGoldName: string | undefined = undefined;

      if (rawMeta?.rarity === 2) {
        const mapped = getInheritableSkillForGold(rawSid);
        if (!mapped) return null;
        sid = mapped.whiteId;
        originalGoldName = rawMeta.nameEn || mapped.goldNameEn;
      }

      if (mainDeckSkillIds.has(sid) || seenSkillIds.has(sid)) return null;
      const filterCheck = isSkillMatchingFilter(sid, style, effDistance, effSurface);
      if (!filterCheck.matches) return null;

      const meta = skillMetaMap[sid] || rawMeta;
      if (!meta) return null;

      let firesOnCourse: boolean | undefined = undefined;
      let triggerBonus = 0;

      if (course) {
        const fires = doesSkillFireOnCourse(sid, course, style);
        if (fires === true) {
          firesOnCourse = true;
          triggerBonus = 2.5;
        } else if (fires === false) {
          firesOnCourse = false;
          triggerBonus = -1;
        }
      }

      const skillScore = (filterCheck.isSpecialized ? 2 : 0.5) + triggerBonus;

      return {
        sid,
        meta,
        filterCheck,
        originalGoldName,
        firesOnCourse,
        score: skillScore,
      };
    };

    const handledEventSkillIds = new Set<number>();

    // Process structured eventDetails if available
    if (card.eventDetails && card.eventDetails.length > 0) {
      for (const ev of card.eventDetails) {
        const totalChoices = ev.choices.length;

        interface EvaluatedChoice {
          index: number;
          textEn: string;
          textJp: string;
          skills: {
            evalResult: NonNullable<ReturnType<typeof evaluateSkill>>;
            eventMeta: EventSkillMetadata;
          }[];
          totalScore: number;
        }

        const evaluatedChoices: EvaluatedChoice[] = [];

        for (const ch of ev.choices) {
          const choiceSkills: EvaluatedChoice["skills"] = [];
          let choiceScore = 0;

          for (const rawSid of ch.skillIds) {
            handledEventSkillIds.add(rawSid);
            const res = evaluateSkill(rawSid);
            if (res) {
              const eventMeta: EventSkillMetadata = {
                eventId: ev.eventId,
                eventNameEn: ev.nameEn,
                eventNameJp: ev.nameJp,
                choiceIndex: ch.index,
                choiceTextEn: ch.textEn,
                choiceTextJp: ch.textJp,
                totalChoices,
              };
              choiceSkills.push({ evalResult: res, eventMeta });
              choiceScore += res.score;
            }
          }

          evaluatedChoices.push({
            index: ch.index,
            textEn: ch.textEn,
            textJp: ch.textJp,
            skills: choiceSkills,
            totalScore: choiceScore,
          });
        }

        const activeChoices = evaluatedChoices.filter((c) => c.skills.length > 0);
        if (activeChoices.length === 0) continue;

        // Sort choices: highest score first, tiebreak by most matching skills
        activeChoices.sort((a, b) => b.totalScore - a.totalScore || b.skills.length - a.skills.length || a.index - b.index);
        const bestChoice = activeChoices[0];

        // Add optimal choice score & realistic skill count
        score += bestChoice.totalScore;
        newEventCount += bestChoice.skills.length;

        // More than 1 choice branch with matching skills => conflict!
        const hasConflict = activeChoices.length > 1;
        const eventAddedSkillIds = new Set<number>();

        // 1. Add optimal choice skills (recommended)
        for (const item of bestChoice.skills) {
          const { evalResult, eventMeta } = item;
          if (eventAddedSkillIds.has(evalResult.sid) || seenSkillIds.has(evalResult.sid)) continue;
          eventAddedSkillIds.add(evalResult.sid);
          seenSkillIds.add(evalResult.sid);

          newMatchingSkills.push({
            id: evalResult.sid,
            nameEn: evalResult.meta.nameEn || `Skill #${evalResult.sid}`,
            nameJp: evalResult.meta.nameJp || "",
            rarity: evalResult.meta.rarity ?? 1,
            iconId: skillIconMap.get(evalResult.sid) ?? null,
            source: "event",
            isSpecialized: evalResult.filterCheck.isSpecialized,
            firesOnCourse: evalResult.firesOnCourse,
            originalGoldName: evalResult.originalGoldName,
            eventMeta,
            choiceConflict: hasConflict,
            isRecommendedChoice: true,
          });
        }

        // 2. Add alternative choice skills (marked with choice conflict & alternative)
        for (const altChoice of activeChoices.slice(1)) {
          for (const item of altChoice.skills) {
            const { evalResult, eventMeta } = item;
            if (eventAddedSkillIds.has(evalResult.sid) || seenSkillIds.has(evalResult.sid)) continue;
            eventAddedSkillIds.add(evalResult.sid);
            seenSkillIds.add(evalResult.sid);

            newMatchingSkills.push({
              id: evalResult.sid,
              nameEn: evalResult.meta.nameEn || `Skill #${evalResult.sid}`,
              nameJp: evalResult.meta.nameJp || "",
              rarity: evalResult.meta.rarity ?? 1,
              iconId: skillIconMap.get(evalResult.sid) ?? null,
              source: "event",
              isSpecialized: evalResult.filterCheck.isSpecialized,
              firesOnCourse: evalResult.firesOnCourse,
              originalGoldName: evalResult.originalGoldName,
              eventMeta,
              choiceConflict: true,
              isRecommendedChoice: false,
            });
          }
        }
      }
    }

    // Fallback: Check any raw events not handled by eventDetails
    for (const rawSid of card.events) {
      if (handledEventSkillIds.has(rawSid)) continue;
      const res = evaluateSkill(rawSid);
      if (!res) continue;

      seenSkillIds.add(res.sid);
      newEventCount++;
      score += res.score;

      newMatchingSkills.push({
        id: res.sid,
        nameEn: res.meta.nameEn || `Skill #${res.sid}`,
        nameJp: res.meta.nameJp || "",
        rarity: res.meta.rarity ?? 1,
        iconId: skillIconMap.get(res.sid) ?? null,
        source: "event",
        isSpecialized: res.filterCheck.isSpecialized,
        firesOnCourse: res.firesOnCourse,
        originalGoldName: res.originalGoldName,
      });
    }

    if (newMatchingSkills.length > 0) {
      recommendations.push({
        cardId,
        nameEn: card.nameEn,
        nameJp: card.nameJp,
        rarity: card.rarity,
        type: card.type,
        score,
        newMatchingSkills,
        newHintCount,
        newEventCount,
        totalNewCount: newHintCount + newEventCount,
      });
    }
  }

  // Sort by score desc, then total new skills desc, then rarity desc
  recommendations.sort((a, b) => b.score - a.score || b.totalNewCount - a.totalNewCount || b.rarity - a.rarity);

  return recommendations.slice(0, limit);
}
