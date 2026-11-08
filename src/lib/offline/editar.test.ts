import { describe, expect, it } from "vitest";
import { corrigirOp, rascunhoDaFila } from "./editar";
import type { Op } from "./fila";

describe("correção de lançamento com erro", () => {
  const op: Op = {
    tipo: "tora_insert",
    dados: { empresa_id: "RJ", origem: "serraria", plaqueta: 9, arvore: 1861, secao: "B", especie: "Abiurana", autex: "AUTEX-1", volume: 2.0125 },
    log: { operacao_id: "original", acao: "Tora lançada", detalhe: "original", user_email: "operador", lat: -10, lng: -60, criado_em: "2026-11-08T19:37:00Z" },
  };
  it("corrige plaqueta e árvore/secção sem perder origem, empresa, hora e GPS", () => {
    const valores = { ...rascunhoDaFila(op, []), plaquetaNova: "10", arvore: "1862", secao: "c" };
    const corrigida = corrigirOp(op, valores, []);
    expect(corrigida.tipo).toBe("tora_insert");
    if (corrigida.tipo !== "tora_insert") throw new Error("Tipo alterado");
    expect(corrigida.dados).toMatchObject({ plaqueta: 10, arvore: 1862, secao: "C", empresa_id: "RJ", origem: "serraria", volume: 2.0125 });
    expect(corrigida.log).toMatchObject({ operacao_id: "original", user_email: "operador", lat: -10, lng: -60, criado_em: "2026-11-08T19:37:00Z" });
  });
  it("rejeita plaqueta inválida antes de modificar a fila", () => {
    expect(() => corrigirOp(op, { ...rascunhoDaFila(op, []), plaquetaNova: "0" }, [])).toThrow("maior que zero");
  });
});