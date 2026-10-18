"use client";

import { ToggleButton } from "react-aria-components/ToggleButton";

export function OwnedFirstToggle({ isSelected, onChange, controls }: { isSelected: boolean; onChange: (selected: boolean) => void; controls: string }) {
  return <ToggleButton isSelected={isSelected} onChange={onChange} aria-controls={controls} className="inline-flex min-h-11 items-center rounded-lg border border-zinc-200 px-3 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 data-[selected]:border-emerald-500/40 data-[selected]:bg-emerald-500/15 data-[selected]:text-emerald-800 data-[focus-visible]:ring-2 data-[focus-visible]:ring-emerald-500/70 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:data-[selected]:text-emerald-300">Owned first</ToggleButton>;
}
