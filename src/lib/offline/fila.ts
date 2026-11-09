// Fila de operações feitas sem internet. O armazenamento é injetável para
// permitir testes em memória; no app usa IndexedDB (db.ts).

import { idb } from "./db";
import type { LogCapturado } from "@/lib/registro";
import type { CabPacote, BitolaSerrada } from '@/lib/madeira-serrada';
import type { PontoRastro } from '@/lib/exploracao';
import type { DadosArvoreGPS } from '@/lib/exploracao-salvar';

export type Op =
  | { tipo:'pacote_serrado_salvar'; empresa_id:string; pacote_id:string; cab:CabPacote; itens:BitolaSerrada[]; log:LogCapturado }
  | { tipo: "tora_insert"; dados: Record<string, unknown>; log?: LogCapturado }
  | {
      tipo: "tora_update";
      plaqueta: number;
      empresa_id: string;
      autex: string | null;
      dados: Record<string, unknown>;
      log?: LogCapturado;
    }
  | { tipo: "tora_delete"; plaqueta: number; empresa_id: string; log?: LogCapturado }
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
  | { tipo: "toras_serradas"; plaquetas: number[]; desfazer: boolean; empresa_id?: string; log?: LogCapturado }
  | { tipo: "arvore_gps"; id: string; empresa_id: string; autex: string; dados: DadosArvoreGPS; log: LogCapturado }
  | { tipo: "rastro_salvar"; empresa_id: string; autex: string; pontos: PontoRastro[]; log: LogCapturado };

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
    async editarErro(id: string, op: Op) {
      const item = (await store.all()).find((i) => i.id === id);
      if (!item?.erro) throw new Error("Este lançamento não está mais disponível para edição");
      if (op.tipo !== item.op.tipo) throw new Error("Não é possível trocar o tipo do lançamento");
      // Keep the error until an explicit retry: saving must not send unexpectedly.
      await store.put({ ...item, op });
      onMudou();
    },
    async atualizarPacote(id:string, op:Extract<Op,{tipo:'pacote_serrado_salvar'}>) {
      const item=(await store.all()).find(i=>i.id===id);
      if(!item||item.op.tipo!=='pacote_serrado_salvar'||item.op.empresa_id!==op.empresa_id||item.op.pacote_id!==op.pacote_id) throw new Error('Pacote pendente não encontrado');
      await store.put({...item,op:{...op,log:item.op.log}});
      onMudou();
    },
    async limparErro(id: string) {
      const itens = await store.all();
      const item = itens.find((i) => i.id === id);
      if (item) {
        const { erro: _e, ...resto } = item;
        await store.put(resto);
        onMudou();
      }
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
