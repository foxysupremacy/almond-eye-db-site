"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "../icons";
import {
  DEFAULT_RACE_IMPACT_STATS,
  type DynamicConditionKey,
  type RaceImpactProfile,
  type RaceImpactStat,
} from "../../lib/race-impact";

const STAT_LABELS: Record<RaceImpactStat, string> = {
  speed: "Speed",
  stamina: "Stamina",
  power: "Power",
  guts: "Guts",
  wisdom: "Wisdom",
};

const DYNAMIC_LABELS: Record<DynamicConditionKey, string> = {
  blocked: "Blocked",
  overtake: "Overtake",
  nearby: "Nearby runners",
  surrounded: "Surrounded",
  activate_count: "Activation count",
  other_skill: "Prior skill trigger",
  visibility: "Visibility",
};

export function RaceImpactProfilePanel({
  profile,
  dynamicKeys,
  onChange,
}: {
  profile: RaceImpactProfile;
  dynamicKeys: DynamicConditionKey[];
  onChange: (next: RaceImpactProfile) => void;
}) {
  const [open, setOpen] = useState(false);
  const updateStat = (key: RaceImpactStat, value: string) => {
    const parsed = Number.parseInt(value, 10);
    onChange({ ...profile, stats: { ...profile.stats, [key]: Number.isFinite(parsed) ? parsed : profile.stats[key] } });
  };
  const updateDynamic = (key: DynamicConditionKey, value: string) => {
    const percentage = Number.parseFloat(value);
    const probability = Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) / 100 : undefined;
    const dynamicOverrides = { ...profile.dynamicOverrides };
    if (probability === undefined) delete dynamicOverrides[key];
    else dynamicOverrides[key] = probability;
    onChange({ ...profile, dynamicOverrides });
  };
  return (
    <section className="border-y border-zinc-200/80 py-2.5 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-7 w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Race-impact profile</span>
          <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">Stats and dynamic-condition assumptions are saved locally.</span>
        </span>
        {open ? <ChevronUpIcon className="h-4 w-4 flex-none text-zinc-500" /> : <ChevronDownIcon className="h-4 w-4 flex-none text-zinc-500" />}
      </button>
      {open && (
        <div className="mt-3 divide-y divide-zinc-200/80 border-t border-zinc-200/80 pt-3 dark:divide-zinc-800 dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 pb-3 sm:grid-cols-5">
            {(Object.keys(STAT_LABELS) as RaceImpactStat[]).map((key) => (
              <label key={key} className="flex min-w-0 items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>{STAT_LABELS[key]}</span>
                <input
                  type="number"
                  min="1"
                  max="3000"
                  value={profile.stats[key]}
                  onChange={(event) => updateStat(key, event.target.value)}
                  className="w-16 border-b border-zinc-300 bg-transparent py-0.5 text-right font-mono text-xs font-semibold text-zinc-900 outline-none dark:border-zinc-700 dark:text-zinc-100"
                />
              </label>
            ))}
          </div>
          {dynamicKeys.length > 0 && (
            <div className="grid grid-cols-1 gap-x-4 gap-y-2 py-3 sm:grid-cols-2">
              {dynamicKeys.map((key) => (
                <label key={key} className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span>{DYNAMIC_LABELS[key]}</span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      placeholder="Telemetry"
                      value={profile.dynamicOverrides[key] === undefined ? "" : Math.round(profile.dynamicOverrides[key]! * 100)}
                      onChange={(event) => updateDynamic(key, event.target.value)}
                      className="w-16 border-b border-zinc-300 bg-transparent py-0.5 text-right font-mono text-xs font-semibold text-zinc-900 outline-none dark:border-zinc-700 dark:text-zinc-100"
                    />
                    <span>%</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => onChange({ version: 1, stats: { ...DEFAULT_RACE_IMPACT_STATS }, dynamicOverrides: {} })}
            className="pt-3 text-[11px] font-semibold text-emerald-700 hover:text-emerald-600 dark:text-emerald-400"
          >
            Reset to standard profile
          </button>
        </div>
      )}
    </section>
  );
}
