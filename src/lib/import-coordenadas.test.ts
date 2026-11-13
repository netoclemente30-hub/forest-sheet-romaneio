import { expect, it } from "vitest";
import type { Arvore } from "./data";
import { analisarCoordenadas, dadosCoordenadas } from "./import-coordenadas";
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