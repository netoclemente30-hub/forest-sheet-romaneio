import { describe, it, expect } from "vitest";
import { gerarEtiquetasPdf, ordenarEtiquetasPorLancamento, tamanhoValido } from "./etiqueta-pdf";

const tora = { plaqueta: 11, arvore: 5, secao: "A", especie: "Mandioqueira", nome_cientifico: "Qualea albiflora", autex: "123", d_topo1: 70, d_topo2: 68, d_pe1: 72, d_pe2: 70, comprimento: 7.6, volume: 3.1234 } as never;

describe("etiqueta no tamanho escolhido", () => {
  it("imprime primeiro o lançamento mais antigo, independentemente da seleção e do número", () => {
    const selecionadas = [
      { plaqueta: 1, created_at: "2026-11-07T15:10:00Z" },
      { plaqueta: 90, created_at: "2026-11-07T15:06:00Z" },
      { plaqueta: 20, created_at: "2026-11-07T15:08:00Z" },
    ];
    expect(ordenarEtiquetasPorLancamento(selecionadas).map(t => t.plaqueta)).toEqual([90, 20, 1]);
    expect(selecionadas.map(t => t.plaqueta)).toEqual([1, 90, 20]);
  });
  it("cada página tem exatamente o tamanho da etiqueta", async () => {
    const doc = await gerarEtiquetasPdf([tora, tora], { largura: 100, altura: 50 });
    expect(doc.getNumberOfPages()).toBe(2);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(100, 1);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(50, 1);
  });
  it("recusa tamanhos fora de 25–300 mm", () => {
    expect(tamanhoValido({ largura: 20, altura: 50 })).toBe(false);
    expect(tamanhoValido({ largura: 100, altura: 70 })).toBe(true);
  });
});
