// IndexedDB mínimo para a fila offline e o cache de leitura. Browser-only:
// só chamar dentro de handlers/useEffect (nunca em render nem em módulo SSR).

const DB_NAME = "manejo-offline";
const DB_VERSION = 1;

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("fila")) db.createObjectStore("fila", { keyPath: "id" });
      if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return abrir().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export const idb = {
  async getAll<T>(store: string): Promise<T[]> {
    return tx(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
  },
  async put(store: string, value: unknown, key?: IDBValidKey) {
    await tx(store, "readwrite", (s) => (key === undefined ? s.put(value) : s.put(value, key)));
  },
  async del(store: string, key: IDBValidKey) {
    await tx(store, "readwrite", (s) => s.delete(key));
  },
  async get<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
    return tx(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
  },
};
