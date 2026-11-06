export function resumoPorEspecie(itens: { especie: string | null; nome_cientifico?: string | null; volume: number | string }[]) {
  const m = new Map<string, { especie: string; nome_cientifico: string | null; qtd: number; volume: number }>();
  for (const t of itens) {
    const k = t.especie ?? "Não cadastrada";
    const r = m.get(k) ?? { especie: k, nome_cientifico: null, qtd: 0, volume: 0 };
    r.nome_cientifico ??= t.nome_cientifico ?? null;
    r.qtd++;
    r.volume += Number(t.volume);
    m.set(k, r);
  }
  return [...m.values()].sort((a, b) => a.especie.localeCompare(b.especie, "pt-BR"));
}
