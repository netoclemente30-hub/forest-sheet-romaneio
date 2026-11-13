import type { Tora } from "./data";

/** Endereço publicado: etiquetas impressas no preview também abrem a página pública definitiva. */
export const URL_PUBLICA = "https://forest-sheet-romaneio.lovable.app";

type IdentidadeQr = { plaqueta: number; arvore?: number; secao?: string; autex?: string };

/** Etiqueta com página pública quando a tora já tem código público (sincronizada); senão, o JSON interno. */
export function qrTora(t: Tora & { publico_id?: string | null }) {
  if (t.publico_id) {
    const q = new URLSearchParams({ p: String(t.plaqueta), a: String(t.arvore) });
    if (t.secao) q.set("s", t.secao);
    if (t.autex) q.set("x", t.autex);
    return `${URL_PUBLICA}/t/${t.publico_id}?${q}`;
  }
  return JSON.stringify({ tipo: "tora", versao: 1, plaqueta: t.plaqueta, arvore: t.arvore, especie: t.especie, nome_cientifico: t.nome_cientifico, autex: t.autex, secao: t.secao, d_topo1: t.d_topo1, d_topo2: t.d_topo2, d_pe1: t.d_pe1, d_pe2: t.d_pe2, comprimento: t.comprimento, volume: Number(t.volume) });
}

/** Lê a identidade impressa: plaqueta pura, JSON v1 ou link público. */
export function identidadeDoQr(raw: string): IdentidadeQr | null {
  const text = raw.trim();
  const ok = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) > 0;
  if (/^\d+$/.test(text)) { const n = Number(text); return ok(n) ? { plaqueta: n } : null; }
  if (/^https?:\/\//i.test(text)) {
    try {
      const u = new URL(text);
      if (!/^\/t\/[0-9a-f-]{36}\/?$/i.test(u.pathname)) return null;
      const p = Number(u.searchParams.get("p")); const a = Number(u.searchParams.get("a"));
      if (!ok(p) || !Number.isSafeInteger(a)) return null;
      return { plaqueta: p, arvore: a, secao: u.searchParams.get("s") ?? "", autex: u.searchParams.get("x") ?? "" };
    } catch { return null; }
  }
  try {
    const d = JSON.parse(text);
    if (d?.tipo !== "tora" || d.versao !== 1 || !ok(d.plaqueta)) return null;
    return { plaqueta: d.plaqueta, arvore: d.arvore, secao: d.secao ?? "", autex: d.autex ?? "" };
  } catch { return null; }
}

export function plaquetaDoQr(raw: string): number | null {
  return identidadeDoQr(raw)?.plaqueta ?? null;
}

export function selecionarToras(selecionadas: number[], visiveis: number[], marcar: boolean) {
  return marcar ? [...new Set([...selecionadas, ...visiveis])] : selecionadas.filter((p) => !visiveis.includes(p));
}
