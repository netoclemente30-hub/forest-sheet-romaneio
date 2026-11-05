import type { Tora } from "./data";

export function qrTora(t: Tora) {
  return JSON.stringify({ tipo: "tora", versao: 1, plaqueta: t.plaqueta, arvore: t.arvore, especie: t.especie, nome_cientifico: t.nome_cientifico, autex: t.autex, secao: t.secao, d_topo1: t.d_topo1, d_topo2: t.d_topo2, d_pe1: t.d_pe1, d_pe2: t.d_pe2, comprimento: t.comprimento, volume: Number(t.volume) });
}

export function plaquetaDoQr(raw: string): number | null {
  const text = raw.trim();
  if (/^\d+$/.test(text)) {
    const n = Number(text);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  }
  try {
    const data = JSON.parse(text);
    return data?.tipo === "tora" && data.versao === 1 && Number.isSafeInteger(data.plaqueta) && data.plaqueta > 0 ? data.plaqueta : null;
  } catch { return null; }
}

export function selecionarToras(selecionadas: number[], visiveis: number[], marcar: boolean) {
  return marcar ? [...new Set([...selecionadas, ...visiveis])] : selecionadas.filter((p) => !visiveis.includes(p));
}