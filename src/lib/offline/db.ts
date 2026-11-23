// IndexedDB mínimo para a fila offline e o cache de leitura. Browser-only:
// só chamar dentro de handlers/useEffect (nunca em render nem em módulo SSR).

const DB_NAME = "manejo-offline";
const DB_VERSION = 1;

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Armazenamento indisponível. O lançamento não foi salvo neste aparelho.")); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onblocked = () => reject(new Error("Armazenamento bloqueado. Feche outras abas e tente salvar novamente."));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("fila")) db.createObjectStore("fila", { keyPath: "id" });
      if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function falhaArmazenamento(e: unknown): Error {
  const nome = (e as { name?: string } | null)?.name;
  return new Error(nome === "QuotaExceededError"
    ? "Armazenamento cheio. O lançamento NÃO foi salvo. Libere espaço sem apagar os dados do aplicativo e tente novamente."
    : "Não foi possível confirmar a gravação neste aparelho. O lançamento NÃO foi salvo; mantenha o formulário aberto e tente novamente.");
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
  return abrir().then(db => new Promise<T>((resolve, reject) => {
    try {
      const t = db.transaction(store, mode);
      let resultado: T;
      const req = run(t.objectStore(store));
      req.onsuccess = () => { resultado = req.result; };
      // A successful request can still be rolled back by quota/abort at commit.
      t.oncomplete = () => { db.close(); resolve(resultado); };
      t.onabort = t.onerror = () => { db.close(); reject(falhaArmazenamento(t.error ?? req.error)); };
    } catch (e) { db.close(); reject(falhaArmazenamento(e)); }
  }));
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
