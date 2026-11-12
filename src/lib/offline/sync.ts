// Sincronização da fila offline: envia as operações na ordem em que foram
// feitas quando a internet volta. Itens com erro ficam marcados (nunca
// descartados) para o usuário resolver.

import { supabase } from "@/integrations/supabase/client";
import { gravarRegistro } from "@/lib/registro";
import type { Fila, Op } from "./fila";
import { registrarOperacao } from "@/lib/registro-operacao";

export function estaOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

// Executa uma operação contra o backend. Lança erro em caso de falha.
export async function executarOp(op: Op, operacao?: string): Promise<void> {
  if(op.tipo==='pacote_serrado_salvar') {
    const { enviarPacote }=await import('@/lib/madeira-serrada');
    await enviarPacote(op.empresa_id,op.pacote_id,op.cab,op.itens,op.log);
    return;
  }
  const suportada = ["tora_insert", "tora_update", "tora_delete", "toras_serradas", "romaneio_recebido"].includes(op.tipo);
  if (suportada && op.log) {
    let empresa = op.tipo === "tora_insert" ? String(op.dados["empresa_id"] ?? "") : "empresa_id" in op ? op.empresa_id ?? "" : "";
    if (!empresa) { const { data, error } = await supabase.rpc("minha_empresa"); if (error) throw error; empresa = data ?? ""; }
    const dados = op.tipo === "tora_insert" || op.tipo === "tora_update" ? op.dados : op.tipo === "toras_serradas" ? { desfazer: op.desfazer } : op.tipo === "romaneio_recebido" ? { patio: op.patio } : {};
    const alvos = op.tipo === "tora_update" || op.tipo === "tora_delete" ? [op.plaqueta] : op.tipo === "toras_serradas" ? op.plaquetas : op.tipo === "romaneio_recebido" ? [op.id] : [];
    await registrarOperacao(op.tipo, empresa, dados, alvos, op.log, operacao);
    return;
  }
  await executarOpSemLog(op);
  if (op.log) await gravarRegistro(op.log);
}

async function executarOpSemLog(op: Op): Promise<void> {
  switch (op.tipo) {
    case 'pacote_serrado_salvar': return;
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
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("romaneios")
        .insert({
          ...op.cab,
          total_volume: op.total_volume,
          qtd_toras: op.qtd_toras,
          created_by: u.user?.id ?? null,
          ...(op.empresa_id ? { empresa_id: op.empresa_id } : {}),
        } as never)
        .select()
        .single();
      if (error || !data) throw new Error(error?.message ?? "Erro ao salvar romaneio");
      const romaneio = data as { id: string };
      const { error: e2 } = await supabase
        .from("toras")
        .update({ carregada: true, romaneio_id: romaneio.id } as never)
        .in("plaqueta", op.plaquetas);
      if (e2) throw new Error(e2.message);
      const emp = op.empresa_id ? { empresa_id: op.empresa_id } : {};
      const up = (p: string, tipo: string) =>
        p.trim() &&
        supabase
          .from("veiculos")
          .upsert({ placa: p.trim().toUpperCase(), tipo, ...emp } as never, { onConflict: "empresa_id,placa,tipo", ignoreDuplicates: true });
      await Promise.all([
        up(op.cab.placa, "caminhao"),
        up(op.cab.julieta, "reboque"),
        op.cab.motorista.trim() &&
          supabase
            .from("motoristas")
            .upsert({ nome: op.cab.motorista.trim(), cpf: op.cab.cpf.trim() || null, ...emp } as never, { onConflict: "empresa_id,nome" }),
      ]);
      return;
    }
    case "romaneio_recebido": {
      const emp = op.empresa_id ? { empresa_id: op.empresa_id } : {};
      await supabase
        .from("patios")
        .upsert({ nome: op.patio, ...emp } as never, { onConflict: "empresa_id,nome", ignoreDuplicates: true });
      const { error } = await supabase
        .from("romaneios")
        .update({ recebido_em: new Date().toISOString(), patio: op.patio } as never)
        .eq("id", op.id);
      if (error) throw new Error(error.message);
      return;
    }
    case "toras_serradas": {
      const { error } = await supabase
        .from("toras")
        .update({ serrada_em: op.desfazer ? null : new Date().toISOString() } as never)
        .in("plaqueta", op.plaquetas);
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
        await executar(item.op, item.id);
        await f.remover(item.id);
        enviados++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Falha de rede: para e tenta de novo quando a internet voltar.
        if (!estaOnline() || /fetch|network|failed to fetch/i.test(msg)) break;
        await f.marcarErro(item.id, msg);
        erros++;
      }
    }
  } finally {
    sincronizando = false;
  }
  return { enviados, erros };
}
