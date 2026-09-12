"use client";

// Shared search bar for every entity picker (skill/veteran/character modals,
// card popover, ...). Owns the canonical structure: input with emerald focus
// ring + inline clear button. Layout wrappers and adjacent filter controls
// stay at the call site.

import { XIcon } from "../icons";

const DEFAULT_INPUT_CLASS =
  "w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-emerald-500 transition-colors";

export function PickerSearchBar({
  value,
  onChange,
  placeholder,
  autoFocus = false,
  inputRef,
  inputClassName,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  /** Override for pickers that need a different density (e.g. compact rows). */
  inputClassName?: string;
}) {
  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={inputClassName ?? DEFAULT_INPUT_CLASS}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
