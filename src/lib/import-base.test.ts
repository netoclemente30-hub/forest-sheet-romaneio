import { expect, it } from "vitest";
import { lerBase, chaveArvore, numeroInventario } from "./import-base";
it("importa modelo BASE com picada e nome científico sem cálculos", () => {
  expect([...lerBase([["Número", "Espécie"], [1, "Jatobá", 150, "47,75", 20, 3.1, "Comercial", "01", "Hymenaea courbaril"]]).values()]).toEqual([{ numero: 1, nome_vulgar: "Jatobá", cap: 150, dap: 47.75, altura: 20, volume: 3.1, categoria: "Comercial", picada: "01", nome_cientifico: "Hymenaea courbaril", autex: "", latitude: null, longitude: null }]);
});
it("reconhece colunas reordenadas e calcula DAP do CAP quando faltar", () => {
  const a = [...lerBase([["Categoria", "Nome Popular", "Altura (m)", "Nº Árvore", "CAP (cm)", "Volume (m³)"], ["Explorável", "Sorva", "15", 1, "198", "3,2757"]]).values()][0];
  expect(a?.dap).toBeCloseTo(198 / Math.PI, 10);
  expect(a?.volume).toBe(3.2757);
  expect(a?.altura).toBe(15);
});
it("aceita números brasileiros e internacionais sem perder decimais", () => {
  expect(numeroInventario("1.234,56")).toBe(1234.56);
  expect(numeroInventario("1,234.56")).toBe(1234.56);
  expect(numeroInventario("3.2757")).toBe(3.2757);
  expect(numeroInventario("3,2757")).toBe(3.2757);
  expect(numeroInventario("abc")).toBeNull();
});
it("preserva DAP informado e picada com cabeçalhos repetidos e totais", () => {
  const rows = [["Picada: 03"], ["Nº", "Nome Vulgar", "CAP", "DAP", "Altura", "Volume", "Categoria"], [34, "Pequia", 224, 71, 13, "3,6335", "Explorável"], [null, null, null, null, null, "39,8378"], ["Ficha de Campo"], ["Nº", "Nome Vulgar", "CAP", "DAP", "Altura", "Volume", "Categoria"], [35, "Abiurana", 152, null, 16, "2,0592", "Remanescente"]];
  const arvores = lerBase(rows);
  expect(arvores.size).toBe(2);
  expect(arvores.get(chaveArvore(34, ""))?.dap).toBe(71);
  expect(arvores.get(chaveArvore(35, ""))?.picada).toBe("03");
});
it("preserva formato original da BASE", () => expect(lerBase([["Picada: 02"], [2, "Ipê", 140, 44, 18, 2, "Comercial"]]).get(chaveArvore(2, ""))?.picada).toBe("02"));
it("importa latitude e longitude quando a ficha já trouxer coordenadas", () => {
  const a = lerBase([["Nº", "Espécie", "Latitude", "Longitude"], [8, "Cedro", "-9,123456", "-63,654321"]]).get(chaveArvore(8, ""));
  expect(a?.latitude).toBe(-9.123456);
  expect(a?.longitude).toBe(-63.654321);
});
it("descarta coordenadas incompletas ou fora dos limites", () => {
  const a = lerBase([["Nº", "Espécie", "Latitude", "Longitude"], [8, "Cedro", "-91", "-63"]]).get(chaveArvore(8, ""));
  expect(a?.latitude).toBeNull();
  expect(a?.longitude).toBeNull();
});
it("mesmo número de árvore em AUTEX diferentes vira duas árvores", () => {
  const b = lerBase([[7, "Mandioqueiro", 1, 1, 1, 1, "C", "01", "Qualea", "AUTEX-1"], [7, "Mandioqueiro", 1, 1, 1, 1, "C", "01", "Qualea", "AUTEX-2"]]);
  expect(b.size).toBe(2);
  expect(b.get(chaveArvore(7, "AUTEX-2"))?.autex).toBe("AUTEX-2");
});
