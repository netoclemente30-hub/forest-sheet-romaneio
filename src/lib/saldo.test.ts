import { expect, it } from "vitest";
import { conferirSaldo, lerSaldo } from "./saldo";

const rows = [["AUTEX", "Nome científico", "Espécie", "Árvore", "Secção", "Volume"], ["A1", "Qualea", "Mandioqueira", 5, "a", "1,2"], ["A1", "Qualea", "Mandioqueira", 9, "B", 2]];
it("lê colunas pelo cabeçalho", () => expect(lerSaldo(rows)[0]).toEqual({ autex: "A1", nome_cientifico: "Qualea", especie: "Mandioqueira", arvore: 5, secao: "A", volume: 1.2 }));
it("tora sem cadastro fica fora de estoque", () => {
  const r = conferirSaldo(lerSaldo(rows), [{ plaqueta: 10, arvore: 5, secao: "A", autex: "A1" }]);
  expect(r[0]?.tora?.plaqueta).toBe(10);
  expect(r[1]?.tora).toBeNull();
});
