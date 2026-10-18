"use client";

import { ToggleButton, ToggleButtonGroup } from "react-aria-components/ToggleButtonGroup";
import type { StyleTab } from "../model/rankings-prefs";

export const STYLE_TABS: { id: StyleTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: 1, label: "Runner" },
  { id: 2, label: "Leader" },
  { id: 3, label: "Betweener" },
  { id: 4, label: "Chaser" },
];

const keyOf = (tab: StyleTab) => String(tab);
const tabOf = (key: string): StyleTab => (key === "all" ? "all" : (Number(key) as 1 | 2 | 3 | 4));

/** Running-style segmented control (single selection → radiogroup semantics). */
export function StyleTabs({ value, onChange, sticky }: { value: StyleTab; onChange(tab: StyleTab): void; sticky: boolean }) {
  return (
    <div className={`${sticky ? "sticky top-14 z-20 bg-white/90 backdrop-blur dark:bg-zinc-900/90" : ""} -mx-1 overflow-x-auto px-1 py-1.5`}>
      <ToggleButtonGroup
        aria-label="Running style"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set([keyOf(value)])}
        onSelectionChange={(keys) => {
          const next = [...keys][0];
          if (next != null) onChange(tabOf(String(next)));
        }}
        className="inline-flex min-w-max items-center gap-1 rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700"
      >
        {STYLE_TABS.map((tab) => (
          <ToggleButton
            key={keyOf(tab.id)}
            id={keyOf(tab.id)}
            className="inline-flex min-h-11 items-center justify-center rounded-md px-3 text-xs font-semibold text-zinc-600 outline-none transition-colors duration-150 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-500/70 data-[selected]:bg-emerald-800 data-[selected]:text-white md:min-h-8 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:data-[selected]:bg-emerald-700"
          >
            {tab.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}
