import { describe, it, expect } from "vitest";
import { identidadeDoQr, plaquetaDoQr, qrTora, selecionarToraParaQr, selecionarToras } from "./tora-qr";
import type { Tora } from "./data";

const tora: Tora = { origem: "manejo", plaqueta: 50, arvore: 12, especie: "Jatobá", nome_cientifico: "Hymenaea courbaril", autex: "123/2026", secao: "A", d_topo1: 46, d_topo2: 45, d_pe1: 44, d_pe2: 43, comprimento: 5.8, volume: 0.9025, carregada: false, created_at: "2026-11-05T12:00:00Z", romaneio_id: null, serrada_em: null, etiqueta_impressa_em: null, empresa_id: "a0000000-0000-0000-0000-000000000001" };
describe("QR e seleção de toras", () => {
  it("contém autorização e todas as informações da tora", () => {
    expect(JSON.parse(qrTora(tora))).toEqual({ tipo: "tora", versao: 1, empresa_id: "a0000000-0000-0000-0000-000000000001", plaqueta: 50, arvore: 12, especie: "Jatobá", nome_cientifico: "Hymenaea courbaril", autex: "123/2026", secao: "A", d_topo1: 46, d_topo2: 45, d_pe1: 44, d_pe2: 43, comprimento: 5.8, volume: 0.9025 });
  });
  it("lê QR completo para a plaqueta correta sem concatenar medidas", () => expect(plaquetaDoQr(qrTora(tora))).toBe(50));
  it("mantém leitura de etiquetas antigas", () => expect(plaquetaDoQr("50")).toBe(50));
  it("rejeita QR desconhecido", () => expect(plaquetaDoQr('{"plaqueta":50}')).toBeNull());
  it("nunca seleciona a plaqueta 2 da RJ quando o pátio é da MADENORTE", () => {
    const rj = { ...tora, plaqueta: 2, empresa_id: "a0000000-0000-0000-0000-000000000001", especie: "Angelim", publico_id: "4be6b922-b689-473c-bc6f-00a89de5cc69" };
    const madenorte = { ...tora, plaqueta: 2, empresa_id: "6d4582f7-b121-4d90-9708-e8c544591397", especie: "Abiurana", publico_id: "7c24b195-d5ad-4c40-ba53-ccf7f8bc05de" };
    const ambas = [rj, madenorte];
    expect(selecionarToraParaQr(ambas, null, 2)).toBeNull();
    expect(selecionarToraParaQr(ambas, madenorte.empresa_id, 2)).toBe(madenorte);
    expect(qrTora(selecionarToraParaQr(ambas, madenorte.empresa_id, 2)!)).toContain("/t/7c24b195-d5ad-4c40-ba53-ccf7f8bc05de");
    expect(qrTora(selecionarToraParaQr(ambas, rj.empresa_id, 2)!)).toContain("/t/4be6b922-b689-473c-bc6f-00a89de5cc69");
    expect(identidadeDoQr(qrTora(madenorte))).toMatchObject({
      plaqueta: 2, empresa_id: madenorte.empresa_id, publico_id: madenorte.publico_id,
    });
  });
  it("imprime apenas as toras selecionadas entre 50 lançadas", () => {
    const todas = Array.from({ length: 50 }, (_, i) => i + 1);
    expect(selecionarToras([], todas.filter((p) => [2, 17, 50].includes(p)), true)).toEqual([2, 17, 50]);
  });
});