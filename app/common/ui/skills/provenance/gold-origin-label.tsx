"use client";

/** Marks a parent-deck white skill that stands in for a gold: parents pass on
 * the white counterpart, so the row names the gold it was inherited from. */
export function GoldOriginLabel({
  gold,
  className = "",
}: {
  gold: { id?: number; nameEn: string; nameJp?: string };
  className?: string;
}) {
  const name = gold.nameEn || gold.nameJp || "";
  const title = `Inherited white of the gold skill ${gold.nameEn || gold.nameJp}${gold.nameEn && gold.nameJp ? ` (${gold.nameJp})` : ""}`;

  return (
    <span className={`inline-flex min-w-0 max-w-full items-center gap-1 text-[10px] text-amber-800 dark:text-amber-300 ${className}`} title={title}>
      <span className="inline-flex h-5 shrink-0 items-center gap-0.5 rounded-md border border-amber-400/60 bg-amber-500/15 px-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-800 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
        <span aria-hidden="true">★</span>Gold
      </span>
      <span className="min-w-0 truncate font-semibold">{name}</span>
    </span>
  );
}

export default GoldOriginLabel;
