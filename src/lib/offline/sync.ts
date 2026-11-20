// Sincronização da fila offline: envia as operações na ordem em que foram
// feitas quando a internet volta. Itens com erro ficam marcados (nunca
// descartados) para o usuário resolver.

import { supabase } from "@/integrations/supabase/client";
import { gravarRegistro, type LogCapturado } from "@/lib/registro";
import type { Fila, Op } from "./fila";
import { enviarOperacao } from "@/lib/registro-operacao";
import { salvarRomaneioNoBanco } from "@/lib/romaneio-salvar";
import { erroDaTransacao, RejeicaoConfirmada } from './rejeicao';

export function estaOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

// Executa uma operação contra o backend. Lança erro em caso de falha.
export async function executarOp(op: Op, operacao?: string): Promise<void> {
  if (op.tipo === 'estoque_operacao') {
    await enviarOperacao(op.tipo_operacao, op.empresa_id, op.dados, op.alvos, op.log, op.operacao);
    return;
  }
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
    await enviarOperacao(op.tipo, empresa, dados, alvos, log, operacao);
    return;
  }
  await executarOpSemLog(op, operacao);
  // A função SQL de romaneio já registra a operação na mesma transação.
  if (op.log && op.tipo !== "romaneio_salvar" && op.tipo !== 'romaneio_importado_salvar') {
    await gravarRegistro(op.log, "empresa_id" in op ? op.empresa_id ?? null : null);
  }
}

async function executarOpSemLog(op: Op, operacao?: string): Promise<void> {
  switch (op.tipo) {
    case 'pacote_serrado_salvar': return;
    case 'estoque_operacao': return;
    case 'romaneio_importado_salvar': {
      const { error } = await supabase.rpc('salvar_romaneio_serrado_importado', { _empresa: op.empresa_id, _id: op.documento_id, _revisao: op.revisao, _cab: op.cab as never, _itens: op.itens as never, _operacao: op.operacao, _log: op.log as never });
      if (error) throw erroDaTransacao(error);
      return;
    }
    case 'campo_update': {
      const { error } = await supabase.from(op.tabela as 'arvores').update(op.dados as never).filter(op.chave, 'eq', op.alvo).eq('empresa_id', op.empresa_id).select('*');
      if (error) throw new Error(error.message);
      return;
    }
    case 'cadastro_upsert': {
      const { error } = await supabase.from(op.tabela).upsert({ ...op.dados, empresa_id: op.empresa_id } as never, { onConflict: op.conflito });
      if (error) throw new Error(error.message);
      return;
    }
    case 'aguardando_delete': {
      const { error } = await supabase.from('toras_aguardando').delete().eq('id', op.id).eq('empresa_id', op.empresa_id);
      if (error) throw new Error(error.message);
      return;
    }
    case "tora_insert": {
      const { error } = await supabase.from("toras").insert(op.dados as never);
      if (error) throw new Error(error.message);
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
        if (ea) throw new Error(ea.message);
      }
      const { error } = await supabase
        .from("toras")
        .update(op.dados as never)
        .eq("plaqueta", op.plaqueta)
        .eq("empresa_id", op.empresa_id);
      if (error) throw new Error(error.message);
      return;
    }
    case "tora_delete": {
      const { error } = await supabase
        .from("toras")
        .delete()
        .eq("plaqueta", op.plaqueta)
        .eq("empresa_id", op.empresa_id);
      if (error) throw new Error(error.message);
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
      if (patioError) throw new Error(patioError.message);
      const { error } = await supabase
        .from("romaneios")
        .update({ recebido_em: new Date().toISOString(), patio: op.patio } as never)
        .eq("id", op.id)
        .eq("empresa_id", op.empresa_id ?? "");
      if (error) throw new Error(error.message);
      return;
    }
    case "toras_serradas": {
      const { error } = await supabase
        .from("toras")
        .update({ serrada_em: op.desfazer ? null : new Date().toISOString() } as never)
        .in("plaqueta", op.plaquetas)
        .eq("empresa_id", op.empresa_id ?? "");
      if (error) throw new Error(error.message);
      return;
    }
    case "arvore_gps": {
      const { error } = await supabase
        .from("arvores")
        .update(op.dados)
        .eq("id", op.id)
        .eq("empresa_id", op.empresa_id)
        .eq("autex", op.autex);
      if (error) throw new Error(error.message);
      return;
    }
    case "aguardando_insert": {
      // Stable id makes replay idempotent; a numero clash is a marked conflict.
      const { error } = await supabase.from("toras_aguardando").upsert(op.dados as never, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw new Error(error.code === "23505" ? `Código NI-${op.dados["numero"]} já usado em outro aparelho` : error.message);
      return;
    }
    case "aguardando_update": {
      // Same id + company; replay of identical values is harmless (idempotent).
      const { error } = await supabase.from("toras_aguardando").update(op.dados as never).eq("id", op.id).eq("empresa_id", op.empresa_id);
      if (error) throw new Error(error.message);
      return;
    }
    case "aguardando_impressa": {
      const { error } = await supabase
        .from("toras_aguardando")
        .update({ etiqueta_impressa: op.imprimiu, etiqueta_impressa_em: op.imprimiu ? new Date().toISOString() : null } as never)
        .eq("id", op.id)
        .eq("empresa_id", op.empresa_id);
      if (error) throw new Error(error.message);
      return;
    }
    case "rastro_salvar": {
      const { error } = await supabase
        .from("rastros_gps")
        .upsert(op.pontos, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
      return;
    }
  }
}

let sincronizando = false;

// Envia a fila na ordem; para no primeiro erro de rede, mas marca conflitos
// (ex.: plaqueta duplicada) e segue para os próximos.
export async function sincronizar(f: Fila, executar: (op: Op, operacao?: string) => Promise<void> = executarOp): Promise<{ enviados: number; erros: number }> {
  if (sincronizando || !estaOnline()) return { enviados: 0, erros: 0 };
  sincronizando = true;
  let enviados = 0;
  let erros = 0;
  try {
    for (const item of await f.listar()) {
      if (!estaOnline()) break;
      if (item.erro) continue;
      try {
        const atual = await f.iniciarEnvio(item.id);
        if (!(await f.listar()).some(i => i.id === atual.id)) break;
        await executar(atual.op, atual.id);
        await f.remover(item.id);
        enviados++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Falha de rede: para e tenta de novo quando a internet voltar.
        if (!estaOnline() || /fetch|network|failed to fetch|timeout|timed out|connection|load failed|abort/i.test(msg)) break;
        // Only an explicit rollback of the first attempt permits rewriting.
        // An earlier lost response may already have committed this stable ID.
        await f.marcarErro(item.id, msg, e instanceof RejeicaoConfirmada && !item.envio_iniciado);
        erros++;
      }
    }
  } finally {
    sincronizando = false;
  }
  return { enviados, erros };
}
