// Shared localStorage pattern for every persisted domain state (deck presets,
// parenting setup, ...). Guarded for SSR, tolerant of storage errors, and with
// a built-in same-tab + cross-tab notification channel so hook-based domains
// can re-sync without prop drilling.

export function readJsonStorage<T>(key: string): T | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJsonStorage(key: string, value: unknown): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore storage errors (quota, private mode, ...) */
  }
}

export function removeJsonStorage(key: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore storage errors */
  }
}

/**
 * Notify listeners (same tab via a window Event, other tabs via the `storage`
 * event — subscribeLocalUpdates covers both) that a persisted domain changed.
 */
export function notifyLocalUpdate(eventKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(eventKey));
  } catch {
    /* ignore */
  }
}

/**
 * Subscribe to a domain's update notifications: the same-tab event emitted by
 * notifyLocalUpdate plus the browser `storage` event for cross-tab sync.
 * Returns an unsubscribe function.
 */
export function subscribeLocalUpdates(
  eventKey: string,
  handler: () => void
): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(eventKey, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(eventKey, handler);
    window.removeEventListener("storage", handler);
  };
}
