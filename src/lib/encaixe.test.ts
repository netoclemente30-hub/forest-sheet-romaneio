import { describe, expect, it } from "vitest";
import { encaixarToras, linhasDisponiveisOffline, nomesCientificosEncaixe, volumeEncaixe } from "./encaixe";
import type { LinhaSaldo } from "./saldo";
import { criarFila, type ItemFila } from "./offline/fila";

const linha = (arvore: number, volume: number | null, nome_cientifico = "Pouteria macrophylla", autex = "AUTEX-2011.2.2026.10587"): LinhaSaldo => ({ arvore, volume, nome_cientifico, autex, secao: "B", especie: "Abiurana" });
describe("encaixe de toras", () => {
  it("retira 1861-B imediatamente após lançar offline e mantém reserva ao reler a fila, inclusive com erro", async () => {
    const itens = new Map<string, ItemFila>();
    const store = { all: async () => [...itens.values()], put: async (i: ItemFila) => { itens.set(i.id, i); }, del: async (id: string) => { itens.delete(id); } };
    const f = criarFila(store);
    const saldo = [linha(1861, 2.0125), linha(1862, 2.02)];
    expect(linhasDisponiveisOffline(saldo, await f.listar(), "RJ").map((l) => l.arvore)).toEqual([1861, 1862]);
    const item = await f.enfileirar({ tipo: "tora_insert", dados: { empresa_id: "RJ", arvore: 1861, secao: " b ", autex: "2011.2.2026.10587", plaqueta: 50 } });
    expect(linhasDisponiveisOffline(saldo, await f.listar(), "RJ").map((l) => l.arvore)).toEqual([1862]);
    await f.marcarErro(item.id, "Sem conexão");
    expect(linhasDisponiveisOffline(saldo, await criarFila(store).listar(), "RJ").map((l) => l.arvore)).toEqual([1862]);
    await f.remover(item.id);
    expect(linhasDisponiveisOffline(saldo, await f.listar(), "RJ").map((l) => l.arvore)).toEqual([1861, 1862]);
  });
  it("reserva somente a mesma empresa, AUTEX e secção, incluindo linhas repetidas do saldo", () => {
    const itens: ItemFila[] = [{ id: "1", criadoEm: 1, op: { tipo: "tora_insert", dados: { empresa_id: "RJ", arvore: 1861, secao: "B", autex: "AUTEX-2011.2.2026.10587", plaqueta: 50 } } }];
    const saldo = [linha(1861, 2), linha(1861, 2), linha(1861, 2, "Pouteria macrophylla", "OUTRA"), { ...linha(1861, 2), secao: "A" }];
    expect(linhasDisponiveisOffline(saldo, itens, "RJ").map((l) => [l.autex, l.secao])).toEqual([["OUTRA", "B"], ["AUTEX-2011.2.2026.10587", "A"]]);
    expect(linhasDisponiveisOffline(saldo, itens, "OUTRA EMPRESA")).toEqual(saldo);
    expect(linhasDisponiveisOffline(saldo, itens, null)).toEqual([]);
  });
  it("calcula Smalian com as cinco medidas e aceita vírgula decimal", () => {
    expect(volumeEncaixe({ d_topo1: "73", d_topo2: "68", d_pe1: "67", d_pe2: "62", comprimento: "7,6" })).toBe(2.725);
  });
  it("não sugere volume com medidas incompletas ou inválidas", () => {
    for (const d_topo1 of ["", "0", "-3", "abc", "Infinity"]) expect(volumeEncaixe({ d_topo1, d_topo2: "68", d_pe1: "67", d_pe2: "62", comprimento: "7.6" })).toBeNull();
  });
  it("ordena por diferença absoluta, não pelo número da árvore", () => {
    const opcoes = encaixarToras([linha(10, 3), linha(1861, 2.0125), linha(20, 1.99)], "Pouteria macrophylla", 2);
    expect(opcoes.map((o) => o.linha.arvore)).toEqual([20, 1861, 10]);
    expect(opcoes.map((o) => o.diferenca)).toEqual([-0.01, 0.0125, 1]);
  });
  it("limita ao nome científico escolhido e ignora saldo sem volume válido", () => {
    expect(encaixarToras([linha(1, 2, "Qualea albiflora"), linha(2, null), linha(3, 0), linha(4, NaN), linha(1861, 2.0125, " POUTERIA   MACROPHYLLA ")], "Pouteria macrophylla", 2).map((o) => o.linha.arvore)).toEqual([1861]);
    expect(encaixarToras([linha(1, 2)], "", 2)).toEqual([]);
    expect(encaixarToras([linha(1, 2)], "Pouteria macrophylla", null)).toEqual([]);
  });
  it("preserva AUTEX, árvore e secção mesmo quando os números se repetem", () => {
    const opcoes = encaixarToras([linha(1861, 2.0125), linha(1861, 2.02, "Pouteria macrophylla", "AUTEX-OUTRA")], "Pouteria macrophylla", 2.0125);
    expect(opcoes.map((o) => [o.linha.autex, o.linha.arvore, o.linha.secao])).toEqual([["AUTEX-2011.2.2026.10587", 1861, "B"], ["AUTEX-OUTRA", 1861, "B"]]);
  });
  it("agrupa nomes científicos repetidos sem perder espécies diferentes", () => {
    expect(nomesCientificosEncaixe([linha(1, 2), linha(2, 2, " POUTERIA MACROPHYLLA "), linha(3, 2, "Qualea albiflora"), linha(4, 2, "")])).toEqual(["Pouteria macrophylla", "Qualea albiflora"]);
  });
  it("sugere e deixa escolher tora de AUTESP sem seção pelo volume", () => {
    const autesp: LinhaSaldo = { arvore: 349, volume: 2.0125, nome_cientifico: "Pouteria macrophylla", autex: "AUTESP-2011.2.2026.10587", secao: "", especie: "Abiurana" };
    const opcoes = encaixarToras([autesp], "Pouteria macrophylla", 2);
    expect(opcoes.map((o) => [o.linha.arvore, o.linha.secao, o.linha.autex])).toEqual([[349, "", "AUTESP-2011.2.2026.10587"]]);
    expect(linhasDisponiveisOffline([autesp], [], "RJ").map((l) => l.arvore)).toEqual([349]);
  });
  it("reserva AUTESP sem seção depois do lançamento offline e libera ao remover", async () => {
    const itens: ItemFila[] = [{ id: "1", criadoEm: 1, op: { tipo: "tora_insert", dados: { empresa_id: "RJ", arvore: 349, secao: null, autex: "AUTESP-2011.2.2026.10587", plaqueta: 60 } } }];
    const autesp: LinhaSaldo = { arvore: 349, volume: 2.0125, nome_cientifico: "Pouteria macrophylla", autex: "AUTESP-2011.2.2026.10587", secao: "", especie: "Abiurana" };
    expect(linhasDisponiveisOffline([autesp], itens, "RJ")).toEqual([]);
    expect(linhasDisponiveisOffline([autesp], itens.filter(() => false), "RJ").map((l) => l.arvore)).toEqual([349]);
  });
});