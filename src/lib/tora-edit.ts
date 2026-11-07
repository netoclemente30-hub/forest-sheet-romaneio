// Edição de uma tora já lançada: campos, validação e payload.
// Sem React e sem rede de propósito — a regra da secção repetida é testada aqui.

import type { Tora } from "./data";
import { volumeTora } from "./volume";
import { avisoDuplicidade, toraDuplicada } from "./tora-duplicidade";

export interface EdicaoTora {
  plaqueta: number;
  empresa_id: string;
  arvore: string;
  secao: string;
  especie: string;
  nome_cientifico: string;
  autex: string;
  volume: string;
  d_topo1: string;
  d_topo2: string;
  d_pe1: string;
  d_pe2: string;
  comprimento: string;
}

export const MEDIDAS = ["d_topo1", "d_topo2", "d_pe1", "d_pe2", "comprimento"] as const;

export const ROTULOS: Record<(typeof MEDIDAS)[number], string> = {
  d_topo1: "D. topo 1",
  d_topo2: "D. topo 2",
  d_pe1: "D. pé 1",
  d_pe2: "D. pé 2",
  comprimento: "Comprimento",
};

const txt = (v: string | number | null | undefined) => (v == null ? "" : String(v));

// "73,5" e "73.5" valem; campo vazio é null; texto sem número é NaN.
export const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

export function editarDe(t: Tora): EdicaoTora {
  return {
    plaqueta: t.plaqueta,
    empresa_id: t.empresa_id,
    arvore: txt(t.arvore),
    secao: txt(t.secao),
    especie: txt(t.especie),
    nome_cientifico: txt(t.nome_cientifico),
    autex: txt(t.autex),
    volume: txt(t.volume),
    d_topo1: txt(t.d_topo1),
    d_topo2: txt(t.d_topo2),
    d_pe1: txt(t.d_pe1),
    d_pe2: txt(t.d_pe2),
    comprimento: txt(t.comprimento),
  };
}

export function medidasDaEdicao(e: EdicaoTora) {
  return {
    d_topo1: num(e.d_topo1),
    d_topo2: num(e.d_topo2),
    d_pe1: num(e.d_pe1),
    d_pe2: num(e.d_pe2),
    comprimento: num(e.comprimento),
  };
}

// Volume de Smalian das medidas digitadas — 0 enquanto faltar qualquer uma,
// senão uma ponta faltante sairia pela metade do volume.
export function volumeMedido(e: EdicaoTora): number {
  const m = medidasDaEdicao(e);
  return MEDIDAS.every((k) => (m[k] ?? 0) > 0) ? volumeTora(m) : 0;
}

export function validarEdicao(e: EdicaoTora, toras: Tora[]): string | null {
  const arvore = num(e.arvore);
  if (arvore == null || !Number.isFinite(arvore) || arvore <= 0) return "Número da árvore precisa ser um número";
  const volume = num(e.volume);
  if (volume == null || !Number.isFinite(volume) || volume < 0) return "Volume precisa ser um número";
  for (const k of MEDIDAS) {
    const v = num(e[k]);
    if (v != null && (!Number.isFinite(v) || v <= 0)) return `${ROTULOS[k]} precisa ser um número maior que zero`;
  }
  const secao = e.secao.trim().toUpperCase();
  const autex = e.autex.trim();
  const rep = toraDuplicada(toras, { arvore, secao, autex, empresa_id: e.empresa_id }, e.plaqueta);
  if (rep) return avisoDuplicidade(rep);
  return null;
}

export function dadosDaEdicao(e: EdicaoTora) {
  return {
    arvore: Number(num(e.arvore)),
    secao: e.secao.trim().toUpperCase() || null,
    especie: e.especie.trim() || null,
    nome_cientifico: e.nome_cientifico.trim() || null,
    autex: e.autex.trim() || null,
    volume: Number(num(e.volume)),
    ...medidasDaEdicao(e),
  };
}
