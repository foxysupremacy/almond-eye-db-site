"use client";

import { LoadingAnimation } from "@/app/common/ui/controls/loading-animation";

/**
 * Suspense fallback for the lazy feature tabs. The fallback unmounts the
 * moment the chunk resolves, so only the enter + loop clips ever play here —
 * the exit clip cannot (see DESIGN.md §13.6).
 */
export function TabSkeleton() {
  return (
    <LoadingAnimation
      active
      label="Loading section"
      fill={false}
      className="min-h-[50vh]"
      fallback={<TabSkeletonLayout />}
    />
  );
}

function TabSkeletonLayout() {
  return (
    <div
      role="status"
      aria-label="Loading section"
      className="flex min-w-0 flex-col gap-6 animate-pulse"
    >
      {/* Top Banner / Controls bar skeleton */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 p-4 shadow-2xs backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-zinc-200 dark:bg-zinc-800 shrink-0" />
          <div className="space-y-1.5">
            <div className="h-4 w-36 rounded-md bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-3 w-56 rounded-md bg-zinc-100 dark:bg-zinc-850" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-8 w-20 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>

      {/* Grid / Content skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-900/50 p-3 shadow-2xs space-y-2.5"
          >
            <div className="aspect-square w-full rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            <div className="space-y-1">
              <div className="h-3.5 w-4/5 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-2.5 w-3/5 rounded bg-zinc-100 dark:bg-zinc-850" />
            </div>
            <div className="flex gap-1 pt-1">
              <div className="h-4 w-10 rounded-md bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-12 rounded-md bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>

      {/* Detail panel skeleton */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 p-5 shadow-2xs space-y-3">
        <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-zinc-100 dark:bg-zinc-850" />
          <div className="h-3 w-5/6 rounded bg-zinc-100 dark:bg-zinc-850" />
          <div className="h-3 w-3/4 rounded bg-zinc-100 dark:bg-zinc-850" />
        </div>
      </div>
    </div>
  );
}
