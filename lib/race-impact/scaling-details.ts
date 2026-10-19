import type { RawSkillEffect } from "../data/types";
import type { RunningStyle } from "../deck/types";
import type { Course } from "../skill-engine/types";
import type { ResolvedSkillEffects, SkillEffectScalingResolution } from "../skill-scaling";
import { defaultRaceImpactProfile } from "./profile";
import { additionalActivationFactor, scaledEffectValue, scalingContextFor } from "./scaling";
import { simulationInputFor } from "./trace";
import type { RaceImpactProfile } from "./types";
import { uniqueLevelMultiplier } from "./unique-level";

export interface RaceEffectScalingContext {
  course?: Course | null;
  profile?: RaceImpactProfile;
  style?: RunningStyle | null;
  groundCondition?: number | null;
  isUnique?: boolean;
  level?: number;
}

/** Values come from the physical engine; this adapter adds explanations only. */
export function resolveRaceSkillEffects(
  effects: readonly RawSkillEffect[] | undefined,
  context: RaceEffectScalingContext = {},
): ResolvedSkillEffects {
  const profile = context.profile ?? defaultRaceImpactProfile();
  const sim = simulationInputFor(context.course, profile, context.style, context.groundCondition);
  const course = context.course ?? {
    id: 0, trackId: 0, length: 0, distance: 0, terrain: 1, turn: 1, inout: 1,
    corners: [], straights: [], slopes: [],
  };
  const scaling = scalingContextFor(course, profile.stats, sim.stats.speed, { greenSkillCount: profile.greenSkillCount });
  const resolutions: SkillEffectScalingResolution[] = [];
  const resolved = (effects ?? []).map((effect, effectIndex) => {
    const code = effect.value_scale ?? 1;
    const leveled = (effect.value ?? 0) * (context.isUnique ? uniqueLevelMultiplier(context.level ?? 1, effect.type ?? 0) : 1);
    const count = additionalActivationFactor(effect.additional_activation);
    // The same order as effectValues(): unique level, value scaling, additional activation.
    const value = scaledEffectValue(effect, leveled, scaling) * count;
    let status: SkillEffectScalingResolution["status"] = "assumed";
    let reason: string;
    let label: string | undefined;
    let assumedInputs: string[] = [];
    switch (code) {
      case 0: case 1: status = "unchanged"; reason = "Base effect value"; break;
      case 2:
        reason = `Reference horse holds ${scaling.skillCount} skill; the engine uses that reference count.`;
        assumedInputs = [`Skills held: ${scaling.skillCount} (Assumed)`]; break;
      case 8: case 9:
        status = "resolved"; label = "Random effect scaling";
        reason = "Expected effect across the engine's random outcomes; this is an average, not the maximum roll."; break;
      case 11:
        reason = "Final Leg corner overtakes are assumed at the highest effect tier.";
        assumedInputs = ["4+ Final Leg corner overtakes (Assumed)"]; break;
      case 13:
        status = "resolved"; reason = `Highest raw stat: ${scaling.maxRawStat}; the matching engine band is applied.`; break;
      case 14:
        status = profile.greenSkillCount == null ? "assumed" : "resolved";
        reason = `Activated green skills: ${scaling.passiveCount}${status === "assumed" ? " (engine reference)" : " (configured reference)"}; the matching engine band is applied.`;
        if (status === "assumed") assumedInputs = [`Activated green skills: ${scaling.passiveCount} (Assumed)`]; break;
      case 19:
        reason = "The strongest distance-from-leader bonus is assumed.";
        assumedInputs = ["20 m+ from the race leader (Assumed)"]; break;
      case 20:
        reason = "The strongest Middle Leg side-blocked effect is assumed.";
        assumedInputs = ["6 s+ side-blocked during the Middle Leg (Assumed)"]; break;
      case 22: case 23:
        status = "resolved"; reason = `Adjusted Speed: ${scaling.adjustedSpeed}; the matching engine band is applied.`; break;
      case 25:
        reason = "The strongest lead bonus is assumed.";
        assumedInputs = ["25 m+ lead before the Final Leg (Assumed)"]; break;
      case 30:
        reason = "Fan Love data is unavailable; the engine assumes its highest effect tier."; break;
      case 34:
        reason = "The distance-behind-first bonus is assumed.";
        assumedInputs = ["20 m+ behind first place (Assumed)"]; break;
      case 35:
        status = "resolved";
        if (scaling.distanceType === 2) reason = "Mile race; +0.1 effect value";
        else if (scaling.courseLength === 2500 && scaling.trackId === 10005) {
          status = "assumed"; reason = "Arima Kinen course selected; the 146,738-fan bonus is assumed.";
          assumedInputs = ["Arima Kinen course and 146,738+ fans (Assumed)"];
        } else reason = context.course ? "No Mile or Arima Kinen bonus applies on this course" : "No course is selected; course-specific bonus not assumed";
        break;
      case 36:
        status = context.course ? "resolved" : "unsupported";
        reason = !context.course ? "Select a course to resolve the Medium-race bonus."
          : scaling.distanceType === 3 ? "Medium race; the engine uses an effect value of 0.65 m/s."
          : "Non-Medium race; no Medium-race bonus applies.";
        break;
      case 3: case 4: case 5: case 6: case 7: case 10: case 12: case 24:
      case 26: case 27: case 28: case 31: case 32: case 37:
        label = "Team / career effect scaling";
        reason = "The engine assumes the strongest team or career effect tier.";
        assumedInputs = ["Highest team / career effect tier (Assumed)"]; break;
      default:
        status = "unsupported"; reason = `Scaling code ${code} is not modeled by the current engine; its base effect value is retained.`;
    }
    if (count > 1) {
      if (status === "unchanged") label = "Additional activation value";
      if (status !== "unsupported") status = "assumed";
      reason += ` The engine applies ${count} total effect applications from activation.`;
      assumedInputs.push(`${count} total effect applications (Assumed)`);
    }
    resolutions.push({ effectIndex, code, baseValue: effect.value ?? 0, value, status, reason, needs: [],
      ...(label ? { label } : {}), ...(assumedInputs.length ? { assumedInputs } : {}) });
    return { ...effect, value };
  });
  return { effects: resolved, resolutions };
}
