/** Placeholder row with the same geometry as `CharacterCard`. */
export function CharacterCardSkeleton() {
  return (
    <li aria-hidden="true" className="py-2">
      <div className="flex min-h-11 items-center gap-3 px-2 pt-2">
        <span className="h-4 w-6 flex-none animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <span className="h-10 w-10 flex-none animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="h-3.5 w-40 max-w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          <span className="h-3 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        </span>
        <span className="h-4 w-20 flex-none animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="mt-1 flex gap-1.5 pl-11 pr-2 sm:pl-[5.25rem]">
        <span className="h-11 w-28 animate-pulse rounded-md bg-zinc-100 md:h-8 dark:bg-zinc-800" />
        <span className="h-11 w-28 animate-pulse rounded-md bg-zinc-100 md:h-8 dark:bg-zinc-800" />
        <span className="h-11 w-28 animate-pulse rounded-md bg-zinc-100 md:h-8 dark:bg-zinc-800" />
      </div>
    </li>
  );
}
