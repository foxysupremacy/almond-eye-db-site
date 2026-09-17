"use client";

import { useState, type ReactNode } from "react";
import { MobileSheet } from "./mobile-sheet";
import { FilterIcon } from "../icons";

export function MobileFilters({ children, count = 0, title = "Skill filters", summary }: {
  children: ReactNode; count?: number; title?: string; summary?: string;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <div className="flex min-w-0 items-center gap-3 md:hidden">
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium dark:border-zinc-800 dark:bg-zinc-900" aria-haspopup="dialog">
        <FilterIcon className="h-4 w-4" /> Filters{count > 0 && <span className="rounded-md bg-emerald-100 px-1.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{count}</span>}
      </button>
      {summary && <span className="min-w-0 text-xs text-zinc-500 dark:text-zinc-400">{summary}</span>}
    </div>
    <div className="hidden md:contents">{children}</div>
    <MobileSheet open={open} onClose={() => setOpen(false)} title={title}>
      <div className="mobile-filter-controls flex flex-col gap-4">{children}</div>
    </MobileSheet>
  </>;
}
