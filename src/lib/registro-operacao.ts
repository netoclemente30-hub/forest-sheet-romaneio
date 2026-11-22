import { erroDaTransacao } from "./offline/rejeicao";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { LogCapturado } from "./registro";

export async function registrarOperacao(tipo: string, empresa: string, dados: Record<string, unknown>, alvos: (number | string)[], log: LogCapturado, operacao = log.operacao_id ?? crypto.randomUUID()) {
  const dadosEnvio = { ...dados };
  if (tipo === "tora_insert") {
    // Encaixe/offline retain a complete local row for labels. These fields are
    // assigned by the database, not accepted as input to a new log.
    for (const campo of ["created_at", "romaneio_id", "serrada_em", "etiqueta_impressa_em"]) delete dadosEnvio[campo];
  }
  const { data, error } = await supabase.rpc("registrar_operacao", { _tipo: tipo, _empresa: empresa, _dados: dadosEnvio as Json, _alvos: alvos, _log: log as unknown as Json, _operacao: operacao });
  if (error) throw erroDaTransacao(error);
  return data;
}