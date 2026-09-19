// Pure recommendation engine for Uma Musume Parent Deck building.
// Ranks support cards based on skills matching the target race course & style
// that the Main Deck does NOT have, with priority boost for skills that
// activate on the selected course geometry.

import { cardMetaMap, skillMetaMap, skillIconById, skillsById } from "./data/registry";
import type { Course, RaceParameters } from "./skill-engine/types";
import { computeAllZones, horseForStrategy } from "./skill-engine/zones";
import { getInheritableSkillForGold } from "./skill-rarity";
import {
  evaluateSkillForTrack,
  type SkillTacticalCategory,
  type EvaluatorZoneInput,
} from "./evaluator";
import { BANNED_DEBUFF_SKILL_IDS } from "./pvp-events";

// Dataset types (SkillMeta/CardMeta) and lookup maps live in lib/data —
// re-exported here for existing consumers/tests (they mutate these maps as fixtures).
export { cardMetaMap, skillMetaMap } from "./data/registry";
import type { SkillMeta, CardMeta, EventSkillMetadata } from "./data/types";
export type { SkillMeta, CardMeta };

const skillIconMap = skillIconById;

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
  tacticalCategory?: SkillTacticalCategory;
  evalTier?: "S" | "A" | "B" | "C" | "D" | "F";
  evalStars?: 1 | 2 | 3 | 4 | 5;
  tacticalLabel?: string;
  tacticalBadgeClass?: string;
  evalScore?: number;
}

export interface CardRecommendation {
  cardId: number;
  nameEn: string;
  nameJp: string;
  rarity: number;
  /** Card training type; null while a card awaits its first GameTora crawl. */
  type: string | null;
  score: number;
  /** Skills provided by this card that are NOT in the Main Deck and match filters */
  newMatchingSkills: NewSkillMatch[];
  newHintCount: number;
  newEventCount: number;
  totalNewCount: number;
}

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
  raceParams?: Partial<RaceParameters>,
): boolean | null {
  const meta = skillMetaMap[skillId];
  if (!meta || !meta.conditions || meta.conditions.length === 0) return null;

  const horse = style ? horseForStrategy(style) : undefined;
  try {
    const zones = computeAllZones(course, meta.conditions, horse, { ...raceParams, skillId: String(skillId) });
    return zones.some((z) => z.regions.length > 0);
  } catch {
    return null;
  }
}

/** Tactical categories that actually move the uma (accel/speed families).
    Excludes recovery, passive, debuff, other, invalid. */
export const SPEED_TACTICAL_CATEGORIES: readonly SkillTacticalCategory[] = [
  "fastest_accel",
  "carry_over",
  "delayed_accel",
  "position_accel",
  "dead_accel",
  "current_speed",
  "mid_speed",
  "late_speed",
  "early_speed",
];

