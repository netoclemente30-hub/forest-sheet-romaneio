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
  for (const item of await deps.listarFila()) {
    const op = item.op;
    if (op.tipo !== "aguardando_insert" || item.envio_iniciado) continue;
    const id = String(op.dados["id"] ?? "");
    const alvo = rest.get(id);
    if (!alvo || op.dados['empresa_id'] !== alvo.empresa_id) continue;
    await deps.reescrever(item.id, { ...op, dados: { ...op.dados, etiqueta_impressa: imprimiu, etiqueta_impressa_em: em } });
    rest.delete(id);
  }

  const restantes = [...rest.values()];
  if (!restantes.length) return { offline: 0 };

  // 3) Sem internet: cada marcação entra na fila, com a auditoria do momento.
  for (const t of restantes) {
    const log = await deps.capturar(acao(imprimiu), `${codigoAguardando(t.numero)} · ${t.especie}`);
    await deps.enfileirar({ tipo: "aguardando_impressa", id: t.id, empresa_id: t.empresa_id, imprimiu, log });
  }
  return { offline: restantes.length };
}

/** Campos editáveis de uma tora não identificada (identidade, número e empresa ficam). */
export type EdicaoAguardando = Pick<ToraAguardando, "especie" | "nome_cientifico" | "d_topo1" | "d_topo2" | "d_pe1" | "d_pe2" | "comprimento" | "volume">;

export type EditarAguardandoDeps = Pick<MarcaImpressaDeps, "listarFila" | "online" | "capturar" | "gravarLog" | "reescrever" | "enfileirar"> & {
  atualizar: (t: AlvoImpressa, dados: EdicaoAguardando) => Promise<void>;
};

function depsEditar(): EditarAguardandoDeps {
  const { gravar: _g, ...base } = depsApp();
  return {
    ...base,
    atualizar: async (t, dados) => {
      const { error } = await supabase.from("toras_aguardando").update(dados as never).eq("id", t.id).eq("empresa_id", t.empresa_id);
      if (error) throw new Error(error.message);
    },
  };
}

/**
 * Edita medidas/espécie mantendo id, empresa e número NI. Lançamento ainda na
 * fila é corrigido no próprio item (sem criar outro); online grava direto;
 * offline enfileira a edição com a auditoria do momento.
 */
export async function editarAguardando(
  t: AlvoImpressa,
  dados: EdicaoAguardando,
  detalhe: string,
  deps: EditarAguardandoDeps = depsEditar(),
): Promise<{ offline: boolean }> {
  const acaoEd = "Tora não identificada editada";
  for (const item of await deps.listarFila()) {
    const op = item.op;
    if (op.tipo === "aguardando_insert" && !item.envio_iniciado && op.dados['empresa_id'] === t.empresa_id && String(op.dados["id"] ?? "") === t.id) {
      await deps.reescrever(item.id, { ...op, dados: { ...op.dados, ...dados } });
      return { offline: true };
    }
  }
  await deps.enfileirar({ tipo: "aguardando_update", id: t.id, empresa_id: t.empresa_id, dados: { ...dados, numero: t.numero }, log: await deps.capturar(acaoEd, detalhe) });
  return { offline: true };
}
