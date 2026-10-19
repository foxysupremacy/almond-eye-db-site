import { MAX_UNIQUE_LEVEL } from "@/lib/race-impact/unique-level";

const BTN =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-zinc-200 text-base font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

export function LevelStepper({ level, onChange, deltaBashin }: { level: number; onChange(level: number): void; deltaBashin: number | null }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex items-center gap-1">
        <button type="button" aria-label="Decrease unique level" className={BTN} disabled={level <= 1} onClick={() => onChange(Math.max(1, level - 1))}>
          −
        </button>
        <span className="min-w-10 text-center text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{`Lv${level}`}</span>
        <button
          type="button"
          aria-label="Increase unique level"
          className={BTN}
          disabled={level >= MAX_UNIQUE_LEVEL}
          onClick={() => onChange(Math.min(MAX_UNIQUE_LEVEL, level + 1))}
        >
          +
        </button>
      </div>
      <span role="status" aria-label="Level delta" className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
        {deltaBashin === null ? "" : `${deltaBashin >= 0 ? "+" : "−"}${Math.abs(deltaBashin).toFixed(2)} Bashin vs Lv1`}
      </span>
    </div>
  );
}
