"use client";

import { AppButton } from "@/app/common/ui/controls/app-button";
import { MinusIcon, PlusIcon } from "@/app/common/ui/primitives/icons";
import { MAX_SKILL_COUNT } from "../model/stamina-prefs";

/** One −/+ count (0..20). `name` is the full accessible noun, e.g. "9.5% recovery". */
export function BucketCounter({ label, sublabel, name, value, onChange }: {
  label: string;
  sublabel?: string;
  name: string;
  value: number;
  onChange(next: number): void;
}) {
  return (
    <div role="group" aria-label={name} className="flex min-w-0 items-center justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{label}</p>
        {sublabel ? <p className="mt-0.5 truncate text-[11px] text-zinc-400 dark:text-zinc-500">{sublabel}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <AppButton variant="secondary" iconOnly aria-label={`Decrease ${name}`} isDisabled={value <= 0} onPress={() => onChange(Math.max(0, value - 1))}>
          <MinusIcon className="h-3.5 w-3.5" />
        </AppButton>
        <output aria-live="polite" className={`w-7 text-center text-sm font-semibold tabular-nums ${value > 0 ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}`}>{value}</output>
        <AppButton variant="secondary" iconOnly aria-label={`Increase ${name}`} isDisabled={value >= MAX_SKILL_COUNT} onPress={() => onChange(Math.min(MAX_SKILL_COUNT, value + 1))}>
          <PlusIcon className="h-3.5 w-3.5" />
        </AppButton>
      </div>
    </div>
  );
}
