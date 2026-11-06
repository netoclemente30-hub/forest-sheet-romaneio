import { describe, it, expect } from "vitest";
import { gerarEtiquetasPdf, tamanhoValido } from "./etiqueta-pdf";

const tora = { plaqueta: 11, arvore: 5, secao: "A", especie: "Mandioqueira", nome_cientifico: "Qualea albiflora", autex: "123", d_topo1: 70, d_topo2: 68, d_pe1: 72, d_pe2: 70, comprimento: 7.6, volume: 3.1234 } as never;

describe("etiqueta no tamanho escolhido", () => {
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
