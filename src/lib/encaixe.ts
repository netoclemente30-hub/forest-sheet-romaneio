import type { LinhaSaldo } from "./saldo";
import { volumeTora } from "./volume";

export const CAMPOS_ENCAIXE = ["d_topo1", "d_topo2", "d_pe1", "d_pe2", "comprimento"] as const;
export type MedidasEncaixe = Record<(typeof CAMPOS_ENCAIXE)[number], string>;
const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();

export function volumeEncaixe(medidas: MedidasEncaixe): number | null {
  const valores = CAMPOS_ENCAIXE.map((k) => Number(medidas[k].trim().replace(",", ".")));
  if (valores.some((v) => !Number.isFinite(v) || v <= 0)) return null;
  return volumeTora({ d_topo1: valores[0] ?? null, d_topo2: valores[1] ?? null, d_pe1: valores[2] ?? null, d_pe2: valores[3] ?? null, comprimento: valores[4] ?? null });
}

export function nomesCientificosEncaixe(linhas: LinhaSaldo[]): string[] {
  const nomes = new Map<string, string>();
  for (const linha of linhas) {
    const nome = linha.nome_cientifico.trim();
    if (nome && !nomes.has(normalizar(nome))) nomes.set(normalizar(nome), nome);
  }
  return [...nomes.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Sugestões, não identificação automática: compara apenas volumes da mesma espécie científica. */
export function encaixarToras(linhas: LinhaSaldo[], nome: string, volume: number | null) {
  if (!normalizar(nome) || volume === null || !Number.isFinite(volume) || volume <= 0) return [];
  return linhas.flatMap((linha, indice) => {
    if (normalizar(linha.nome_cientifico) !== normalizar(nome) || linha.arvore === null || linha.volume === null || !Number.isFinite(linha.volume) || linha.volume <= 0) return [];
    const diferenca = Math.round((linha.volume - volume) * 10000) / 10000;
    return [{ linha, indice, diferenca, distancia: Math.abs(diferenca) }];
  }).sort((a, b) => a.distancia - b.distancia || (a.linha.arvore ?? 0) - (b.linha.arvore ?? 0) || a.linha.secao.localeCompare(b.linha.secao, "pt-BR") || a.linha.autex.localeCompare(b.linha.autex, "pt-BR") || a.indice - b.indice);
}