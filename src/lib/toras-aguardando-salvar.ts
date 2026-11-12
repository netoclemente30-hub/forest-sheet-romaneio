// Marca a etiqueta das toras medidas no pátio como impressa ou não impressa.
// Com internet grava na hora; sem internet a marcação vai junto com o
// lançamento ainda pendente ou entra na fila para ser enviada depois.

import { supabase } from "@/integrations/supabase/client";
import { capturarLog, gravarRegistro, type LogCapturado } from "@/lib/registro";
import { fila, type Fila, type ItemFila, type Op } from "@/lib/offline/fila";
import { estaOnline } from "@/lib/offline/sync";
import { codigoAguardando, type ToraAguardando } from "@/lib/toras-aguardando";

export type AlvoImpressa = Pick<ToraAguardando, "id" | "empresa_id" | "numero" | "especie">;

export type MarcaImpressaDeps = {
  listarFila: () => Promise<ItemFila[]>;
  online: () => boolean;
  capturar: (acao: string, detalhe: string) => Promise<LogCapturado>;
  gravarLog: (log: LogCapturado) => Promise<void>;
  gravar: (t: AlvoImpressa, imprimiu: boolean, em: string | null) => Promise<void>;
  reescrever: (idFila: string, op: Op) => Promise<unknown>;
  enfileirar: (op: Op) => Promise<unknown>;
};

const acao = (imprimiu: boolean) => (imprimiu ? "Etiqueta de tora não identificada impressa" : "Impressão de tora não identificada desmarcada");

function depsApp(): MarcaImpressaDeps {
  const f: Fila = fila();
  return {
    listarFila: () => f.listar(),
    online: estaOnline,
    capturar: capturarLog,
    gravarLog: gravarRegistro,
    gravar: async (t, imprimiu, em) => {
      const { error } = await supabase
        .from("toras_aguardando")
        .update({ etiqueta_impressa: imprimiu, etiqueta_impressa_em: em } as never)
        .eq("id", t.id)
        .eq("empresa_id", t.empresa_id);
      if (error) throw new Error(error.message);
    },
    reescrever: (idFila, op) => f.substituir(idFila, op),
    enfileirar: (op) => f.enfileirar(op),
  };
}

/**
 * Marca (ou desmarca) a impressão das etiquetas. Retorna quantas toras ficaram
 * guardadas no aparelho para enviar quando a internet voltar.
 */
export async function marcarAguardandoImpressa(
  toras: AlvoImpressa[],
  imprimiu: boolean,
  deps: MarcaImpressaDeps = depsApp(),
): Promise<{ offline: number }> {
  const alvos = toras.filter((t) => t.id && t.empresa_id);
  if (!alvos.length) return { offline: 0 };
  const em = imprimiu ? new Date().toISOString() : null;
  const rest = new Map(alvos.map((t) => [t.id, t]));

  // 1) Tora ainda na fila de envio: a marcação via junto com o lançamento.
  for (const item of await deps.listarFila().catch(() => [] as ItemFila[])) {
    const op = item.op;
    if (op.tipo !== "aguardando_insert") continue;
    const id = String(op.dados["id"] ?? "");
    if (!rest.has(id)) continue;
    await deps.reescrever(item.id, { ...op, dados: { ...op.dados, etiqueta_impressa: imprimiu, etiqueta_impressa_em: em } });
    rest.delete(id);
  }

  const restantes = [...rest.values()];
  if (!restantes.length) return { offline: 0 };

  // 2) Com internet: grava direto e registra quem marcou.
  if (deps.online()) {
    for (const t of restantes) await deps.gravar(t, imprimiu, em);
    const detalhe = restantes.map((t) => `${codigoAguardando(t.numero)} · ${t.especie}`).join(" | ");
    await deps.gravarLog(await deps.capturar(acao(imprimiu), detalhe));
    return { offline: 0 };
  }

  // 3) Sem internet: cada marcação entra na fila, com a auditoria do momento.
  for (const t of restantes) {
    const log = await deps.capturar(acao(imprimiu), `${codigoAguardando(t.numero)} · ${t.especie}`);
    await deps.enfileirar({ tipo: "aguardando_impressa", id: t.id, empresa_id: t.empresa_id, imprimiu, log });
  }
  return { offline: restantes.length };
}
