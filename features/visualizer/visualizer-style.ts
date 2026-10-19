import type { RunningStyle } from "@/lib/deck/types";
import { horseForStrategy } from "@/lib/skill-engine/zones";
import type { HorseParameters } from "@/lib/skill-engine/types";

/**
 * The running style for the Visualizer's race-impact numbers (inspector and
 * effect modal). The modal's scorer needs a concrete style, so an unset header
 * style falls back to Leader (2); the inspector's race impact uses the same value.
 */
export function visualizerRunningStyle(style: RunningStyle | null | undefined): RunningStyle {
  return style ?? 2;
}

/**
 * The horse used for zones and triggerable tints. With no running style it stays
 * undefined (the engine's default HORSE), as before the race-impact work (R17).
 */
export function visualizerZoneHorse(style: RunningStyle | null | undefined): HorseParameters | undefined {
  return style ? horseForStrategy(style) : undefined;
}
