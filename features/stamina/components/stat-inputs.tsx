"use client";

import { useEffect, useState } from "react";
import { STAT_CAP, type StatBlock } from "@/lib/race-impact/adjusted-stats";
import { STAT_KEYS } from "../model/stamina-prefs";

const STAT_LABELS: Record<keyof StatBlock, string> = { speed: "Speed", stamina: "Stamina", power: "Power", guts: "Guts", wisdom: "Wit" };

const clampStat = (n: number) => Math.min(STAT_CAP, Math.max(1, Math.round(n)));

/** Raw on-screen stat; commits while the typed value is in range and clamps on blur. */
function StatInput({ stat, value, onChange }: { stat: keyof StatBlock; value: number; onChange(next: number): void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const id = `stamina-stat-${stat}`;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{STAT_LABELS[stat]}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={STAT_CAP}
        step={1}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isInteger(n) && n >= 1 && n <= STAT_CAP) onChange(n);
        }}
        onBlur={() => {
          const n = Number(draft);
          const next = draft === "" || !Number.isFinite(n) ? value : clampStat(n);
          setDraft(String(next));
          if (next !== value) onChange(next);
        }}
        className="min-h-11 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm font-semibold tabular-nums text-zinc-900 outline-none transition-colors hover:border-zinc-300 focus-visible:ring-2 focus-visible:ring-emerald-500/70 md:min-h-9 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600"
      />
    </div>
  );
}

export function StatInputs({ stats, onChange }: { stats: StatBlock; onChange(next: StatBlock): void }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {STAT_KEYS.map((k) => (
        <StatInput key={k} stat={k} value={stats[k]} onChange={(n) => onChange({ ...stats, [k]: n })} />
      ))}
    </div>
  );
}
