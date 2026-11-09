import { describe, expect, it } from "vitest";
import { ajustarControle, aplicarMatriz, arvoresProximas, inverterMatriz } from "./geopdf";

describe("GeoPDF e árvores próximas", () => {
  it("alinha e inverte os controles do mapa com orientação PDF", () => {
    const m = ajustarControle([0, 1, 0, 0, 1, 0, 1, 1], [350000, 9003000, 350000, 9000000, 354000, 9000000, 354000, 9003000]);
    expect(aplicarMatriz(m, .5, .5)).toEqual([352000, 9001500]);
    expect(aplicarMatriz(inverterMatriz(m), 352000, 9001500)).toEqual([.5, .5]);
  });
  it("recusa controles inconsistentes em vez de inventar localização", () => {
    expect(() => ajustarControle([0, 1, 0, 0, 1, 0, 1, 1], [0, 100, 0, 0, 100, 0, 110, 100])).toThrow("inconsistente");
  });
  it("aproximação da árvore 349 sugere seleção sem alterar abatimento", () => {
    const arvore = { id: "349", numero: 349, latitude: -9, longitude: -63, abatida_em: null };
    expect(arvoresProximas([arvore], { lat: -9.00001, lng: -63, precisao: 5 }, 50)[0]?.arvore.numero).toBe(349);
    expect(arvore.abatida_em).toBeNull();
    expect(arvoresProximas([arvore], { lat: -9.01, lng: -63 }, 50)).toEqual([]);
  });
  it("não sugere árvores abatidas, sem localização ou GPS impreciso", () => {
    const a = { id: "349", numero: 349, latitude: -9, longitude: -63, abatida_em: null };
    expect(arvoresProximas([{ ...a, abatida_em: "2026-11-09" }, { ...a, latitude: null }], { lat: -9, lng: -63 }, 50)).toEqual([]);
    expect(arvoresProximas([a], { lat: -9, lng: -63, precisao: 101 }, 50)).toEqual([]);
  });
});