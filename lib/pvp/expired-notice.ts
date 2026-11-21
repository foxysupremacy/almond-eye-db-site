// Persistent "don't show again" state for the PvP Event Ended notice.
// Each entry ties a preset to the ended event it was linked to, so linking the
// same preset to a later event (which then ends) notifies again.

import { readJsonStorage, writeJsonStorage } from "@/lib/storage/persistence";

export const EXPIRED_NOTICE_HIDDEN_KEY = "pvp_expired_hidden.v1";

export function expiredNoticeKey(presetId: string, eventId: string | null | undefined): string {
  return `${presetId}::${eventId ?? ""}`;
}

export function parseHiddenNotices(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

export function mergeHiddenNotices(existing: readonly string[], added: readonly string[]): string[] {
  return [...new Set([...existing, ...added])];
}

export function loadHiddenNotices(): string[] {
  return parseHiddenNotices(readJsonStorage<unknown>(EXPIRED_NOTICE_HIDDEN_KEY));
}

export function saveHiddenNotices(keys: readonly string[]): void {
  writeJsonStorage(EXPIRED_NOTICE_HIDDEN_KEY, keys);
}
