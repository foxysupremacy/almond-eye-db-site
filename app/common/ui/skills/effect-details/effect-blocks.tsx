import { Fragment } from "react";
import type { SkillDetail } from "@/lib/data/types";
import { uniqueLevelMultiplier } from "@/lib/race-impact/unique-level";
import { OrDivider } from "./condition-blocks";

const CHIP = "rounded-full bg-zinc-100 px-2 text-[11px] dark:bg-zinc-800";

interface EffectMeta {
  name: string;
  unit: string;
  scale: number;
  decimals: number;
  provisional?: boolean;
}
const EFFECTS: Record<number, EffectMeta> = {
  27: { name: "Target speed", unit: "m/s", scale: 10000, decimals: 3 },
  21: { name: "Current speed", unit: "m/s", scale: 10000, decimals: 3 },
  22: { name: "Current speed", unit: "m/s", scale: 10000, decimals: 3 },
  31: { name: "Acceleration", unit: "m/s²", scale: 10000, decimals: 3 },
  9: { name: "Recovery", unit: "% HP", scale: 100, decimals: 2 },
  48: { name: "Spurt acceleration", unit: "m/s²", scale: 10000, decimals: 3, provisional: true },
};

const trim = (n: number) => String(Number(n.toFixed(1)));

export function EffectBlocks({
  groups,
  activeIndex,
  courseLength,
  level,
  isUnique,
}: {
  groups: SkillDetail["conditionGroups"];
  activeIndex: number | null;
  courseLength: number;
  level: number;
  isUnique: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group, index) => {
        const active = index === activeIndex;
        const baseSeconds = group.base_time && group.base_time > 0 ? group.base_time / 10000 : 0;
        const cooldown = (group as { cooldown_time?: number | null }).cooldown_time;
        return (
          <Fragment key={index}>
            {index > 0 ? <OrDivider /> : null}
            <section
              role="group"
              aria-label={`Effect group ${index + 1}`}
              className={`border-l-2 pl-3 ${active ? "border-emerald-500" : "border-zinc-200 opacity-70 dark:border-zinc-800"}`}
            >
              <dl className="flex flex-col gap-1.5 text-xs">
                {group.effects.map((eff, i) => {
                  const type = eff.type ?? 0;
                  const meta = EFFECTS[type];
                  const raw = eff.value ?? 0;
                  let value: string;
                  if (meta) {
                    const v = (raw / meta.scale) * (isUnique ? uniqueLevelMultiplier(level, type) : 1);
                    value = `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(meta.decimals)} ${meta.unit}`;
                  } else {
                    value = String(raw);
                  }
                  return (
                    <div key={i} className="flex flex-wrap items-baseline gap-2">
                      <dt className={CHIP}>{meta ? meta.name : `Effect type ${type}`}</dt>
                      <dd className="min-w-0 tabular-nums text-zinc-800 dark:text-zinc-200">
                        {value}
                        {meta?.provisional ? (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 text-[11px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            Provisional
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  );
                })}
                {baseSeconds > 0 ? (
                  <div className="flex flex-wrap items-baseline gap-2">
                    <dt className={CHIP}>Duration</dt>
                    <dd className="tabular-nums text-zinc-800 dark:text-zinc-200">
                      {`${trim(baseSeconds)} s × ${trim(courseLength / 1000)}`}
                      <span className="ml-2 text-zinc-500 dark:text-zinc-400">{`= ${trim(baseSeconds * (courseLength / 1000))} s`}</span>
                    </dd>
                  </div>
                ) : null}
                {cooldown && cooldown > 0 ? (
                  <div className="flex flex-wrap items-baseline gap-2">
                    <dt className={CHIP}>Cooldown</dt>
                    <dd className="tabular-nums text-zinc-800 dark:text-zinc-200">{`${trim(cooldown / 10000)} s`}</dd>
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
