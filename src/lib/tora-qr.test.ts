import { describe, it, expect } from "vitest";
import { plaquetaDoQr, qrTora, selecionarToras } from "./tora-qr";
import type { Tora } from "./data";

const tora: Tora = { plaqueta: 50, arvore: 12, especie: "Jatobá", nome_cientifico: "Hymenaea courbaril", autex: "123/2026", secao: "A", d_topo1: 46, d_topo2: 45, d_pe1: 44, d_pe2: 43, comprimento: 5.8, volume: 0.9025, carregada: false, created_at: "2026-11-05T12:00:00Z", romaneio_id: null, serrada_em: null, empresa_id: null };
describe("QR e seleção de toras", () => {
  it("contém autorização e todas as informações da tora", () => {
    expect(JSON.parse(qrTora(tora))).toEqual({ tipo: "tora", versao: 1, plaqueta: 50, arvore: 12, especie: "Jatobá", nome_cientifico: "Hymenaea courbaril", autex: "123/2026", secao: "A", d_topo1: 46, d_topo2: 45, d_pe1: 44, d_pe2: 43, comprimento: 5.8, volume: 0.9025 });
  });
  it("lê QR completo para a plaqueta correta sem concatenar medidas", () => expect(plaquetaDoQr(qrTora(tora))).toBe(50));
  it("mantém leitura de etiquetas antigas", () => expect(plaquetaDoQr("50")).toBe(50));
  it("rejeita QR desconhecido", () => expect(plaquetaDoQr('{"plaqueta":50}')).toBeNull());
  it("imprime apenas as toras selecionadas entre 50 lançadas", () => {
    const todas = Array.from({ length: 50 }, (_, i) => i + 1);
    expect(selecionarToras([], todas.filter((p) => [2, 17, 50].includes(p)), true)).toEqual([2, 17, 50]);
  });
});