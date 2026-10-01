"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Button, Label, ListBox, ListBoxItem, ListBoxSection, Popover, Select, SelectValue } from "react-aria-components/Select";
import { CheckIcon, ChevronDownIcon } from "../primitives/icons";
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

const groups = (options: readonly AppSelectOption[]) => Array.from(new Set(options.map((option) => option.group)));

/** Shared single-value selector, backed by React Aria's keyboard/focus model. */
export function AppSelect({ value, onValueChange, options, label, placeholder = "Choose…", disabled, variant = "field", className = "", id, triggerLabel }: AppSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const unavailable = disabled || !options.some((option) => !option.disabled);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setOpen(false);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const triggerClass = `group inline-flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-lg text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500/70 disabled:cursor-not-allowed disabled:opacity-40 md:min-h-8 ${variant === "field" ? "border border-zinc-200 bg-white px-2.5 py-1.5 text-zinc-800 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600" : "border px-1.5 py-0.5"} ${className}`;

  return (
    <Select
      id={id}
      aria-label={label}
      value={selected ? selectWireValue(value) : undefined}
      onChange={(wire) => { if (typeof wire === "string") onValueChange(selectAppValue(wire)); }}
      isOpen={open}
      onOpenChange={setOpen}
      isDisabled={unavailable}
      className="min-w-0"
    >
      <Label className="sr-only">{label}</Label>
      <Button className={triggerClass}>
        <span className="flex min-w-0 items-center gap-1.5">
          {triggerLabel && <span className="shrink-0 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{triggerLabel}:</span>}
          {selected?.icon}
          <SelectValue className="truncate">{({ selectedText }) => selectedText || placeholder}</SelectValue>
        </span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 transition-transform group-data-[open]:rotate-180" />
      </Button>
      <Popover
        data-app-select-layer="true"
        placement="bottom start"
        offset={4}
        containerPadding={12}
        className="z-[410] min-w-[var(--trigger-width)] max-w-[calc(100vw-24px)] overflow-hidden rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-xl outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <ListBox
          aria-label={label}
          className="max-h-[min(20rem,var(--popover-available-height))] min-w-0 overflow-auto overscroll-contain p-1 outline-none"
        >
          {groups(options).map((group) => {
            const entries = options.filter((option) => option.group === group);
            const items = entries.map((option) => (
              <ListBoxItem
                key={option.value}
                id={selectWireValue(option.value)}
                textValue={option.label}
                isDisabled={option.disabled}
                className="group relative flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-3 text-left text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[focused]:bg-zinc-100 data-[selected]:text-emerald-700 dark:data-[focused]:bg-zinc-800 dark:data-[selected]:text-emerald-300 md:min-h-9"
              >
                {option.icon}
                <span className="min-w-0 flex-1 break-words">{option.label}</span>
                <CheckIcon className="h-4 w-4 shrink-0 opacity-0 group-data-[selected]:opacity-100" />
              </ListBoxItem>
            ));
            return group
              ? <ListBoxSection key={group} id={`group-${group}`} className="outline-none"><Label className="block px-3 pb-1 pt-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{group}</Label>{items}</ListBoxSection>
              : <Fragment key="ungrouped">{items}</Fragment>;
          })}
        </ListBox>
      </Popover>
    </Select>
  );
}
