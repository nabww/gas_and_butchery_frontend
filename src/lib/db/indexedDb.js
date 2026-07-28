// IndexedDB scaffolding — the local-first data store described in build
// plan Section 1b and 4. This sets up the database and object stores;
// the actual queue-write / conflict-resolution logic (additive point
// merges, oversell flagging, etc.) is Phase 1 work.

const DB_NAME = 'tezipos-local';
const DB_VERSION = 5;

// One object store per syncable entity, keyed by local_id (a UUID
// generated on-device — see schema.sql sync-metadata columns).
const STORES = [
  'sales',
  'sale_items',
  'cylinder_exchanges',
  'payments',
  'points_ledger',
  'promo_wins',
  'pending_sales',
  'products',
  'cylinder_brands',
  'customers',
];

const CACHE_STORES = ['products', 'cylinder_brands', 'customers'];

const CHILD_STORES = ['sale_items', 'cylinder_exchanges', 'payments'];

let dbPromise = null;

export function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      STORES.forEach((storeName) => {
        let store;
        if (!db.objectStoreNames.contains(storeName)) {
          store = db.createObjectStore(storeName, { keyPath: 'local_id' });
        } else {
          store = event.target.transaction.objectStore(storeName);
        }
        if (!store.indexNames.contains('sync_status')) {
          store.createIndex('sync_status', 'sync_status', { unique: false });
        }
        if (CHILD_STORES.includes(storeName) && !store.indexNames.contains('sale_local_id')) {
          store.createIndex('sale_local_id', 'sale_local_id', { unique: false });
        }
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// Queue a record locally with pending sync status.
export async function queueLocal(storeName, record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put({ ...record, sync_status: 'pending' });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function putRecord(storeName, record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getById(storeName, localId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(localId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteRecord(storeName, localId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const request = tx.objectStore(storeName).delete(localId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getByIndex(storeName, indexName, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const index = tx.objectStore(storeName).index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getPending(storeName) {
  return getByIndex(storeName, 'sync_status', 'pending');
}

export async function getAll(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
