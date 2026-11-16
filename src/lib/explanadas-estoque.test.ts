import { describe, expect, it } from "vitest";
import type { Tora } from "@/lib/data";
import type { Explanada } from "./explanadas";
import type { ArrastoArvore } from "./arrasto-arvore";
import { resumoExplanada, toraDisponivelExplanada, torasDaExplanada, validarTransferenciaTora } from "./explanadas-estoque";

const origem = { id: "ex-1", nome: "Pátio 1", empresa_id: "madenorte", autex: "geraldo" } as Explanada;
const destino = { ...origem, id: "ex-2", nome: "Pátio 2" };
const daRJ = { ...destino, empresa_id: "rj" };
const outraAutex = { ...destino, autex: "outra" };

function tora(plaqueta: number, mods: Record<string, unknown> = {}): Tora {
  return {
    plaqueta, arvore: 394, secao: plaqueta === 1 ? "A" : "B",
    origem: "manejo", autex: "geraldo", empresa_id: "madenorte",
    arrasto_explanada_id: "ex-1", arrastada_em: "2026-11-15T22:00:00Z",
    volume: plaqueta === 1 ? 1.7615 : 1.3511,
    carregada: false, romaneio_id: null, serrada_em: null, ...mods,
  } as unknown as Tora;
}

describe("abrir explanada e consultar toras", () => {
  it("não mistura empresas, AUTEX, origens e serraria", () => {
    const lista = [
      tora(1), tora(2), tora(3, { empresa_id: "rj" }),
      tora(4, { autex: "outra" }), tora(5, { arrasto_explanada_id: "ex-2" }),
      tora(6, { origem: "serraria" }),
    ];
    expect(torasDaExplanada(lista, origem).map((t) => t.plaqueta)).toEqual([1, 2]);
  });
  it("a MADENORTE tem 2 toras históricas já carregadas, mas saldo zero", () => {
    const ts = [tora(1, { carregada: true, romaneio_id: "rom-1" }),
      tora(2, { carregada: true, romaneio_id: "rom-1" })];
    const s = resumoExplanada(origem, ts);
    expect(s.torasVinculadas).toBe(2);
    expect(s.carregadas).toBe(2);
    expect(s.disponiveis).toBe(0);
    expect(s.volumeDisponivel).toBe(0);
  });
  it("soma saldo de toras disponíveis em m³ sem incluir as já carregadas", () => {
    const ts = [tora(1), tora(2), tora(3, { carregada: true }), tora(4, { serrada_em: "2026-11-15T22:00:00Z" })];
    const s = resumoExplanada(origem, ts);
    expect(s.disponiveis).toBe(2);
    expect(s.volumeDisponivel).toBeCloseTo(3.1126);
    expect(s.carregadas).toBe(1);
    expect(s.outrasSaidas).toBe(1);
  });
  it("fuste arrastado sem tora traçada não é contabilizado como tora", () => {
    const arrasto = { empresa_id: "madenorte", autex: "geraldo", explanada_id: "ex-1", arvore: 395 } as ArrastoArvore;
    const s = resumoExplanada(origem, [tora(1)], [arrasto, arrasto]);
    expect(s.disponiveis).toBe(1);
    expect(s.fustesSemToras).toBe(1);
  });
  it("não transfere tora carregada, serrada, de outra empresa ou já transferida", () => {
    expect(validarTransferenciaTora(tora(1), origem, destino)).toBeNull();
    expect(validarTransferenciaTora(tora(1), origem, daRJ)).toContain("mesma empresa");
    expect(validarTransferenciaTora(tora(1), origem, outraAutex)).toContain("AUTEX");
    expect(validarTransferenciaTora(tora(1), origem, origem)).toContain("outra explanada");
    expect(validarTransferenciaTora(tora(1, { arrasto_explanada_id: "ex-2" }), origem, destino)).toContain("não está mais");
    expect(validarTransferenciaTora(tora(1, { carregada: true }), origem, destino)).toContain("Somente");
    expect(validarTransferenciaTora(tora(1, { romaneio_id: "rom" }), origem, destino)).toContain("Somente");
    expect(validarTransferenciaTora(tora(1, { serrada_em: "ontem" }), origem, destino)).toContain("Somente");
    expect(validarTransferenciaTora(tora(1, { arrastada_em: null }), origem, destino)).toContain("Somente");
    expect(toraDisponivelExplanada(tora(1))).toBe(true);
  });
});
