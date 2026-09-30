"use client";

import { RACE_CONDITION_OPTIONS, type CustomRaceConditions } from "@/lib/deck/race-conditions";
import { FlagIcon, SparklesIcon, TimerIcon, WeatherIcon } from "../primitives/icons";

import { AppSelect } from "./app-select";

const fields = ["season", "weather", "groundCondition", "time"] as const;
const labels = { season: "Season", weather: "Weather", groundCondition: "Ground", time: "Time" };
const tones = {
  season: "border-orange-200 bg-orange-50/80 text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300",
  weather: "border-sky-200 bg-sky-50/80 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300",
  groundCondition: "border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  time: "border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
};

function ConditionIcon({ field, value }: { field: keyof CustomRaceConditions; value: number | null }) {
  const iconClass = "h-3.5 w-3.5 shrink-0 object-contain";
  // Only use available, identified game assets; remaining values use SVG icons.
  const asset = field === "season" && value && value <= 4 ? `utx_txt_season_0${value - 1}.png`
    : field === "weather" && value ? `utx_ico_weather_0${value - 1}.png`
    : field === "time" && value === 2 ? "utx_ico_timezone_00.png" : null;
  if (asset) return <img src={`/assets/track_conditions/${asset}`} alt="" aria-hidden="true" className={iconClass} />;
  const Icon = { season: SparklesIcon, weather: WeatherIcon, groundCondition: FlagIcon, time: TimerIcon }[field];
  return <Icon className={iconClass} />;
}

export function RaceConditionChips({ conditions, onChange }: {
  conditions: CustomRaceConditions;
  onChange?: (conditions: Partial<CustomRaceConditions>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]" aria-label="Race conditions">
      {fields.map((field) => {
        const value = conditions[field];
        const text = value ? RACE_CONDITION_OPTIONS[field][value - 1] : `${labels[field]}: Any / Random`;
        const content = <><ConditionIcon field={field} value={value} /><span>{field === "groundCondition" && value ? `Ground: ${text}` : text}</span></>;
        const className = `inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-medium ${tones[field]}`;
        return onChange ? (
          <AppSelect key={field} label={`Custom ${field}`} variant="chip" className={tones[field]}
            value={String(value ?? "")} onValueChange={(next) => onChange({ [field]: next ? Number(next) : null })}
            options={[{ value: "", label: `${labels[field]}: Any / Random`, icon: <ConditionIcon field={field} value={null} /> },
              ...RACE_CONDITION_OPTIONS[field].map((label, index) => ({ value: String(index + 1),
                label: field === "groundCondition" ? `Ground: ${label}` : label,
                icon: <ConditionIcon field={field} value={index + 1} /> }))]} />
        ) : <span key={field} className={className}>{content}</span>;
      })}
    </div>
  );
}
