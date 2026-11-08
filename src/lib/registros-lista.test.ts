import { describe, expect, it } from "vitest";
import { filtrarRegistros, podeReverterRegistro } from "./registros-lista";
const registros = [
  { numero: 12, user_email: "a@teste.com", acao: "Tora excluída", detalhe: "1861-B", mudancas: [{}], revertido_em: null, reversao_de: null },
  { numero: 13, user_email: "b@teste.com", acao: "Tora editada", detalhe: "1861-B", mudancas: null, revertido_em: null, reversao_de: null },
];
describe("registros numerados", () => {
  it("filtra pelo usuário exato sem mudar o número do registro", () => {
    expect(filtrarRegistros(registros, "a@teste.com", "").map((r) => r.numero)).toEqual([12]);
    expect(filtrarRegistros(registros, "b@teste.com", "1861").map((r) => r.numero)).toEqual([13]);
    expect(filtrarRegistros(registros, "a@teste.com", "editada")).toEqual([]);
  });
  it("encontra o registro por seu número persistente", () => {
    expect(filtrarRegistros(registros, "", "13").map((r) => r.numero)).toEqual([13]);
  });
  it("oferece reversão só com cópia completa e sem reversão anterior", () => {
    expect(podeReverterRegistro(registros[0])).toBe(true);
    expect(podeReverterRegistro(registros[1])).toBe(false);
    expect(podeReverterRegistro({ mudancas: [], revertido_em: null, reversao_de: null })).toBe(false);
    expect(podeReverterRegistro({ mudancas: [{}], revertido_em: "2026-11-08", reversao_de: null })).toBe(false);
    expect(podeReverterRegistro({ mudancas: [{}], revertido_em: null, reversao_de: "original" })).toBe(false);
  });
});