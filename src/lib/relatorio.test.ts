import { describe, expect, it } from "vitest";
import { ordenarToras, resumoPorAutex } from "./relatorio";
import type { Tora } from "./data";
const t = (plaqueta: number, especie: string, volume: number) => ({ plaqueta, especie, volume }) as unknown as Tora;
const lista = [t(5, "Ipê", 1), t(12, "Angelim", 3), t(8, "Cumaru", 2)];
describe("ordenarToras", () => {
  it("ordem numérica decrescente", () => expect(ordenarToras(lista, "plaqueta_desc").map((x) => x.plaqueta)).toEqual([12, 8, 5]));
  it("ordem alfabética", () => expect(ordenarToras(lista, "especie_asc").map((x) => x.especie)).toEqual(["Angelim", "Cumaru", "Ipê"]));
});
it("separa toras de mesma árvore e seção por AUTEX", () => {
  const a = { plaqueta: 1, arvore: 7, secao: "A", autex: "B-2", volume: 1 } as unknown as Tora;
  const b = { plaqueta: 2, arvore: 7, secao: "A", autex: "A-1", volume: 2 } as unknown as Tora;
  expect(ordenarToras([a, b], "autex").map((x) => x.autex)).toEqual(["A-1", "B-2"]);
  expect(resumoPorAutex([a, b]).map((r) => [r.autex, r.qtd])).toEqual([["A-1", 1], ["B-2", 1]]);
});

import { linhaSinaflor as ls } from "./relatorio";
import { it as it2, expect as ex2 } from "vitest";
it2("SINAFLOR: médias de topo e pé em metros", () => {
  ex2(ls({ arvore: 11, d_topo1: 73, d_topo2: 68, d_pe1: 67, d_pe2: 62, comprimento: 7.6 })).toEqual([11, 0.705, 0.645, 7.6]);
});
