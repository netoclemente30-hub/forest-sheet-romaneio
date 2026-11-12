import { describe, expect, it } from "vitest";
import { proximoNumeroAguardando, qrAguardando, volumesAguardando } from "./toras-aguardando";
import { volumeTora } from "./volume";

describe("toras aguardando identificação", () => {
  it("numera em sequência própria após o maior número", () => {
    expect(proximoNumeroAguardando([])).toBe(1);
    expect(proximoNumeroAguardando([{ numero: 3 }, { numero: 7 }])).toBe(8);
  });
  it("calcula físico e comercial sem árvore ou seção", () => {
    const v = volumesAguardando({ d_pe1: 56, d_pe2: 58, d_topo1: 52, d_topo2: 54, comprimento: 6.6 });
    expect(v?.fisico).toBeCloseTo(volumeTora({ d_pe1: 56, d_pe2: 58, d_topo1: 52, d_topo2: 54, comprimento: 6.6 }), 6);
    expect(v?.comercial?.comprimento).toBe(6.5);
    expect(v?.comercial?.volume).toBeCloseTo(1.434, 3);
  });
  it("não calcula com medida faltando", () => {
    expect(volumesAguardando({ d_pe1: 56, d_pe2: 58, d_topo1: 52, comprimento: 6.6 })).toBeNull();
  });
  it("QR identifica a tora como não identificada", () => {
    const q = JSON.parse(qrAguardando({ id: "x", empresa_id: "e", numero: 4, especie: "Ipê" }));
    expect(q).toMatchObject({ tipo: "nao_identificada", codigo: "NI-4", empresa: "e" });
  });
});

import { relatorioAguardando } from "./toras-aguardando";
describe("relatório de toras aguardando", () => {
  const base = { empresa_id: "e", nome_cientifico: null, created_at: "2026-11-12T10:00:00Z", d_pe1: 56, d_pe2: 58, d_topo1: 52, d_topo2: 54, comprimento: 6.6, volume: 1.5701 };
  it("soma físico e comercial e agrupa por espécie", () => {
    const r = relatorioAguardando([{ ...base, id: "b", numero: 2, especie: "Ipê" }, { ...base, id: "a", numero: 1, especie: "Ipê" }]);
    expect(r.linhas.map((l) => l.codigo)).toEqual(["NI-1", "NI-2"]);
    expect(r.total).toEqual({ qtd: 2, fisico: 3.1402, comercial: 2.868 });
    expect(r.porEspecie).toHaveLength(1);
  });
});
