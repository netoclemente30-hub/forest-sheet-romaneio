// Fila de operações feitas sem internet. O armazenamento é injetável para
// permitir testes em memória; no app usa IndexedDB (db.ts).

import { idb } from "./db";
import { sessaoDoAparelho } from "./sessao";
import { getEmpresaAtiva, lerEmpresaSalva } from "@/lib/empresa";
import type { LogCapturado } from "@/lib/registro";
import type { CabPacote, BitolaSerrada } from '@/lib/madeira-serrada';
import type { PontoRastro } from '@/lib/exploracao';
import type { DadosArvoreGPS } from '@/lib/exploracao-salvar';

export type Op =
  | { tipo: 'estoque_operacao'; empresa_id: string; operacao: string; tipo_operacao: string; dados: Record<string, unknown>; alvos: (number | string)[]; log: LogCapturado }
  | { tipo: 'aguardando_delete'; id: string; empresa_id: string; log: LogCapturado }
  | { tipo: 'romaneio_importado_salvar'; empresa_id: string; documento_id: string; revisao: number; cab: import('@/lib/romaneio-serrado-importar').CabImportado; itens: import('@/lib/romaneio-serrado-importar').PecaImportada[]; operacao: string; log: LogCapturado }
  | { tipo: 'campo_update'; empresa_id: string; tabela: 'arvores' | 'autex' | 'toras'; alvo: string | number; chave: 'id' | 'numero' | 'plaqueta'; dados: Record<string, unknown>; limitesAnteriores?: import('@/integrations/supabase/types').Json; log: LogCapturado }
  | { tipo: 'cadastro_upsert'; empresa_id: string; tabela: 'autex' | 'explanadas' | 'saldos'; dados: Record<string, unknown>; conflito: string; log: LogCapturado }
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
  | { tipo: "toras_etiquetas"; empresa_id: string; plaquetas: number[]; log: LogCapturado }
  | { tipo: "tora_delete"; plaqueta: number; empresa_id: string; log?: LogCapturado }
  | {
      tipo: "romaneio_salvar";
      cab: { placa: string; julieta: string; motorista: string; cpf: string; data: string; cliente?: Record<string, string> | null };
      total_volume: number;
      qtd_toras: number;
      plaquetas: number[];
      empresa_id?: string | null;
      log?: LogCapturado;
    }
  | { tipo: "romaneio_recebido"; id: string; patio: string; empresa_id?: string | null; log?: LogCapturado }
  | { tipo: "toras_serradas"; plaquetas: number[]; desfazer: boolean; empresa_id?: string; log?: LogCapturado }
  | { tipo: "arvore_gps"; id: string; empresa_id: string; autex: string; dados: DadosArvoreGPS; log: LogCapturado }
  | {
      tipo: "arrasto_arvore";
      empresa_id: string;
      autex: string;
      arvore: number;
      explanada_id: string | null;
      latitude: number;
      longitude: number;
      precisao: number;
      capturado_em: string;
      log: LogCapturado;
    }
  | {
      tipo: "arrasto_toras";
      empresa_id: string;
      autex: string;
      arvore: number;
      plaquetas: number[];
      explanada_id: string;
      latitude: number;
      longitude: number;
      precisao: number;
      capturado_em: string;
      log: LogCapturado;
    }
  | {
      tipo: "transferencia_explanada";
      empresa_id: string;
      autex: string;
      plaqueta: number;
      origem_id: string;
      destino_id: string;
      log: LogCapturado;
    }
  | { tipo: "aguardando_insert"; dados: Record<string, unknown>; log: LogCapturado }
  | { tipo: "aguardando_update"; id: string; empresa_id: string; dados: Record<string, unknown>; log: LogCapturado }
  | { tipo: "aguardando_impressa"; id: string; empresa_id: string; imprimiu: boolean; log: LogCapturado }
  | { tipo: "rastro_salvar"; empresa_id: string; autex: string; pontos: PontoRastro[]; log: LogCapturado };

