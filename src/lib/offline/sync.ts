// Sincronização da fila offline: envia as operações na ordem em que foram
// feitas quando a internet volta. Itens com erro ficam marcados (nunca
// descartados) para o usuário resolver.

import { supabase } from "@/integrations/supabase/client";
import { gravarRegistro, type LogCapturado } from "@/lib/registro";
import type { Fila, Op } from "./fila";
import { registrarOperacao } from "@/lib/registro-operacao";
import { salvarRomaneioNoBanco } from "@/lib/romaneio-salvar";
import { comPrazo, erroDeRede, informarConexao, redeDisponivel, verificarBackend } from "./conexao";
import { rejeicaoConfirmada, erroDaTransacao } from "./rejeicao";

export function estaOnline(): boolean {
  return redeDisponivel();
}

// Executa uma operação contra o backend. Lança erro em caso de falha.
export async function executarOp(op: Op, operacao?: string): Promise<void> {
  if (op.tipo === "transferencia_explanada") {
    // RPC do banco valida cargo, empresa, AUTEX, estoque, concorrência e auditoria.
    // Cast local porque o schema da Lovable atualiza os tipos gerados separadamente.
    const { error } = await supabase.rpc("transferir_tora_explanada" as never, {
      _empresa: op.empresa_id,
      _autex: op.autex,
      _plaqueta: op.plaqueta,
      _origem: op.origem_id,
      _destino: op.destino_id,
      _operacao: op.log.operacao_id ?? operacao ?? "",
      _log: op.log,
    } as never);
    if (error) throw erroDaTransacao(error);
    return; // A RPC registra a auditoria na mesma transação.
  }
  if (op.tipo === "arrasto_arvore") {
    // Legacy queue entries may have no landing; preserve null for server validation.
    const { error } = await supabase.rpc("registrar_arrasto_arvore" as never, {
      _empresa: op.empresa_id,
      _autex: op.autex,
      _arvore: op.arvore,
      _explanada: op.explanada_id,
      _lat: op.latitude,
      _lng: op.longitude,
      _precisao: op.precisao,
      _capturado_em: op.capturado_em,
      _operacao: op.log.operacao_id ?? operacao ?? "",
    } as never);
    if (error) throw erroDaTransacao(error);
    return; // Auditoria inserida atomicamente no Postgres.
  }
  if (op.tipo === "arrasto_toras") {
    const { error } = await supabase.rpc("registrar_arrasto_toras", {
      _empresa: op.empresa_id,
      _autex: op.autex,
      _arvore: op.arvore,
      _plaquetas: op.plaquetas,
      _explanada: op.explanada_id,
      _lat: op.latitude,
      _lng: op.longitude,
      _precisao: op.precisao,
      _capturado_em: op.capturado_em,
      _operacao: op.log.operacao_id ?? operacao ?? "",
    });
    if (error) throw erroDaTransacao(error);
    // O banco registra a auditoria atomicamente na mesma transação.
    return;
  }
  if(op.tipo==='pacote_serrado_salvar') {
    const { enviarPacote }=await import('@/lib/madeira-serrada');
    await enviarPacote(op.empresa_id,op.pacote_id,op.cab,op.itens,op.log);
    return;
  }
  const suportada = ["tora_insert", "tora_update", "tora_delete", "toras_serradas", "romaneio_recebido"].includes(op.tipo);
  if (suportada) {
    // Old queued items without audit still go through the authorized RPC
    // (direct table writes are blocked by role policies).
    const log: LogCapturado = op.log ?? { acao: "Alteração sincronizada", detalhe: "Lançamento offline antigo", user_email: null, lat: null, lng: null, criado_em: new Date().toISOString() };
    let empresa = op.tipo === "tora_insert" ? String(op.dados["empresa_id"] ?? "") : "empresa_id" in op ? op.empresa_id ?? "" : "";
    if (!empresa) { const { data, error } = await supabase.rpc("minha_empresa"); if (error) throw error; empresa = data ?? ""; }
    const dados = op.tipo === "tora_insert" || op.tipo === "tora_update" ? op.dados : op.tipo === "toras_serradas" ? { desfazer: op.desfazer } : op.tipo === "romaneio_recebido" ? { patio: op.patio } : {};
    const alvos = op.tipo === "tora_update" || op.tipo === "tora_delete" ? [op.plaqueta] : op.tipo === "toras_serradas" ? op.plaquetas : op.tipo === "romaneio_recebido" ? [op.id] : [];
    await registrarOperacao(op.tipo, empresa, dados, alvos, log, operacao);
    return;
  }
  await executarOpSemLog(op, operacao);
  // A função SQL de romaneio já registra a operação na mesma transação.
  if (op.log && op.tipo !== "romaneio_salvar") {
    await gravarRegistro(op.log, "empresa_id" in op ? op.empresa_id ?? null : null);
  }
}

