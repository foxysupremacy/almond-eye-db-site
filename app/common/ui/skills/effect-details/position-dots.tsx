import { normalizeRacerCount, positionRange } from "@/lib/skill-engine/describe";

/** Ordinal label: 1st, 2nd, 3rd, 4th, 11th ... */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/**
 * Allowed finishing places for a condition string. Delegates to the shared
 * `positionRange` in lib/skill-engine/describe.ts so dots always agree with the
 * describeCondition wording (all order/order_rate terms intersected per `@`
 * branch; span across branches; null when unconstrained). The racer count is
 * normalized (round, clamp 9-18, default 12) the same way.
 */
export function orderRateRange(conditionText: string, racerCount: number): [number, number] | null {
  return positionRange(conditionText, racerCount);
}

export function positionLabel(racerCount: number, range: [number, number]): string {
  const count = normalizeRacerCount(racerCount);
  const prefix = count === 9 ? "CM condition" : count === 12 ? "LoH condition" : "Position";
  const [a, b] = range;
  return `${prefix}: ${a === b ? ordinal(a) : `${ordinal(a)}–${ordinal(b)}`}`;
}

export function PositionDots({ racerCount, range, label }: { racerCount: number; range: [number, number]; label: string }) {
  const count = normalizeRacerCount(racerCount);
  return (
    <ul aria-label={label} className="flex flex-wrap items-center gap-1">
      {Array.from({ length: count }, (_, i) => {
        const place = i + 1;
        const allowed = place >= range[0] && place <= range[1];
        return (
          <li
            key={place}
            data-allowed={allowed ? "true" : "false"}
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums ${
              allowed ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {place}
          </li>
        );
      })}
    </ul>
  );
}
