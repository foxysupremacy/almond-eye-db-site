// IndexedDB storage for Kyumaru Veteran / Hall of Fame characters.
// Veterans payloads (~3.1 MB) exceed typical 5 MB localStorage limits.

import type { KyumaruVeteranItem } from "../veterans/types";

const DB_NAME = "almondeye_db";
const DB_VERSION = 1;
const STORE_NAME = "veterans";
const UPDATED_EVENT = "almondeye_veterans_updated";

/** Keep supplied IDs where possible and assign a free positive key otherwise. */
export function normalizeVeterans(veterans: KyumaruVeteranItem[]): KyumaruVeteranItem[] {
  const usedIds = new Set<number>();
  const needsId: number[] = [];
  const records = veterans.map((item, index) => {
    const id = item.trained_chara_id;
    if (Number.isSafeInteger(id) && (id as number) > 0 && !usedIds.has(id as number)) {
      usedIds.add(id as number);
      return item;
    }

    needsId.push(index);
    return item;
  });

  let candidate = 1;
  for (const index of needsId) {
    while (usedIds.has(candidate)) candidate++;
    records[index] = { ...records[index], trained_chara_id: candidate };
    usedIds.add(candidate);
    candidate++;
  }

  return records;
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    let settled = false;

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "trained_chara_id" });
      }
    };

    request.onblocked = () => {
      settled = true;
      reject(new Error("Opening the veterans database was blocked by another connection."));
    };
    request.onerror = () => {
      if (!settled) {
        settled = true;
        reject(request.error ?? new Error("Failed to open the veterans database."));
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Close on version changes so a future upgrade is not held open by a stale tab.
      db.onversionchange = () => db.close();
      if (settled) {
        db.close();
        return;
      }
      settled = true;
      resolve(db);
    };
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => { request?: IDBRequest<T>; result?: T },
): Promise<T | undefined> {
  return getDB().then((db) => new Promise<T | undefined>((resolve, reject) => {
    let transaction: IDBTransaction;
    let outcome: { request?: IDBRequest<T>; result?: T };

    try {
      transaction = db.transaction(STORE_NAME, mode);
      outcome = operation(transaction.objectStore(STORE_NAME));
    } catch (error) {
      db.close();
      reject(error);
      return;
    }

    let finished = false;
    const finish = (error?: unknown) => {
      if (finished) return;
      finished = true;
      db.close();
      if (error !== undefined) reject(error);
      else resolve(outcome.request ? outcome.request.result : outcome.result);
    };
    transaction.oncomplete = () => {
      finish();
    };
    transaction.onerror = () => {
      finish(transaction.error ?? outcome.request?.error ?? new Error("IndexedDB transaction failed."));
    };
    transaction.onabort = () => {
      finish(transaction.error ?? outcome.request?.error ?? new Error("IndexedDB transaction was aborted."));
    };
  }));
}

export async function saveVeterans(veterans: KyumaruVeteranItem[]): Promise<void> {
  const records = normalizeVeterans(veterans);
  await runTransaction("readwrite", (store) => {
    // Queue clear and puts in the same transaction; any failed put rolls back the roster.
    store.clear();
    for (const record of records) store.put(record);
    return {};
  });
  if (typeof window !== "undefined") window.dispatchEvent(new Event(UPDATED_EVENT));
}

export async function getAllVeterans(): Promise<KyumaruVeteranItem[]> {
  if (typeof window === "undefined" || !window.indexedDB) return [];
  try {
    return (await runTransaction<KyumaruVeteranItem[]>("readonly", (store) => ({ request: store.getAll() }))) ?? [];
  } catch (err) {
    console.warn("Failed to load veterans from IndexedDB:", err);
    return [];
  }
}

export async function clearVeterans(): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  await runTransaction("readwrite", (store) => {
    store.clear();
    return {};
  });
  window.dispatchEvent(new Event(UPDATED_EVENT));
}

export async function getVeteransCount(): Promise<number> {
  if (typeof window === "undefined" || !window.indexedDB) return 0;
  try {
    return (await runTransaction<number>("readonly", (store) => ({ request: store.count() }))) ?? 0;
  } catch {
    return 0;
  }
}
