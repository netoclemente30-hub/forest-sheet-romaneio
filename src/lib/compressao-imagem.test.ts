import { describe, expect, it } from "vitest";
import { dimensoesReduzidas } from "./compressao-imagem";

describe("dimensoesReduzidas", () => {
  it("reduz foto horizontal 4000x3000 para 1280x960", () => {
    expect(dimensoesReduzidas(4000, 3000)).toEqual({ largura: 1280, altura: 960 });
  });
  it("reduz foto vertical 3000x4000 para 960x1280", () => {
    expect(dimensoesReduzidas(3000, 4000)).toEqual({ largura: 960, altura: 1280 });
  });
  it("não amplia imagem menor que 1280", () => {
    expect(dimensoesReduzidas(800, 600)).toEqual({ largura: 800, altura: 600 });
  });
  it("mantém exatamente 1280", () => {
    expect(dimensoesReduzidas(1280, 720)).toEqual({ largura: 1280, altura: 720 });
  });
  it("dimensões inválidas retornam zero", () => {
    expect(dimensoesReduzidas(0, 500)).toEqual({ largura: 0, altura: 0 });
  });
});
