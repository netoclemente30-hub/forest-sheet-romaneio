import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { LogCapturado } from "./registro";

export async function registrarOperacao(tipo: string, empresa: string, dados: Record<string, unknown>, alvos: (number | string)[], log: LogCapturado, operacao = log.operacao_id ?? crypto.randomUUID()) {
  const { data, error } = await supabase.rpc("registrar_operacao", { _tipo: tipo, _empresa: empresa, _dados: dados as Json, _alvos: alvos, _log: log as unknown as Json, _operacao: operacao });
  if (error) throw new Error(error.message);
  return data;
}