// Cubagem de Smalian, igual à planilha Calculos_Inventario:
// D médio (m) = média dos dois diâmetros (cm) / 100; volume = média das áreas das pontas × comprimento.
export function diametroMedio(d1?: number | null, d2?: number | null): number {
  if (!d1 || !d2) return 0;
  return (d1 + d2) / 2 / 100;
}

export function volumeTora(t: {
  d_topo1?: number | null;
  d_topo2?: number | null;
  d_pe1?: number | null;
  d_pe2?: number | null;
  comprimento?: number | null;
}): number {
  const dt = diametroMedio(t.d_topo1, t.d_topo2);
  const dp = diametroMedio(t.d_pe1, t.d_pe2);
  const area = (d: number) => Math.PI * (d / 2) ** 2;
  const v = ((area(dt) + area(dp)) / 2) * (t.comprimento ?? 0);
  return Math.round(v * 10000) / 10000;
}

export const fmtM3 = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
