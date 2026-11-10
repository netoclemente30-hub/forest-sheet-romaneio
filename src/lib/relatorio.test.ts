import { describe, expect, it } from "vitest";
import { ordenarToras, resumoPorAutex, resumoPorEspecie, exportarExcel, exportarPdf, exportarSinaflor, dadosPdfToras } from "./relatorio";
import type { Tora } from "./data";
const t = (plaqueta: number, especie: string, volume: number) => ({ plaqueta, especie, volume }) as unknown as Tora;
const lista = [t(5, "Ipê", 1), t(12, "Angelim", 3), t(8, "Cumaru", 2)];
const medidaExemplo = { ...t(1, "Ipê", 1.685), arvore: 349, secao: "A", autex: "AUTEX-1", d_topo1: 52, d_topo2: 54, d_pe1: 56, d_pe2: 58, comprimento: 6.6 } as Tora;
describe("medidas do PDF de toras", () => {
  it("comercial exporta a ponta menor 52×54, comprimento 6,5 e volume 1,4340", () => {
    const dados = dadosPdfToras([medidaExemplo], "comercial");
    expect(dados.body[0]?.slice(4, 8)).toEqual(["52", "54", "6,5", "1,4340"]);
    expect(medidaExemplo.comprimento).toBe(6.6);
    expect(medidaExemplo.volume).toBe(1.685);
  });
  it.each([[6.9, "6,5"], [6.1, "6,0"]])("comercial arredonda %s para %s no relatório", (comprimento, esperado) => {
    expect(dadosPdfToras([{ ...medidaExemplo, comprimento }], "comercial").body[0]?.[6]).toBe(esperado);
  });
  it("totais comercial, AUTEX e espécie somam somente volumes comerciais", () => {
    const dados = dadosPdfToras([medidaExemplo, { ...medidaExemplo, plaqueta: 2 }], "comercial");
    expect(dados.total).toBeCloseTo(2.868, 4);
    expect(dados.foot[7]).toBe("2,8680");
    expect(dados.porAutex[0]?.volume).toBeCloseTo(2.868, 4);
    expect(dados.porEspecie[0]?.volume).toBeCloseTo(2.868, 4);
  });
  it("físico mantém quatro diâmetros, comprimento original e totais físicos", () => {
    const dados = dadosPdfToras([medidaExemplo]);
    expect(dados.body[0]?.slice(4, 10)).toEqual(["52", "54", "56", "58", "6.6", "1,6850"]);
    expect(dados.total).toBe(1.685);
    expect(dados.foot[9]).toBe("1,6850");
    expect(dados.porAutex[0]?.volume).toBe(1.685);
    expect(dados.porEspecie[0]?.volume).toBe(1.685);
  });
});
const bytes = (blob: Blob) => new Promise<ArrayBuffer>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error("Arquivo inválido"));
  reader.onerror = () => reject(reader.error);
  reader.readAsArrayBuffer(blob);
});
it("prepara Excel com toras e resumos antes do clique para salvar", async () => {
  const arquivo = await exportarExcel(lista);
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await bytes(arquivo.blob), { type: "array" });
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
  expect(new TextDecoder().decode(await bytes(arquivo.blob.slice(0, 5)))).toBe("%PDF-");
});
it("prepara arquivo SINAFLOR com as quatro colunas de medidas", async () => {
  const arquivo = await exportarSinaflor([{ ...lista[0], arvore: 11, d_topo1: 73, d_topo2: 68, d_pe1: 67, d_pe2: 62, comprimento: 7.6 } as Tora]);
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await bytes(arquivo.blob), { type: "array" });
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

import { resumoWhatsappToras } from "./relatorio";
describe("resumo de toras para o WhatsApp", () => {
  it("traz título, contagem, total e espécies na medida física", () => {
    const texto = resumoWhatsappToras(lista, "Pátio");
    expect(texto).toContain("*RELATÓRIO DE TORAS — PÁTIO*");
    expect(texto).toContain("MEDIDA FÍSICA");
    expect(texto).toContain("3 toras · 6,0000 m³");
    expect(texto).toContain("• Angelim: 1 tora · 3,0000 m³");
    expect(texto).toContain("• Cumaru: 1 tora · 2,0000 m³");
  });
  it("usa o volume comercial e avisa toras sem medidas", () => {
    const texto = resumoWhatsappToras([medidaExemplo, { ...medidaExemplo, plaqueta: 2 }, { ...medidaExemplo, plaqueta: 3, comprimento: null }], "Serraria", "comercial");
    expect(texto).toContain("MEDIDA COMERCIAL");
    expect(texto).toContain("3 toras · 2,8680 m³");
    expect(texto).toContain("1 tora(s) sem medidas completas");
  });
  it("corta em 12 espécies e aponta as restantes", () => {
    const muitas = Array.from({ length: 13 }, (_, i) => t(i + 1, `Espécie ${i + 1}`, 1));
    const texto = resumoWhatsappToras(muitas, "Pátio");
    expect(texto).toContain("… +1 outras espécies");
    expect(texto.split("• ").length - 1).toBe(12);
  });
});
