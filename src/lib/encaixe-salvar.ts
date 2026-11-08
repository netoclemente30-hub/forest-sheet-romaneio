import type { Tora } from "./data";
import type { LinhaSaldo } from "./saldo";
import { CAMPOS_ENCAIXE, menorPlaquetaLivre, volumeEncaixe, type MedidasEncaixe } from "./encaixe";
import { avisoDuplicidade, toraDuplicada, type IdentidadeTora } from "./tora-duplicidade";
import type { ItemFila, Op } from "./offline/fila";
import type { LogCapturado } from "./registro";

export type SalvarEncaixeDeps = {
  listarFila: () => Promise<ItemFila[]>;
  online: () => boolean;
  lerInventario: () => Promise<Tora[]>;
  capturar: (acao: string, detalhe: string) => Promise<LogCapturado>;
  gravarLog: (log: LogCapturado) => Promise<void>;
  inserir: (tora: Tora) => Promise<void>;
  enfileirar: (op: Op) => Promise<unknown>;
};

export async function salvarEncaixe(linha: LinhaSaldo, medidas: MedidasEncaixe, empresa: string, toras: Tora[], deps: SalvarEncaixeDeps): Promise<Tora> {
  const volume = volumeEncaixe(medidas);
  if (!empresa || linha.arvore === null || !linha.autex.trim() || !linha.secao.trim() || volume === null) throw new Error("Confira AUTEX, árvore, secção e todas as medidas antes de salvar.");
  const inventario = deps.online() ? await deps.lerInventario() : toras;
  const itens = await deps.listarFila();
  const identidade = { empresa_id: empresa, arvore: linha.arvore, secao: linha.secao.trim().toUpperCase(), autex: linha.autex.trim() };
  const pendentes: IdentidadeTora[] = itens.flatMap(({ op }) => op.tipo === "tora_insert" ? [{ empresa_id: String(op.dados["empresa_id"] ?? ""), arvore: Number(op.dados["arvore"]), secao: String(op.dados["secao"] ?? ""), autex: String(op.dados["autex"] ?? ""), plaqueta: Number(op.dados["plaqueta"]) }] : []);
  const repetida = toraDuplicada([...inventario, ...pendentes], identidade);
  if (repetida) throw new Error(avisoDuplicidade(repetida));
  const plaqueta = menorPlaquetaLivre(inventario, itens, empresa);
  const log = await deps.capturar("Encaixe confirmado", `Plaqueta ${plaqueta} · ${linha.especie} · árvore ${linha.arvore} · secção ${identidade.secao} · AUTEX ${identidade.autex} · identidade escolhida pelo usuário · saldo ${linha.volume} m³ · medido ${volume} m³`);
  const valores = Object.fromEntries(CAMPOS_ENCAIXE.map((k) => [k, Number(medidas[k].trim().replace(",", "."))])) as Record<(typeof CAMPOS_ENCAIXE)[number], number>;
  const tora: Tora = { ...identidade, ...valores, plaqueta, volume, especie: linha.especie || null, nome_cientifico: linha.nome_cientifico || null, carregada: false, created_at: log.criado_em, romaneio_id: null, serrada_em: null, etiqueta_impressa_em: null };
  if (deps.online()) { await deps.inserir(tora); await deps.gravarLog(log); }
  else await deps.enfileirar({ tipo: "tora_insert", dados: tora, log });
  return tora;
}

/** Complete queued measurements can be printed before they reach the cloud. */
export function torasEtiquetasOffline(itens: ItemFila[], empresa: string | null): Tora[] {
  return itens.flatMap(({ op, criadoEm }) => {
    if (op.tipo !== "tora_insert" || !empresa || op.dados["empresa_id"] !== empresa) return [];
    const d = op.dados;
    const arvore = Number(d["arvore"]), plaqueta = Number(d["plaqueta"]), volume = Number(d["volume"]);
    if (!Number.isSafeInteger(arvore) || !Number.isSafeInteger(plaqueta) || plaqueta <= 0 || !Number.isFinite(volume)) return [];
    const n = (k: string) => typeof d[k] === "number" ? d[k] as number : null;
    const s = (k: string) => typeof d[k] === "string" ? d[k] as string : null;
    return [{ arvore, plaqueta, volume, empresa_id: empresa, autex: s("autex"), secao: s("secao"), especie: s("especie"), nome_cientifico: s("nome_cientifico"), d_topo1: n("d_topo1"), d_topo2: n("d_topo2"), d_pe1: n("d_pe1"), d_pe2: n("d_pe2"), comprimento: n("comprimento"), created_at: s("created_at") ?? new Date(criadoEm).toISOString(), carregada: false, romaneio_id: null, serrada_em: null, etiqueta_impressa_em: null }];
  });
}