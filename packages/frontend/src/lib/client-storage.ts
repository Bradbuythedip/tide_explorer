/**
 * Tiny IndexedDB wrapper for prevblock's client-side state.
 *
 * DIRECTIVE.md §1 anti-pattern: do NOT use localStorage. IndexedDB is
 * the persistence floor for every client-only thing — onboarding
 * dismissed flag, compact-mode flag, the eventual My Tidecoin
 * watchlist. All of it lives here, all keyed by a short string.
 *
 * Design:
 *   - One database: "prevblock"
 *   - One object store: "kv" (key-value pairs, promisified)
 *   - Keys are namespaced by prefix: "ui:onboarding:seen",
 *     "ui:compact-mode", "mytdc:addresses", ...
 *   - Values are JSON-serialisable and go through JSON.stringify/parse
 *     at the boundary so callers don't have to worry about structured
 *     cloning quirks.
 *
 * Zero server round-trips. Zero cookies. Zero fingerprinting.
 */

const DB_NAME = "prevblock";
const STORE = "kv";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        const raw = req.result as string | undefined;
        if (raw === undefined) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(raw) as T);
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.put(JSON.stringify(value), key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    /* non-fatal — the UX degrades but nothing breaks */
  }
}

export async function kvDel(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    /* non-fatal */
  }
}
