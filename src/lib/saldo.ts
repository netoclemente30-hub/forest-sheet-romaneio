export type LinhaSaldo = { autex: string; arvore: number | null; secao: string; especie: string; nome_cientifico: string; volume: number | null };
type ToraMin = { plaqueta: number; arvore: number; secao: string | null; autex: string | null };

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const num = (v: unknown) => { const x = Number(String(v ?? "").replace(",", ".")); return String(v ?? "").trim() && Number.isFinite(x) ? x : null; };
/** AUTEX sem o prefixo "AUTEX-" para comparar "AUTEX-2011.2..." com "2011.2...". */
const autexBase = (s: unknown) => norm(s).replace(/^autex[\s:-]*/, "");

/** "AUTEX-2011.2.2026.10587-1861-B" → AUTEX, árvore e secção. */
export function lerCodigoRastreio(c: unknown) {
  const m = String(c ?? "").trim().match(/^(.*?)-(\d+)(?:P\d+)?(?:-([A-Za-z0-9]+))?$/i);
  return m ? { autex: m[1]!.trim(), arvore: Number(m[2]), secao: (m[3] ?? "").toUpperCase() } : null;
}

/** Lê a planilha de saldo procurando as colunas pelo nome do cabeçalho. */
export function lerSaldo(rows: unknown[][]): LinhaSaldo[] {
  const hi = rows.findIndex((r) => r.some((c) => norm(c).includes("arv") || norm(c).includes("rastreio")));
  if (hi < 0) throw new Error("Não achei a coluna da árvore ou do código de rastreio no cabeçalho");
  const h = (rows[hi] ?? []).map(norm);
  const col = (...k: string[]) => h.findIndex((c) => k.some((x) => c.includes(x)));
  const cient = col("cientif");
  const ci = { autex: col("autex", "autoriz"), arvore: col("arv"), secao: col("sec"), rastreio: col("rastreio"), volume: col("vol", "quant"), especie: h.findIndex((c, i) => i !== cient && (c.includes("especie") || c.includes("vulgar") || c.includes("popular"))) };
  return rows.slice(hi + 1).filter((r) => r.some((c) => String(c ?? "").trim())).map((r) => {
    const cod = ci.rastreio >= 0 ? lerCodigoRastreio(r[ci.rastreio]) : null;
    return {
      autex: cod?.autex ?? String(r[ci.autex] ?? "").trim(),
      arvore: cod?.arvore ?? num(r[ci.arvore]),
      secao: cod?.secao ?? String(r[ci.secao] ?? "").trim().toUpperCase(),
      especie: String(r[ci.especie] ?? "").trim(),
      nome_cientifico: String(r[cient] ?? "").trim(),
      volume: num(r[ci.volume]),
    };
  }).filter((l) => l.arvore !== null);
}

/** Casa cada linha com uma tora (AUTEX + árvore + secção); sem tora = fora de estoque. */
export function conferirSaldo<T extends ToraMin>(linhas: LinhaSaldo[], toras: T[]) {
  const chave = (arvore: number | null, secao: unknown) => JSON.stringify([arvore, norm(secao)]);
  const porSecao = new Map<string, T[]>();
  const porAutex = new Map<string, T[]>();
  for (const tora of toras) {
    const secao = chave(tora.arvore, tora.secao);
    const autex = JSON.stringify([secao, autexBase(tora.autex)]);
    for (const [indice, key] of [[porSecao, secao], [porAutex, autex]] as const) {
      const grupo = indice.get(key);
      if (grupo) grupo.push(tora);
      else indice.set(key, [tora]);
    }
  }
  const usadas = new Set<number>();
  const posicoes = new Map<T[], number>();
  return linhas.map((l) => {
    const secao = chave(l.arvore, l.secao);
    const grupo = l.autex ? porAutex.get(JSON.stringify([secao, autexBase(l.autex)])) : porSecao.get(secao);
    let posicao = grupo ? posicoes.get(grupo) ?? 0 : 0;
    while (grupo?.[posicao] && usadas.has(grupo[posicao]?.plaqueta ?? -1)) posicao++;
    const t = grupo?.[posicao];
    if (grupo) posicoes.set(grupo, posicao + 1);
    if (t) usadas.add(t.plaqueta);
    return { linha: l, tora: t ?? null };
  });
}

/** Monta as toras fora de estoque com plaquetas em sequência, pulando números já usados. */
export function novasTorasDoSaldo(fora: LinhaSaldo[], inicio: number, usadas: Set<number>) {
  let p = inicio;
  return fora.map((l) => {
    while (usadas.has(p)) p++;
    const plaqueta = p++;
    return { plaqueta, arvore: l.arvore!, secao: l.secao || null, autex: l.autex || null, especie: l.especie || null, nome_cientifico: l.nome_cientifico || null, volume: l.volume ?? 0 };
  });
}
