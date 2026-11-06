import { describe, expect, it } from "vitest";
import { ordenarRomaneio } from "./historico.$id";
import type { Tora } from "@/lib/data";

const tora = (plaqueta: number, especie: string, arvore: number, secao: string): Tora =>
  ({ plaqueta, especie, arvore, secao }) as Tora;

describe("ordenarRomaneio", () => {
  it("ordena por espécie (A→Z), depois árvore, depois secção", () => {
    const lista = ordenarRomaneio([
      tora(3, "Mandioqueira", 5, "B"),
      tora(1, "Cupiúba", 8, "A"),
      tora(2, "Mandioqueira", 5, "A"),
      tora(4, "Mandioqueira", 2, "A"),
    ]);
    expect(lista.map((t) => t.plaqueta)).toEqual([1, 4, 2, 3]);
  });

  it("não altera a lista original", () => {
    const original = [tora(2, "B", 1, "A"), tora(1, "A", 1, "A")];
    ordenarRomaneio(original);
    expect(original[0]?.plaqueta).toBe(2);
  });
});
