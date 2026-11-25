import { avaliarCenso } from "./camadas";
import { distanciaMetros } from "./gis";
import { chaveArvore } from "./inventario";
import type { Estado } from "./projeto";

export function resumo(s: Estado, pid: string) {
  const arvores = avaliarCenso(s, pid);
  return s.uts
    .filter((u) => u.projetoId === pid)
    .flatMap((ut) =>
      s.especies
        .filter((e) => e.projetoId === pid)
        .map((e) => {
          const a = arvores.filter((a) => a.ut === ut.id && a.especieId === e.codigo);
          const sementes = a.filter((a) => a.destinacao === "PORTA_SEMENTE").length;
          return {
            ut: ut.nome,
            utId: ut.id,
            especie: e.nomePopular,
            codigo: e.codigo,
            total: a.length,
            areaBasal: a.reduce((v, a) => v + a.areaBasal, 0),
            volume: a.reduce((v, a) => v + a.volume, 0),
            corteHa:
              a.filter((a) => a.destinacao === "CORTE").reduce((v, a) => v + a.volume, 0) /
              ut.areaHa,
            percentual: a.length ? (100 * sementes) / a.length : 0,
            sementes,
          };
        }),
    )
    .filter((r) => r.total > 0);
}
export function sugerirSementes(s: Estado, pid: string) {
  const p = s.projetos.find((p) => p.id === pid);
  if (!p) throw new Error("Projeto ausente.");
  const a = avaliarCenso(s, pid),
    selecionadas = new Set<string>(),
    avisos: string[] = [];
  for (const r of resumo(s, pid)) {
    const grupo = a.filter((a) => a.ut === r.utId && a.especieId === r.codigo);
    const escolhidas = grupo.filter((a) => a.destinacao === "PORTA_SEMENTE");
    const candidatas = grupo
      .filter(
        (a) =>
          a.qualidadeFuste === 1 &&
          a.destinacao !== "PORTA_SEMENTE" &&
          a.destinacao !== "PROIBIDA_APP" &&
          !a.alertas.length,
      )
      .sort((a, b) => a.numeroArvore.localeCompare(b.numeroArvore, undefined, { numeric: true }));
    const alvo = Math.ceil((grupo.length * p.percentualSementes) / 100);
    while (escolhidas.length < alvo && candidatas.length) {
      let melhor = 0,
        dist = -1;
      candidatas.forEach((c, i) => {
        const d = escolhidas.length
          ? Math.min(...escolhidas.map((e) => distanciaMetros(c, e)))
          : c.dapCm;
        if (d > dist) {
          dist = d;
          melhor = i;
        }
      });
      const c = candidatas.splice(melhor, 1)[0]!;
      escolhidas.push(c);
      selecionadas.add(chaveArvore(c));
    }
    if (escolhidas.length < alvo)
      avisos.push(
        `${r.ut} / ${r.especie}: apenas ${escolhidas.length} matrizes elegíveis para meta ${alvo}.`,
      );
  }
  return { selecionadas, avisos };
}
