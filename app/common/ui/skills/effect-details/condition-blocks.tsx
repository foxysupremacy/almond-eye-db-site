import { Fragment } from "react";
import type { SkillDetail } from "@/lib/data/types";
import { describeCondition, normalizeRacerCount } from "@/lib/skill-engine/describe";
import { orderRateRange, PositionDots, positionLabel } from "./position-dots";

const CHIP = "rounded-full bg-zinc-100 px-2 text-[11px] dark:bg-zinc-800";

export function OrDivider() {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      <span>OR</span>
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

export function ConditionBlocks({
  groups,
  activeIndex,
  venueLabel,
  racerCount,
  inactiveReasons,
}: {
  groups: SkillDetail["conditionGroups"];
  activeIndex: number | null;
  venueLabel: string;
  racerCount: number;
  inactiveReasons?: Record<number, string>;
}) {
  const count = normalizeRacerCount(racerCount);
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group, index) => {
        const active = index === activeIndex;
        const { when, needs } = describeCondition(group.condition ?? "", group.precondition, count);
        const range = orderRateRange(group.condition ?? "", count);
        const reason = !active ? inactiveReasons?.[index] : undefined;
        return (
          <Fragment key={index}>
            {index > 0 ? <OrDivider /> : null}
            <section
              role="group"
              aria-label={`Condition group ${index + 1}`}
              className={`border-l-2 pl-3 ${active ? "border-emerald-500" : "border-zinc-200 opacity-70 dark:border-zinc-800"}`}
            >
              {active ? (
                <p className="mb-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Applies on {venueLabel}</p>
              ) : null}
              {reason ? <p className="mb-1 text-[11px] text-zinc-500 dark:text-zinc-400">{reason}</p> : null}
              <dl className="flex flex-col gap-1.5 text-xs">
                <div className="flex flex-wrap items-baseline gap-2">
                  <dt className={CHIP}>When</dt>
                  <dd className="min-w-0 text-zinc-800 dark:text-zinc-200">{when || "Always"}</dd>
                </div>
                {needs ? (
                  <div className="flex flex-wrap items-baseline gap-2">
                    <dt className={CHIP}>Needs</dt>
                    <dd className="min-w-0 text-zinc-800 dark:text-zinc-200">{needs}</dd>
                  </div>
                ) : null}
                {range ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <dt className={CHIP}>Places</dt>
                    <dd>
                      <PositionDots racerCount={count} range={range} label={positionLabel(count, range)} />
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
          </Fragment>
        );
      })}
    </div>
  );
}
