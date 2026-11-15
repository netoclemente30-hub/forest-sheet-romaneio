import { describe, expect, it } from "vitest";
import type { Arvore, Tora } from "./data";
import { situacaoArrasto, validarPosicaoArrasto } from "./arrasto";

const arvore = {
  id: "arvore-1", numero: 7451, autex: "AUTEX-1",
  empresa_id: "emp-1", abatida_em: "2026-11-15T12:00:00Z",
  latitude: -8.75, longitude: -63.9,
} as Arvore;

function tora(plaqueta: number, mods: Record<string, unknown> = {}): Tora {
  return {
    plaqueta, arvore: 7451, autex: "AUTEX-1",
    empresa_id: "emp-1", origem: "manejo",
    arrastada_em: null, carregada: false, romaneio_id: null,
    secao: "A", volume: 1.5, ...mods,
  } as unknown as Tora;
}

describe("arrasto por tora na árvore correta", () => {
  it("separa toras pendentes, concluídas e antigas já carregadas", () => {
    const ts = [
      tora(1), tora(2, { arrastada_em: "2026-11-15T16:00:00Z" }),
      tora(3, { carregada: true }),
      tora(4, { origem: "serraria" }),
      tora(5, { arvore: 7777 }),
      tora(6, { autex: "AUTEX-2" }),
      tora(7, { empresa_id: "emp-2" }),
      tora(1),
    ];
    const s = situacaoArrasto(arvore, "emp-1", ts);
    expect(s.total).toBe(3);
    expect(s.disponiveis.map((t) => t.plaqueta)).toEqual([1]);
    expect(s.arrastadas.map((t) => t.plaqueta)).toEqual([2]);
    expect(s.carregadasSemArrasto.map((t) => t.plaqueta)).toEqual([3]);
  });

  it("exige abate, localização GPS válida, precisão e proximidade", () => {
    const agora = new Date("2026-11-15T17:00:00Z").getTime();
    const posicao = { lat: -8.7502, lng: -63.9, precisao: 12, capturado_em: "2026-11-15T16:59:30Z" };
    expect(validarPosicaoArrasto(arvore, posicao, agora)).toBeNull();
    expect(validarPosicaoArrasto({ ...arvore, abatida_em: null }, posicao, agora)).toContain("abatimento");
    expect(validarPosicaoArrasto({ ...arvore, latitude: null }, posicao, agora)).toContain("Localize");
    expect(validarPosicaoArrasto(arvore, { ...posicao, lat: -8.76 }, agora)).toContain("mais de 100 m");
    expect(validarPosicaoArrasto(arvore, { ...posicao, precisao: 110 }, agora)).toContain("precisão");
    expect(validarPosicaoArrasto(arvore, { ...posicao, capturado_em: "2026-11-15T16:40:00Z" }, agora)).toContain("antigo");
  });
});
