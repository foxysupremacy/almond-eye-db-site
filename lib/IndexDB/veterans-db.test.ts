import { afterEach, describe, expect, test } from "bun:test";
import {
  getAllVeterans,
  normalizeVeterans,
  saveVeterans,
} from "./veterans-db";
import type { KyumaruVeteranItem } from "../veterans/import/kyumaru-types";

type Item = KyumaruVeteranItem & { name: string };

const originalWindow = (globalThis as Record<string, unknown>).window;

function createIndexedDbMock(options: { transactionError?: boolean } = {}) {
  let records: Item[] = [];
  let closeCount = 0;
  let openedWith: { name: string; version: number } | undefined;

  const database = {
    objectStoreNames: { contains: () => true },
    createObjectStore: (_name: string, _options: { keyPath: string }) => undefined,
    close: () => { closeCount++; },
    onversionchange: null as (() => void) | null,
    transaction: (_storeName: string, _mode: IDBTransactionMode) => {
      const transaction: Record<string, unknown> = {
        error: options.transactionError ? new Error("transaction failed") : null,
        oncomplete: null,
        onerror: null,
        onabort: null,
      };
      let workingRecords = records.slice();
      const queued: Array<() => void> = [];
      const objectStore = {
        clear: () => {
          queued.push(() => { workingRecords = []; });
          return {};
        },
        put: (record: Item) => {
          queued.push(() => {
            const index = workingRecords.findIndex((value) => value.trained_chara_id === record.trained_chara_id);
            if (index >= 0) workingRecords[index] = record;
            else workingRecords.push(record);
          });
          return {};
        },
        getAll: () => {
          const request: { result?: Item[]; error?: Error } = {};
          queued.push(() => { request.result = workingRecords.slice(); });
          return request;
        },
        count: () => {
          const request: { result?: number; error?: Error } = {};
          queued.push(() => { request.result = workingRecords.length; });
          return request;
        },
      };

      transaction.objectStore = (_name: string) => objectStore;
      queueMicrotask(() => {
        if (options.transactionError) {
          (transaction.onerror as (() => void) | null)?.();
          (transaction.onabort as (() => void) | null)?.();
          return;
        }
        for (const operation of queued) operation();
        records = workingRecords;
        (transaction.oncomplete as (() => void) | null)?.();
      });
      return transaction as unknown as IDBTransaction;
    },
  } as unknown as IDBDatabase;

  const indexedDB = {
    open: (name: string, version: number) => {
      openedWith = { name, version };
      const request: Record<string, unknown> = { result: database, error: null };
      queueMicrotask(() => (request.onsuccess as (() => void) | null)?.());
      return request as unknown as IDBOpenDBRequest;
    },
  } as IDBFactory;

  (globalThis as Record<string, unknown>).window = {
    indexedDB,
    dispatchEvent: () => true,
  };

  return {
    get records() { return records; },
    get closeCount() { return closeCount; },
    get openedWith() { return openedWith; },
  };
}

afterEach(() => {
  if (originalWindow === undefined) delete (globalThis as Record<string, unknown>).window;
  else (globalThis as Record<string, unknown>).window = originalWindow;
});

describe("veterans IndexedDB storage", () => {
  test("assigns unique fallback keys without colliding with supplied IDs", () => {
    const normalized = normalizeVeterans([
      { trained_chara_id: 1, name: "one" } as Item,
      { name: "missing" } as Item,
      { trained_chara_id: 3, name: "three" } as Item,
      { trained_chara_id: 1, name: "duplicate" } as Item,
      { trained_chara_id: 0, name: "zero" } as Item,
    ]);

    expect(normalized.map((item) => item.trained_chara_id)).toEqual([1, 2, 3, 4, 5]);
  });

  test("preserves the existing database identity and closes connections after operations", async () => {
    const mock = createIndexedDbMock();
    await saveVeterans([{ trained_chara_id: 20, name: "veteran" } as Item]);
    const loaded = await getAllVeterans();

    expect(mock.openedWith).toEqual({ name: "almondeye_db", version: 1 });
    expect(mock.records[0].trained_chara_id).toBe(20);
    expect(loaded).toEqual(mock.records);
    expect(mock.closeCount).toBe(2);
  });

  test("rejects failed write transactions and closes the connection", async () => {
    const mock = createIndexedDbMock({ transactionError: true });
    let thrown: unknown;
    try {
      await saveVeterans([{ name: "not saved" } as Item]);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeDefined();
    expect(mock.records).toHaveLength(0);
    expect(mock.closeCount).toBe(1);
  });
});
