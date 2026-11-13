import { classifyEffect, type EffectCategory, type RawEffect } from "../evaluator/effects";

export type SkillGroup = "target_speed" | "current_speed" | "acceleration" | "recovery" | "debuff" | "passive" | "other";

export const SKILL_GROUPS: readonly SkillGroup[] = ["target_speed", "current_speed", "acceleration", "recovery", "debuff", "passive", "other"];
export const DEFAULT_ENABLED_GROUPS: readonly SkillGroup[] = SKILL_GROUPS.slice(0, 3);
export const SPEED_GROUPS: readonly SkillGroup[] = SKILL_GROUPS.slice(0, 3);

export const SKILL_GROUP_LABELS: Record<SkillGroup, string> = {
  target_speed: "Target speed",
  current_speed: "Current speed",
  acceleration: "Acceleration",
  recovery: "Recovery",
  debuff: "Debuffs",
  passive: "Passive (green)",
  other: "Other",
};

const CATEGORY_TO_GROUP: Record<EffectCategory, SkillGroup> = {
  target_speed: "target_speed",
  current_speed: "current_speed",
  acceleration: "acceleration",
  zenkai_acceleration: "acceleration",
  heal: "recovery",
  debuff: "debuff",
  passive: "passive",
  lane_movement: "other",
  other: "other",
};

export function skillGroupsOf(skill: { conditionGroups?: { effects?: RawEffect[] }[] | null }): SkillGroup[] {
  const found = new Set<SkillGroup>();
  for (const g of skill.conditionGroups ?? []) {
    for (const eff of g.effects ?? []) {
      const category = classifyEffect(eff);
      found.add(category ? CATEGORY_TO_GROUP[category] : "other");
    }
  }
  if (found.size === 0) return ["other"];
  return SKILL_GROUPS.filter((g) => found.has(g));
}

export function isCounted(groups: readonly SkillGroup[], enabled: ReadonlySet<SkillGroup>): boolean {
  return groups.some((g) => enabled.has(g));
}

export function toggleGroup(enabled: readonly SkillGroup[], group: SkillGroup): SkillGroup[] {
  if (enabled.includes(group)) {
    const next = enabled.filter((g) => g !== group);
    return next.length === 0 ? [...enabled] : next;
  }
  const set = new Set<SkillGroup>([...enabled, group]);
  return SKILL_GROUPS.filter((g) => set.has(g));
}
