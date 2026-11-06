// Fila de operações feitas sem internet. O armazenamento é injetável para
// permitir testes em memória; no app usa IndexedDB (db.ts).

import { idb } from "./db";
import type { LogCapturado } from "@/lib/registro";

export type Op =
  | { tipo: "tora_insert"; dados: Record<string, unknown>; log?: LogCapturado }
  | {
      tipo: "romaneio_salvar";
      cab: { placa: string; julieta: string; motorista: string; cpf: string; data: string };
      total_volume: number;
      qtd_toras: number;
      plaquetas: number[];
      empresa_id?: string | null;
      log?: LogCapturado;
    }
  | { tipo: "romaneio_recebido"; id: string; patio: string; empresa_id?: string | null; log?: LogCapturado }
  | { tipo: "toras_serradas"; plaquetas: number[]; desfazer: boolean; log?: LogCapturado };

export interface ItemFila {
  id: string;
  criadoEm: number;
  op: Op;
  erro?: string;
}

export interface FilaStore {
  all(): Promise<ItemFila[]>;
  put(item: ItemFila): Promise<void>;
  del(id: string): Promise<void>;
}

export function criarFila(store: FilaStore, onMudou: () => void = () => {}) {
  return {
    async enfileirar(op: Op): Promise<ItemFila> {
      const item: ItemFila = {
        id: crypto.randomUUID(),
        criadoEm: Date.now(),
        op,
      };
      await store.put(item);
      onMudou();
      return item;
    },
    async listar(): Promise<ItemFila[]> {
      const itens = await store.all();
      return itens.sort((a, b) => a.criadoEm - b.criadoEm);
    },
    async remover(id: string) {
      await store.del(id);
      onMudou();
    },
    async marcarErro(id: string, erro: string) {
      const itens = await store.all();
      const item = itens.find((i) => i.id === id);
      if (item) {
        await store.put({ ...item, erro });
        onMudou();
      }
    },
  };
}

export type Fila = ReturnType<typeof criarFila>;

// --- Instância do app (IndexedDB) + aviso de mudanças para a interface ---

type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();
export function assinarFila(fn: Ouvinte): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}
function avisar() {
  ouvintes.forEach((fn) => fn());
}

let filaApp: Fila | null = null;
export function fila(): Fila {
  if (!filaApp) {
    const store: FilaStore = {
      all: () => idb.getAll<ItemFila>("fila"),
      put: (item) => idb.put("fila", item),
      del: (id) => idb.del("fila", id),
    };
    filaApp = criarFila(store, avisar);
  }
  return filaApp;
}
