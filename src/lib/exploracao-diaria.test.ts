import { describe, expect, it } from "vitest";
import type { Arvore, Romaneio, Tora } from "./data";
import { dataExploracao, hojeExploracao, resumoExploracaoDiaria } from "./exploracao-diaria";

const dia = "2026-11-15";
const arvore = (numero: number, outros: Record<string, unknown> = {}): Arvore =>
  ({ numero, empresa_id: "emp-1", autex: "A1", abatida_em: "2026-11-15T15:00:00Z", ...outros } as unknown as Arvore);
const tora = (plaqueta: number, outros: Record<string, unknown> = {}): Tora =>
  ({ plaqueta, arvore: 100, secao: "A", empresa_id: "emp-1", autex: "A1",
    origem: "manejo", created_at: "2026-11-15T15:00:00Z",
    carregada: false, romaneio_id: null, ...outros } as unknown as Tora);
const romaneio = (id: string, outros: Record<string, unknown> = {}): Romaneio =>
  ({ id, empresa_id: "emp-1", data: dia, qtd_toras: 2, total_volume: 5,
    created_at: "2026-11-15T15:00:00Z", ...outros } as unknown as Romaneio);

describe("Exploração diária da página inicial", () => {
  it("conta árvores abatidas pela data do abate, sem duplicar espécie/árvore", () => {
    const a = [
      arvore(1), arvore(1), arvore(2, { abatida_em: null }),
      arvore(3, { abatida_em: "2026-11-14T14:00:00Z" }),
      arvore(1, { autex: "A2" }),
      arvore(4, { empresa_id: "emp-2" }),
    ];
    expect(resumoExploracaoDiaria(dia, a, [], [], "emp-1").abatidas).toBe(2);
  });

  it("conta toras de manejo traçadas na data, não peças de serraria", () => {
    const t = [
      tora(11), tora(12, { arvore: 100, secao: "B" }), tora(11),
      tora(13, { origem: "serraria" }),
      tora(14, { created_at: "2026-11-14T15:00:00Z" }),
      tora(15, { empresa_id: "emp-2" }),
    ];
    const r = resumoExploracaoDiaria(dia, [], t, [], "emp-1");
    expect(r.tracadas).toBe(2);
    expect(r.arvoresTracadas).toBe(1);
  });

  it("conta toras carregadas com romaneio emitido no dia, não apenas marcadas carregadas", () => {
    const cargas = [romaneio("r1"), romaneio("r2", { data: "2026-11-14" }), romaneio("r3", { empresa_id: "emp-2" })];
    const toras = [
      tora(1, { carregada: true, romaneio_id: "r1" }),
      tora(2, { carregada: true, romaneio_id: "r1" }),
      tora(3, { carregada: true, romaneio_id: "r2" }),
      tora(4, { carregada: false, romaneio_id: "r1" }),
      tora(5, { carregada: true, romaneio_id: null }),
      tora(6, { carregada: true, romaneio_id: "r3" }),
      tora(7, { carregada: true, romaneio_id: "r1", origem: "serraria" }),
    ];
    const r = resumoExploracaoDiaria(dia, [], toras, cargas, "emp-1");
    expect(r.carregadas).toBe(2);
    expect(r.cargas).toBe(1);
  });

  it("mantém empresas isoladas mesmo se o superadmin visualizar todas", () => {
    const t = [
      tora(3, { empresa_id: "emp-1", carregada: true, romaneio_id: "r1" }),
      tora(3, { empresa_id: "emp-2", carregada: true, romaneio_id: "r2" }),
    ];
    const roms = [romaneio("r1"), romaneio("r2", { empresa_id: "emp-2" })];
    expect(resumoExploracaoDiaria(dia, [], t, roms).carregadas).toBe(2);
    expect(resumoExploracaoDiaria(dia, [], t, roms, "emp-1").carregadas).toBe(1);
  });

  it("considera o fuso de Rondônia e não conta a madrugada UTC no dia errado", () => {
    expect(dataExploracao("2026-11-16T01:30:00Z")).toBe("2026-11-15");
    expect(dataExploracao("2026-11-16")).toBe("2026-11-16");
    expect(dataExploracao(null)).toBeNull();
    expect(hojeExploracao(new Date("2026-11-16T01:30:00Z"))).toBe("2026-11-15");
  });

  it("conta toras arrastadas na data do serviço, deduplicando plaquetas por empresa", () => {
    const toras = [
      tora(10, { arrastada_em: "2026-11-15T17:00:00Z", volume: 2.5 }),
      tora(10, { arrastada_em: "2026-11-15T17:00:00Z", volume: 2.5 }),
      tora(11, { arrastada_em: "2026-11-16T01:30:00Z", volume: 1.2 }),
      tora(12, { arrastada_em: "2026-11-14T17:00:00Z", volume: 9 }),
      tora(13, { arrastada_em: null, volume: 3 }),
      tora(14, { arrastada_em: "2026-11-15T17:00:00Z", empresa_id: "emp-2", volume: 8 }),
      tora(15, { arrastada_em: "2026-11-15T17:00:00Z", origem: "serraria", volume: 12 }),
    ];
    const um = resumoExploracaoDiaria(dia, [], toras, [], "emp-1");
    expect(um.arrastadas).toBe(2);
    expect(um.volumeArrastado).toBeCloseTo(3.7);
    const todas = resumoExploracaoDiaria(dia, [], toras, []);
    expect(todas.arrastadas).toBe(3);
  });

  it("mostra zero quando não há atividade na data, sem criar dados artificiais", () => {
    expect(resumoExploracaoDiaria(dia, [], [], [], "emp-1")).toEqual({
      abatidas: 0, tracadas: 0, arvoresTracadas: 0, arrastadas: 0, volumeArrastado: 0, carregadas: 0, cargas: 0,
    });
  });
});
