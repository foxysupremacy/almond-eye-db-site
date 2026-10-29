"use client";

import type { StaminaResult } from "@/lib/stamina-sim";
import { LoadingAnimation } from "@/app/common/ui/controls/loading-animation";
import type { StaminaStatus } from "../view-models/use-stamina-sim";

const R = 34;
const C = 2 * Math.PI * R;

/** Percent (0-100) as a ring; `null` draws the empty track only. */
function Ring({ pct, tone }: { pct: number | null; tone: string }) {
  const clamped = pct == null ? 0 : Math.min(100, Math.max(0, pct));
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true" className="h-20 w-20 shrink-0 -rotate-90">
      <circle cx="40" cy="40" r={R} fill="none" strokeWidth="6" className="stroke-zinc-100 dark:stroke-zinc-800" />
      {pct != null ? (
        <circle cx="40" cy="40" r={R} fill="none" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - clamped / 100)} className={tone} />
      ) : null}
    </svg>
  );
}

const pctText = (n: number) => `${n.toFixed(1)}%`;

interface Item { label: string; caption: string; tone: string; pct: (r: StaminaResult) => number; extra?: (r: StaminaResult) => string }

const ITEMS: Item[] = [
  { label: "Goal reach", caption: "HP lasts to the finish. A reduced spurt is planned to spend all HP, so it often runs dry just before the line.", tone: "stroke-emerald-600 dark:stroke-emerald-500", pct: (r) => r.goalReachPct },
  { label: "Max spurt", caption: "Full last spurt to the line", tone: "stroke-emerald-800 dark:stroke-emerald-400", pct: (r) => r.maxSpurtPct, extra: (r) => (r.maxSpurtPct > 0 ? `≈ ${Math.round(r.avgSurplusHp)} HP surplus` : "—") },
  { label: "Stamina Keep", caption: "Runs that entered Stamina Keep", tone: "stroke-amber-500 dark:stroke-amber-400", pct: (r) => r.staminaKeepPct },
];

/** Three result rings. Idle shows the labels only (no numbers); running overlays the shared loader; stale dims the last result. */
export function ResultCircles({ status, result, error, stale = false }: { status: StaminaStatus; result: StaminaResult | null; error: string | null; stale?: boolean }) {
  const ready = status === "ready" && result != null;
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
      <ul aria-label="Results" aria-busy={status === "running"} data-stale={stale ? "true" : undefined} className={`${stale ? "opacity-50" : ""} transition-opacity duration-200 ease-out-quart grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-0 lg:divide-y lg:divide-zinc-100 dark:lg:divide-zinc-800/80`}>
        {ITEMS.map((item) => {
          const pct = ready ? item.pct(result) : null;
          const extra = ready && item.extra ? item.extra(result) : null;
          return (
            <li key={item.label} aria-label={pct == null ? item.label : `${item.label} ${pctText(pct)}${extra ? `, ${extra}` : ""}`} className="flex min-w-0 flex-col items-center gap-1.5 text-center lg:flex-row lg:gap-3 lg:py-2 lg:text-left">
              <div className="relative">
                <Ring pct={pct} tone={item.tone} />
                <span className="absolute inset-0 grid place-items-center text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {pct == null ? <span className="text-zinc-300 dark:text-zinc-600">–</span> : pctText(pct)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{item.label}</p>
                <p className="mt-0.5 hidden text-[11px] text-zinc-400 sm:block dark:text-zinc-500">{item.caption}</p>
                {extra ? <p className="mt-0.5 text-[11px] font-medium tabular-nums text-zinc-600 dark:text-zinc-300">{extra}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
      <LoadingAnimation active={status === "running"} label="Calculating stamina" variant="overlay" size="md" />
      </div>
      <p aria-live="polite" className="text-[11px] text-zinc-500 dark:text-zinc-400">
        {status === "running" ? "Calculating…"
          : status === "error" ? `Could not calculate${error ? `: ${error}` : "."}`
          : stale ? "Inputs changed — press Calculate"
          : ready ? `${result.runs.toLocaleString("en-US")} simulated races.`
          : "Press Calculate to simulate this build."}
      </p>
    </div>
  );
}
