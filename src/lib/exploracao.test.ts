import { describe, expect, it } from "vitest";
import { aceitarPontoRastro, atualizarDataAbatimento, comprimentoRastro, coordenadaValida, distanciaMetros, mesclarRastros, projetarMapa, validarAbateProximo } from "./exploracao";

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

  it("atualizar só o GPS não desfaz um abatimento já registrado", () => {
    const data = "2026-11-09T00:00:00Z";
    expect(atualizarDataAbatimento(data, null, "2026-11-09T01:00:00Z")).toBe(data);
    expect(atualizarDataAbatimento(data, true, "2026-11-09T01:00:00Z")).toBe(data);
    expect(atualizarDataAbatimento(data, false, "2026-11-09T01:00:00Z")).toBeNull();
  });

  it("mantém os pontos dentro do mapa mesmo sem variação de coordenadas", () => {
    const projetados = projetarMapa([{ id: "a", lat: -9, lng: -63 }]);
    expect(projetados).toEqual([{ ponto: { id: "a", lat: -9, lng: -63 }, x: 320, y: 210 }]);
  });
});

describe("registro de abate pelo cortador próximo da árvore", () => {
  const arvore = { latitude: -9, longitude: -63 };
  const agora = new Date("2026-11-15T15:00:00Z").getTime();
  const gps = { lat: -9.0001, lng: -63, precisao: 12, capturado_em: "2026-11-15T14:59:30Z" };

  it("aceita posição recente e próxima", () => {
    expect(validarAbateProximo(arvore, gps, agora)).toBeNull();
    expect(validarAbateProximo({ latitude: null, longitude: null }, gps, agora)).toBeNull();
  });
  it("não aceita abate com coordenadas da árvore sem captura de GPS", () => {
    expect(validarAbateProximo(arvore, { lat: -9, lng: -63 }, agora)).toContain("Capture");
    expect(validarAbateProximo(arvore, null, agora)).toContain("Capture");
  });
  it("impede GPS antigo, impreciso ou distante", () => {
    expect(validarAbateProximo(arvore, { ...gps, capturado_em: "2026-11-15T14:50:00Z" }, agora)).toContain("antigo");
    expect(validarAbateProximo(arvore, { ...gps, precisao: 150 }, agora)).toContain("precisão");
    expect(validarAbateProximo(arvore, { ...gps, lat: -9.01 }, agora)).toContain("mais de 100 m");
  });
});
