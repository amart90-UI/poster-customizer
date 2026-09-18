/**
 * Minimal promise-based IndexedDB wrapper.
 *
 * We only need a single object store keyed by string id. IndexedDB is used
 * (instead of localStorage) because projects embed the background image as a
 * data URL, which can be several megabytes — far beyond localStorage's ~5MB
 * total quota. IndexedDB typically allows hundreds of MB to GBs.
 *
 * No external dependency: this is a thin wrapper over the raw API.
 */

const DB_NAME = "poster-db";
const DB_VERSION = 1;
const STORE = "projects";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open database"));
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const store = transaction.objectStore(STORE);
        const request = fn(store);
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error ?? request.error);
        transaction.onabort = () => reject(transaction.error ?? new Error("Transaction aborted"));
      }),
  );
}

export function idbGet<T>(key: string): Promise<T | undefined> {
  return tx<T | undefined>("readonly", (store) => store.get(key) as IDBRequest<T | undefined>);
}

export function idbPut<T>(key: string, value: T): Promise<void> {
  return tx("readwrite", (store) => store.put(value, key)).then(() => undefined);
}

export function idbDelete(key: string): Promise<void> {
  return tx("readwrite", (store) => store.delete(key)).then(() => undefined);
}
