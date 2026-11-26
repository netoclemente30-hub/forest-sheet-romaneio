import { describe, expect, it } from "vitest";
import { consolidarCarga } from "./carga-consolidada";

describe("consolidação para expedição", () => {
  it("consolida apenas a mesma espécie, produto e autorização", () => {
    const linha = { especie: "Ipê", produto: "Viga", autorizacao: "001", pecas: 2, volume: 0.5 };
    expect(consolidarCarga([
      linha,
      { ...linha, especie: " IPÊ ", pecas: 3, volume: 0.75 },
      { ...linha, autorizacao: "002" },
      { ...linha, produto: "Ripa" },
    ])).toEqual([
      { ...linha, produto: "Ripa" },
      { ...linha, pecas: 5, volume: 1.25 },
      { ...linha, autorizacao: "002" },
    ]);
    expect(linha.volume).toBe(0.5);
  });
});
