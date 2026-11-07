import { describe, expect, it } from "vitest";
import { toraDuplicada } from "./tora-duplicidade";

const tora = { plaqueta: 5009, arvore: 1861, secao: "B", autex: "AUTEX-2011.2.2026.10587", empresa_id: "rj" };
describe("duplicidade da tora 1861-B", () => {
  it("bloqueia a árvore e secção com a AUTEX que veio do saldo", () => {
    expect(toraDuplicada([tora], { ...tora, secao: " b " })).toEqual(tora);
  });
  it("reconhece a mesma AUTEX com ou sem o prefixo do saldo", () => {
    expect(toraDuplicada([tora], { ...tora, autex: "2011.2.2026.10587" })).toEqual(tora);
  });
  it("permite a mesma árvore e secção de outra AUTEX", () => {
    expect(toraDuplicada([tora], { ...tora, autex: "2011.2.2026.99999" })).toBeUndefined();
  });
  it("permite a mesma árvore e secção de outra empresa", () => {
    expect(toraDuplicada([tora], { ...tora, empresa_id: "outra" })).toBeUndefined();
  });
  it("permite completar medidas da própria tora do saldo", () => {
    expect(toraDuplicada([tora], tora, 5009)).toBeUndefined();
  });
});