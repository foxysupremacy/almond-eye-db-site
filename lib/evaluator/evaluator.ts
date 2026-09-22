import type { Course } from "../skill-engine/types";
import { CourseHelpers } from "../skill-engine/course";
import type { RunningStyle } from "../deck/types";
import { getInheritableSkillForGold } from "../skill-rarity";
import type {
  SkillDetailInput,
  EvaluatorZoneInput,
  SkillEvaluationResult,
  SkillTriggerEvaluation,
  SkillTacticalCategory,
  SpecialEffectItem,
  CalculationBreakdown,
} from "./types";
import {
  STYLE_EXPECTED_RANKS,
  STYLE_NAMES,
  STYLE_PHASE_PROFILES,
  SPURT_ACCEL_TOLERANCE_METERS,
  HEAVY_TURF_STAMINA_CRITICAL_DISTANCE,
} from "./constants";
import { classifyEffect } from "./effects";
import { parseRankRequirements, calculateStyleRankOverlap } from "./rank-parser";
import { getCategoryBadge, buildCalculationBreakdown } from "./calculation-steps";
import { raceImpactPriors } from "../data/registry";
import {
  aggregateRaceImpact,
  defaultRaceImpactProfile,
  evaluateTriggerRaceImpact,
  type RaceImpactProfile,
  type RaceImpactPriorsPayload,
} from "../race-impact";

export interface EvaluationOptions {
  skipTriggerEvaluations?: boolean;
  raceImpactProfile?: RaceImpactProfile;
  raceImpactPriors?: RaceImpactPriorsPayload;
}

/**
 * Primary skill evaluation function.
 */
