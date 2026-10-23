"use client";

import { Radio, RadioGroup } from "react-aria-components/RadioGroup";
import type { AptitudeKey } from "@/lib/parenting/loop-planner";
import { AptitudeGrid, AptitudeName, BUTTON, CHOICE, SHORT, nextPinkStars } from "./aptitude-controls";
import { ParentingPopover } from "./parenting-popover";

export function withPinkSpark<T extends { pink?: AptitudeKey | null; pinkStars?: number }>(goal: T, value?: AptitudeKey | null, stars?: number): T {
  const next = { ...goal };
  if (value === undefined) { delete next.pink; delete next.pinkStars; return next; }
  return { ...next, pink: value, pinkStars: stars };
}

/** The one pink-spark form: stars, aptitude, Not set / No factor. Used by popovers and the Ancestor Sheet. */
export function PinkSparkFields({ value, stars, onChange, title = "Pink spark" }: {
  value?: AptitudeKey | null; stars?: number; title?: string;
  onChange: (value?: AptitudeKey | null, stars?: number) => void;
}) {
  return <>
    <p className="mb-2 text-xs font-semibold">{title}</p>
    <RadioGroup aria-label="Stars" value={stars ? String(stars) : ""} isDisabled={!value} onChange={(count) => onChange(value, Number(count))} className="mb-2 flex gap-1">
      {[1, 2, 3].map((count) => <Radio key={count} value={String(count)} aria-label={`${count} stars`} className={`${CHOICE} flex-1`}>{"★".repeat(count)}</Radio>)}
    </RadioGroup>
    <RadioGroup aria-label="Pink aptitude" value={value ?? ""} onChange={(key) => onChange(key as AptitudeKey, nextPinkStars(stars))}>
      <AptitudeGrid render={(key) => <Radio key={key} value={key} aria-label={key} className={CHOICE}>{SHORT[key]}</Radio>} />
    </RadioGroup>
    <div className="mt-2 flex gap-1 border-t border-zinc-200 pt-2 dark:border-zinc-800">
      <button type="button" onClick={() => onChange(undefined, undefined)} className={`${BUTTON} flex-1`}>Not set</button>
      <button type="button" onClick={() => onChange(null, 0)} className={`${BUTTON} flex-1`}>No factor</button>
    </div>
  </>;
}

export function PinkSparkPicker({ label, value, stars, onChange, compact }: { label: string; value?: AptitudeKey | null; stars?: number; onChange: (value?: AptitudeKey | null, stars?: number) => void; compact?: boolean }) {
  const triggerLabel = value
    ? `${value}, ${stars ?? "unknown"} star${stars === 1 ? "" : "s"}`
    : value === null ? "No factor" : "Not set";
  if (compact) {
    return <ParentingPopover label={`${label} Red factor: ${triggerLabel}`} className="parenting-aptitude-cell flex h-6 min-h-6 w-full min-w-0 items-center justify-center gap-px rounded-md border border-pink-300 bg-pink-50/80 text-[9px] leading-none font-bold text-pink-900 shadow-2xs hover:bg-pink-100/90 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-pink-500 dark:border-pink-800 dark:bg-pink-950/25 dark:text-pink-100" trigger={
      value
        ? <span aria-hidden="true" className="flex shrink-0 gap-px leading-none">{[1, 2, 3].map((star) => <span key={star} className={star <= (stars ?? 0) ? "text-pink-600 dark:text-pink-400" : "text-zinc-400/60 dark:text-zinc-600"}>★</span>)}</span>
        : <span className="max-w-full truncate text-zinc-700 dark:text-zinc-300">{value === null ? "None" : "Set"}</span>
    }>
      <PinkSparkFields value={value} stars={stars} onChange={onChange} />
    </ParentingPopover>;
  }
  return <ParentingPopover label={`${label} Red factor: ${triggerLabel}`} className={`${BUTTON} parenting-aptitude-cell flex h-11 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-pink-300 bg-pink-50/80 text-[9px] leading-tight text-pink-900 shadow-2xs hover:bg-pink-100/90 transition-colors dark:border-pink-800 dark:bg-pink-950/25 dark:text-pink-100`} trigger={<>
    <span className="max-w-full truncate">{value && <AptitudeName value={value} />}{value === null ? "None" : value === undefined ? "Set" : null}</span>
    <span aria-hidden="true" className="flex shrink-0 gap-px leading-none">{[1, 2, 3].map((star) => <span key={star} className={value && star <= (stars ?? 0) ? "text-pink-600 dark:text-pink-400" : "text-zinc-400/60 dark:text-zinc-600"}>★</span>)}</span>
  </>}>
    <PinkSparkFields value={value} stars={stars} onChange={onChange} />
  </ParentingPopover>;
}
