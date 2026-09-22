import type {
  SkillTacticalCategory,
  CalculationStep,
  CalculationBreakdown,
} from "./types";

export function getCategoryBadge(category: SkillTacticalCategory): {
  label: string;
  badgeClass: string;
  dotColor: string;
} {
  switch (category) {
    case "fastest_accel":
      return {
        label: "Valid Fastest Accel",
        badgeClass:
          "bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-bold",
        dotColor: "bg-emerald-500",
      };
    case "carry_over":
      return {
        label: "Carry-Over",
        badgeClass:
          "bg-cyan-100 dark:bg-cyan-950/90 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700 font-bold",
        dotColor: "bg-cyan-500",
      };
    case "position_accel":
      return {
        label: "Position Accel",
        badgeClass:
          "bg-violet-100 dark:bg-violet-950/90 text-violet-800 dark:text-violet-300 border-violet-300 dark:border-violet-700 font-semibold",
        dotColor: "bg-violet-500",
      };
    case "delayed_accel":
      return {
        label: "Delayed Accel",
        badgeClass:
          "bg-amber-100 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-semibold",
        dotColor: "bg-amber-500",
      };
    case "dead_accel":
      return {
        label: "Dead Accel",
        badgeClass:
          "bg-rose-100 dark:bg-rose-950/90 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700 font-bold",
        dotColor: "bg-rose-500",
      };
    case "current_speed":
      return {
        label: "Instant Current Speed",
        badgeClass:
          "bg-indigo-100 dark:bg-indigo-950/90 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 font-bold",
        dotColor: "bg-indigo-500",
      };
    case "mid_speed":
      return {
        label: "Mid-Race Speed",
        badgeClass:
          "bg-blue-100 dark:bg-blue-950/90 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700 font-medium",
        dotColor: "bg-blue-500",
      };
    case "late_speed":
      return {
        label: "Late-Race Top Speed",
        badgeClass:
          "bg-teal-100 dark:bg-teal-950/90 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700 font-medium",
        dotColor: "bg-teal-500",
      };
    case "early_speed":
      return {
        label: "Early Positioning",
        badgeClass:
          "bg-sky-100 dark:bg-sky-950/90 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-700 font-medium",
        dotColor: "bg-sky-500",
      };
    case "recovery":
      return {
        label: "Stamina Recovery",
        badgeClass:
          "bg-emerald-100/70 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300/70 dark:border-emerald-700 font-medium",
        dotColor: "bg-emerald-500",
      };
    case "passive":
      return {
        label: "Green Passive",
        badgeClass:
          "bg-green-100 dark:bg-green-950/90 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700 font-medium",
        dotColor: "bg-green-500",
      };
    case "debuff":
      return {
        label: "Opponent Debuff",
        badgeClass:
          "bg-purple-100 dark:bg-purple-950/90 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700 font-medium",
        dotColor: "bg-purple-500",
      };
    case "invalid":
      return {
        label: "Invalid on Course",
        badgeClass:
          "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700",
        dotColor: "bg-zinc-400",
      };
    default:
      return {
        label: "Strategy Skill",
        badgeClass:
          "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
        dotColor: "bg-zinc-400",
      };
  }
}

export interface BuildBreakdownParams {
  category: SkillTacticalCategory;
  courseLength: number;
  spurtMeters: number;
  triggerStartMeters: number | null;
  triggerEndMeters: number | null;
  baseDurationSeconds: number;
  scaledDurationSeconds: number;
  estimatedDistanceMeters: number;
  delayFromSpurt: number | null;
  delayFromSpurtMeters: number | null;
  delayStatus: CalculationBreakdown["delayStatus"];
  accelPhaseEndMeters: number;
  hasAccel: boolean;
  maxAccelVal: number;
  hasCurrentSpeed: boolean;
  hasTargetSpeed: boolean;
  maxSpeedVal: number;
  hasHeal: boolean;
  durationMeters: number;
  phaseVelocity?: number;
  verdictSummary: string;
  tier: "S" | "A" | "B" | "C" | "D" | "F";
  stars: number;
}

