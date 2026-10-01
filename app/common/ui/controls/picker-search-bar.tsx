"use client";

// Shared search bar for every entity picker (skill/veteran/character modals,
// card popover, ...). Owns the canonical structure: input with emerald focus
// ring + inline clear button. Layout wrappers and adjacent filter controls
// stay at the call site.

import { useEffect, useRef } from "react";
import { Button, Input, SearchField } from "react-aria-components/SearchField";
import { XIcon } from "@/app/common/ui/primitives/icons";

const DEFAULT_INPUT_CLASS =
  "w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-emerald-500 transition-colors";

export function PickerSearchBar({
  value,
  onChange,
  placeholder,
  autoFocus = false,
  inputRef,
  inputClassName,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  /** Override for pickers that need a different density (e.g. compact rows). */
  inputClassName?: string;
  /** Accessible name; falls back to the visible placeholder. */
  label?: string;
}) {
  const localInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus && typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) {
      localInputRef.current?.focus();
    }
  }, [autoFocus, inputRef]);

  const setInputRef = (node: HTMLInputElement | null) => {
    localInputRef.current = node;
    if (typeof inputRef === "function") inputRef(node);
    else if (inputRef) inputRef.current = node;
  };

  return (
    <SearchField value={value} onChange={onChange} aria-label={label ?? placeholder} className="relative flex-1">
      <Input
        ref={setInputRef}
        placeholder={placeholder}
        className={inputClassName ?? DEFAULT_INPUT_CLASS}
      />
      {value && (
        <Button
          aria-label="Clear search"
          className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-zinc-400 outline-none hover:text-zinc-600 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:text-zinc-200"
        >
          <XIcon className="h-3.5 w-3.5" />
        </Button>
      )}
    </SearchField>
  );
}