export interface ItemFila {
  id: string;
  criadoEm: number;
  op: Op;
  /** Responsável pelo lançamento offline (separa contas no mesmo aparelho). */
  usuario_id?: string;
  /** Durable marker: the remote response may have been lost. Do not rewrite this intent. */
  envio_iniciado?: boolean;
  erro?: string;
  estado?: "pendente" | "enviando" | "enviado" | "erro";
}

export interface FilaStore {
  all(): Promise<ItemFila[]>;
  put(item: ItemFila): Promise<void>;
  del(id: string): Promise<void>;
}

export function empresaDaOp(op: Op): string | null {
  if (op.tipo === 'tora_insert' || op.tipo === 'aguardando_insert') return typeof op.dados['empresa_id'] === 'string' ? op.dados['empresa_id'] : null;
  return 'empresa_id' in op ? op.empresa_id ?? null : null;
}
function preservarAuditoria(anterior: Op, nova: Op): Op {
  return anterior.log ? { ...nova, log: anterior.log } : nova;
}

export function criarFila(store: FilaStore, onMudou: () => void = () => {}) {
  return {
    async enfileirar(op: Op): Promise<ItemFila> {
      const item: ItemFila = {
        id: crypto.randomUUID(),
        criadoEm: Date.now(),
        op,
        estado: "pendente",
      };
      await store.put(item);
      onMudou();
      return item;
    },
    async listar(): Promise<ItemFila[]> {
      const itens = await store.all();
      return itens.filter(i => i.estado !== "enviado").sort((a, b) => a.criadoEm - b.criadoEm);
    },
    async remover(id: string) {
      await store.del(id);
      onMudou();
    },
    async editarErro(id: string, op: Op) {
      const item = (await store.all()).find((i) => i.id === id);
      if (!item?.erro) throw new Error("Este lançamento não está mais disponível para edição");
      if (item.envio_iniciado) throw new Error('Este lançamento já teve envio iniciado. Tente novamente antes de editar.');
      if (op.tipo !== item.op.tipo) throw new Error("Não é possível trocar o tipo do lançamento");
      if (item.envio_iniciado) throw new Error("Envio sem confirmação: tente novamente com os mesmos dados antes de editar.");
      if (empresaDaOp(op) !== empresaDaOp(item.op)) throw new Error("Não é possível trocar a empresa do lançamento");
      // Keep the error until an explicit retry: saving must not send unexpectedly.
      await store.put({ ...item, op: preservarAuditoria(item.op, op) });
      onMudou();
    },
    /** Reescreve um lançamento pendente mantendo id, hora e auditoria capturados. */
    async substituir(id: string, op: Op) {
      const item = (await store.all()).find((i) => i.id === id);
      if (!item) throw new Error("Este lançamento não está mais na lista de pendentes");
      if (item.envio_iniciado) throw new Error('Envio sem confirmação: este lançamento já teve envio iniciado. Aguarde a confirmação antes de editar.');
      if (op.tipo !== item.op.tipo) throw new Error("Não é possível trocar o tipo do lançamento");
      if (item.envio_iniciado) throw new Error("Envio sem confirmação: tente novamente com os mesmos dados antes de editar.");
      if (empresaDaOp(op) !== empresaDaOp(item.op)) throw new Error("Não é possível trocar a empresa do lançamento");
      await store.put({ ...item, op: preservarAuditoria(item.op, op) });
      onMudou();
    },
    async atualizarPacote(id:string, op:Extract<Op,{tipo:'pacote_serrado_salvar'}>) {
      const item=(await store.all()).find(i=>i.id===id);
      if(item?.envio_iniciado) throw new Error('Envio sem confirmação: aguarde antes de editar o pacote');
      if(!item||item.op.tipo!=='pacote_serrado_salvar'||item.op.empresa_id!==op.empresa_id||item.op.pacote_id!==op.pacote_id) throw new Error('Pacote pendente não encontrado');
      if (item.envio_iniciado) throw new Error('O envio deste pacote já começou. Aguarde a confirmação antes de editar.');
      await store.put({...item,op:{...op,log:item.op.log}});
      onMudou();
    },
    async limparErro(id: string) {
      const itens = await store.all();
      const item = itens.find((i) => i.id === id);
      if (item) {
        const { erro: _e, ...resto } = item;
        await store.put({ ...resto, estado: item.envio_iniciado ? "enviando" : "pendente" });
        onMudou();
      }
    },
    async iniciarEnvio(id: string) {
      const item = (await store.all()).find(i => i.id === id);
      if (!item || item.erro) throw new Error("Lançamento indisponível para envio");
      await store.put({ ...item, envio_iniciado: true, estado: "enviando" });
      onMudou();
    },
    async confirmarEnvio(id: string) {
      const item = (await store.all()).find(i => i.id === id);
      if (item) await store.put({ ...item, estado: "enviado" });
      onMudou();
    },
    async marcarErro(id: string, erro: string, rollback = false) {
      const itens = await store.all();
      const item = itens.find((i) => i.id === id);
      if (item) {
        await store.put({ ...item, erro, estado: "erro", ...(rollback ? { envio_iniciado: false } : {}) });
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

// Os lançamentos antigos não têm usuario_id. Recuperar somente quando o e-mail
// capturado na época do lançamento coincide com a conta autenticada agora.
// Nenhum lançamento antigo é apagado automaticamente.
type IdentidadeFila = { id: string; email: string | null };

async function identidadeFila(): Promise<IdentidadeFila> {
  const session = await sessaoDoAparelho();
  if (!session?.user.id) throw new Error("Entre na sua conta antes de acessar a fila offline");
  return {
    id: session.user.id,
    email: session.user.email?.trim().toLowerCase() ?? null,
  };
}

export function pertenceAoUsuario(item: ItemFila, usuario: IdentidadeFila): boolean {
  if (item.usuario_id) return item.usuario_id === usuario.id;
  const antigoEmail = "log" in item.op ? item.op.log?.user_email?.trim().toLowerCase() : null;
  return Boolean(usuario.email && antigoEmail && usuario.email === antigoEmail);
}

export function pertenceAoContexto(item: ItemFila, usuario: IdentidadeFila, empresa: string | null): boolean {
  return !!empresa && pertenceAoUsuario(item, usuario) && empresaDaOp(item.op) === empresa;
}

let filaApp: Fila | null = null;
export function fila(): Fila {
  if (!filaApp) {
    const store: FilaStore = {
      all: async () => {
        const usuario = await identidadeFila();
        const itens = await idb.getAll<ItemFila>("fila");
        const empresa = getEmpresaAtiva() ?? lerEmpresaSalva(usuario.id);
        return itens.filter((item) => pertenceAoContexto(item, usuario, empresa));
      },
      put: async (item) => {
        const usuario = await identidadeFila();
        // Um item nunca pode ser reatribuído para outra conta, nem por atualização.
        if (item.usuario_id && item.usuario_id !== usuario.id) {
          throw new Error("Operação offline pertencente a outra conta");
        }
        if (!item.usuario_id && item.op.log?.user_email && item.op.log.user_email.trim().toLowerCase() !== usuario.email) throw new Error("A conta mudou durante o lançamento. Os dados não foram salvos; entre novamente na conta original.");
        const empresa = empresaDaOp(item.op) ?? getEmpresaAtiva() ?? lerEmpresaSalva(usuario.id);
        if (!empresa) throw new Error("Empresa não confirmada. O lançamento não foi salvo.");
        const op = "dados" in item.op && (item.op.tipo === "tora_insert" || item.op.tipo === "aguardando_insert")
          ? { ...item.op, dados: { ...item.op.dados, empresa_id: empresa } }
          : { ...item.op, empresa_id: empresa };
        await idb.put("fila", { ...item, op, usuario_id: usuario.id });
      },
      del: async (id) => {
        const usuario = await identidadeFila();
        const item = await idb.get<ItemFila>("fila", id);
        if (!item || !pertenceAoContexto(item, usuario, getEmpresaAtiva() ?? lerEmpresaSalva(usuario.id))) {
          throw new Error("Operação offline não pertence à conta atual");
        }
        await idb.del("fila", id);
      },
    };
    filaApp = criarFila(store, avisar);
  }
  return filaApp;
}
