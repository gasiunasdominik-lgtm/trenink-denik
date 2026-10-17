// Tenký promise wrapper nad IndexedDB.

const DB_NAME = 'trenink-denik';
const VERSION = 1;

export const STORES = {
  units:    { keyPath: 'id' },
  wellness: { keyPath: 'datum' },
  weeks:    { keyPath: 'tyden' },
  reports:  { keyPath: 'id' },
  kv:       { keyPath: 'k' },
  outbox:   { keyPath: 'seq', autoIncrement: true },
};

let dbp;

export function open() {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, opts] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, opts);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

const done = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export async function all(store) {
  const db = await open();
  return done(db.transaction(store).objectStore(store).getAll());
}

export async function put(store, value) {
  const db = await open();
  return done(db.transaction(store, 'readwrite').objectStore(store).put(value));
}

export async function del(store, key) {
  const db = await open();
  return done(db.transaction(store, 'readwrite').objectStore(store).delete(key));
}

export async function putMany(store, values) {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  values.forEach(v => os.put(v));
  return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}
