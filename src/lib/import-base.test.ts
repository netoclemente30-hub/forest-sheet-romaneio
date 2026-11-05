import { expect, it } from "vitest";
import { lerBase } from "./import-base";
it("importa modelo BASE com picada e nome científico sem cálculos", () => {
  expect([...lerBase([["Número", "Espécie"], [1, "Jatobá", 150, "47,75", 20, 3.1, "Comercial", "01", "Hymenaea courbaril"]]).values()]).toEqual([{ numero: 1, nome_vulgar: "Jatobá", cap: 150, dap: 47.75, altura: 20, volume: 3.1, categoria: "Comercial", picada: "01", nome_cientifico: "Hymenaea courbaril" }]);
});
it("preserva formato original da BASE", () => expect(lerBase([["Picada: 02"], [2, "Ipê", 140, 44, 18, 2, "Comercial"]]).get(2)?.picada).toBe("02"));