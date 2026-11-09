import { describe, expect, it } from "vitest";
import { aceitarPontoRastro, comprimentoRastro, coordenadaValida, distanciaMetros, mesclarRastros, projetarMapa } from "./exploracao";

describe("mapa exploratório", () => {
  it("valida coordenadas WGS84", () => {
    expect(coordenadaValida(-9.12, -63.45)).toBe(true);
    expect(coordenadaValida(-91, -63.45)).toBe(false);
    expect(coordenadaValida(-9.12, 181)).toBe(false);
  });

  it("calcula a distância real do rastro", () => {
    const umGrau = distanciaMetros({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(umGrau).toBeGreaterThan(111000);
    expect(umGrau).toBeLessThan(112000);
    expect(comprimentoRastro([{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 0, lng: 2 }])).toBeCloseTo(umGrau * 2, 3);
  });

  it("não guarda pontos parados nem leituras acima de 100 metros de imprecisão", () => {
    const a = { lat: -9, lng: -63, precisao: 8, capturado_em: "2026-11-09T00:00:00Z" };
    expect(aceitarPontoRastro(a, { ...a, capturado_em: "2026-11-09T00:00:05Z" })).toBe(false);
    expect(aceitarPontoRastro(a, { ...a, precisao: 101 })).toBe(false);
    expect(aceitarPontoRastro(a, { ...a, capturado_em: "2026-11-09T00:00:31Z" })).toBe(true);
    expect(aceitarPontoRastro(a, { lat: -9.0001, lng: -63, precisao: 8 })).toBe(true);
  });

  it("deduplica pontos offline ao reabrir e sincronizar", () => {
    const a = { id: "a", capturado_em: "2026-11-09T00:00:00Z" };
    const b = { id: "b", capturado_em: "2026-11-09T00:00:01Z" };
    expect(mesclarRastros([b], [a, b])).toEqual([a, b]);
  });

  it("mantém os pontos dentro do mapa mesmo sem variação de coordenadas", () => {
    const projetados = projetarMapa([{ id: "a", lat: -9, lng: -63 }]);
    expect(projetados).toEqual([{ ponto: { id: "a", lat: -9, lng: -63 }, x: 320, y: 210 }]);
  });
});
