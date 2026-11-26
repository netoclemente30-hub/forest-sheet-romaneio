export type LinhaCarga = { especie: string; produto: string; autorizacao: string; pecas: number; volume: number };

export function consolidarCarga(linhas: LinhaCarga[]) {
  const agrupadas = new Map<string, LinhaCarga>();
  for (const linha of linhas) {
    const key = JSON.stringify([linha.especie, linha.produto, linha.autorizacao].map(v => v.trim().toLocaleLowerCase("pt-BR")));
    const atual = agrupadas.get(key);
    if (atual) {
      atual.pecas += linha.pecas;
      atual.volume += linha.volume;
    } else agrupadas.set(key, { ...linha });
  }
  return [...agrupadas.values()].sort((a, b) =>
    a.especie.localeCompare(b.especie, "pt-BR") || a.produto.localeCompare(b.produto, "pt-BR") || a.autorizacao.localeCompare(b.autorizacao, "pt-BR"));
}
