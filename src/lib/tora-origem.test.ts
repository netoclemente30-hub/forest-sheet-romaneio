import { describe, expect, it } from "vitest";
import type { Arvore, Romaneio, Tora } from "./data";
import { estoqueComFila, patioDaTora, torasDeManejo, validarBaseManejo } from "./tora-origem";

const tora = (plaqueta: number, origem: string) => ({ plaqueta, origem, empresa_id: "RJ", arvore: 1861, secao: "B", romaneio_id: null, serrada_em: null }) as Tora;
describe("separação de manejo e serraria", () => {
  it("mostra somente lançamentos de manejo em Toras de manejo", () => {
    expect(torasDeManejo([tora(1, "serraria"), tora(2, "manejo")]).map((t) => t.plaqueta)).toEqual([2]);
  });
  it("exige árvore da Base da própria empresa para lançar no manejo", () => {
    expect(validarBaseManejo(undefined, "RJ")).toBe(false);
    expect(validarBaseManejo({ empresa_id: "OUTRA" } as Arvore, "RJ")).toBe(false);
    expect(validarBaseManejo({ empresa_id: "RJ" } as Arvore, "RJ")).toBe(true);
  });
  it("medição da conferência aparece no pátio sem exigir romaneio", () => {
    expect(patioDaTora(tora(1, "serraria"), [])).toBe("Conferência de estoque");
    expect(patioDaTora(tora(2, "manejo"), [])).toBeNull();
  });
  it("preserva a entrada de cargas de manejo no pátio recebido", () => {
    expect(patioDaTora({ ...tora(2, "manejo"), romaneio_id: "carga" }, [{ id: "carga", empresa_id: "RJ", recebido_em: "2026-11-08", patio: "RJ Madeiras" } as Romaneio])).toBe("RJ Madeiras");
  });
  it("inclui imediatamente medição offline da serraria, sem duplicar após sincronizar", () => {
    const dados = { ...tora(1, "serraria"), volume: 2, created_at: "2026-11-08T19:00:00Z" };
    const itens = [{ id: "medicao", criadoEm: 1, op: { tipo: "tora_insert" as const, dados } }];
    expect(estoqueComFila([], itens, "RJ").map((t) => [t.plaqueta, t.origem])).toEqual([[1, "serraria"]]);
    expect(estoqueComFila([dados], itens, "RJ")).toHaveLength(1);
    expect(estoqueComFila([], itens, "OUTRA")).toEqual([]);
  });
});
describe('projeção offline de estoque', () => {
  it('mostra medida pendente, oculta carga pendente e nunca mistura empresas', () => {
    const rj = { ...tora(39, 'manejo'), volume: 1, carregada: false } as Tora;
    const outra = { ...rj, empresa_id: 'OUTRA' } as Tora;
    const itens = [
      { id: 'a', criadoEm: 1, op: { tipo: 'tora_update' as const, plaqueta: 39, empresa_id: 'RJ', autex: null, dados: { volume: 2.5 } } },
      { id: 'b', criadoEm: 2, op: { tipo: 'romaneio_salvar' as const, cab: { placa: 'ABC', julieta: '', motorista: '', cpf: '', data: '2026-11-22' }, total_volume: 2.5, qtd_toras: 1, plaquetas: [39], empresa_id: 'RJ' } },
    ];
    const r = estoqueComFila([rj, outra], itens, 'RJ');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ empresa_id: 'RJ', volume: 2.5, carregada: true });
  });
});
