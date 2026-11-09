export function numeroInventario(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").trim().replace(/\s/g, "");
  if (!s || !/^[+-]?[\d.,]+$/.test(s)) return null;
  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else s = s.replace(",", ".");
  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

export const normalizarColuna = (v: unknown) => String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export type ArvoreBase = { numero: number; nome_vulgar: string; nome_cientifico: string | null; autex: string; cap: number | null; dap: number | null; altura: number | null; volume: number | null; categoria: string | null; picada: string | null; latitude: number | null; longitude: number | null };

type Campo = keyof ArvoreBase;
const aliases: Record<Campo, string[]> = {
  numero: ["n", "no", "numero", "num", "nro", "narvore", "noarvore", "numeroarvore", "numerodaarvore", "arvore", "id", "plaqueta"],
  nome_vulgar: ["nomevulgar", "nomepopular", "especie", "madeira", "nomecomum", "especiepopular"],
  nome_cientifico: ["nomecientifico", "cientifico", "especiecientifica"],
  cap: ["cap", "capcm", "circunferencia", "circunferenciacm", "circunferenciaaalturadopeito"],
  dap: ["dap", "dapcm", "diametro", "diametrocm", "diametroaalturadopeito"],
  altura: ["altura", "alturam", "h", "hm", "hc", "hcm", "alturacomercial", "alturacomercialm", "alturatotal", "alturatotalm"],
  volume: ["volume", "vol", "volumem3", "volm3", "vm3", "volumecomercial", "volumecomercialm3"],
  categoria: ["categoria", "classe", "classificacao", "situacao", "destinacao"],
  picada: ["picada", "faixa", "linha", "trilha"],
  autex: ["autex", "numeroautex", "autorizacao", "autorizacaodeexploracao"],
};
export function campoInventario(v: unknown): Campo | undefined {
  const key = normalizarColuna(v);
  return (Object.keys(aliases) as Campo[]).find((campo) => aliases[campo].includes(key));
}
const original: Partial<Record<Campo, number>> = { numero: 0, nome_vulgar: 1, cap: 2, dap: 3, altura: 4, volume: 5, categoria: 6, picada: 7, nome_cientifico: 8, autex: 9 };

/** Chave única da árvore: o mesmo número pode existir em AUTEX diferentes. */
export const chaveArvore = (numero: number, autex: string | null | undefined) => `${numero}|${(autex ?? "").trim()}`;

export function lerBase(rows: unknown[][]) {
  return analisarBase(rows).arvores;
}

export function analisarBase(rows: unknown[][]) {
  const arvores = new Map<string, ArvoreBase>();
  let picada: string | null = null;
  let colunas = original;
  let invalidas = 0;
  let repetidas = 0;
  for (const r of rows) {
    const marcacao = r.map((c) => String(c ?? "").match(/^\s*(?:picada|faixa|trilha)\s*[:\-]\s*(.+)$/i)).find(Boolean);
    if (marcacao?.[1]) { picada = marcacao[1].trim(); continue; }
    const header: Partial<Record<Campo, number>> = {};
    r.forEach((cell, index) => { const campo = campoInventario(cell); if (campo) header[campo] = index; });
    if (header.numero !== undefined && header.nome_vulgar !== undefined) {
      if (Object.keys(header).length >= 3) colunas = header;
      continue;
    }
    const cell = (campo: Campo) => { const i = colunas[campo]; return i === undefined ? undefined : r[i]; };
    const text = (campo: Campo) => String(cell(campo) ?? "").trim();
    const numero = numeroInventario(cell("numero"));
    if (numero === null) continue;
    if (!Number.isSafeInteger(numero) || numero <= 0 || !text("nome_vulgar")) { invalidas++; continue; }
    const cap = numeroInventario(cell("cap"));
    const dap = numeroInventario(cell("dap")) ?? (cap !== null && cap > 0 ? cap / Math.PI : null);
    const autex = text("autex");
    const key = chaveArvore(numero, autex);
    if (arvores.has(key)) repetidas++;
    arvores.set(key, { numero, nome_vulgar: text("nome_vulgar"), cap, dap, altura: numeroInventario(cell("altura")), volume: numeroInventario(cell("volume")), categoria: text("categoria") || null, picada: text("picada") || picada, nome_cientifico: text("nome_cientifico") || null, autex });
  }
  return { arvores, invalidas, repetidas };
}
