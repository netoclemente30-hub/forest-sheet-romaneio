import { describe, expect, it } from "vitest";
import type { Arvore } from "./data";
import {
  ALTURA_MAPA, LARGURA_MAPA, acoesProximasMapa,
  centroMapa, janelaMapa, limitarZoom,
} from "./mapa-campo";

const empresa = "empresa-madenorte";
const agora = Date.parse("2026-11-16T14:00:00Z");
const arvore = {
  id: "394-b", empresa_id: empresa, numero: 394, autex: "autex geraldo",
  nome_vulgar: "Abiurana", picada: "12",
  latitude: -8.67868, longitude: -63.6456,
  abatida_em: null, nao_abatida_motivo: null,
} as unknown as Arvore;
const gps = {
  lat: -8.67868, lng: -63.6456, precisao: 5,
  capturado_em: new Date(agora).toISOString(),
};

describe("zoom do mapa GPS offline", () => {
  it("limita zoom de 1 a 12 vezes e descarta números inválidos", () => {
    expect(limitarZoom(0)).toBe(1);
    expect(limitarZoom(24)).toBe(12);
    expect(limitarZoom(Number.NaN)).toBe(1);
    expect(limitarZoom(4)).toBe(4);
  });
  it("mapa completo inicia em 640x420, sem deslocar coordenadas", () => {
    expect(janelaMapa(320, 210, 1)).toEqual([0, 0, LARGURA_MAPA, ALTURA_MAPA]);
  });
  it("zoom aproxima a região central e permite pan dentro das bordas", () => {
    expect(janelaMapa(320, 210, 2)).toEqual([160, 105, 320, 210]);
    expect(centroMapa(-100, 99999, 2)).toEqual({ x: 160, y: 315 });
    expect(janelaMapa(-100, 99999, 2)).toEqual([0, 210, 320, 210]);
  });
});

describe("ações que aparecem ao se aproximar da árvore", () => {
  it("cortador vê somente abater quando está com GPS válido até 100 m", () => {
    const resultado = acoesProximasMapa([arvore], gps, true, false, [], empresa, agora);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.acao).toBe("abater");
    expect(resultado[0]?.arvore.numero).toBe(394);
  });
  it("tratorista vê arrasto mesmo antes de o abate estar sincronizado", () => {
    const resultado = acoesProximasMapa([arvore], gps, false, true, [], empresa, agora);
    expect(resultado.map((r) => r.acao)).toEqual(["arrastar"]);
  });
  it("árvore abatida não oferece novo abate, mas permite arrasto", () => {
    const abatida = { ...arvore, abatida_em: "2026-11-16T13:00:00Z" };
    const resultado = acoesProximasMapa([abatida], gps, true, true, [], empresa, agora);
    expect(resultado.map((r) => r.acao)).toEqual(["arrastar"]);
  });
  it("não oferece arrasto novamente quando já está registrado", () => {
    expect(acoesProximasMapa([arvore], gps, false, true, [{
      empresa_id: empresa, autex: arvore.autex, arvore: arvore.numero,
    }], empresa, agora)).toEqual([]);
  });
  it("não mostra ações em outra empresa mesmo com a mesma árvore", () => {
    expect(acoesProximasMapa([arvore], gps, true, true, [], "rj", agora)).toEqual([]);
    expect(acoesProximasMapa([arvore], gps, true, true, [], null, agora)).toEqual([]);
  });
  it("bloqueia ações com GPS impreciso, antigo ou a mais de 100 m", () => {
    const impreciso = { ...gps, precisao: 120 };
    const antigo = { ...gps, capturado_em: new Date(agora - 180000).toISOString() };
    const longe = { ...gps, lat: gps.lat + 0.003 };
    for (const leitura of [impreciso, antigo, longe]) {
      expect(acoesProximasMapa([arvore], leitura, true, true, [], empresa, agora)).toEqual([]);
    }
  });
  it("árvore sem coordenadas ou marcada como não abatida não permite operações", () => {
    const semGPS = { ...arvore, latitude: null, longitude: null };
    const naoAbatida = { ...arvore, nao_abatida_motivo: "OCA" };
    expect(acoesProximasMapa([semGPS], gps, true, true, [], empresa, agora)).toEqual([]);
    expect(acoesProximasMapa([naoAbatida], gps, true, true, [], empresa, agora)).toEqual([]);
  });
  it("sem cargo autorizado, aproximação não registra nem habilita ação", () => {
    expect(acoesProximasMapa([arvore], gps, false, false, [], empresa, agora)).toEqual([]);
  });
});
