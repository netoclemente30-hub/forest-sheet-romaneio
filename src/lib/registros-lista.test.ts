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
    const [primeiro, segundo] = registros;
    if (!primeiro || !segundo) throw new Error("Registros de teste ausentes");
    expect(podeReverterRegistro(primeiro)).toBe(true);
    expect(podeReverterRegistro(segundo)).toBe(false);
    expect(podeReverterRegistro({ mudancas: [], revertido_em: null, reversao_de: null })).toBe(false);
    expect(podeReverterRegistro({ mudancas: [{}], revertido_em: "2026-11-08", reversao_de: null })).toBe(false);
    expect(podeReverterRegistro({ mudancas: [{}], revertido_em: null, reversao_de: "original" })).toBe(false);
  });
});
import { CAMPOS_ARRASTO } from "./registros-lista";
describe("reversão de arrasto", () => {
  const completo = Object.fromEntries(CAMPOS_ARRASTO.map((k) => [k, null]));
  const base = { revertido_em: null, reversao_de: null };
  it("permite reverter com snapshot completo de arrasto/explanada", () => {
    expect(podeReverterRegistro({ ...base, mudancas: [{ tabela: "toras", antes: { plaqueta: 1, ...completo }, depois: { plaqueta: 1, ...completo, arrastada_em: "2026-11-15" } }] })).toBe(true);
  });
  it("não oferece reversão quando falta campo de arrasto", () => {
    const { arrasto_explanada_id: _x, ...semExplanada } = completo;
    expect(podeReverterRegistro({ ...base, mudancas: [{ tabela: "toras", antes: { plaqueta: 1, ...semExplanada }, depois: { plaqueta: 1, ...completo } }] })).toBe(false);
  });
});
