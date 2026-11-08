// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ordenarToras, resumoPorAutex, resumoPorEspecie, exportarExcel, exportarPdf, exportarSinaflor } from "./relatorio";
import type { Tora } from "./data";
const t = (plaqueta: number, especie: string, volume: number) => ({ plaqueta, especie, volume }) as unknown as Tora;
const lista = [t(5, "Ipê", 1), t(12, "Angelim", 3), t(8, "Cumaru", 2)];
it("prepara Excel com toras e resumos antes do clique para salvar", async () => {
  const arquivo = await exportarExcel(lista);
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await arquivo.blob.arrayBuffer(), { type: "array" });
  expect(arquivo.nome).toMatch(/\.xlsx$/);
  expect(arquivo.blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  expect(wb.SheetNames).toEqual(["Toras", "Por AUTEX", "Por espécie"]);
  const sheet = wb.Sheets["Toras"];
  if (!sheet) throw new Error("Planilha Toras ausente");
  expect(XLSX.utils.sheet_to_json(sheet).length).toBe(4);
});
it("prepara PDF válido antes do clique para salvar", async () => {
  const arquivo = await exportarPdf(lista, "Toras");
  expect(arquivo.blob.type).toBe("application/pdf");
  expect(arquivo.nome).toMatch(/\.pdf$/);
  expect(await arquivo.blob.slice(0, 5).text()).toBe("%PDF-");
});
it("prepara arquivo SINAFLOR com as quatro colunas de medidas", async () => {
  const arquivo = await exportarSinaflor([{ ...lista[0], arvore: 11, d_topo1: 73, d_topo2: 68, d_pe1: 67, d_pe2: 62, comprimento: 7.6 } as Tora]);
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await arquivo.blob.arrayBuffer(), { type: "array" });
  const sheet = wb.Sheets["Repique SINAFLOR"];
  if (!sheet) throw new Error("Planilha SINAFLOR ausente");
  expect(XLSX.utils.sheet_to_json(sheet, { header: 1 })[1]).toEqual([11, 0.705, 0.645, 7.6]);
});
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
it2("resumo por espécie: agrupa qtd e volume com nome científico", () => {
  const a = { especie: "Cupiúba", nome_cientifico: "Goupia glabra", volume: 2 } as unknown as Tora;
  const b = { especie: "Cupiúba", nome_cientifico: "Goupia glabra", volume: 1.5 } as unknown as Tora;
  const c = { especie: "Abiurana", nome_cientifico: "Pouteria macrophylla", volume: 1 } as unknown as Tora;
  ex2(resumoPorEspecie([a, b, c])).toEqual([
    { especie: "Abiurana", cientifico: "Pouteria macrophylla", qtd: 1, volume: 1 },
    { especie: "Cupiúba", cientifico: "Goupia glabra", qtd: 2, volume: 3.5 },
  ]);
});
