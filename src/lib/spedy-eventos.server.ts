import { storeAdmin } from "./spedy.server";
import type { StoreEventos } from "./spedy-eventos.core";
export async function storeEventos(): Promise<StoreEventos> {
  const base = await storeAdmin();
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  return {
    documento: base.documento,
    config: base.config,
    evento: base.evento,
    async cnpj(empresa) {
      const { data } = await db
        .from("empresas")
        .select("cnpj")
        .eq("id", empresa)
        .single()
        .throwOnError();
      return data.cnpj ?? "";
    },
    async reservarEvento(doc, usuario) {
      const tentativa = new Date().toISOString();
      const { data } = await db
        .from("fiscal_documentos")
        .update({
          status: "evento_pendente",
          tentativa_em: tentativa,
          enviado_por: usuario,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", doc.id)
        .eq("empresa_id", doc.empresa_id)
        .eq("status", "authorized")
        .select("id")
        .maybeSingle()
        .throwOnError();
      return data ? { ...doc, status: "evento_pendente", tentativa_em: tentativa } : null;
    },
    async finalizarEvento(doc, campos) {
      if (!doc.tentativa_em) return false;
      const { data } = await db
        .from("fiscal_documentos")
        .update({ ...campos, atualizado_em: new Date().toISOString() })
        .eq("id", doc.id)
        .eq("empresa_id", doc.empresa_id)
        .eq("status", "evento_pendente")
        .eq("tentativa_em", doc.tentativa_em)
        .select("id")
        .maybeSingle()
        .throwOnError();
      return !!data;
    },
    async historico(empresa, documento) {
      const { data } = await db
        .from("fiscal_eventos")
        .select("id,acao,resultado,criado_em")
        .eq("empresa_id", empresa)
        .eq("documento_id", documento)
        .like("acao", "evento_%")
        .order("criado_em", { ascending: false })
        .limit(100)
        .throwOnError();
      return data;
    },
    async ultimoInicio(empresa, documento) {
      const { data } = await db
        .from("fiscal_eventos")
        .select("id,acao,resultado,criado_em")
        .eq("empresa_id", empresa)
        .eq("documento_id", documento)
        .eq("acao", "evento_inicio")
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle()
        .throwOnError();
      return data;
    },
  };
}
