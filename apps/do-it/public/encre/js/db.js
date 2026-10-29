// Stockage d'Encré (IndexedDB « encre ») : pages, dossiers, cartes de mémoire, réglages.
// Les notes vocales restent dans la base de Do It (voir voice.js).

const DB_NAME = 'encre';
const DB_VERSION = 1;
export const STORES = ['pages', 'folders', 'cards'];

let dbPromise = null;
let memory = null; // repli si IndexedDB est indisponible

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no-idb'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => {
    memory = memory || { pages: new Map(), folders: new Map(), cards: new Map(), kv: new Map() };
  });
  return dbPromise;
}

function request(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export async function getAll(store) {
  try {
    return (await request(store, 'readonly', (s) => s.getAll())) || [];
  } catch {
    return memory ? [...memory[store].values()] : [];
  }
}

export async function put(store, value) {
  const copy = structuredClone(value);
  try {
    await request(store, 'readwrite', (s) => s.put(copy));
  } catch {
    memory?.[store].set(copy.id, copy);
  }
}

export async function remove(store, id) {
  try {
    await request(store, 'readwrite', (s) => s.delete(id));
  } catch {
    memory?.[store].delete(id);
  }
}

export async function getValue(key, fallback) {
  try {
    const value = await request('kv', 'readonly', (s) => s.get(key));
    return value === undefined ? fallback : value;
  } catch {
    return memory?.kv.has(key) ? memory.kv.get(key) : fallback;
  }
}

export async function setValue(key, value) {
  try {
    await request('kv', 'readwrite', (s) => s.put(structuredClone(value), key));
  } catch {
    memory?.kv.set(key, value);
  }
}
