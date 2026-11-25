export const BANCO_ENGENHEIRO = "gestor-florestal-engenheiro-v1";
import { vazio, validarEstado, type Estado } from "./projeto";
import { avaliarCenso } from "./camadas";

// Additive v2 upgrade: keeps all legacy scoped drafts intact.
export function abrirBanco(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let cancelado = false;
    const r = factory.open(BANCO_ENGENHEIRO, 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains("arvores"))
        r.result.createObjectStore("arvores", { keyPath: "chave" }).createIndex("escopo", "escopo");
      if (!r.result.objectStoreNames.contains("core")) r.result.createObjectStore("core");
    };
    r.onsuccess = () => {
      if (cancelado) {
        r.result.close();
        return;
      }
      r.result.onversionchange = () => r.result.close();
      resolve(r.result);
    };
    r.onerror = () => reject(r.error);
    r.onblocked = () => {
      cancelado = true;
      reject(new Error("Feche outras abas do engenheiro e tente novamente."));
    };
  });
}
export async function lerEstado(factory?: IDBFactory): Promise<Estado> {
  const db = await abrirBanco(factory);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("core", "readonly");
      const r = tx.objectStore("core").get("local");
      tx.oncomplete = () => {
        try {
          const s = r.result as Estado | undefined;
          if (s) validarEstado(s);
          resolve(s ?? vazio());
        } catch (e) {
          reject(e);
        }
      };
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function salvarEstado(s: Estado, factory?: IDBFactory): Promise<Estado> {
  validarEstado(s);
  s = {
    ...s,
    censo: s.projetos.flatMap((p) =>
      avaliarCenso(s, p.id).map(({ alertas: _alertas, areaBasal: _g, volume: _v, ...a }) => ({
        ...a,
        projetoId: p.id,
      })),
    ),
  };
  const db = await abrirBanco(factory);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("core", "readwrite");
      const store = tx.objectStore("core");
      const r = store.get("local");
      let conflito = false;
      const novo = { ...s, revisao: s.revisao + 1 };
      r.onsuccess = () => {
        if ((r.result?.revisao ?? 0) !== s.revisao) {
          conflito = true;
          tx.abort();
          return;
        }
        store.put(novo, "local");
      };
      tx.oncomplete = () => resolve(novo);
      tx.onabort = () =>
        reject(
          new Error(
            conflito
              ? "Outra aba alterou os dados. Recarregue antes de salvar."
              : "Não foi possível salvar. Verifique espaço disponível.",
          ),
        );
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
