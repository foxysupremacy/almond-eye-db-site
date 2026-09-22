"use client";

import type { EventSkillMetadata } from "../lib/data/types";
import { ChainArrowIcon } from "./chain-arrow-icon";

/** Compact, consistent source metadata for event-granted skills. */
type EventAttributionMetadata = Partial<EventSkillMetadata>;

export function EventChainAttribution({ eventMeta, className = "" }: { eventMeta: EventAttributionMetadata; className?: string }) {
  const isChain = eventMeta.eventType === "chain" && Boolean(eventMeta.chainStep);
  const eventTitle = eventMeta.eventNameEn || eventMeta.eventNameJp;
  const choiceText = eventMeta.choiceTextEn || eventMeta.choiceTextJp;
  const title = `Event: ${eventMeta.eventNameJp ?? ""} (${eventMeta.eventNameEn ?? ""})\nChoice ${eventMeta.choiceIndex ?? "?"}: ${eventMeta.choiceTextJp ?? ""}`;

  return (
    <span className={`inline-flex min-w-0 max-w-full items-center gap-1 text-[10px] text-violet-800 dark:text-violet-300 ${className}`} title={title}>
      <span className="inline-flex h-5 shrink-0 items-center rounded-md border border-violet-200/80 bg-violet-100 px-1.5 text-[9px] font-bold uppercase tracking-wider text-violet-700 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-300">Event</span>
      {isChain && <ChainArrowIcon step={eventMeta.chainStep ?? 1} size="sm" className="text-violet-600 dark:text-violet-400" />}
      <span className="shrink-0 font-semibold">C{eventMeta.choiceIndex ?? "?"}</span>
      {choiceText && <span className="min-w-0 truncate text-violet-700 dark:text-violet-200">{choiceText}</span>}
      <span className="sr-only">{eventTitle}</span>
    </span>
  );
}

export default EventChainAttribution;
