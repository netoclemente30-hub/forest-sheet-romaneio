export type LinhaSaldo = { autex: string; arvore: number | null; secao: string; especie: string; nome_cientifico: string; volume: number | null };
type ToraMin = { plaqueta: number; arvore: number; secao: string | null; autex: string | null };

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const num = (v: unknown) => { const x = Number(String(v ?? "").replace(",", ".")); return String(v ?? "").trim() && Number.isFinite(x) ? x : null; };

/** Lê a planilha de saldo procurando as colunas pelo nome do cabeçalho. */
export function lerSaldo(rows: unknown[][]): LinhaSaldo[] {
  const hi = rows.findIndex((r) => r.some((c) => norm(c).includes("arv")));
  if (hi < 0) throw new Error("Não achei a coluna da árvore no cabeçalho");
  const h = (rows[hi] ?? []).map(norm);
  const col = (...k: string[]) => h.findIndex((c) => k.some((x) => c.includes(x)));
  const ci = { autex: col("autex", "autoriz"), arvore: col("arv"), secao: col("sec"), cient: col("cientif"), volume: col("vol"), especie: h.findIndex((c, i) => (c.includes("especie") || c.includes("vulgar") || c === "nome") && i !== col("cientif")) };
  return rows.slice(hi + 1).filter((r) => r.some((c) => String(c ?? "").trim())).map((r) => ({
    autex: String(r[ci.autex] ?? "").trim(),
    arvore: num(r[ci.arvore]),
    secao: String(r[ci.secao] ?? "").trim().toUpperCase(),
    especie: String(r[ci.especie] ?? "").trim(),
    nome_cientifico: String(r[ci.cient] ?? "").trim(),
    volume: num(r[ci.volume]),
  })).filter((l) => l.arvore !== null);
}

/** Casa cada linha com uma tora (AUTEX + árvore + secção); sem tora = fora de estoque. */
export function conferirSaldo<T extends ToraMin>(linhas: LinhaSaldo[], toras: T[]) {
  const usadas = new Set<number>();
  return linhas.map((l) => {
    const t = toras.find((x) => !usadas.has(x.plaqueta) && x.arvore === l.arvore && norm(x.secao) === norm(l.secao) && (!l.autex || norm(x.autex) === norm(l.autex)));
    if (t) usadas.add(t.plaqueta);
    return { linha: l, tora: t ?? null };
  });
}
