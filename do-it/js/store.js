// Stockage local (IndexedDB) : le journal reste sur l'appareil.
// Deux magasins : `entries` (une ligne par entrée) et `kv` (réglages, thèmes perso).

const DB_NAME = 'do-it';
const DB_VERSION = 1;

let dbPromise = null;
let memory = null; // repli si IndexedDB est indisponible (navigation privée stricte)

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no-idb'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((err) => {
    memory = memory || { entries: new Map(), kv: new Map() };
    throw err;
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const result = fn(t.objectStore(store));
      t.oncomplete = () => resolve(result?.result ?? result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } catch {
    return null;
  }
}

export async function loadEntries() {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const req = db.transaction('entries').objectStore('entries').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return memory ? [...memory.entries.values()] : [];
  }
}

export async function saveEntry(entry) {
  if (memory) return memory.entries.set(entry.id, entry);
  await tx('entries', 'readwrite', (s) => s.put(entry));
}

export async function deleteEntry(id) {
  if (memory) return memory.entries.delete(id);
  await tx('entries', 'readwrite', (s) => s.delete(id));
}

export async function clearAll() {
  if (memory) {
    memory.entries.clear();
    memory.kv.clear();
    return;
  }
  await tx('entries', 'readwrite', (s) => s.clear());
  await tx('kv', 'readwrite', (s) => s.clear());
}

export async function getValue(key, fallback) {
  if (memory) return memory.kv.has(key) ? memory.kv.get(key) : fallback;
  try {
    const db = await open();
    const value = await new Promise((resolve, reject) => {
      const req = db.transaction('kv').objectStore('kv').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return value === undefined ? fallback : value;
  } catch {
    return memory?.kv.has(key) ? memory.kv.get(key) : fallback;
  }
}

export async function setValue(key, value) {
  if (memory) return memory.kv.set(key, value);
  await tx('kv', 'readwrite', (s) => s.put(value, key));
}

/** Demande au navigateur de ne pas effacer le journal quand l'espace manque. */
export function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {});
}
