import type { SkillEffectScalingResolution } from "@/lib/skill-scaling";
import { FAN_LOVE_MAX_THRESHOLD, SKILL_SCALING_LABELS } from "@/lib/skill-scaling";

/** Shared special-value explanations for the inspector, Visualizer and effect modal. */
export function SpecialValueDetails({ resolutions, selectedUma }: {
  resolutions: SkillEffectScalingResolution[];
  selectedUma?: string;
}) {
  const entries = [...new Map(resolutions.filter(item => item.status !== "unchanged")
    .map(item => [JSON.stringify([item.code, item.status, item.reason, item.assumedInputs]), item])).values()];
  const assumedScalingInputs = (code: number): string[] => {
    if (code === 11) return ["4+ Final Leg corner overtakes (Assumed)"];
    if (code === 30) return [`${selectedUma ?? "Selected Uma"}’s Fan Love: ${FAN_LOVE_MAX_THRESHOLD.toLocaleString("de-DE")}+ (Assumed)`];
    if (code === 34) return ["20 m+ behind first place (Assumed)"];
    if (code === 35) return ["Arima Kinen course and 146,738+ fans (Assumed)"];
    return [];
  };
  if (!entries.length) return null;
  return (
    <div aria-label="Special value">
      {entries.map((item, index) => {
        const assumed = item.status === "assumed";
        const inputs = assumed
          ? [...new Set([...assumedScalingInputs(item.code), ...(item.assumedInputs ?? item.needs ?? [])])]
          : item.needs ?? ["The formula and its runtime inputs have not been verified."];
        // Fan Love is a derived quantity, not the Uma's training fan count.
        const visibleInputs = assumed && item.code === 30
          ? [...new Set([...assumedScalingInputs(30), ...(item.assumedInputs ?? [])])]
          : inputs;
        return (
          <div key={index} className="mt-2 border-l-2 border-violet-300 pl-2.5 dark:border-violet-800">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold text-violet-900 dark:text-violet-200">
                {item.label ?? SKILL_SCALING_LABELS[item.code] ?? `Effect scaling ${item.code}`}
              </span>
              {item.status !== "resolved" && (
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${assumed ? "bg-amber-200 text-amber-950 dark:bg-amber-900/70 dark:text-amber-100" : "bg-rose-200 text-rose-950 dark:bg-rose-900/70 dark:text-rose-100"}`}>
                  {item.status}
                </span>
              )}
            </div>
            {item.reason && <p className="mt-1 text-[11px] leading-4 text-zinc-700 dark:text-zinc-300">
              {assumed && item.code === 30 ? "Using the maximum effect value because Fan Love data is unavailable." : item.reason}
            </p>}
            {visibleInputs.length > 0 && <>
              <p className="mt-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                {assumed ? "Assumed scaling inputs:" : "Inputs needed to calculate the race-specific value:"}
              </p>
              <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[11px] leading-4 text-zinc-700 dark:text-zinc-300">
                {visibleInputs.map(need => <li key={need}>{need}</li>)}
              </ul>
            </>}
          </div>
        );
      })}
    </div>
  );
}
