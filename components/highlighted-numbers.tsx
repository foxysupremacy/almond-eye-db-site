import React, { useState } from "react";
import type { SkillEvaluationResult } from "../lib/evaluator";
import { EFFECT_LABELS } from "../lib/skill-engine/describe";
import { TimerIcon, FlagIcon, ChevronDownIcon, ChevronUpIcon } from "./icons";

/**
 * Parses a string and wraps numbers, units, percentages, and mathematical formulas
 * in high-contrast styled badges with semantic colors (emerald for optimal/positive,
 * rose for dead/penalty, amber for warning/delayed, zinc for measurements).
 */
export function HighlightText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  if (!text) return null;

  // Tokenize text into words / numbers with units
  // Regex matches:
  // - Quantities with units: +0.40 m/s², -0.35 m/s, 1,466.7m, 1467m, +0m, +333m, 3.96s, ~79.2m, 100%, 5.5%, 2.2×
  // - Ranks: 1st, 2nd, 4th–7th, 1st–2nd
  // - Mathematical expressions: 2200m × 2/3 = 1466.7m
  const pattern =
    /([+−-]?\d+(?:,\d+)*(?:\.\d+)?\s*(?:m\/s²|m\/s|s|m|%|pts|km\/h)|\b[+−-]\d+(?:,\d+)*(?:\.\d+)?m\b|\b\d+(?:,\d+)*(?:\.\d+)?\s*(?:m\/s²|m\/s|s|m|%|pts)\b|\b\d+(?:st|nd|rd|th)(?:–\d+(?:st|nd|rd|th))?\b|\b\d+(?:\.\d+)?×)/gi;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = pattern.lastIndex;
    const matchedStr = match[0];

    // Push preceding text
    if (matchStart > lastIndex) {
      parts.push(text.slice(lastIndex, matchStart));
    }

    // Determine semantic color
    const lower = matchedStr.toLowerCase();
    let badgeClass =
      "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100";

    // Optimal / Positive
    if (
      lower.includes("+0m") ||
      lower.includes("+0.0m") ||
      lower.includes("+0.") ||
      lower.includes("100%") ||
      lower.includes("1st") ||
      (lower.includes("m/s") && !lower.startsWith("-") && !lower.startsWith("−"))
    ) {
      badgeClass =
        "bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold";
    }
    // Severe / Dead / Zero
    else if (
      lower.includes("+333") ||
      lower.includes("+330") ||
      lower.includes("0%") ||
      lower.includes("0.0 m/s") ||
      lower.includes("0.0m/s") ||
      lower.includes("0m/s")
    ) {
      badgeClass =
        "bg-rose-100/80 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 font-bold";
    }
    // Warning / Delayed
    else if (
      lower.includes("+63") ||
      lower.includes("+80") ||
      lower.includes("+83") ||
      lower.includes("40%") ||
      lower.includes("80%") ||
      lower.includes("late")
    ) {
      badgeClass =
        "bg-amber-100/80 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold";
    }

    parts.push(
      <span
        key={matchStart}
        className={`inline-block font-mono text-[11px] px-1 py-0.2 mx-0.5 rounded ${badgeClass}`}
      >
        {matchedStr}
      </span>
    );

    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span className={className}>{parts}</span>;
}

/**
 * Formatted Effect Badge component that explicitly separates magnitude,
 * effect category, duration, and track travel distance into highlighted badges.
 */
