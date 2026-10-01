"use client";

import { ToggleButton, ToggleButtonGroup } from "react-aria-components/ToggleButtonGroup";
import { AppButton } from "@/app/common/ui/controls/app-button";
import type { SkillEffectCategory } from "@/lib/skills/effects";
import { EFFECT_CATEGORIES } from "@/app/common/ui/skills/skill-effects";

interface SkillEffectFilterProps {
  selectedEffects: readonly SkillEffectCategory[];
  onToggle: (category: SkillEffectCategory) => void;
  onClear: () => void;
  ariaLabel?: string;
}

/** Shared effect-category chips used by track recommendations and skill lists. */
export function SkillEffectFilter({
  selectedEffects,
  onToggle,
  onClear,
  ariaLabel = "Filter skills by effect",
}: SkillEffectFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-0.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-500">Effect:</span>
      <ToggleButtonGroup
        aria-label={ariaLabel}
        selectionMode="multiple"
        selectedKeys={new Set(selectedEffects)}
        onSelectionChange={(selection) => {
          const next = selection;
          for (const category of EFFECT_CATEGORIES) {
            if (selectedEffects.includes(category.id) !== next.has(category.id)) onToggle(category.id);
          }
        }}
        className="flex flex-wrap items-center gap-1"
      >
      {EFFECT_CATEGORIES.map((category) => {
        const active = selectedEffects.includes(category.id);
        return (
          <ToggleButton
            key={category.id}
            id={category.id}
            aria-label={category.label}
            aria-description={category.description}
            className={`inline-flex min-h-11 items-center gap-1 rounded border px-1.5 text-[10px] font-medium transition-colors md:min-h-8 data-[selected]:font-semibold ${active ? category.badge : "border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400"}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${category.dotColor} ${active ? "" : "opacity-50"}`} />
            {category.label}
          </ToggleButton>
        );
      })}
      </ToggleButtonGroup>
      {selectedEffects.length > 0 && (
        <AppButton
          variant="quiet"
          size="sm"
          onPress={onClear}
          className="px-1.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400"
        >
          Clear
        </AppButton>
      )}
    </div>
  );
}