export function recommendCardsForParent({
  mainDeckSkillIds,
  equippedParentCardIds = [],
  course = null,
  style = null,
  distance = null,
  surface = null,
  limit = 16,
  raceParams,
  excludeSkillIds,
  tacticalCategories,
  requireFiresOnCourse,
  chainChoicesMap,
}: {
  mainDeckSkillIds: Set<number>;
  equippedParentCardIds?: (number | null)[];
  course?: Course | null;
  style?: number | null;
  distance?: number | null;
  surface?: number | null;
  limit?: number;
  raceParams?: Partial<RaceParameters>;
  /** Extra skill ids to treat as already-owned (e.g. uma-inherited uniques) */
  excludeSkillIds?: Set<number>;
  /** When set, only keep skills whose tactical category is in this list.
      Requires a course (categories come from track evaluation). */
  tacticalCategories?: readonly SkillTacticalCategory[];
  /** When true, drop skills that don't activate on the course. Requires a course. */
  requireFiresOnCourse?: boolean;
  /** Active event chain choices for deck cards */
  chainChoicesMap?: Record<string, number>;
}): CardRecommendation[] {
  const equippedSet = new Set(equippedParentCardIds.filter((id): id is number => typeof id === "number"));
  const combinedExclusions = excludeSkillIds
    ? new Set([...mainDeckSkillIds, ...excludeSkillIds])
    : mainDeckSkillIds;
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

    // Helper to evaluate a candidate skill for parent recommendations
    const evaluateCandidateSkill = (
      rawSid: number,
      source: "hint" | "event"
    ): {
      sid: number;
      meta: SkillMeta;
      filterCheck: { matches: boolean; isSpecialized: boolean };
      originalGoldName?: string;
      firesOnCourse?: boolean;
      tacticalCategory?: SkillTacticalCategory;
      evalTier?: "S" | "A" | "B" | "C" | "D" | "F";
      evalStars?: 1 | 2 | 3 | 4 | 5;
      tacticalLabel?: string;
      tacticalBadgeClass?: string;
      evalScore?: number;
      score: number;
    } | null => {
      const rawMeta = skillMetaMap[rawSid];
      let sid = rawSid;
      let originalGoldName: string | undefined = undefined;

      if (rawMeta?.rarity === 2) {
        const mapped = getInheritableSkillForGold(rawSid);
        if (!mapped) return null;
        sid = mapped.whiteId;
        originalGoldName = skillsById.get(rawSid)?.nameEn || rawMeta.nameEn || mapped.goldNameEn;
      }

      if (combinedExclusions.has(sid) || seenSkillIds.has(sid)) return null;
      const filterCheck = isSkillMatchingFilter(sid, style, effDistance, effSurface);
      if (!filterCheck.matches) return null;

      const rawMetaResolved = skillMetaMap[sid] || rawMeta;
      if (!rawMetaResolved) return null;

      const rawSkill = skillsById.get(sid) || skillsById.get(rawSid);
      const meta: SkillMeta = {
        ...rawMetaResolved,
        nameEn: rawSkill?.nameEn || rawMetaResolved.nameEn,
      };
      let firesOnCourse: boolean | undefined = undefined;
      let tacticalCategory: SkillTacticalCategory | undefined = undefined;
      let evalTier: "S" | "A" | "B" | "C" | "D" | "F" | undefined = undefined;
      let evalStars: (1 | 2 | 3 | 4 | 5) | undefined = undefined;
      let tacticalLabel: string | undefined = undefined;
      let tacticalBadgeClass: string | undefined = undefined;
      let evalScore: number | undefined = undefined;
      let tacticalBonus = 0;

      if (course) {
        const horse = style ? horseForStrategy(style) : undefined;
        let zones: EvaluatorZoneInput[] = [];
        const condGroups = (rawSkill?.conditionGroups ?? meta.conditions ?? []).map((g: any) => ({
          condition: g.condition ?? "",
          precondition: g.precondition ?? null,
          base_time: g.base_time ?? 0,
          effects: g.effects ?? [],
        }));

        const isBanned = Boolean(raceParams?.noDebuffs && BANNED_DEBUFF_SKILL_IDS.has(sid));

        try {
          zones = isBanned ? [] : computeAllZones(course, condGroups, horse, { ...raceParams, skillId: String(sid) });
        } catch {
          zones = [];
        }

        const skillInput = rawSkill ?? {
          id: sid,
          rarity: meta.rarity,
          nameEn: meta.nameEn,
          nameJp: meta.nameJp,
          descEn: meta.descEn,
          conditionGroups: condGroups,
        };

        const evalResult = evaluateSkillForTrack(
          skillInput,
          course,
          style as any,
          raceParams?.numUmas ?? 9,
          true, // isParentMode = true
          zones
        );

        const hasZones = zones.some((z) => z.regions.length > 0);
        const isStyleMismatch = evalResult.specialEffects.some((e) => e.id === "style_mismatch");
        const isRankMismatch = evalResult.specialEffects.some((e) => e.id === "rank_mismatch");
        firesOnCourse = hasZones && evalResult.category !== "invalid" && !isBanned && !isStyleMismatch && !isRankMismatch;
        tacticalCategory = evalResult.category;
        evalTier = evalResult.tier;
        evalStars = evalResult.stars;
        tacticalLabel = evalResult.primaryBadge.label;
        tacticalBadgeClass = evalResult.primaryBadge.badgeClass;
        evalScore = evalResult.score;

        if (isBanned) {
          tacticalBonus = -50;
          tacticalLabel = "BANNED";
          tacticalBadgeClass = "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800";
        } else {
          // Style/rank traps are dropped outright (parity with
          // evaluateSkillActivation): a skill that can never trigger under the
          // trainee's style or rank envelope is dead weight, not a low pick.
          if (isStyleMismatch || isRankMismatch) return null;

          switch (evalResult.category) {
            case "fastest_accel":
              tacticalBonus = source === "hint" ? 18 : 14;
              break;
            case "carry_over":
              tacticalBonus = source === "hint" ? 12 : 10;
              break;
            case "current_speed":
              tacticalBonus = source === "hint" ? 8 : 6;
              break;
            case "late_speed":
            case "mid_speed":
              tacticalBonus = source === "hint" ? 5 : 4;
              break;
            case "position_accel":
              tacticalBonus = source === "hint" ? 4 : 3;
              break;
            case "recovery":
            case "passive":
              tacticalBonus = source === "hint" ? 3 : 2.5;
              break;
            case "delayed_accel":
              tacticalBonus = source === "hint" ? 1 : 0.5;
              break;
            case "dead_accel":
              tacticalBonus = -6;
              break;
            case "invalid":
              tacticalBonus = -4;
              break;
            default:
              tacticalBonus = hasZones ? (source === "hint" ? 2 : 1) : -3;
              break;
          }

          // Graded position-overlap penalties (mirror the evaluator's rank_weak)
          const rankWeak = evalResult.specialEffects.find((e) => e.id === "rank_weak");
          if (rankWeak) {
            tacticalBonus -= rankWeak.type === "warning" ? 6 : 3;
          }
        }
      }

      // Opt-in hard gates (both need a course: the data comes from track evaluation)
      if (requireFiresOnCourse && !firesOnCourse) return null;
      if (tacticalCategories && (tacticalCategory === undefined || !tacticalCategories.includes(tacticalCategory))) {
        return null;
      }

      const baseScore = source === "hint"
        ? (filterCheck.isSpecialized ? 3 : 1)
        : (filterCheck.isSpecialized ? 2 : 0.5);

      const skillScore = baseScore + tacticalBonus;

      return {
        sid,
        meta,
        filterCheck,
        originalGoldName,
        firesOnCourse,
        tacticalCategory,
        evalTier,
        evalStars,
        tacticalLabel,
        tacticalBadgeClass,
        evalScore,
        score: skillScore,
      };
    };

    // Check hint skills (primary in parent farming)
    for (const sid of card.hints || []) {
      const res = evaluateCandidateSkill(sid, "hint");
      if (!res) continue;

      seenSkillIds.add(res.sid);
      newHintCount++;
      score += res.score;

      newMatchingSkills.push({
        id: res.sid,
        nameEn: res.meta.nameEn || `Skill #${res.sid}`,
        nameJp: res.meta.nameJp || "",
        rarity: res.meta.rarity ?? 1,
        iconId: skillIconMap.get(res.sid) ?? null,
        source: "hint",
        isSpecialized: res.filterCheck.isSpecialized,
        firesOnCourse: res.firesOnCourse,
        originalGoldName: res.originalGoldName,
        tacticalCategory: res.tacticalCategory,
        evalTier: res.evalTier,
        evalStars: res.evalStars,
        tacticalLabel: res.tacticalLabel,
        tacticalBadgeClass: res.tacticalBadgeClass,
        evalScore: res.evalScore,
      });
    }

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
            evalResult: NonNullable<ReturnType<typeof evaluateCandidateSkill>>;
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
            const res = evaluateCandidateSkill(rawSid, "event");
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

        const choiceKey = `${cardId}:${ev.eventId}`;
        const explicitChoiceIndex = chainChoicesMap?.[choiceKey] ?? chainChoicesMap?.[String(cardId)];
        const selectedChoice = explicitChoiceIndex !== undefined
          ? (evaluatedChoices.find((c) => c.index === explicitChoiceIndex) ?? bestChoice)
          : (chainChoicesMap ? bestChoice : null);

        if (selectedChoice) {
          score += selectedChoice.totalScore;
          newEventCount += selectedChoice.skills.length;

          const eventAddedSkillIds = new Set<number>();
          for (const item of selectedChoice.skills) {
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
              choiceConflict: activeChoices.length > 1,
              isRecommendedChoice: true,
              tacticalCategory: evalResult.tacticalCategory,
              evalTier: evalResult.evalTier,
              evalStars: evalResult.evalStars,
              tacticalLabel: evalResult.tacticalLabel,
              tacticalBadgeClass: evalResult.tacticalBadgeClass,
              evalScore: evalResult.evalScore,
            });
          }
        } else {
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
              tacticalCategory: evalResult.tacticalCategory,
              evalTier: evalResult.evalTier,
              evalStars: evalResult.evalStars,
              tacticalLabel: evalResult.tacticalLabel,
              tacticalBadgeClass: evalResult.tacticalBadgeClass,
              evalScore: evalResult.evalScore,
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
                tacticalCategory: evalResult.tacticalCategory,
                evalTier: evalResult.evalTier,
                evalStars: evalResult.evalStars,
                tacticalLabel: evalResult.tacticalLabel,
                tacticalBadgeClass: evalResult.tacticalBadgeClass,
                evalScore: evalResult.evalScore,
              });
            }
          }
        }
      }
    }

    // Fallback: Check any raw events not handled by eventDetails
    for (const rawSid of card.events || []) {
      if (handledEventSkillIds.has(rawSid)) continue;
      const res = evaluateCandidateSkill(rawSid, "event");
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
        tacticalCategory: res.tacticalCategory,
        evalTier: res.evalTier,
        evalStars: res.evalStars,
        tacticalLabel: res.tacticalLabel,
        tacticalBadgeClass: res.tacticalBadgeClass,
        evalScore: res.evalScore,
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
