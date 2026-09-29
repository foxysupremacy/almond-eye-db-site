import { classifyEffect } from "./effects";
import type { SkillDetailInput } from "./types";

export interface SkillEffectSummary {
  hasAccel: boolean;
  hasZenkaiAcceleration: boolean;
  hasTargetSpeed: boolean;
  hasCurrentSpeed: boolean;
  hasHeal: boolean;
  hasPassive: boolean;
  hasDebuff: boolean;
  maxBaseTime: number;
  maxAccelVal: number;
  maxZenkaiAccelerationVal: number;
  maxSpeedVal: number;
  zenkaiOnly: boolean;
}

/** Summarize effect groups once before course timing and scoring are evaluated. */
export function summarizeSkillEffects(
  groups: SkillDetailInput["conditionGroups"],
): SkillEffectSummary {
  const summary: SkillEffectSummary = {
    hasAccel: false,
    hasZenkaiAcceleration: false,
    hasTargetSpeed: false,
    hasCurrentSpeed: false,
    hasHeal: false,
    hasPassive: false,
    hasDebuff: false,
    maxBaseTime: 0,
    maxAccelVal: 0,
    maxZenkaiAccelerationVal: 0,
    maxSpeedVal: 0,
    zenkaiOnly: false,
  };

  for (const group of groups ?? []) {
    summary.maxBaseTime = Math.max(summary.maxBaseTime, group.base_time ?? 0);
    for (const effect of group.effects ?? []) {
      const value = effect.value ?? 0;
      switch (classifyEffect(effect)) {
        case "debuff":
          summary.hasDebuff = true;
          break;
        case "acceleration":
          summary.hasAccel = true;
          summary.maxAccelVal = Math.max(summary.maxAccelVal, value);
          break;
        case "zenkai_acceleration":
          summary.hasZenkaiAcceleration = true;
          summary.maxZenkaiAccelerationVal = Math.max(summary.maxZenkaiAccelerationVal, value);
          break;
        case "target_speed":
          summary.hasTargetSpeed = true;
          summary.maxSpeedVal = Math.max(summary.maxSpeedVal, value);
          break;
        case "current_speed":
          summary.hasCurrentSpeed = true;
          summary.maxSpeedVal = Math.max(summary.maxSpeedVal, value);
          break;
        case "heal":
          summary.hasHeal = true;
          break;
        case "passive":
          summary.hasPassive = true;
          break;
      }
    }
  }

  summary.zenkaiOnly =
    summary.hasZenkaiAcceleration &&
    !summary.hasAccel &&
    !summary.hasTargetSpeed &&
    !summary.hasCurrentSpeed &&
    !summary.hasHeal &&
    !summary.hasPassive &&
    !summary.hasDebuff;

  return summary;
}
