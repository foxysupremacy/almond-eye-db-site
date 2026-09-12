import type { Course } from "../skill-engine/types";
import type { RunningStyle } from "../deck/types";
import { getInheritableSkillForGold } from "../skill-rarity";
import type {
  SkillDetailInput,
  EvaluatorZoneInput,
  SkillEvaluationResult,
  SkillTacticalCategory,
  SpecialEffectItem,
  CalculationBreakdown,
} from "./types";
import { STYLE_EXPECTED_RANKS, STYLE_NAMES } from "./constants";
import { parseRankRequirements } from "./rank-parser";
import { getCategoryBadge, buildCalculationBreakdown } from "./calculation-steps";

/**
 * Primary skill evaluation function.
 */
export function evaluateSkillForTrack(
  skill: SkillDetailInput,
  course: Course | null | undefined,
  runningStyle: RunningStyle | null | undefined,
  racerCount: number = 9,
  isParentMode: boolean = false,
  zones: EvaluatorZoneInput[] = []
): SkillEvaluationResult {
  const courseLength = course?.length ?? 2000;
  const spurtMeters = course?.spurtStart?.meters ?? Math.round(courseLength * (2 / 3));

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
  let hasTargetSpeed = false;
  let hasCurrentSpeed = false;
  let hasHeal = false;
  let hasPassive = false;
  let hasDebuff = false;
  let maxBaseTime = 0;
  let maxAccelVal = 0;
  let maxSpeedVal = 0;

  const rawConditions: string[] = [];
  const rawPreconditions: string[] = [];

  for (const group of skill.conditionGroups ?? []) {
    if (group.condition) rawConditions.push(group.condition);
    if (group.precondition) rawPreconditions.push(group.precondition);
    if (group.base_time && group.base_time > maxBaseTime) {
      maxBaseTime = group.base_time;
    }

    for (const rawEff of group.effects ?? []) {
      const eff = rawEff as { type?: number; value?: number; target?: number; target_details?: number };
      const type = eff.type ?? 0;
      const val = eff.value ?? 0;
      const target = eff.target ?? 0;

      const isOpponent = target === 9 || target === 10 || target === 18 || val < 0;
      if (isOpponent || type === 10 || type === 14) {
        hasDebuff = true;
      } else if (type === 31) {
        hasAccel = true;
        if (val > maxAccelVal) maxAccelVal = val;
      } else if (type === 27) {
        hasTargetSpeed = true;
        if (val > maxSpeedVal) maxSpeedVal = val;
      } else if (type === 21 || type === 22) {
        hasCurrentSpeed = true;
        if (val > maxSpeedVal) maxSpeedVal = val;
      } else if (type === 9) {
        hasHeal = true;
      } else if (type >= 1 && type <= 5) {
        hasPassive = true;
      }
    }
  }

  const durationSeconds =
    maxBaseTime > 0 ? (maxBaseTime / 10000) * (courseLength / 1000) : 0;
  // Approximating distance travelled: standard cruising velocity is ~20m/s
  const durationMeters = durationSeconds * 20.0;

  // 3. Inspect computed zone regions
  const activeRegions = zones.flatMap((z) => z.regions);
  const isRandom = zones.some((z) => z.isRandom);

  let triggerStartMeters: number | null = null;
  let triggerEndMeters: number | null = null;

  if (activeRegions.length > 0) {
    triggerStartMeters = Math.min(...activeRegions.map((r) => r.start));
    triggerEndMeters = Math.max(...activeRegions.map((r) => r.end));
  }

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

  const allCondStr = rawConditions.join(" ") + " " + rawPreconditions.join(" ");

  // Check Dynamic 6: Style & Rank Trap
  if (runningStyle) {
    // Style check
    const styleReqM = /running_style==(\d+)/.exec(allCondStr);
    if (styleReqM) {
      const reqStyle = parseInt(styleReqM[1], 10);
      if (reqStyle !== runningStyle) {
        specialEffects.push({
          id: "style_mismatch",
          type: "error",
          badge: "Style Trap",
          title: `Requires ${STYLE_NAMES[reqStyle] ?? "Another Style"}`,
          description: `This skill only functions for ${STYLE_NAMES[reqStyle] ?? "another style"}. Ineffective for your selected ${STYLE_NAMES[runningStyle]}.`,
        });
        score -= 50;
      }
    }

    // Rank check
    const { minRank, maxRank, hasOrderCondition } = parseRankRequirements(allCondStr, racerCount);
    if (hasOrderCondition) {
      const [expMin, expMax] = STYLE_EXPECTED_RANKS[runningStyle] ?? [1, racerCount];
      const overlaps = Math.max(0, Math.min(maxRank, expMax) - Math.max(minRank, expMin) + 1);
      if (overlaps === 0) {
        specialEffects.push({
          id: "rank_mismatch",
          type: "warning",
          badge: "Rank Trap",
          title: `Strict Rank: ${minRank}–${maxRank} (${racerCount} umas)`,
          description: `${STYLE_NAMES[runningStyle]} typically runs in ranks ${expMin}–${expMax}, which does not overlap this skill's trigger window.`,
        });
        score -= 25;
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
    // If the skill has multiple condition groups, isolate trigger timing for groups containing acceleration
    let accelTriggerStart = triggerStartMeters;
    if (skill.conditionGroups && zones && zones.length === skill.conditionGroups.length) {
      const accelRegions: Array<{ start: number; end: number }> = [];
      skill.conditionGroups.forEach((g, idx) => {
        const hasGroupAccel = (g.effects ?? []).some((e: any) => e.type === 31);
        if (hasGroupAccel && zones[idx]?.regions) {
          accelRegions.push(...zones[idx].regions);
        }
      });
      if (accelRegions.length > 0) {
        accelTriggerStart = Math.min(...accelRegions.map((r) => r.start));
      } else {
        accelTriggerStart = null;
      }
    }
    const accelDelay = accelTriggerStart !== null ? accelTriggerStart - spurtMeters : delayFromSpurt;

    if (accelTriggerStart !== null) {
      accelEvaluated = true;
      // Ahead of Spurt Point (Pre-late race, with 15m tolerance for course rounding):
      if (accelDelay !== null && accelDelay < -15) {
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
      // Right at or closely after the Spurt Point (-15m to 50m):
      else if (accelDelay !== null && accelDelay >= -15 && accelDelay <= 50) {
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
      else if (accelDelay !== null && accelDelay > 50 && accelDelay <= 140) {
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
      // Dead Accel (>140m):
      else {
        category = "dead_accel";
        stars = 1;
        tier = "F";
        score = 15;
        verdictSummary = `Dead Accel: activates at ${Math.round(accelTriggerStart)}m (+${Math.round(accelDelay ?? 0)}m delay). Acceleration ramp is already complete; top speed is reached, giving this skill near-zero utility.`;
        specialEffects.push({
          id: "dead_accel_dynamic",
          type: "error",
          badge: "Dead Accel",
          title: "Fires After Acceleration Phase",
          description: `Triggers ${Math.round(accelDelay ?? 0)}m after the 2/3 line. The horse has already at maximum sprint speed.`,
          meters: `+${Math.round(accelDelay ?? 0)}m delay`,
        });
      }
    }
  }

  if (!accelEvaluated) {
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
      stars = 4;
      tier = "A";
      score = Math.max(score, 85);
      verdictSummary = `Late-Race Speed: activates at ${Math.round(triggerStartMeters)}m during the final stretch to boost sprint top speed.`;
    } else if (triggerStartMeters !== null && triggerStartMeters < spurtMeters * 0.33) {
      category = "early_speed";
      stars = 3;
      tier = "B";
      score = Math.max(score, 72);
      verdictSummary = `Early Speed: activates at ${Math.round(triggerStartMeters)}m to establish early position before the pack settles.`;
    } else {
      category = "mid_speed";
      stars = 4;
      tier = "A";
      score = Math.max(score, 82);
      verdictSummary = `Mid-Race Speed: activates at ${triggerStartMeters !== null ? Math.round(triggerStartMeters) + "m" : "mid-leg"} to contest position before the 2/3 spurt point.`;
    }
  } else if (hasHeal) {
    category = "recovery";
    stars = 4;
    tier = "A";
    score = Math.max(score, 80);
    verdictSummary = "Stamina Recovery: restores endurance to prevent stamina exhaustion in long stretches.";
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

  // 6. Detailed Mathematical Breakdown
  const baseDurationSeconds = maxBaseTime > 0 ? maxBaseTime / 10000 : 0;
  const scaledDurationSeconds = Math.round(durationSeconds * 100) / 100;
  const estimatedDistanceMeters = Math.round(durationMeters * 10) / 10;
  const delayFromSpurtMeters = delayFromSpurt !== null ? Math.round(delayFromSpurt * 10) / 10 : null;
  const accelPhaseEndMeters = Math.round((spurtMeters + 130) * 10) / 10;

  let delayStatus: CalculationBreakdown["delayStatus"] = "mid_race";
  if (category === "fastest_accel") delayStatus = "optimal";
  else if (category === "carry_over") delayStatus = "early_overlap";
  else if (category === "delayed_accel") delayStatus = "delayed";
  else if (category === "dead_accel") delayStatus = "dead";

  const primaryBadge = getCategoryBadge(category);

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
    hasCurrentSpeed,
    hasTargetSpeed,
    maxSpeedVal,
    hasHeal,
    durationMeters,
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
