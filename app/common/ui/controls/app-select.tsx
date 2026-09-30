"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Select from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "../primitives/icons";
import { selectAppValue, selectWireValue, type SelectChoice } from "./app-select-model";

export interface AppSelectOption extends SelectChoice { icon?: ReactNode }
export interface AppSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly AppSelectOption[];
  label: string;
  placeholder?: string;
  disabled?: boolean;
  variant?: "field" | "chip";
  className?: string;
  id?: string;
  triggerLabel?: string;
}

const surface = "border border-zinc-200 bg-white text-zinc-900 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const row = "flex w-full min-w-0 items-center gap-2 rounded-md px-3 text-left text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-zinc-100 dark:data-[highlighted]:bg-zinc-800 focus-visible:bg-zinc-100 dark:focus-visible:bg-zinc-800";

export function AppSelect({ value, onValueChange, options, label, placeholder = "Choose…", disabled, variant = "field", className = "", id, triggerLabel }: AppSelectProps) {
  const [open, setOpen] = useState(false);
  const keyboardOpen = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value);
  const unavailable = disabled || !options.some((option) => !option.disabled);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => { setOpen(false); };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const triggerClass = `inline-flex min-h-8 min-w-0 items-center justify-between gap-2 rounded-lg text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:cursor-not-allowed disabled:opacity-40 ${variant === "field" ? "border border-zinc-200 bg-white px-2.5 py-1.5 text-zinc-800 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600" : "border px-1.5 py-0.5"} ${className}`;
  const triggerEvents = { onPointerDown: () => { keyboardOpen.current = false; }, onKeyDown: () => { keyboardOpen.current = true; } };
  const triggerContent = <><span className="flex min-w-0 items-center gap-1.5">{triggerLabel && <span className="shrink-0 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{triggerLabel}:</span>}{selected?.icon}<span className="truncate">{selected?.label ?? placeholder}</span></span><ChevronDownIcon className="h-3.5 w-3.5 shrink-0" /></>;
  const choose = (option: AppSelectOption) => {
    if (option.disabled) return;
    if (option.value !== value) onValueChange(option.value);
    setOpen(false);
  };
  const groups = Array.from(new Set(options.map((option) => option.group)));
  return (
    <Select.Root value={selected ? selectWireValue(value) : ""} onValueChange={(wire) => {
      const option = options.find((entry) => entry.value === selectAppValue(wire));
      if (option) choose(option);
    }} open={open} onOpenChange={setOpen} disabled={unavailable}>
      <Select.Trigger {...triggerEvents} ref={trigger} id={id} aria-label={label} className={triggerClass}>{triggerContent}</Select.Trigger>
      <Select.Portal>
        <Select.Content data-app-select-layer="true" onClick={(event) => event.stopPropagation()} position="popper" sideOffset={4} collisionPadding={12}
          className={`z-[410] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-24px)] overflow-hidden rounded-lg ${surface} ${keyboardOpen.current ? "animate-none" : ""} animate-in fade-in zoom-in-95 duration-150 ease-out-expo`}
          style={{ transformOrigin: "var(--radix-select-content-transform-origin)" }}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus({ preventScroll: true }); }}>
          <Select.ScrollUpButton className="flex justify-center py-1"><ChevronUpIcon className="h-4 w-4" /></Select.ScrollUpButton>
          <Select.Viewport className="max-h-[min(20rem,var(--radix-select-content-available-height))] overscroll-contain p-1">
            {groups.map((group) => <Select.Group key={group ?? "ungrouped"}>
              {group && <Select.Label className="px-3 pb-1 pt-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{group}</Select.Label>}
              {options.filter((option) => option.group === group).map((option) => <Select.Item key={option.value} value={selectWireValue(option.value)} disabled={option.disabled} textValue={option.label}
                className={`${row} relative min-h-11 md:min-h-9 cursor-pointer data-[state=checked]:text-emerald-700 dark:data-[state=checked]:text-emerald-300`}>
                {option.icon}<Select.ItemText className="min-w-0 flex-1 break-words">{option.label}</Select.ItemText><Select.ItemIndicator className="ml-auto"><CheckIcon className="h-4 w-4" /></Select.ItemIndicator>
              </Select.Item>)}
            </Select.Group>)}
          </Select.Viewport>
          <Select.ScrollDownButton className="flex justify-center py-1"><ChevronDownIcon className="h-4 w-4" /></Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
