// IndexedDB storage for Kyumaru Veteran / Hall of Fame characters.
// Veterans payloads (~3.1 MB) exceed typical 5 MB localStorage limits,
// making IndexedDB the ideal, robust storage solution.

import type { KyumaruVeteranItem } from "../kyumaru-types";

const DB_NAME = "almondeye_db";
const DB_VERSION = 1;
const STORE_NAME = "veterans";

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not available in this environment."));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "trained_chara_id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveVeterans(veterans: KyumaruVeteranItem[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    // Clear existing veterans and write the new roster
    const clearReq = store.clear();
    clearReq.onsuccess = () => {
      for (let i = 0; i < veterans.length; i++) {
        const item = veterans[i];
        // Ensure every item has a unique primary key
        const record = item.trained_chara_id
          ? item
          : { ...item, trained_chara_id: i + 1 };
        store.put(record);
      }
    };

    tx.oncomplete = () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("almondeye_veterans_updated"));
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllVeterans(): Promise<KyumaruVeteranItem[]> {
  if (typeof window === "undefined" || !window.indexedDB) return [];
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("Failed to load veterans from IndexedDB:", err);
    return [];
  }
}

export async function clearVeterans(): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    tx.oncomplete = () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("almondeye_veterans_updated"));
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getVeteransCount(): Promise<number> {
  if (typeof window === "undefined" || !window.indexedDB) return 0;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return 0;
  }
}
