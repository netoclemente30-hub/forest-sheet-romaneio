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

export function transacionar<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let resultado: T;
    let erro: unknown;
    let t: IDBTransaction | undefined;
    const falhou = () => {
      db.close();
      reject(erro ?? t?.error ?? new Error("A gravação local foi interrompida. Os dados não foram confirmados."));
    };
    try {
      t = db.transaction(store, mode);
      t.oncomplete = () => { db.close(); resolve(resultado); };
      t.onabort = falhou;
      t.onerror = () => { erro ??= t?.error; };
      const req = run(t.objectStore(store));
      req.onsuccess = () => { resultado = req.result; };
      req.onerror = () => { erro = req.error; };
    } catch (e) {
      erro = e;
      try { t?.abort(); } catch { /* Already completed/aborted. */ }
      falhou();
    }
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return abrir().then(db => transacionar(db, store, mode, run));
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