async function executarOpSemLog(op: Op, operacao?: string): Promise<void> {
  switch (op.tipo) {
    case 'pacote_serrado_salvar': return;
    case "tora_insert": {
      const { error } = await supabase.from("toras").insert(op.dados as never);
      if (error) throw erroDaTransacao(error);
      return;
    }
    case "tora_update": {
      // A AUTEX digitada precisa existir no cadastro da empresa antes de gravar na tora.
      if (op.autex) {
        const { error: ea } = await supabase
          .from("autex")
          .upsert({ numero: op.autex, empresa_id: op.empresa_id } as never, {
            onConflict: "empresa_id,numero",
            ignoreDuplicates: true,
          });
        if (ea) throw erroDaTransacao(ea);
      }
      const { error } = await supabase
        .from("toras")
        .update(op.dados as never)
        .eq("plaqueta", op.plaqueta)
        .eq("empresa_id", op.empresa_id);
      if (error) throw erroDaTransacao(error);
      return;
    }
    case "tora_delete": {
      const { error } = await supabase
        .from("toras")
        .delete()
        .eq("plaqueta", op.plaqueta)
        .eq("empresa_id", op.empresa_id);
      if (error) throw erroDaTransacao(error);
      return;
    }
    case "romaneio_salvar": {
      // Um mesmo item offline preserva o ID na repetição após falha de rede.
      const log = op.log ?? {
        acao: "Romaneio salvo", detalhe: "Romaneio sincronizado", user_email: null,
        lat: null, lng: null, criado_em: new Date().toISOString(),
      };
      await salvarRomaneioNoBanco(op.cab, op.plaquetas, log, op.empresa_id, operacao);
      return;
    }
    case "romaneio_recebido": {
      const emp = op.empresa_id ? { empresa_id: op.empresa_id } : {};
      const { error: patioError } = await supabase
        .from("patios")
        .upsert({ nome: op.patio, ...emp } as never, { onConflict: "empresa_id,nome", ignoreDuplicates: true });
      if (patioError) throw erroDaTransacao(patioError);
      const { error } = await supabase
        .from("romaneios")
        .update({ recebido_em: new Date().toISOString(), patio: op.patio } as never)
        .eq("id", op.id)
        .eq("empresa_id", op.empresa_id ?? "");
      if (error) throw erroDaTransacao(error);
      return;
    }
    case "toras_serradas": {
      const { error } = await supabase
        .from("toras")
        .update({ serrada_em: op.desfazer ? null : new Date().toISOString() } as never)
        .in("plaqueta", op.plaquetas)
        .eq("empresa_id", op.empresa_id ?? "");
      if (error) throw erroDaTransacao(error);
      return;
    }
    case "arvore_gps": {
      const { error } = await supabase
        .from("arvores")
        .update(op.dados)
        .eq("id", op.id)
        .eq("empresa_id", op.empresa_id)
        .eq("autex", op.autex);
      if (error) throw erroDaTransacao(error);
      return;
    }
    case "aguardando_insert": {
      // Stable id makes replay idempotent; a numero clash is a marked conflict.
      const { error } = await supabase.from("toras_aguardando").upsert(op.dados as never, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw erroDaTransacao({ message: error.code === "23505" ? `Código NI-${op.dados["numero"]} já usado em outro aparelho` : error.message, code: error.code });
      return;
    }
    case "aguardando_update": {
      // Same id + company; replay of identical values is harmless (idempotent).
      const { error } = await supabase.from("toras_aguardando").update(op.dados as never).eq("id", op.id).eq("empresa_id", op.empresa_id);
      if (error) throw erroDaTransacao(error);
      return;
    }
    case "aguardando_impressa": {
      const { error } = await supabase
        .from("toras_aguardando")
        .update({ etiqueta_impressa: op.imprimiu, etiqueta_impressa_em: op.imprimiu ? new Date().toISOString() : null } as never)
        .eq("id", op.id)
        .eq("empresa_id", op.empresa_id);
      if (error) throw erroDaTransacao(error);
      return;
    }
    case "rastro_salvar": {
      const { error } = await supabase
        .from("rastros_gps")
        .upsert(op.pontos, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw erroDaTransacao(error);
      return;
    }
  }
}

let sincronizando = false;

export async function sincronizar(f: Fila, executar: (op: Op, operacao?: string) => Promise<void> = executarOp,
  verificar: () => Promise<boolean> = executar === executarOp ? verificarBackend : async () => true,
): Promise<{ enviados: number; erros: number }> {
  const vazio = { enviados: 0, erros: 0 };
  if (sincronizando || (typeof navigator !== 'undefined' && !navigator.onLine)) return vazio;
  sincronizando = true;
  const enviar = async () => {
    let enviados = 0;
    let erros = 0;
    if (!await verificar()) return vazio;
    informarConexao(true);
    for (const item of await f.listar()) {
      if (!estaOnline()) break;
      if (item.erro) continue;
      // Ensure another tab / account change has not removed or changed this entry.
      const atual = (await f.listar()).find(i => i.id === item.id);
      if (!atual || atual.erro) continue;
      await f.iniciarEnvio(item.id); // persisted BEFORE the request, including uncertain response protection
      try {
        await comPrazo(executar(atual.op, atual.id), 20000);
      } catch (e) {
        if (erroDeRede(e) || (typeof navigator !== 'undefined' && !navigator.onLine)) { informarConexao(false); break; }
        await f.marcarErro(item.id, e instanceof Error ? e.message : String(e), rejeicaoConfirmada(e));
        erros++;
        continue;
      }
      // Persist receipt before cleanup. Cleanup failures must not replay an acknowledged write.
      await f.confirmarEnvio(item.id);
      enviados++;
      try { await f.remover(item.id); } catch { /* receipt retained, never resent */ }
    }
    return { enviados, erros };
  };
  try {
    // Cross-tab exclusion as well as the in-process guard. No forced takeover on reconnect.
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return await navigator.locks.request('gestor-fila-sync', { ifAvailable: true }, lock => lock ? enviar() : Promise.resolve(vazio));
    }
    return await enviar();
  } finally { sincronizando = false; }
}
