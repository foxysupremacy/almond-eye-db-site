"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Button, Label, ListBox, ListBoxItem, ListBoxSection, Popover, Select, SelectValue } from "react-aria-components/Select";
import { Header } from "react-aria-components/ListBox";
import { Autocomplete, useFilter } from "react-aria-components/Autocomplete";
import { Input, SearchField } from "react-aria-components/SearchField";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "../primitives/icons";
import { selectAppValue, selectWireValue, type SelectChoice } from "./app-select-model";

export interface AppSelectOption extends SelectChoice {
  icon?: ReactNode;
  /** Borderless aligned columns in the list (first left, rest centred); `label` still names the option. */
  columns?: readonly string[];
}
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
  size?: "default" | "compact";
  /** CSS grid-template-columns for options that carry `columns`. */
  columnTemplate?: string;
  /** Adds a search box above the list (filters on each option's `label`). */
  searchPlaceholder?: string;
  /** Extra classes for the list popover (e.g. a wider minimum width). */
  popoverClassName?: string;
}

const groups = (options: readonly AppSelectOption[]) => Array.from(new Set(options.map((option) => option.group)));

/** Shared single-value selector, backed by React Aria's keyboard/focus model. */
export function AppSelect({ value, onValueChange, options, label, placeholder = "Choose…", disabled, variant = "field", className = "", id, triggerLabel, size = "default", columnTemplate, searchPlaceholder, popoverClassName = "" }: AppSelectProps) {
  const [open, setOpen] = useState(false);
  const { contains } = useFilter({ sensitivity: "base" });
  const selected = options.find((option) => option.value === value);
  const unavailable = disabled || !options.some((option) => !option.disabled);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setOpen(false);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const triggerClass = `group inline-flex ${size === "compact" ? "min-h-7 text-[9px] gap-1" : "min-h-11 text-xs gap-2 md:min-h-8"} min-w-0 items-center justify-between rounded-lg font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500/70 disabled:cursor-not-allowed disabled:opacity-40 ${variant === "field" ? "border border-zinc-200 bg-white px-2.5 py-1.5 text-zinc-800 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600" : "border px-1.5 py-0.5"} ${className}`;

  const list = (
    <ListBox
      aria-label={label}
      className="min-w-0 overflow-y-auto overscroll-contain p-1 outline-none"
      renderEmptyState={() => <div className="px-3 py-4 text-center text-xs text-zinc-500 dark:text-zinc-400">No matches</div>}
      style={{
        maxHeight: "min(50vh, var(--popover-available-height, 50vh))",
        overflowY: "auto",
        overscrollBehavior: "contain",
        touchAction: "pan-y",
        WebkitOverflowScrolling: "touch",
      }}
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
            {option.columns ? (
              <span className="grid min-w-0 flex-1 items-center gap-x-3"
                style={{ gridTemplateColumns: columnTemplate ?? `minmax(0,1fr) repeat(${option.columns.length - 1}, auto)` }}>
                {option.columns.map((text, index) => (
                  <span key={index} className={index === 0 ? "min-w-0 break-words text-left" : "whitespace-nowrap text-center"}>{text}</span>
                ))}
              </span>
            ) : <span className="min-w-0 flex-1 break-words">{option.label}</span>}
            <CheckIcon className="h-4 w-4 shrink-0 opacity-0 group-data-[selected]:opacity-100" />
          </ListBoxItem>
        ));
        return group
          ? <ListBoxSection key={group} id={`group-${group}`} className="outline-none"><Header className="block px-3 pb-1 pt-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{group}</Header>{items}</ListBoxSection>
          : <Fragment key="ungrouped">{items}</Fragment>;
      })}
    </ListBox>
  );

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
        className={`z-[410] flex min-w-[var(--trigger-width)] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-xl outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ${popoverClassName}`}
      >
        {searchPlaceholder ? (
          <Autocomplete filter={contains}>
            <SearchField aria-label={`Search ${label}`} className="relative shrink-0 border-b border-zinc-100 p-1.5 dark:border-zinc-800/80"
              // Never auto-focus on touch devices (DESIGN.md §6).
              autoFocus={typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches}>
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <Input placeholder={searchPlaceholder}
                className="min-h-11 w-full rounded-md bg-zinc-50 py-1.5 pl-8 pr-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-emerald-500/70 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder-zinc-500 md:min-h-8 [&::-webkit-search-cancel-button]:hidden" />
            </SearchField>
            {list}
          </Autocomplete>
        ) : list}
      </Popover>
    </Select>
  );
}
