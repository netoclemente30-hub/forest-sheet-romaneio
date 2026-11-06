// Sincronização da fila offline: envia as operações na ordem em que foram
// feitas quando a internet volta. Itens com erro ficam marcados (nunca
// descartados) para o usuário resolver.

import { supabase } from "@/integrations/supabase/client";
import type { Fila, Op } from "./fila";

export function estaOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

// Executa uma operação contra o backend. Lança erro em caso de falha.
export async function executarOp(op: Op): Promise<void> {
  switch (op.tipo) {
    case "tora_insert": {
      const { error } = await supabase.from("toras").insert(op.dados as never);
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
  }
}

let sincronizando = false;

// Envia a fila na ordem; para no primeiro erro de rede, mas marca conflitos
// (ex.: plaqueta duplicada) e segue para os próximos.
export async function sincronizar(f: Fila, executar: (op: Op) => Promise<void> = executarOp): Promise<{ enviados: number; erros: number }> {
  if (sincronizando || !estaOnline()) return { enviados: 0, erros: 0 };
  sincronizando = true;
  let enviados = 0;
  let erros = 0;
  try {
    for (const item of await f.listar()) {
      if (!estaOnline()) break;
      try {
        await executar(item.op);
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
