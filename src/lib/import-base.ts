const n = (v: unknown) => v === null || v === undefined || String(v).trim() === "" || !Number.isFinite(Number(String(v).replace(",", "."))) ? null : Number(String(v).replace(",", "."));

export type ArvoreBase = { numero: number; nome_vulgar: string; nome_cientifico: string | null; autex: string; cap: number | null; dap: number | null; altura: number | null; volume: number | null; categoria: string | null; picada: string | null };

/** Chave única da árvore: o mesmo número pode existir em AUTEX diferentes. */
export const chaveArvore = (numero: number, autex: string | null | undefined) => `${numero}|${(autex ?? "").trim()}`;

export function lerBase(rows: unknown[][]) {
  const arvores = new Map<string, ArvoreBase>();
  let picada: string | null = null;
  for (const r of rows) {
    const a = r[0];
    if (typeof a === "string" && a.toLowerCase().startsWith("picada")) picada = a.split(":")[1]?.trim() ?? a;
    const numero = n(a);
    if (numero !== null && Number.isSafeInteger(numero) && numero > 0 && r[1]) {
      const autex = r[9] !== null && r[9] !== undefined ? String(r[9]).trim() : "";
      arvores.set(chaveArvore(numero, autex), { numero, nome_vulgar: String(r[1]), cap: n(r[2]), dap: n(r[3]), altura: n(r[4]), volume: n(r[5]), categoria: r[6] ? String(r[6]) : null, picada: r[7] ? String(r[7]) : picada, nome_cientifico: r[8] ? String(r[8]) : null, autex });
    }
  }
  return arvores;
}
