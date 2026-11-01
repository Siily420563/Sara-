/**
 * SARA IndexedDB Storage Engine
 * Provides persistent, quota-resilient local database for offline messages, memories, media attachments, and state.
 */

const DB_NAME = 'sara_neural_cortex_db';
const DB_VERSION = 1;

export const STORES = {
  CHAT_MESSAGES: 'chat_messages',
  APP_STATE: 'app_state',
  OFFLINE_CACHE: 'offline_cache',
  MEDIA_ATTACHMENTS: 'media_attachments',
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDatabase(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.reject(new Error('IndexedDB not supported in this environment'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORES.CHAT_MESSAGES)) {
          db.createObjectStore(STORES.CHAT_MESSAGES, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORES.APP_STATE)) {
          db.createObjectStore(STORES.APP_STATE, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORES.OFFLINE_CACHE)) {
          db.createObjectStore(STORES.OFFLINE_CACHE, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORES.MEDIA_ATTACHMENTS)) {
          db.createObjectStore(STORES.MEDIA_ATTACHMENTS, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  return dbPromise;
}

export async function idbSet<T = any>(storeName: string, value: T): Promise<void> {
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`IndexedDB set error in ${storeName}:`, err);
  }
}

export async function idbGet<T = any>(storeName: string, key: IDBValidKey): Promise<T | null> {
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`IndexedDB get error in ${storeName}:`, err);
    return null;
  }
}

export async function idbGetAll<T = any>(storeName: string): Promise<T[]> {
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`IndexedDB getAll error in ${storeName}:`, err);
    return [];
  }
}

export async function idbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`IndexedDB delete error in ${storeName}:`, err);
  }
}

export async function idbClear(storeName: string): Promise<void> {
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`IndexedDB clear error in ${storeName}:`, err);
  }
}
