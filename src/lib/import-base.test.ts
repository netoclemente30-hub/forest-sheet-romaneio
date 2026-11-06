import { expect, it } from "vitest";
import { lerBase, chaveArvore } from "./import-base";
it("importa modelo BASE com picada e nome científico sem cálculos", () => {
  expect([...lerBase([["Número", "Espécie"], [1, "Jatobá", 150, "47,75", 20, 3.1, "Comercial", "01", "Hymenaea courbaril"]]).values()]).toEqual([{ numero: 1, nome_vulgar: "Jatobá", cap: 150, dap: 47.75, altura: 20, volume: 3.1, categoria: "Comercial", picada: "01", nome_cientifico: "Hymenaea courbaril", autex: "" }]);
});
it("preserva formato original da BASE", () => expect(lerBase([["Picada: 02"], [2, "Ipê", 140, 44, 18, 2, "Comercial"]]).get(chaveArvore(2, ""))?.picada).toBe("02"));
it("mesmo número de árvore em AUTEX diferentes vira duas árvores", () => {
  const b = lerBase([[7, "Mandioqueiro", 1, 1, 1, 1, "C", "01", "Qualea", "AUTEX-1"], [7, "Mandioqueiro", 1, 1, 1, 1, "C", "01", "Qualea", "AUTEX-2"]]);
  expect(b.size).toBe(2);
  expect(b.get(chaveArvore(7, "AUTEX-2"))?.autex).toBe("AUTEX-2");
});
