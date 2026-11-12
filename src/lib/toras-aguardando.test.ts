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