export function FormattedEffectBadges({
  effects,
  baseTime,
  courseLength,
  className = "",
}: {
  effects: Array<{ type: number; value: number; target?: number; target_details?: number }>;
  baseTime: number | null | undefined;
  courseLength: number;
  className?: string;
}) {
  const hasDuration = baseTime != null && baseTime > 0 && Number.isFinite(baseTime);
  const durationS = hasDuration ? (baseTime! * courseLength) / 10_000_000 : 0;
  const distanceM = durationS > 0 ? durationS * 20.0 : 0;

  const visible = effects.filter((e) => {
    const meta = EFFECT_LABELS[e.type];
    return !meta || meta.label !== "Internal";
  });

  if (visible.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {visible.map((e, idx) => {
        const meta = EFFECT_LABELS[e.type];
        if (!meta) return null;

        const scaled = e.value / meta.scale;
        const sign = scaled >= 0 ? "+" : "−";
        const abs = Math.abs(scaled);
        let numStr: string;
        let unitStr: string;

        if (meta.unit === "%") {
          numStr = Number(abs.toFixed(2)).toString();
          unitStr = "%";
        } else if (meta.unit) {
          numStr = abs.toFixed(2);
          unitStr = ` ${meta.unit}`;
        } else {
          numStr = Math.round(abs).toString();
          unitStr = "";
        }

        const isAccel = e.type === 31;
        const isZenkaiAccel = e.type === 48;
        const isCurrentSpeed = e.type === 21 || e.type === 22;
        const isTargetSpeed = e.type === 27;
        const isHP = e.type === 9;

        const badgeTheme = isAccel
          ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700"
          : isZenkaiAccel
          ? "bg-teal-100 dark:bg-teal-950/80 text-teal-900 dark:text-teal-200 border-teal-300 dark:border-teal-700"
          : isCurrentSpeed
          ? "bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-700"
          : isTargetSpeed
          ? "bg-blue-100 dark:bg-blue-950/80 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700"
          : isHP
          ? "bg-teal-100 dark:bg-teal-950/80 text-teal-900 dark:text-teal-200 border-teal-300 dark:border-teal-700"
          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700";

        return (
          <div
            key={idx}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs shadow-2xs ${badgeTheme}`}
          >
            {/* Magnitude */}
            <span className="font-mono font-extrabold text-xs">
              {sign}
              {numStr}
              {unitStr}
            </span>

            {/* Label */}
            <span className="font-medium text-[11px] opacity-90">
              {meta.label}
              {isCurrentSpeed ? " (Instant)" : ""}
            </span>

            {/* Target Details */}
            {e.target && e.target !== 1 && (
              <span className="rounded bg-black/10 dark:bg-white/10 px-1 text-[9px] font-semibold">
                opponents
              </span>
            )}
          </div>
        );
      })}

      {/* Duration Badge */}
      {durationS > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/80 dark:border-amber-700/80 bg-amber-50 dark:bg-amber-950/70 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:text-amber-200 shadow-2xs">
          <TimerIcon className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300 flex-none" />
          <span className="font-mono font-extrabold">{durationS.toFixed(2)}s</span>
        </span>
      )}

      {/* Distance Badge */}
      {distanceM > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/80 dark:border-cyan-700/80 bg-cyan-50 dark:bg-cyan-950/70 px-2 py-0.5 text-xs font-semibold text-cyan-900 dark:text-cyan-200 shadow-2xs">
          <FlagIcon className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-300 flex-none" />
          <span className="font-mono font-extrabold">~{Math.round(distanceM)}m</span>
        </span>
      )}
    </div>
  );
}

/**
 * Compact Tactical Timing Strip for Hover Cards.
 */
export function TacticalTimingStrip({
  evaluation,
  className = "",
}: {
  evaluation: SkillEvaluationResult;
  className?: string;
}) {
  const { timingAnalysis } = evaluation;
  const spurtM = timingAnalysis.spurtMeters;
  const delay = timingAnalysis.delayFromSpurt;
  const durationS = timingAnalysis.durationSeconds;
  const durationM = timingAnalysis.durationMeters;

  const delayColor =
    delay === null
      ? "text-zinc-400"
      : delay > 180
      ? "text-rose-600 dark:text-rose-400"
      : delay > 25
      ? "text-amber-600 dark:text-amber-400"
      : delay < 0
      ? "text-cyan-600 dark:text-cyan-400"
      : "text-emerald-600 dark:text-emerald-400";

  const delayLabel =
    delay === null
      ? "N/A"
      : delay === 0
      ? "+0m (Instant)"
      : delay > 0
      ? `+${Math.round(delay)}m (${delay > 180 ? "Dead" : "Delayed"})`
      : `${Math.round(delay)}m (${timingAnalysis.connectsToLateRace ? "Carry-Over" : "Early"})`;

  return (
    <div className={`grid grid-cols-3 divide-x divide-zinc-200/80 dark:divide-zinc-800 text-center py-1 mt-1.5 ${className}`}>
      {/* 2/3 Spurt Line */}
      <div className="px-1.5">
        <span className="block text-[9px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500">
          2/3 Spurt Line
        </span>
        <span className="font-mono font-bold text-xs text-zinc-800 dark:text-zinc-200">
          {spurtM}m
        </span>
      </div>

      {/* Spurt Delay */}
      <div className="px-1.5">
        <span className="block text-[9px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500">
          Spurt Offset (ΔS)
        </span>
        <span className={`font-mono font-extrabold text-xs ${delayColor}`}>
          {delayLabel}
        </span>
      </div>

      {/* Duration on Course */}
      <div className="px-1.5">
        <span className="block text-[9px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500">
          Course Duration
        </span>
        <span className="font-mono font-bold text-xs text-zinc-800 dark:text-zinc-200">
          {durationS > 0 ? `${durationS.toFixed(2)}s (~${Math.round(durationM)}m)` : "Instant"}
        </span>
      </div>
    </div>
  );
}

/**
 * Full Interactive Calculation Breakdown Panel for Track View.
 */
export function CalculationBreakdownPanel({
  evaluation,
  compact = false,
}: {
  evaluation: SkillEvaluationResult;
  compact?: boolean;
}) {
  const [showMathSteps, setShowMathSteps] = useState(false);
  const { calculationBreakdown, timingAnalysis } = evaluation;

  const delayTextClass =
    calculationBreakdown.delayStatus === "optimal"
      ? "text-emerald-600 dark:text-emerald-400"
      : calculationBreakdown.delayStatus === "early_overlap"
      ? "text-cyan-600 dark:text-cyan-400"
      : calculationBreakdown.delayStatus === "delayed"
      ? "text-amber-600 dark:text-amber-400"
      : calculationBreakdown.delayStatus === "dead"
      ? "text-rose-600 dark:text-rose-400"
      : "text-zinc-900 dark:text-zinc-100";

  return (
    <div className="mt-3 flex flex-col gap-3">
      {/* 4 Clean Metric Cells (De-cluttered and airy) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 sm:divide-x divide-zinc-200/80 dark:divide-zinc-800 py-1">
        {/* Metric 1: 2/3 Spurt Line */}
        <div className="py-2.5 sm:py-0 sm:pr-4 flex flex-col justify-between">
          <span className={`${compact ? "text-[9px]" : "text-[10px]"} font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500`}>
            Spurt Line
          </span>
          <div className={`mt-1 font-mono font-extrabold ${compact ? "text-sm sm:text-base" : "text-lg sm:text-xl"} text-zinc-900 dark:text-zinc-100`}>
            {calculationBreakdown.spurtLineMeters.toLocaleString()} m
          </div>
          <div className={`mt-1 ${compact ? "text-[9px]" : "text-[11px]"} font-medium text-zinc-500 dark:text-zinc-400`}>
            Phase 2 Start
          </div>
        </div>

        {/* Metric 2: Activation Trigger Point */}
        <div className="py-2.5 sm:py-0 sm:px-4 flex flex-col justify-between">
          <span className={`${compact ? "text-[9px]" : "text-[10px]"} font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500`}>
            Activation Point
          </span>
          <div className={`mt-1 font-mono font-extrabold ${compact ? "text-sm sm:text-base" : "text-lg sm:text-xl"} text-zinc-900 dark:text-zinc-100`}>
            {calculationBreakdown.triggerStartMeters !== null
              ? `${calculationBreakdown.triggerStartMeters.toLocaleString()} m`
              : "No Trigger"}
          </div>
          <div className={`mt-1 ${compact ? "text-[9px]" : "text-[11px]"} font-medium text-emerald-600 dark:text-emerald-400 font-mono`}>
            {timingAnalysis.isRandom ? "Random Zone" : "Deterministic"}
          </div>
        </div>

        {/* Metric 3: Spurt Delay (ΔS) */}
        <div className="py-2.5 sm:py-0 sm:px-4 flex flex-col justify-between">
          <span className={`${compact ? "text-[9px]" : "text-[10px]"} font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500`}>
            Spurt Offset (ΔS)
          </span>
          <div className={`mt-1 font-mono font-extrabold ${compact ? "text-sm sm:text-base" : "text-lg sm:text-xl"} ${delayTextClass}`}>
            {calculationBreakdown.delayFromSpurtMeters !== null
              ? calculationBreakdown.delayFromSpurtMeters === 0
                ? "+0.0 m"
                : calculationBreakdown.delayFromSpurtMeters > 0
                ? `+${calculationBreakdown.delayFromSpurtMeters} m`
                : `${calculationBreakdown.delayFromSpurtMeters} m`
              : "N/A"}
          </div>
          <div className={`mt-1 ${compact ? "text-[9px]" : "text-[11px]"} font-medium ${delayTextClass}`}>
            {calculationBreakdown.delayStatus === "optimal"
              ? "Instant Accel"
              : calculationBreakdown.delayStatus === "early_overlap"
              ? "Carry-Over"
              : calculationBreakdown.delayStatus === "delayed"
              ? "Delayed Trigger"
              : calculationBreakdown.delayStatus === "dead"
              ? "Zero Acceleration"
              : calculationBreakdown.delayStatus === "mid_race"
              ? "Mid-Race Positioning"
              : "Invalid"}
          </div>
        </div>

        {/* Metric 4: Course Scaled Duration */}
        <div className="py-2.5 sm:py-0 sm:pl-4 flex flex-col justify-between">
          <span className={`${compact ? "text-[9px]" : "text-[10px]"} font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500`}>
            Duration & Travel
          </span>
          <div className={`mt-1 font-mono font-extrabold ${compact ? "text-sm sm:text-base" : "text-lg sm:text-xl"} text-zinc-900 dark:text-zinc-100`}>
            {calculationBreakdown.scaledDurationSeconds > 0
              ? `${calculationBreakdown.scaledDurationSeconds} s`
              : "Instant"}
          </div>
          <div className={`mt-1 ${compact ? "text-[9px]" : "text-[11px]"} font-medium text-zinc-500 dark:text-zinc-400`}>
            {calculationBreakdown.estimatedDistanceMeters > 0
              ? `~${calculationBreakdown.estimatedDistanceMeters}m covered`
              : "Instant Velocity Jump"}
          </div>
        </div>
      </div>

      {/* Accordion Toggle: Show Step-by-Step Mathematical Breakdown (Unboxed) */}
      <div className="border-t border-zinc-200/80 dark:border-zinc-800 pt-3">
        <button
          type="button"
          onClick={() => setShowMathSteps((prev) => !prev)}
          className="w-full flex items-center justify-between py-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-4 w-4 rounded-xs bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-bold">
              ∑
            </span>
            <span>Mathematical & Tactical Calculation Breakdown</span>
            <span className="text-[11px] font-normal text-zinc-400 dark:text-zinc-500">
              (Formula derivations & mechanics)
            </span>
          </div>
          <span className="text-zinc-400 text-xs font-mono inline-flex items-center gap-1">
            {showMathSteps ? (
              <>
                <ChevronUpIcon className="h-3.5 w-3.5" /> Collapse
              </>
            ) : (
              <>
                <ChevronDownIcon className="h-3.5 w-3.5" /> Expand
              </>
            )}
          </span>
        </button>

        {showMathSteps && (
          <div className="divide-y divide-zinc-200/80 dark:divide-zinc-800 border-t border-zinc-200/80 dark:border-zinc-800 mt-2.5">
            {calculationBreakdown.steps.map((step, sIdx) => {
              const borderLeftColor =
                step.badgeType === "optimal"
                  ? "border-l-emerald-500"
                  : step.badgeType === "warning"
                  ? "border-l-amber-500"
                  : step.badgeType === "error"
                  ? "border-l-rose-500"
                  : "border-l-zinc-300 dark:border-l-zinc-700";

              return (
                <div key={sIdx} className={`border-l-2 ${borderLeftColor} py-2.5 px-3 text-xs`}>
                  <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{step.title}</span>
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                      {step.result}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400 mb-1">
                    Formula: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{step.formula}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                    <HighlightText text={step.explanation} />
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
