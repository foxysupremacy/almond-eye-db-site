"use client";

import { CheckboxGroup, Checkbox } from "react-aria-components/CheckboxGroup";
import { FARM_APTITUDES, type FarmAptitude } from "@/lib/parenting/loop-planner";
import { SHORT } from "./aptitude-controls";
import { ParentingPopover } from "./parenting-popover";

const GROUPS: [FarmAptitude[], FarmAptitude[]] = [["Turf", "Dirt"], ["Sprint", "Mile", "Medium", "Long"]];
const CHOICE = "flex min-h-9 cursor-pointer items-center justify-center rounded-md bg-zinc-100 px-1 text-xs font-semibold outline-none data-[selected]:bg-emerald-600 data-[selected]:text-white data-[focus-visible]:ring-2 data-[focus-visible]:ring-emerald-500 data-[disabled]:opacity-40 dark:bg-zinc-800 dark:data-[selected]:bg-emerald-600 transition-colors duration-150 ease-out-quart";

/** Surface/Distance farm focus: disabled aptitudes drop their floor targets
 * and their G1 races leave the calendar, freeing spark budget for the rest. */
export function FarmFocusToggles({ disabled, onChange }: { disabled: FarmAptitude[]; onChange: (next: FarmAptitude[]) => void }) {
  const disabledSet = new Set(disabled);
  const enabled = FARM_APTITUDES.filter((aptitude) => !disabledSet.has(aptitude));
  const triggerText = disabled.length
    ? `Farm focus: −${disabled.map((aptitude) => SHORT[aptitude]).join(" · −")}`
    : "Farm focus: all";
  return (
    <ParentingPopover
      label="Farm focus"
      className="inline-flex min-h-8 items-center justify-center gap-1 rounded-full border border-zinc-300/90 bg-zinc-50/90 px-2.5 text-[10px] font-bold text-zinc-700 transition-all duration-150 ease-out-quart hover:bg-zinc-100 hover:border-zinc-400 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-zinc-700/80 dark:bg-zinc-800/70 dark:text-zinc-200 dark:hover:bg-zinc-700/70 shadow-2xs"
      trigger={<span className="truncate">{triggerText}</span>}
    >
      <div className="space-y-2">
        <p className="text-sm font-semibold">Farm focus</p>
        <p className="text-xs text-zinc-500">
          Toggled-off aptitudes drop their floor targets and their races leave the G1 calendar — no spark budget is spent on them.
        </p>
        <CheckboxGroup
          aria-label="Farm focus aptitudes"
          value={enabled}
          onChange={(values) => onChange(FARM_APTITUDES.filter((aptitude) => !(values as FarmAptitude[]).includes(aptitude)))}
        >
          {GROUPS.map((group, index) => (
            <div key={index} className="mt-1">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{index === 0 ? "Surface" : "Distance"}</p>
              <div className={`grid gap-1 ${index === 0 ? "grid-cols-2" : "grid-cols-4"}`}>
                {group.map((aptitude) => (
                  <Checkbox key={aptitude} value={aptitude} className={CHOICE}>
                    {SHORT[aptitude]}
                  </Checkbox>
                ))}
              </div>
            </div>
          ))}
        </CheckboxGroup>
      </div>
    </ParentingPopover>
  );
}
