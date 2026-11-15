import { expect, it } from "vitest";
import type { Arvore } from "./data";
import { analisarCoordenadas, dadosCoordenadas, converterCoordenadas, precisaConversaoUtm } from "./import-coordenadas";
const arvore = { id: "a", empresa_id: "empresa", autex: "AUTEX-1", numero: 349, nome_vulgar: "Jatobá", cap: 150, abatida_em: "2026-11-12", latitude: null, longitude: null } as Arvore;
const header = ["Número", "Latitude", "Longitude", "AUTEX"];
it("localiza a árvore pelo número no manejo e empresa selecionados", () => {
  const resultado = analisarCoordenadas([header, [349, "-9,123456", "-63,654321"]], [arvore], "empresa", "AUTEX-1");
  expect(resultado.erros).toEqual([]);
  expect(resultado.atualizacoes[0]?.arvore.id).toBe("a");
  expect(resultado.atualizacoes[0]?.latitude).toBe(-9.123456);
});
it("não altera medidas, espécie ou abatimento ao importar só coordenadas", () => {
  const atualizada = { ...arvore, ...dadosCoordenadas(-9.123456, -63.654321, "2026-11-13") };
  expect(atualizada.cap).toBe(150);
  expect(atualizada.nome_vulgar).toBe("Jatobá");
  expect(atualizada.abatida_em).toBe("2026-11-12");
  expect(atualizada.latitude).toBe(-9.123456);
});
it("recusa outra empresa, AUTEX divergente, número repetido e coordenadas UTM", () => {
  expect(analisarCoordenadas([header, [349, -9, -63]], [arvore], "outra", "AUTEX-1").erros).toHaveLength(1);
  expect(analisarCoordenadas([header, [349, -9, -63, "AUTEX-2"]], [arvore], "empresa", "AUTEX-1").erros).toHaveLength(1);
  expect(analisarCoordenadas([header, [349, -9, -63], [349, -9, -63]], [arvore], "empresa", "AUTEX-1").erros).toHaveLength(1);
  expect(analisarCoordenadas([header, [349, 419900, 9044800]], [arvore], "empresa", "AUTEX-1").atualizacoes).toEqual([]);
});
it("reconhece metros sob Latitude/Longitude no modelo enviado", () => {
  expect(precisaConversaoUtm([header, [1, 429178.124, 9040158.97]])).toBe(true);
  expect(precisaConversaoUtm([header, [1, -9.123456, -63.654321]])).toBe(false);
});
it("converte UTM com fuso e datum explícitos, sem modificar medidas da ficha", () => {
  const rows = [["Número", "Nome Vulgar", "CAP (cm)", "DAP (cm)", "Altura (m)", "Volume (m³)", "Categoria", "Picada", "Latitude", "Longitude"], [349, "Cambará", 176, 0.5602253997, 17, 2.93334019274266, "Explorável", 1, 429178.124, 9040158.97], [null, "Abiurana"]];
  const resultado = analisarCoordenadas(rows, [arvore], "empresa", "AUTEX-1", { tipo: "utm", fuso: 20, hemisferio: "sul", datum: "SIRGAS2000" });
  expect(resultado.erros).toEqual([]);
  expect(resultado.atualizacoes).toHaveLength(1);
  expect(resultado.atualizacoes[0]?.latitude).toBeCloseTo(-8.68263, 4);
  expect(resultado.atualizacoes[0]?.longitude).toBeCloseTo(-63.64380, 4);
  expect(resultado.atualizacoes[0]?.arvore.cap).toBe(150);
});
it("não assume fuso UTM ausente nem aceita fuso fora do intervalo", () => {
  for (const fuso of [0, 61, 20.5, NaN]) expect(() => converterCoordenadas(429178.124, 9040158.97, { tipo: "utm", fuso, hemisferio: "sul", datum: "WGS84" })).toThrow("fuso UTM");
});
it("mantém o isolamento por empresa ao converter UTM", () => {
  const resultado = analisarCoordenadas([header, [349, 429178.124, 9040158.97]], [arvore], "outra", "AUTEX-1", { tipo: "utm", fuso: 20, hemisferio: "sul", datum: "WGS84" });
  expect(resultado.atualizacoes).toEqual([]);
  expect(resultado.erros).toHaveLength(1);
});