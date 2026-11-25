import { arvoreColetada, chaveEscopo, type ArvoreColetada, type EscopoColeta } from "./coleta";
import { abrirBanco } from "./banco";

export const BANCO_ENGENHEIRO = "gestor-florestal-engenheiro-v1";
type Rascunho = { chave: string; escopo: string; arvore: ArvoreColetada; atualizadoEm: string };

/** Internal persistence primitive, not authorization. Keep disconnected from UI until
 * a verified engineering identity/grant exists. Never replays into operational stock. */
export async function abrirRascunhos(factory: IDBFactory = indexedDB) {
  const db = await abrirBanco(factory);
  db.onversionchange = () => db.close();
  return {
    async salvar(escopo: EscopoColeta, entrada: ArvoreColetada): Promise<void> {
      const scope = chaveEscopo(escopo);
      const arvore = arvoreColetada.parse(entrada);
      const registro: Rascunho = {
        chave: JSON.stringify([scope, arvore.numero]),
        escopo: scope,
        arvore,
        atualizadoEm: new Date().toISOString(),
      };
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("arvores", "readwrite");
        tx.objectStore("arvores").put(registro);
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error ?? new Error("Rascunho não foi salvo."));
        tx.onerror = () => reject(tx.error);
      });
    },
    async listar(escopo: EscopoColeta): Promise<ArvoreColetada[]> {
      const scope = chaveEscopo(escopo);
      return new Promise((resolve, reject) => {
        const tx = db.transaction("arvores", "readonly");
        const req = tx.objectStore("arvores").index("escopo").getAll(scope);
        tx.oncomplete = () => {
          try {
            resolve((req.result as Rascunho[]).map((r) => arvoreColetada.parse(r.arvore)));
          } catch (e) {
            reject(e);
          }
        };
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    },
    fechar: () => db.close(),
  };
}
