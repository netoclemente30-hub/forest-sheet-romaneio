import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { LogCapturado } from "./registro";
import { erroDaTransacao } from './offline/rejeicao';

export async function enviarOperacao(tipo: string, empresa: string, dados: Record<string, unknown>, alvos: (number | string)[], log: LogCapturado, operacao = log.operacao_id ?? crypto.randomUUID()) {
  const dadosEnvio = { ...dados };
  // Register free AUTEX at replay, after local intent is durable, with unchanged RLS.
  if (['tora_insert', 'tora_update'].includes(tipo) && typeof dados['autex'] === 'string' && dados['autex'].trim() && supabase.from) {
    const { error } = await supabase.from('autex').upsert({ numero: dados['autex'].trim(), empresa_id: empresa }, { onConflict: 'empresa_id,numero', ignoreDuplicates: true });
    if (error) throw erroDaTransacao(error);
  }
  if (tipo === "tora_insert") {
    // Encaixe/offline retain a complete local row for labels. These fields are
    // assigned by the database, not accepted as input to a new log.
    for (const campo of ["created_at", "romaneio_id", "serrada_em", "etiqueta_impressa_em"]) delete dadosEnvio[campo];
  }
  const { data, error } = await supabase.rpc("registrar_operacao", { _tipo: tipo, _empresa: empresa, _dados: dadosEnvio as Json, _alvos: alvos, _log: log as unknown as Json, _operacao: operacao });
  if (error) throw erroDaTransacao(error);
  return data;
}

/** Replay uses enviarOperacao; handlers acknowledge durable local intent. */
export async function registrarOperacao(tipo: string, empresa: string, dados: Record<string, unknown>, alvos: (number | string)[], log: LogCapturado, operacao = log.operacao_id ?? crypto.randomUUID()) {
  const { persistirOperacao } = await import('./offline/persistir');
  if (tipo === 'tora_insert') return persistirOperacao({ tipo, dados: { ...dados, empresa_id: empresa }, log: { ...log, operacao_id: operacao } });
  if (tipo === 'tora_update') return persistirOperacao({ tipo, empresa_id: empresa, plaqueta: Number(alvos[0]), autex: typeof dados['autex'] === 'string' ? dados['autex'] : null, dados, log: { ...log, operacao_id: operacao } });
  if (tipo === 'tora_delete') return persistirOperacao({ tipo, empresa_id: empresa, plaqueta: Number(alvos[0]), log: { ...log, operacao_id: operacao } });
  if (tipo === 'toras_serradas') return persistirOperacao({ tipo, empresa_id: empresa, plaquetas: alvos.map(Number), desfazer: dados['desfazer'] === true, log: { ...log, operacao_id: operacao } });
  if (tipo === 'romaneio_recebido') return persistirOperacao({ tipo, empresa_id: empresa, id: String(alvos[0]), patio: String(dados['patio'] ?? ''), log: { ...log, operacao_id: operacao } });
  return persistirOperacao({ tipo: 'estoque_operacao', empresa_id: empresa, operacao, tipo_operacao: tipo, dados, alvos, log });
}