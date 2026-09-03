import React from "react";

interface ChainArrowIconProps {
  step: number;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Renders crisp vector SVG chevrons indicating chain progression:
 * Step 1 -> ›, Step 2 -> ››, Step 3 -> ›››
 * Spaced with precision geometry and subtle leading opacity for directional flow.
 */
export function ChainArrowIcon({
  step,
  className = "text-amber-700",
  size = "md",
}: ChainArrowIconProps) {
  const count = Math.max(1, Math.min(step, 4));
  const h = size === "sm" ? 10 : 12;
  const chevronSpacing = size === "sm" ? 4 : 5.5;
  const totalWidth = 6 + (count - 1) * chevronSpacing;

  return (
    <svg
      width={totalWidth}
      height={h}
      viewBox={`0 0 ${totalWidth} ${h}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => {
        const xOffset = i * chevronSpacing;
        // Subtle progressive opacity for trailing chevrons
        const opacity = count === 1 ? 1 : 0.45 + ((i + 1) / count) * 0.55;
        const midY = h / 2;
        const topY = 2;
        const botY = h - 2;
        const tipX = xOffset + (size === "sm" ? 4.5 : 5.5);
        const startX = xOffset + 1;

        return (
          <path
            key={i}
            d={`M ${startX} ${topY} L ${tipX} ${midY} L ${startX} ${botY}`}
            stroke="currentColor"
            strokeWidth={size === "sm" ? 1.75 : 2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={opacity}
          />
        );
      })}
    </svg>
  );
}

interface ChainStepBadgeProps {
  step: number;
  isClimax?: boolean;
  className?: string;
}

/**
 * High-craft progressive step badge pairing the directional chevrons
 * with the event step number. Step 3 (climax) gets a distinctive gold highlight.
 */
export function ChainStepBadge({
  step,
  isClimax = false,
  className = "",
}: ChainStepBadgeProps) {
  const isGoldStep = isClimax || step >= 3;

  if (isGoldStep) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md border border-amber-300/90 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 shadow-2xs ${className}`}
        title={`Continuous Event Step ${step} (Gold Skill Climax)`}
      >
        <ChainArrowIcon step={step} size="sm" className="text-amber-600" />
        <span>Step {step}</span>
        <span className="text-[9px] text-amber-600 font-extrabold">★</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 ${className}`}
      title={`Continuous Event Step ${step}`}
    >
      <ChainArrowIcon step={step} size="sm" className="text-zinc-500" />
      <span>Step {step}</span>
    </span>
  );
}