export function evaluateSkillForTrack(
  skill: SkillDetailInput,
  course: Course | null | undefined,
  runningStyle: RunningStyle | null | undefined,
  racerCount: number = 9,
  isParentMode: boolean = false,
  zones: EvaluatorZoneInput[] = [],
  raceParams?: { groundCondition?: number | string | null },
  options?: EvaluationOptions,
): SkillEvaluationResult {
  const courseLength = course?.length ?? 2000;
  const spurtMeters = course?.spurtStart?.meters ?? Math.round(courseLength * (2 / 3));
  const accelPhaseEndMeters = Math.round((spurtMeters + 130) * 10) / 10;

  // 1. Determine Parent Transformation if in parent deck mode
  let isGoldTransformed = false;
  let inheritedWhiteId: number | undefined;
  let inheritedWhiteNameEn: string | undefined;
  let inheritedWhiteNameJp: string | undefined;

  if (isParentMode && skill.rarity === 2) {
    const mapped = getInheritableSkillForGold(skill.id);
    if (mapped) {
      isGoldTransformed = true;
      inheritedWhiteId = mapped.whiteId;
      inheritedWhiteNameEn = mapped.whiteNameEn;
      inheritedWhiteNameJp = mapped.whiteNameJp;
    }
  }

  // 2. Identify effects and base timing across condition groups
  let hasAccel = false;
  let hasZenkaiAcceleration = false;
  let hasTargetSpeed = false;
  let hasCurrentSpeed = false;
  let hasHeal = false;
  let hasPassive = false;
  let hasDebuff = false;
  let maxBaseTime = 0;
  let maxAccelVal = 0;
  let maxZenkaiAccelerationVal = 0;
  let maxSpeedVal = 0;

  for (const group of skill.conditionGroups ?? []) {
    if (group.base_time && group.base_time > maxBaseTime) {
      maxBaseTime = group.base_time;
    }

    for (const rawEff of group.effects ?? []) {
      const eff = rawEff as { type?: number; value?: number; target?: number; target_details?: number };
      const val = eff.value ?? 0;
      const cat = classifyEffect(eff);

      if (cat === "debuff") {
        hasDebuff = true;
      } else if (cat === "acceleration") {
        hasAccel = true;
        if (val > maxAccelVal) maxAccelVal = val;
      } else if (cat === "zenkai_acceleration") {
        hasZenkaiAcceleration = true;
        if (val > maxZenkaiAccelerationVal) maxZenkaiAccelerationVal = val;
      } else if (cat === "target_speed") {
        hasTargetSpeed = true;
        if (val > maxSpeedVal) maxSpeedVal = val;
      } else if (cat === "current_speed") {
        hasCurrentSpeed = true;
        if (val > maxSpeedVal) maxSpeedVal = val;
      } else if (cat === "heal") {
        hasHeal = true;
      } else if (cat === "passive") {
        hasPassive = true;
      }
    }
  }

  // Keep legacy aggregate scoring stable when a multi-stage skill also has a
  // conventional speed effect. Type 48 gets its dedicated verdict when the
  // evaluated trigger is Zenkai-only (which is the per-trigger path).
  const zenkaiOnly =
    hasZenkaiAcceleration &&
    !hasAccel &&
    !hasTargetSpeed &&
    !hasCurrentSpeed &&
    !hasHeal &&
    !hasPassive &&
    !hasDebuff;

  // 3. Inspect computed zone regions
  const activeRegions = zones.flatMap((z) => z.regions);
  const isRandom = zones.some((z) => z.isRandom);

  let triggerStartMeters: number | null = null;
  let triggerEndMeters: number | null = null;

  if (activeRegions.length > 0) {
    triggerStartMeters = Math.min(...activeRegions.map((r) => r.start));
    triggerEndMeters = Math.max(...activeRegions.map((r) => r.end));
  }

  // Phase-aware velocity model (Early: 18.0 m/s, Mid: 20.5 m/s, Late/Spurt: 26.0 m/s)
  const phaseVelocity =
    triggerStartMeters !== null
      ? triggerStartMeters >= spurtMeters
        ? 26.0
        : triggerStartMeters < spurtMeters * 0.33
          ? 18.0
          : 20.5
      : 20.5;

  const durationSeconds =
    maxBaseTime > 0 ? (maxBaseTime / 10000) * (courseLength / 1000) : 0;
  const durationMeters = durationSeconds * phaseVelocity;

  const specialEffects: SpecialEffectItem[] = [];

  // If no triggers activate on this course geometry:
  if (!course || activeRegions.length === 0) {
    return {
      score: 15,
      stars: 1,
      tier: "F",
      category: "invalid",
      primaryBadge: {
        label: "Invalid on Course",
        badgeClass: "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700",
        dotColor: "bg-zinc-400",
      },
      verdictSummary: "This skill cannot activate on the selected course geometry or distance conditions.",
      specialEffects: [
        {
          id: "no_trigger",
          type: "error",
          badge: "No Activation",
          title: "Course Condition Mismatch",
          description: "No valid activation trigger was found on this course for the selected conditions.",
        },
      ],
      timingAnalysis: {
        spurtMeters,
        triggerStartMeters: null,
        triggerEndMeters: null,
        isRandom: false,
        durationSeconds,
        durationMeters,
        delayFromSpurt: null,
        connectsToLateRace: false,
      },
      calculationBreakdown: {
        courseLength,
        spurtLineMeters: spurtMeters,
        spurtFormula: `${courseLength}m × (2/3) = ${spurtMeters}m`,
        triggerStartMeters: null,
        triggerEndMeters: null,
        baseDurationSeconds: 0,
        scaledDurationSeconds: 0,
        durationFormula: "0s (No trigger)",
        estimatedDistanceMeters: 0,
        distanceFormula: "0m",
        delayFromSpurtMeters: null,
        delayFormula: "N/A",
        delayStatus: "invalid",
        delayExplanation: "This skill has no trigger points on this course geometry.",
        accelPhaseEndMeters: Math.round((spurtMeters + 130) * 10) / 10,
        dynamicMathExplanation: "Skill conditions (corner, phase, distance, slope) cannot be satisfied on this track.",
        steps: [],
      },
      parentMeta: isParentMode
        ? {
            isParentMode: true,
            inheritedWhiteId,
            inheritedWhiteNameEn,
            inheritedWhiteNameJp,
            isGoldTransformed,
            factorTier: "C",
          }
        : undefined,
    };
  }

  // 4. Timing Calculations
  const delayFromSpurt = triggerStartMeters !== null ? triggerStartMeters - spurtMeters : null;
  const connectsToLateRace =
    triggerStartMeters !== null &&
    triggerStartMeters < spurtMeters &&
    triggerStartMeters + durationMeters >= spurtMeters;

  // 5. Evaluate Core Dynamics
  let category: SkillTacticalCategory = "other";
  let stars: 1 | 2 | 3 | 4 | 5 = 3;
  let tier: "S" | "A" | "B" | "C" | "D" | "F" = "B";
  let score = 70;
  let verdictSummary = "";

  // Trap checks (style/rank/slope) only consider groups that can actually fire
  // on this course: a rank gate on a group whose zones are empty must not
  // poison the whole skill. When the zone array is not aligned 1:1 with
  // conditionGroups, every group is kept (legacy behavior).
  const zonesAligned = zones.length === (skill.conditionGroups?.length ?? 0);
  const activeGroupIndices: number[] = [];
  const trapConditions: string[] = [];
  const trapPreconditions: string[] = [];
  (skill.conditionGroups ?? []).forEach((group, idx) => {
    if (zonesAligned && (zones[idx]?.regions.length ?? 0) === 0) return;
    activeGroupIndices.push(idx);
    if (group.condition) trapConditions.push(group.condition);
    if (group.precondition) trapPreconditions.push(group.precondition);
  });
  const allCondStr = [...trapConditions, ...trapPreconditions].join(" ");

  // Fraction (0–1) of the style's rank envelope covered by the skill's rank window.
  let positionOverlap: number | undefined;

  // Trap deductions are accumulated here and applied AFTER category
  // classification: the category branches assign (not add to) the base score,
  // which would otherwise overwrite the deductions.
  let trapScorePenalty = 0;

  // Check Dynamic 6: Style & Rank Trap
  const styleReqMatches = [...allCondStr.matchAll(/running_style==(\d+)/g)].map((m) =>
    parseInt(m[1], 10)
  );
  const effectiveStyle: number | "neutral" =
    runningStyle ?? (styleReqMatches.length > 0 ? styleReqMatches[0] : "neutral");
  const phaseProfile = STYLE_PHASE_PROFILES[effectiveStyle] ?? STYLE_PHASE_PROFILES.neutral;

  if (runningStyle) {
    // Style check
    if (styleReqMatches.length > 0) {
      const allowedStyles = Array.from(new Set(styleReqMatches));
      if (!allowedStyles.includes(runningStyle)) {
        specialEffects.push({
          id: "style_mismatch",
          type: "error",
          badge: "No Activation",
          title: `Requires ${allowedStyles.map((s) => STYLE_NAMES[s] ?? "Style " + s).join(" or ")}`,
          description: `This skill only functions for ${allowedStyles.map((s) => STYLE_NAMES[s]).join("/")}. Ineffective for your selected ${STYLE_NAMES[runningStyle]}.`,
        });
        trapScorePenalty += 50;
      }
    }

    // Rank check — evaluate per active conditionGroup independently so sequential
    // phases (e.g. Mid-race order_rate>=50 and Final-straight order_rate<=50)
    // are not merged into an impossible intersection.
    const [expMin, expMax] = STYLE_EXPECTED_RANKS[runningStyle] ?? [1, racerCount];
    const groupRankResults: Array<{
      groupIndex: number;
      minRank: number;
      maxRank: number;
      positionOverlap: number;
      hasOrderCondition: boolean;
    }> = [];

    for (const gIdx of activeGroupIndices) {
      const grp = skill.conditionGroups![gIdx];
      const grpCondStr = [grp.condition, grp.precondition].filter(Boolean).join(" ");
      const parsed = calculateStyleRankOverlap(grpCondStr, runningStyle, racerCount);
      if (parsed.hasOrderCondition) {
        groupRankResults.push({
          groupIndex: gIdx,
          minRank: parsed.minRank,
          maxRank: parsed.maxRank,
          positionOverlap: parsed.positionOverlap,
          hasOrderCondition: true,
        });
      }
    }

    if (groupRankResults.length > 0) {
      // Check if any active group has a hard rank trap (0 overlap)
      const zeroOverlapGroup = groupRankResults.find((g) => g.positionOverlap === 0);
      if (zeroOverlapGroup) {
        positionOverlap = 0;
        specialEffects.push({
          id: "rank_mismatch",
          type: "warning",
          badge: "Rank Trap",
          title: `Strict Rank: ${zeroOverlapGroup.minRank}–${zeroOverlapGroup.maxRank} (${racerCount} umas)`,
          description: `${STYLE_NAMES[runningStyle]} typically runs in ranks ${expMin}–${expMax}, which does not overlap this skill's trigger window.`,
        });
        trapScorePenalty += 25;
      } else {
        const bestGroup = groupRankResults.reduce((prev, curr) =>
          curr.positionOverlap > prev.positionOverlap ? curr : prev
        );
        positionOverlap = bestGroup.positionOverlap;

        if (positionOverlap <= 0.25) {
          specialEffects.push({
            id: "rank_weak",
            type: "warning",
            badge: "Weak Position Match",
            title: `Marginal Rank Window: ${bestGroup.minRank}–${bestGroup.maxRank} (${racerCount} umas)`,
            description: `${STYLE_NAMES[runningStyle]} typically runs in ranks ${expMin}–${expMax}; only ${Math.round(positionOverlap * 100)}% of that envelope satisfies this window. Low activation odds.`,
          });
          trapScorePenalty += 25;
        } else if (positionOverlap <= 0.5) {
          specialEffects.push({
            id: "rank_weak",
            type: "info",
            badge: "Partial Position Match",
            title: `Partial Rank Window: ${bestGroup.minRank}–${bestGroup.maxRank} (${racerCount} umas)`,
            description: `${STYLE_NAMES[runningStyle]} typically runs in ranks ${expMin}–${expMax}; ${Math.round(positionOverlap * 100)}% of that envelope satisfies this window.`,
          });
          trapScorePenalty += 12;
        }
      }
    }
  }

  // Check Dynamic 7: Slope Synergy
  if (/slope==2/.test(allCondStr)) {
    const startStr = triggerStartMeters !== null ? `${Math.round(triggerStartMeters)}m` : "";
    specialEffects.push({
      id: "downhill_synergy",
      type: "info",
      badge: "Downhill Synergy",
      title: "Triggers on Downhill Slope",
      description: `Fires on the track's downhill section${startStr ? ` around ${startStr}` : ""}.`,
      meters: startStr || undefined,
    });
  } else if (/slope==1/.test(allCondStr)) {
    const startStr = triggerStartMeters !== null ? `${Math.round(triggerStartMeters)}m` : "";
    specialEffects.push({
      id: "uphill_synergy",
      type: "info",
      badge: "Uphill Synergy",
      title: "Triggers on Uphill Slope",
      description: `Fires on the track's uphill section${startStr ? ` around ${startStr}` : ""}.`,
      meters: startStr || undefined,
    });
  }

  // Check Dynamic 5: Instant Current Speed
  if (hasCurrentSpeed) {
    specialEffects.push({
      id: "current_speed_dynamic",
      type: "info",
      badge: "Instant Speed",
      title: "Instant Velocity Jump",
      description: "Applies speed directly without waiting for acceleration ramp-up.",
    });
  }

  let accelEvaluated = false;
  if (hasAccel) {
    // Trigger regions of every group that carries acceleration.
    const accelGroupsAligned =
      !!skill.conditionGroups && zones.length === (skill.conditionGroups?.length ?? 0);
    const accelRegions: Array<{ start: number; end: number }> = [];
    if (accelGroupsAligned) {
      skill.conditionGroups!.forEach((g, idx) => {
        const hasGroupAccel = (g.effects ?? []).some((e: any) => e.type === 31);
        if (hasGroupAccel && zones[idx]?.regions) {
          accelRegions.push(...zones[idx].regions);
        }
      });
    }

    // Classify by the BEST firing opportunity across accel groups, not merely
    // the earliest: a skill with one early group and one spurt-perfect group
    // must not be sunk by the early one.
    const midRaceStart = CourseHelpers.phaseStart(course, 1);
    const earliestStartWithin = (lo: number, hi: number) => {
      const starts = accelRegions.map((r) => r.start).filter((s) => s >= lo && s <= hi);
      return starts.length > 0 ? Math.min(...starts) : null;
    };
    let accelTriggerStart: number | null;
    if (accelGroupsAligned) {
      accelTriggerStart =
        earliestStartWithin(spurtMeters - 15, spurtMeters + SPURT_ACCEL_TOLERANCE_METERS) ?? // optimal spurt window
        earliestStartWithin(spurtMeters + SPURT_ACCEL_TOLERANCE_METERS, spurtMeters + 140) ?? // delayed window
        earliestStartWithin(midRaceStart, spurtMeters - 15) ?? // pre-spurt positioning window
        earliestStartWithin(spurtMeters + 140, Number.POSITIVE_INFINITY) ?? // after the accel phase
        (accelRegions.length > 0
          ? Math.min(...accelRegions.map((r) => r.start)) // before mid-race: dead early
          : null); // accel groups all dead on this course → no accel classification
    } else {
      accelTriggerStart = triggerStartMeters; // legacy fallback when zones are misaligned
    }
    const accelDelay = accelTriggerStart !== null ? accelTriggerStart - spurtMeters : delayFromSpurt;

    if (accelTriggerStart !== null && accelDelay !== null) {
      accelEvaluated = true;
      // Right at or closely after the Spurt Point (-15m to SPURT_ACCEL_TOLERANCE_METERS):
      if (accelDelay >= -15 && accelDelay <= SPURT_ACCEL_TOLERANCE_METERS) {
        category = "fastest_accel";
        stars = 5;
        tier = "S";
        score = 98 - Math.max(0, accelDelay) * 0.2;
        const dispDelay = Math.max(0, Math.round(accelDelay));
        verdictSummary = `Valid Fastest Accel: activates at ${Math.round(accelTriggerStart)}m (+${dispDelay}m from spurt). Accelerates the horse to top sprint speed at the earliest optimal instant.`;
        specialEffects.push({
          id: "fastest_accel_dynamic",
          type: "success",
          badge: "Optimal Accel",
          title: "Valid Fastest Acceleration",
          description: `Fires within ${dispDelay}m of the 2/3 line (${spurtMeters}m). Maximum possible race impact.`,
          meters: `+${dispDelay}m delay`,
        });
      }
      // Delayed Accel (51m to 140m):
      else if (accelDelay > 50 && accelDelay <= 140) {
        category = "delayed_accel";
        stars = 3;
        tier = "C";
        score = Math.max(40, 75 - (accelDelay - 50) * 0.35);
        verdictSummary = `Delayed Accel: activates at ${Math.round(accelTriggerStart)}m (+${Math.round(accelDelay)}m delay). By this point, the horse is partially accelerated, diminishing this skill's effectiveness.`;
        specialEffects.push({
          id: "delayed_accel_dynamic",
          type: "warning",
          badge: "Delayed Accel",
          title: "Suboptimal Timing Delay",
          description: `Triggers ${Math.round(accelDelay)}m after the 2/3 line. The horse has already completed part of its acceleration.`,
          meters: `+${Math.round(accelDelay)}m delay`,
        });
      }
      // Position Accel: pre-spurt burst inside the mid-race (after the 1/6 mark).
      // Adds nothing to sprint acceleration, but the burst wins the position
      // battle going into the spurt — valuable for every running style.
      else if (accelDelay < -15 && accelTriggerStart >= midRaceStart) {
        category = "position_accel";
        stars = 3;
        tier = "B";
        score = 72;
        verdictSummary = `Position Accel: activates at ${Math.round(accelTriggerStart)}m, ${Math.round(spurtMeters - accelTriggerStart)}m before the 2/3 spurt line. Adds nothing to sprint acceleration, but the mid-race burst helps take or hold position going into the spurt.`;
        specialEffects.push({
          id: "position_accel_dynamic",
          type: "info",
          badge: "Position Accel",
          title: "Mid-Race Positioning Burst",
          description: `Fires ${Math.round(spurtMeters - accelTriggerStart)}m before late race begins (${spurtMeters}m). Useful for the position battle, not for the sprint itself.`,
          meters: `−${Math.round(spurtMeters - accelTriggerStart)}m early`,
        });
      }
      // Ahead of Spurt Point, before the mid-race (with 15m tolerance for course rounding):
      else if (accelDelay < -15) {
        category = "dead_accel";
        stars = 1;
        tier = "F";
        score = 10;
        verdictSummary = `Dead Accel: triggers early at ${Math.round(accelTriggerStart)}m, well before the 2/3 spurt line (${spurtMeters}m). Speed is already capped at mid-race speed, completely wasting the acceleration.`;
        specialEffects.push({
          id: "dead_accel_dynamic",
          type: "error",
          badge: "Dead Accel",
          title: "Fires Before Spurt Line",
          description: `Triggers at ${Math.round(accelTriggerStart)}m before late race begins (${spurtMeters}m). Zero effect on sprint acceleration.`,
          meters: `−${Math.round(spurtMeters - accelTriggerStart)}m early`,
        });
      }
      // Dead Accel (>140m):
      else {
        category = "dead_accel";
        stars = 1;
        tier = "F";
        score = 15;
        verdictSummary = `Dead Accel: activates at ${Math.round(accelTriggerStart)}m (+${Math.round(accelDelay)}m delay). Acceleration ramp is already complete; top speed is reached, giving this skill near-zero utility.`;
        specialEffects.push({
          id: "dead_accel_dynamic",
          type: "error",
          badge: "Dead Accel",
          title: "Fires After Acceleration Phase",
          description: `Triggers ${Math.round(accelDelay)}m after the 2/3 line. The horse has already at maximum sprint speed.`,
          meters: `+${Math.round(accelDelay)}m delay`,
        });
      }
    }
  }

  if (!accelEvaluated && zenkaiOnly) {
    category = "zenkai_accel";
    stars = 4;
    tier = "A";
    score = 84;
    verdictSummary = `Zenkai Spurt Acceleration: activates at ${triggerStartMeters !== null ? Math.round(triggerStartMeters) + "m" : "the designated zone"}. Raw effect is +${(maxZenkaiAccelerationVal / 10000).toFixed(2)} m/s²; detailed Power-scaled Zenkai simulation is not modeled.`;
    specialEffects.push({
      id: "zenkai_acceleration_dynamic",
      type: "info",
      badge: "Zenkai Accel",
      title: "Zenkai Spurt Acceleration",
      description: `Applies the raw +${(maxZenkaiAccelerationVal / 10000).toFixed(2)} m/s² Zenkai acceleration effect during this trigger window.`,
      meters: triggerStartMeters !== null ? `${Math.round(triggerStartMeters)}m` : undefined,
    });
  }

  if (!accelEvaluated && category !== "zenkai_accel") {
    // Check Dynamic 2: Carry-Over (終盤接続) for Speed Skills
    if (connectsToLateRace && (hasTargetSpeed || hasCurrentSpeed)) {
      category = "carry_over";
      stars = 5;
      tier = "S";
      score = 95;
      const overlap = Math.round(triggerStartMeters! + durationMeters - spurtMeters);
      verdictSummary = `Carry-Over Connection: activates at ${Math.round(triggerStartMeters!)}m and carries ${overlap}m past the ${spurtMeters}m late-race line. Enters the sprint at elevated velocity, drastically shortening time to maximum speed.`;
      specialEffects.push({
        id: "carry_over_dynamic",
        type: "success",
        badge: "Carry-Over",
        title: "Late-Race Connection (終盤接続)",
        description: `Speed boost carries ${overlap}m into the late-race phase (${spurtMeters}m), letting the horse start its sprint at boosted speed.`,
        meters: `+${overlap}m overlap`,
      });
    }
    // Standard Speed & Utility Evaluation
    else if (hasCurrentSpeed) {
    category = "current_speed";
    stars = 4;
    tier = "A";
    score = Math.max(score, 88);
    verdictSummary = `Instant Current Speed: activates at ${triggerStartMeters !== null ? Math.round(triggerStartMeters) + "m" : "designated zone"} with zero acceleration lag.`;
  } else if (hasTargetSpeed) {
    if (triggerStartMeters !== null && triggerStartMeters >= spurtMeters) {
      category = "late_speed";
      stars = phaseProfile.late.stars;
      tier = phaseProfile.late.tier;
      score = phaseProfile.late.score;
      verdictSummary = `${phaseProfile.late.summary} Activates at ${Math.round(triggerStartMeters)}m during the final stretch to boost sprint top speed.`;

      // Warning: Target Speed fires during the acceleration phase (spurtMeters to accelPhaseEndMeters)
      if (triggerStartMeters < accelPhaseEndMeters) {
        specialEffects.push({
          id: "fires_during_accel",
          type: "warning",
          badge: "Fires during Acceleration",
          title: "Triggers in Acceleration Window",
          description: `Activates at ${Math.round(triggerStartMeters)}m while the horse is still accelerating toward top spurt speed (${Math.round(accelPhaseEndMeters)}m). Target speed buff has reduced effectiveness during this ramp.`,
          meters: `${Math.round(triggerStartMeters)}m`,
        });
      }

      // Warning: Stamina Burn on long tracks (>= 2000m) or high potency (magnitude >= 3500)
      const isHeavyOrBadGround =
        raceParams?.groundCondition === 3 ||
        raceParams?.groundCondition === 4 ||
        raceParams?.groundCondition === "Heavy" ||
        raceParams?.groundCondition === "Bad";

      if (courseLength >= HEAVY_TURF_STAMINA_CRITICAL_DISTANCE && isHeavyOrBadGround) {
        specialEffects.push({
          id: "heavy_turf_stamina_critical",
          type: "warning",
          badge: "Heavy Turf Stamina Penalty",
          title: "Critical Heavy Turf Consumption",
          description: `Severe stamina drain on ${courseLength}m heavy/bad turf. HP drain accelerates by 10%–15%. Recovery skills are essential to avoid end-stretch velocity collapse.`,
        });
      } else if (courseLength >= 2000 || maxSpeedVal >= 3500) {
        specialEffects.push({
          id: "stamina_burn_warning",
          type: "warning",
          badge: "High Stamina Demand",
          title: "Elevated Stamina Consumption",
          description: `Late-race speed surge on ${courseLength}m increases HP drain non-linearly (v³). Ensure sufficient stamina and recovery skills to avoid end-stretch exhaustion.`,
        });
      }
    } else if (triggerStartMeters !== null && triggerStartMeters < spurtMeters * 0.33) {
      category = "early_speed";
      stars = phaseProfile.early.stars;
      tier = phaseProfile.early.tier;
      score = phaseProfile.early.score;
      verdictSummary = `${phaseProfile.early.summary} Activates at ${Math.round(triggerStartMeters)}m to establish early position before the pack settles.`;
    } else {
      category = "mid_speed";
      stars = phaseProfile.mid.stars;
      tier = phaseProfile.mid.tier;
      score = phaseProfile.mid.score;
      verdictSummary = `${phaseProfile.mid.summary} Activates at ${triggerStartMeters !== null ? Math.round(triggerStartMeters) + "m" : "mid-leg"} to contest position before the 2/3 spurt point.`;
    }
  } else if (hasHeal) {
    category = "recovery";
    if (courseLength >= 2000) {
      stars = 5;
      tier = "S";
      score = Math.max(score, 88);
      verdictSummary = `Stamina Recovery (Long/Medium): restores endurance on ${courseLength}m track, providing critical protection against late-race stamina exhaustion.`;
      specialEffects.push({
        id: "stamina_safety",
        type: "success",
        badge: "Stamina Safety",
        title: "Essential Endurance Protection",
        description: `High stamina demand track (${courseLength}m). Vital for preventing final stretch HP exhaustion and velocity crash.`,
      });
    } else if (courseLength <= 1400) {
      stars = 2;
      tier = "C";
      score = 60;
      verdictSummary = `Stamina Recovery (Sprint): endurance surplus on short ${courseLength}m sprint; stamina is rarely exhausted unless heavily debuffed.`;
      specialEffects.push({
        id: "stamina_low_demand",
        type: "info",
        badge: "Low Stamina Demand",
        title: "Surplus Stamina on Sprint",
        description: `Short course length (${courseLength}m) has minimal stamina consumption. Recovery provides low marginal utility.`,
      });
    } else {
      stars = 4;
      tier = "A";
      score = Math.max(score, 80);
      verdictSummary = "Stamina Recovery: restores endurance to prevent stamina exhaustion in long stretches.";
    }
  } else if (hasPassive) {
    category = "passive";
    stars = 3;
    tier = "B";
    score = Math.max(score, 75);
    verdictSummary = "Passive Boost: provides continuous stat bonuses when race conditions are satisfied.";
  } else if (hasDebuff) {
    category = "debuff";
    stars = 3;
    tier = "B";
    score = Math.max(score, 72);
    verdictSummary = "Opponent Debuff: slows down or drains stamina from competing racers.";
  } else {
    category = "other";
    verdictSummary = "Strategy skill providing lane movement, visibility, or tactical utility.";
  }
  }

  // Apply style/rank trap deductions after category classification (see above).
  score -= trapScorePenalty;
  let primaryBadge = getCategoryBadge(category);

  // Run the transparent per-trigger model before composing multi-trigger skills.
  // This does not replace category semantics; it contributes an uncapped score
  // whose factors are exposed in the inspector.
  let raceImpact = evaluateTriggerRaceImpact(skill, zones, {
    course,
    runningStyle,
    racerCount,
    raceParams,
    profile: options?.raceImpactProfile ?? defaultRaceImpactProfile(),
    priors: options?.raceImpactPriors ?? raceImpactPriors,
  });

  // Evaluate each firing trigger independently before aggregating the final
  // verdict. A trigger containing is_activate_other_skill_detail==1 is a
  // continuation of the previous trigger; otherwise multiple active groups
  // represent alternative activation paths, not cumulative effects.
  const triggerEvaluations: SkillTriggerEvaluation[] | undefined =
    !options?.skipTriggerEvaluations &&
    !!skill.conditionGroups &&
    zones.length === skill.conditionGroups.length &&
    skill.conditionGroups.length > 1
      ? skill.conditionGroups.map((group, triggerIndex) => ({
          triggerIndex,
          evaluation:
            zones[triggerIndex]?.regions.length
              ? evaluateSkillForTrack(
                  { ...skill, conditionGroups: [group] },
                  course,
                  runningStyle,
                  racerCount,
                  isParentMode,
                  [zones[triggerIndex]],
                  raceParams,
                  { ...options, skipTriggerEvaluations: true },
                )
              : null,
        }))
      : undefined;

  const activeTriggerResults = (triggerEvaluations ?? [])
    .map((entry) => entry.evaluation)
    .filter((entry): entry is SkillEvaluationResult => entry !== null);
  const hasChainedTrigger = (skill.conditionGroups ?? []).some((group) =>
    `${group.condition ?? ""}&${group.precondition ?? ""}`.includes("is_activate_other_skill_detail==1"),
  );

  if (activeTriggerResults.length > 1) {
    if (hasChainedTrigger) {
      // Preserve the existing bounded synergy calculation as an explicit
      // chain bonus, but let the trigger scores themselves accumulate above
      // 100 when the skill has unusually strong multi-stage impact.
      let compositeBonus = 0;
      for (const gIdx of activeGroupIndices) {
        const g = skill.conditionGroups![gIdx];
        const gTime = (g.base_time ?? 0) / 10000;
        const gScaledTime = gTime * (courseLength / 1000);
        const gDurationFactor = Math.min(1.5, gScaledTime > 0 ? gScaledTime / 5.0 : 1.0);

        for (const rawEff of (g.effects ?? []) as any[]) {
          const cat = classifyEffect(rawEff);
          if (cat === "current_speed") compositeBonus += 10 * gDurationFactor;
          else if (cat === "target_speed") compositeBonus += 8 * gDurationFactor;
          else if (cat === "acceleration") compositeBonus += 12 * gDurationFactor;
          else if (cat === "heal") compositeBonus += 8;
        }
      }

      const normalizedBonus = Math.min(15, Math.round(compositeBonus * 0.4));
      score = activeTriggerResults.reduce((total, trigger) => total + trigger.score, 0) + normalizedBonus;
      raceImpact = aggregateRaceImpact(
        activeTriggerResults.flatMap((trigger) => trigger.raceImpact ? [trigger.raceImpact] : []),
        "chain",
      ) ?? raceImpact;

      if (normalizedBonus > 0) {
        specialEffects.push({
          id: "multi_stage_synergy",
          type: "success",
          badge: "Multi-Stage",
          title: "Multi-Stage Activation Synergy",
          description: `Activates across ${activeTriggerResults.length} chained triggers, stacking cumulative benefits (+${normalizedBonus} tactical value).`,
        });
      }
      verdictSummary = `${verdictSummary} Combined chain verdict includes ${activeTriggerResults.length} active triggers.`;
    } else {
      // Alternative condition groups describe different ways to activate the
      // same skill. Only the best active path contributes to the aggregate.
      const bestTrigger = activeTriggerResults.reduce((best, current) =>
        current.score > best.score ? current : best,
      );
      score = bestTrigger.score;
      category = bestTrigger.category;
      stars = bestTrigger.stars;
      tier = bestTrigger.tier;
      primaryBadge = bestTrigger.primaryBadge;
      verdictSummary = `${bestTrigger.verdictSummary} Best of ${activeTriggerResults.length} alternative activation paths on this course.`;
      raceImpact = aggregateRaceImpact(
        activeTriggerResults.flatMap((trigger) => trigger.raceImpact ? [trigger.raceImpact] : []),
        "alternative",
      ) ?? raceImpact;
    }

    // Keep the visible rating consistent with an unbounded tactical score.
    if (score >= 95) {
      stars = 5;
      tier = "S";
    } else if (score >= 85 && stars < 4) {
      stars = 4;
      tier = "A";
    }
  }

  // 6. Detailed Mathematical Breakdown
  const baseDurationSeconds = maxBaseTime > 0 ? maxBaseTime / 10000 : 0;
  const scaledDurationSeconds = Math.round(durationSeconds * 100) / 100;
  const estimatedDistanceMeters = Math.round(durationMeters * 10) / 10;
  const delayFromSpurtMeters = delayFromSpurt !== null ? Math.round(delayFromSpurt * 10) / 10 : null;

  let delayStatus: CalculationBreakdown["delayStatus"] = "mid_race";
  if (category === "fastest_accel") delayStatus = "optimal";
  else if (category === "carry_over") delayStatus = "early_overlap";
  else if (category === "delayed_accel") delayStatus = "delayed";
  else if (category === "dead_accel") delayStatus = "dead";

  let factorTier: "S" | "A" | "B" | "C" = "B";
  if (stars >= 5) factorTier = "S";
  else if (stars === 4) factorTier = "A";
  else if (stars === 3) factorTier = "B";
  else factorTier = "C";

  const calculationBreakdown = buildCalculationBreakdown({
    category,
    courseLength,
    spurtMeters,
    triggerStartMeters,
    triggerEndMeters,
    baseDurationSeconds,
    scaledDurationSeconds,
    estimatedDistanceMeters,
    delayFromSpurt,
    delayFromSpurtMeters,
    delayStatus,
    accelPhaseEndMeters,
    hasAccel,
    maxAccelVal,
    hasZenkaiAcceleration: zenkaiOnly,
    maxZenkaiAccelerationVal,
    hasCurrentSpeed,
    hasTargetSpeed,
    maxSpeedVal,
    hasHeal,
    durationMeters,
    phaseVelocity,
    verdictSummary,
    tier,
    stars,
  });

  return {
    score,
    stars,
    tier,
    category,
    primaryBadge,
    verdictSummary,
    specialEffects,
    positionOverlap,
    timingAnalysis: {
      spurtMeters,
      triggerStartMeters,
      triggerEndMeters,
      isRandom,
      durationSeconds,
      durationMeters,
      delayFromSpurt,
      connectsToLateRace,
    },
    calculationBreakdown,
    raceImpact,
    triggerEvaluations,
    parentMeta: isParentMode
      ? {
          isParentMode: true,
          inheritedWhiteId,
          inheritedWhiteNameEn,
          inheritedWhiteNameJp,
          isGoldTransformed,
          factorTier,
        }
      : undefined,
  };
}
