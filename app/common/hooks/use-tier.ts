"use client";
import { useSyncExternalStore } from "react";

export type Tier = "phone" | "tablet" | "desktop";

const TABLET_QUERY = "(min-width: 640px)";
const DESKTOP_QUERY = "(min-width: 1024px)";

function canMatch(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function subscribe(onChange: () => void): () => void {
  if (!canMatch()) return () => {};
  const queries = [window.matchMedia(TABLET_QUERY), window.matchMedia(DESKTOP_QUERY)];
  for (const q of queries) q.addEventListener?.("change", onChange);
  return () => { for (const q of queries) q.removeEventListener?.("change", onChange); };
}

function read(): Tier {
  if (!canMatch()) return "desktop";
  if (window.matchMedia(DESKTOP_QUERY).matches) return "desktop";
  return window.matchMedia(TABLET_QUERY).matches ? "tablet" : "phone";
}

/** <640 phone, 640–1023 tablet, ≥1024 desktop. SSR renders as desktop. */
export function useTier(): Tier {
  return useSyncExternalStore(subscribe, read, () => "desktop");
}
