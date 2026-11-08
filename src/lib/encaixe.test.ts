import { describe, expect, it } from "vitest";
import { encaixarToras, nomesCientificosEncaixe, volumeEncaixe } from "./encaixe";
import type { LinhaSaldo } from "./saldo";

const linha = (arvore: number, volume: number | null, nome_cientifico = "Pouteria macrophylla", autex = "AUTEX-2011.2.2026.10587"): LinhaSaldo => ({ arvore, volume, nome_cientifico, autex, secao: "B", especie: "Abiurana" });
describe("encaixe de toras", () => {
  it("calcula Smalian com as cinco medidas e aceita vírgula decimal", () => {
    expect(volumeEncaixe({ d_topo1: "73", d_topo2: "68", d_pe1: "67", d_pe2: "62", comprimento: "7,6" })).toBe(2.725);
  });
  it("não sugere volume com medidas incompletas ou inválidas", () => {
    for (const d_topo1 of ["", "0", "-3", "abc", "Infinity"]) expect(volumeEncaixe({ d_topo1, d_topo2: "68", d_pe1: "67", d_pe2: "62", comprimento: "7.6" })).toBeNull();
  });
  it("ordena por diferença absoluta, não pelo número da árvore", () => {
    const opcoes = encaixarToras([linha(10, 3), linha(1861, 2.0125), linha(20, 1.99)], "Pouteria macrophylla", 2);
    expect(opcoes.map((o) => o.linha.arvore)).toEqual([20, 1861, 10]);
    expect(opcoes.map((o) => o.diferenca)).toEqual([-0.01, 0.0125, 1]);
  });
  it("limita ao nome científico escolhido e ignora saldo sem volume válido", () => {
    expect(encaixarToras([linha(1, 2, "Qualea albiflora"), linha(2, null), linha(3, 0), linha(4, NaN), linha(1861, 2.0125, " POUTERIA   MACROPHYLLA ")], "Pouteria macrophylla", 2).map((o) => o.linha.arvore)).toEqual([1861]);
    expect(encaixarToras([linha(1, 2)], "", 2)).toEqual([]);
    expect(encaixarToras([linha(1, 2)], "Pouteria macrophylla", null)).toEqual([]);
  });
  it("preserva AUTEX, árvore e secção mesmo quando os números se repetem", () => {
    const opcoes = encaixarToras([linha(1861, 2.0125), linha(1861, 2.02, "Pouteria macrophylla", "AUTEX-OUTRA")], "Pouteria macrophylla", 2.0125);
    expect(opcoes.map((o) => [o.linha.autex, o.linha.arvore, o.linha.secao])).toEqual([["AUTEX-2011.2.2026.10587", 1861, "B"], ["AUTEX-OUTRA", 1861, "B"]]);
  });
  it("agrupa nomes científicos repetidos sem perder espécies diferentes", () => {
    expect(nomesCientificosEncaixe([linha(1, 2), linha(2, 2, " POUTERIA MACROPHYLLA "), linha(3, 2, "Qualea albiflora"), linha(4, 2, "")])).toEqual(["Pouteria macrophylla", "Qualea albiflora"]);
  });
});