export function buildCalculationBreakdown(p: BuildBreakdownParams): CalculationBreakdown {
  let delayExplanation = "";
  let dynamicMathExplanation = "";

  if (p.category === "fastest_accel") {
    delayExplanation = `Triggers at ${Math.round(p.triggerStartMeters! * 10) / 10}m (+${Math.round(p.delayFromSpurt! * 10) / 10}m delay). Fires right at the late-race 2/3 line (${p.spurtMeters}m). 100% of acceleration duration goes towards ramping to top speed.`;
    dynamicMathExplanation = `Target speed jumps from ~20.0 m/s to ~23.4 m/s at the 2/3 mark (${p.spurtMeters}m). Activating acceleration immediately at +0m delay shaves ~0.3–0.5s off the ramp-up time, creating a decisive gap before the final straight.`;
  } else if (p.category === "carry_over") {
    const overlapMeters = Math.round((p.triggerStartMeters! + p.durationMeters - p.spurtMeters) * 10) / 10;
    delayExplanation = `Triggers at ${Math.round(p.triggerStartMeters! * 10) / 10}m and stays active for ${p.scaledDurationSeconds}s (~${p.estimatedDistanceMeters}m), reaching ${Math.round((p.triggerStartMeters! + p.durationMeters) * 10) / 10}m (+${overlapMeters}m past the 2/3 line).`;
    dynamicMathExplanation = `Because this speed boost extends across the ${p.spurtMeters}m line into late-race, the horse enters Phase 2 already cruising at boosted speed (~20.7 m/s instead of ~20.0 m/s). This allows reaching top sprint speed with less acceleration needed!`;
  } else if (p.category === "dead_accel") {
    delayExplanation = `Triggers at ${Math.round(p.triggerStartMeters! * 10) / 10}m (+${p.delayFromSpurtMeters}m delay). Late race acceleration finishes around ${p.accelPhaseEndMeters}m (+130m ramp).`;
    dynamicMathExplanation = `At ${Math.round(p.triggerStartMeters! * 10) / 10}m, the horse is already cruising at maximum sprint speed (~23.4 m/s). Acceleration skills provide zero velocity increase once top speed is already attained, making this skill 100% wasted.`;
  } else if (p.category === "position_accel") {
    delayExplanation = `Triggers at ${Math.round(p.triggerStartMeters! * 10) / 10}m, ${p.delayFromSpurtMeters}m before the 2/3 line — a mid-race positioning burst, not a sprint accelerator.`;
    dynamicMathExplanation = `Mid-race acceleration helps the horse take or hold a favorable position going into the spurt. The sprint itself starts at the ${p.spurtMeters}m line, by which point this boost has already expired.`;
  } else if (p.category === "delayed_accel") {
    const lossPct = Math.min(80, Math.round((p.delayFromSpurt! / 180) * 100));
    delayExplanation = `Triggers at ${Math.round(p.triggerStartMeters! * 10) / 10}m (+${p.delayFromSpurtMeters}m delay). Activates after the horse has already begun accelerating.`;
    dynamicMathExplanation = `By +${p.delayFromSpurtMeters}m into the late race, the horse has already completed a substantial portion of its acceleration ramp. The skill only boosts the remaining fraction, losing ~${lossPct}% of its value compared to a fastest accel skill.`;
  } else if (p.hasCurrentSpeed) {
    delayExplanation = `Triggers at ${Math.round(p.triggerStartMeters! * 10) / 10}m with Instant Current Speed.`;
    dynamicMathExplanation = `Standard speed skills only increase target speed, which requires time to accelerate towards. Current Speed instantly raises velocity by +${(p.maxSpeedVal / 10000).toFixed(2)} m/s with 0.0s ramp delay, ignoring the normal acceleration curve.`;
  } else if (p.category === "late_speed") {
    delayExplanation = `Fires at ${Math.round(p.triggerStartMeters! * 10) / 10}m during the late sprint to raise the final speed ceiling.`;
    dynamicMathExplanation = `Activates after acceleration is complete, raising maximum sprint speed during the final stretch to pass tired horses.`;
  } else if (p.category === "mid_speed") {
    delayExplanation = `Fires at ${Math.round(p.triggerStartMeters! * 10) / 10}m in the mid-race.`;
    dynamicMathExplanation = `Raises target speed during mid-race to establish a favorable position before the late-race spurt begins.`;
  } else {
    delayExplanation = `Fires at ${p.triggerStartMeters !== null ? Math.round(p.triggerStartMeters * 10) / 10 + "m" : "designated window"} to support race strategy.`;
    dynamicMathExplanation = p.verdictSummary;
  }

  const steps: CalculationStep[] = [
    {
      title: "1. Course Spurt Line (終盤開始地点)",
      formula: `${p.courseLength}m × (2/3) = ${p.spurtMeters}m`,
      result: `${p.spurtMeters}m`,
      explanation: "Phase 2 (Late Race / 終盤) begins here. Target speed spikes to maximum sprint speed (~23.4 m/s).",
      badgeType: "neutral",
    },
    {
      title: "2. Scaled Duration (コース補正持続時間)",
      formula: `${p.baseDurationSeconds.toFixed(2)}s base × (${p.courseLength}m / 1,000m) = ${p.scaledDurationSeconds}s`,
      result: `${p.scaledDurationSeconds}s`,
      explanation: "Umamusume automatically scales base skill durations proportional to course length (Standard 1,000m = 1.0×).",
      badgeType: "neutral",
    },
    {
      title: "3. Distance Covered (スキルの移動距離)",
      formula: `${p.scaledDurationSeconds}s × ~${(p.phaseVelocity ?? 20.0).toFixed(1)} m/s ≈ ${p.estimatedDistanceMeters}m`,
      result: `~${p.estimatedDistanceMeters}m`,
      explanation: `At phase velocity (~${(p.phaseVelocity ?? 20.0).toFixed(1)} m/s), the horse travels this distance while the skill remains active.`,
      badgeType: "neutral",
    },
    {
      title: "4. Spurt Timing Offset (終盤からのズレ ΔS)",
      formula:
        p.triggerStartMeters !== null
          ? `${Math.round(p.triggerStartMeters * 10) / 10}m − ${p.spurtMeters}m = ${p.delayFromSpurt! >= 0 ? "+" : ""}${p.delayFromSpurtMeters}m`
          : "N/A",
      result:
        p.delayFromSpurtMeters !== null
          ? p.delayFromSpurtMeters >= 0
            ? `+${p.delayFromSpurtMeters}m`
            : `${p.delayFromSpurtMeters}m`
          : "N/A",
      explanation: delayExplanation,
      badgeType:
        p.delayStatus === "optimal" || p.delayStatus === "early_overlap"
          ? "optimal"
          : p.delayStatus === "delayed"
            ? "warning"
            : p.delayStatus === "dead"
              ? "error"
              : "neutral",
    },
    {
      title: "5. Tactical Physics Verdict (物理判定とメタ評価)",
      formula: `Verdict: ${p.tier} Tier (${p.stars}★)`,
      result: `${p.category.toUpperCase()}`,
      explanation: dynamicMathExplanation,
      badgeType: p.stars >= 4 ? "optimal" : p.stars === 3 ? "warning" : "error",
    },
  ];

  return {
    courseLength: p.courseLength,
    spurtLineMeters: p.spurtMeters,
    spurtFormula: `${p.courseLength}m × (2/3) = ${p.spurtMeters}m`,
    triggerStartMeters: p.triggerStartMeters,
    triggerEndMeters: p.triggerEndMeters,
    baseDurationSeconds: p.baseDurationSeconds,
    scaledDurationSeconds: p.scaledDurationSeconds,
    durationFormula: `${p.baseDurationSeconds.toFixed(2)}s × (${p.courseLength}m / 1,000m) = ${p.scaledDurationSeconds}s`,
    estimatedDistanceMeters: p.estimatedDistanceMeters,
    distanceFormula: `${p.scaledDurationSeconds}s × ~${(p.phaseVelocity ?? 20.0).toFixed(1)} m/s ≈ ${p.estimatedDistanceMeters}m`,
    delayFromSpurtMeters: p.delayFromSpurtMeters,
    delayFormula:
      p.triggerStartMeters !== null
        ? `${Math.round(p.triggerStartMeters * 10) / 10}m − ${p.spurtMeters}m = ${p.delayFromSpurt! >= 0 ? "+" : ""}${p.delayFromSpurtMeters}m`
        : "N/A",
    delayStatus: p.delayStatus,
    delayExplanation,
    accelPhaseEndMeters: p.accelPhaseEndMeters,
    effectMagnitude: p.hasAccel
      ? p.maxAccelVal / 10000
      : p.hasTargetSpeed || p.hasCurrentSpeed
        ? p.maxSpeedVal / 10000
        : undefined,
    effectTypeLabel: p.hasAccel
      ? "Acceleration"
      : p.hasCurrentSpeed
        ? "Current Speed"
        : p.hasTargetSpeed
          ? "Target Speed"
          : p.hasHeal
            ? "HP Heal"
            : "Stat",
    dynamicMathExplanation,
    steps,
  };
}
