"use client";

import type { StaminaInput } from "@/lib/stamina-sim";

type Toggles = StaminaInput["toggles"];

const TOGGLES: { key: keyof Toggles; en: string; jp: string }[] = [
  { key: "dueling", en: "Dueling", jp: "追い比べ" },
  { key: "spotStruggle", en: "Spot Struggle", jp: "位置取り争い" },
  { key: "kakari", en: "Kakari", jp: "掛かり" },
];

/** Race-mechanic switches; English on top, Japanese underneath (DESIGN §1). */
export function MechanicToggles({ value, onChange }: { value: Toggles; onChange(next: Toggles): void }) {
  return (
    <div className="grid gap-x-4 sm:grid-cols-3">
      {TOGGLES.map(({ key, en, jp }) => (
        <label key={key} className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 py-1.5">
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
            className="h-4 w-4 shrink-0 accent-emerald-700"
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{en}</span>{" "}
            <span className="mt-0.5 block truncate text-[11px] text-zinc-400 dark:text-zinc-500">{jp}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
