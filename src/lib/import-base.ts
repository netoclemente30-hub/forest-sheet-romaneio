const n = (v: unknown) => v === null || v === undefined || String(v).trim() === "" || !Number.isFinite(Number(String(v).replace(",", "."))) ? null : Number(String(v).replace(",", "."));

export function lerBase(rows: unknown[][]) {
  const arvores = new Map<number, { numero: number; nome_vulgar: string; nome_cientifico: string | null; cap: number | null; dap: number | null; altura: number | null; volume: number | null; categoria: string | null; picada: string | null }>();
  let picada: string | null = null;
  for (const r of rows) {
    const a = r[0];
    if (typeof a === "string" && a.toLowerCase().startsWith("picada")) picada = a.split(":")[1]?.trim() ?? a;
    const numero = n(a);
    if (numero !== null && Number.isSafeInteger(numero) && numero > 0 && r[1]) {
      arvores.set(numero, { numero, nome_vulgar: String(r[1]), cap: n(r[2]), dap: n(r[3]), altura: n(r[4]), volume: n(r[5]), categoria: r[6] ? String(r[6]) : null, picada: r[7] ? String(r[7]) : picada, nome_cientifico: r[8] ? String(r[8]) : null });
    }
  }
  return arvores;
}