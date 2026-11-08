import { describe, expect, it, vi } from "vitest";
import { salvarEncaixe, torasEtiquetasOffline, type SalvarEncaixeDeps } from "./encaixe-salvar";
import { menorPlaquetaLivre, type MedidasEncaixe } from "./encaixe";
import type { Tora } from "./data";
import type { ItemFila } from "./offline/fila";

const linha = { arvore: 1861, secao: "B", autex: "AUTEX-2011.2.2026.10587", especie: "Abiurana", nome_cientifico: "Pouteria macrophylla", volume: 2.0125 };
const medidas: MedidasEncaixe = { d_topo1: "73", d_topo2: "68", d_pe1: "67", d_pe2: "62", comprimento: "7,6" };
const deps = (): SalvarEncaixeDeps => ({ listarFila: vi.fn().mockResolvedValue([]), online: () => false, lerInventario: vi.fn().mockResolvedValue([]), capturar: vi.fn().mockResolvedValue({ acao: "Encaixe confirmado", detalhe: "Escolhido", criado_em: "2026-11-08T01:47:00Z", user_email: null, lat: null, lng: null }), gravarLog: vi.fn(), inserir: vi.fn(), enfileirar: vi.fn().mockResolvedValue(undefined) });
const estoque = [{ empresa_id: "RJ", plaqueta: 1 }, { empresa_id: "RJ", plaqueta: 3 }, { empresa_id: "OUTRA", plaqueta: 4 }];

describe("escolha de encaixe", () => {
  it("atribui a menor plaqueta positiva livre, pulando estoque e inserts offline com erro", () => {
    const fila: ItemFila[] = [{ id: "1", criadoEm: 1, erro: "conflito", op: { tipo: "tora_insert", dados: { empresa_id: "RJ", plaqueta: 2 } } }];
    expect(menorPlaquetaLivre(estoque, [], "RJ")).toBe(2);
    expect(menorPlaquetaLivre(estoque, fila, "RJ")).toBe(4);
    expect(menorPlaquetaLivre([], [], "RJ")).toBe(1);
  });
  it("reserva números antigos e novos de renumerações pendentes", () => {
    const fila: ItemFila[] = [{ id: "1", criadoEm: 1, op: { tipo: "tora_update", empresa_id: "RJ", plaqueta: 2, autex: null, dados: { plaqueta: 4 } } }];
    expect(menorPlaquetaLivre(estoque, fila, "RJ")).toBe(5);
  });
  it("aplica exatamente a identidade escolhida, mantém medidas e volume Smalian, e deixa a etiqueta disponível offline", async () => {
    const d = deps();
    const tora = await salvarEncaixe(linha, medidas, "RJ", [], d);
    expect(tora).toMatchObject({ arvore: 1861, secao: "B", autex: linha.autex, especie: "Abiurana", nome_cientifico: "Pouteria macrophylla", plaqueta: 1, d_topo1: 73, d_topo2: 68, d_pe1: 67, d_pe2: 62, comprimento: 7.6, volume: 2.725 });
    expect(d.inserir).not.toHaveBeenCalled();
    expect(d.enfileirar).toHaveBeenCalledWith(expect.objectContaining({ tipo: "tora_insert", dados: tora, log: expect.objectContaining({ criado_em: tora.created_at }) }));
    const fila: ItemFila[] = [{ id: "1", criadoEm: 1, op: { tipo: "tora_insert", dados: tora } }];
    expect(torasEtiquetasOffline(fila, "RJ")).toEqual([tora]);
    expect(torasEtiquetasOffline(fila, "OUTRA")).toEqual([]);
  });
  it("recalcula a plaqueta usando inventário atualizado quando online", async () => {
    const d = deps(); d.online = () => true;
    d.lerInventario = vi.fn().mockResolvedValue([{ empresa_id: "RJ", plaqueta: 1, arvore: 99, secao: "A", autex: "OUTRA" }]);
    const tora = await salvarEncaixe(linha, medidas, "RJ", [], d);
    expect(tora.plaqueta).toBe(2);
    expect(d.inserir).toHaveBeenCalledWith(tora);
    expect(d.enfileirar).not.toHaveBeenCalled();
  });
  it("não reutiliza identidade escolhida que já está na fila", async () => {
    const d = deps();
    d.listarFila = vi.fn().mockResolvedValue([{ op: { tipo: "tora_insert", dados: { ...linha, empresa_id: "RJ", plaqueta: 7 } } }]);
    await expect(salvarEncaixe(linha, medidas, "RJ", [], d)).rejects.toThrow("Árvore 1861 já tem a secção B (plaqueta 7)");
    expect(d.enfileirar).not.toHaveBeenCalled();
  });
  it("não reutiliza identidade já salva na empresa", async () => {
    const d = deps();
    await expect(salvarEncaixe(linha, medidas, "RJ", [{ ...linha, empresa_id: "RJ", plaqueta: 9 } as Tora], d)).rejects.toThrow("plaqueta 9");
    expect(d.enfileirar).not.toHaveBeenCalled();
  });
  it("não salva se não conseguir ler a fila e mantém as medidas de entrada", async () => {
    const d = deps(); d.listarFila = vi.fn().mockRejectedValue(new Error("Falha ao ler fila"));
    await expect(salvarEncaixe(linha, medidas, "RJ", [], d)).rejects.toThrow("Falha ao ler fila");
    expect(d.enfileirar).not.toHaveBeenCalled();
    expect(medidas.comprimento).toBe("7,6");
  });
});