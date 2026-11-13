import { notifyLocalUpdate, readJsonStorage, writeJsonStorage } from "../storage/persistence";
import { DEFAULT_ENABLED_GROUPS, SKILL_GROUPS, type SkillGroup } from "./skill-groups";

export const AUTO_PICK_SETTINGS_KEY = "parent_autopick.v1";

export interface AutoPickSettings { scenarioId: number | null; palCardByScenario: Record<string, number>; enabledGroups: SkillGroup[] }

export function defaultAutoPickSettings(): AutoPickSettings {
  return { scenarioId: null, palCardByScenario: {}, enabledGroups: [...DEFAULT_ENABLED_GROUPS] };
}

export function normalizeAutoPickSettings(value: unknown): AutoPickSettings {
  const base = defaultAutoPickSettings();
  if (typeof value !== "object" || value === null || Array.isArray(value)) return base;
  const raw = value as Record<string, unknown>;
  const scenarioId = typeof raw.scenarioId === "number" && Number.isFinite(raw.scenarioId) ? raw.scenarioId : null;
  const palCardByScenario: Record<string, number> = {};
  if (typeof raw.palCardByScenario === "object" && raw.palCardByScenario !== null && !Array.isArray(raw.palCardByScenario)) {
    for (const [k, v] of Object.entries(raw.palCardByScenario as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) palCardByScenario[k] = v;
    }
  }
  const groups = new Set<SkillGroup>();
  if (Array.isArray(raw.enabledGroups)) {
    for (const g of raw.enabledGroups) if ((SKILL_GROUPS as readonly unknown[]).includes(g)) groups.add(g as SkillGroup);
  }
  const enabledGroups = groups.size === 0 ? base.enabledGroups : SKILL_GROUPS.filter((g) => groups.has(g));
  return { scenarioId, palCardByScenario, enabledGroups };
}

export function loadAutoPickSettings(): AutoPickSettings {
  return normalizeAutoPickSettings(readJsonStorage<unknown>(AUTO_PICK_SETTINGS_KEY));
}

export function saveAutoPickSettings(settings: AutoPickSettings): void {
  writeJsonStorage(AUTO_PICK_SETTINGS_KEY, normalizeAutoPickSettings(settings));
  notifyLocalUpdate(AUTO_PICK_SETTINGS_KEY);
}
