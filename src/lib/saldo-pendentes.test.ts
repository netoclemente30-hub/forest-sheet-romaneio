import { expect, it } from "vitest";
import type { Tora } from "./data";
import type { LinhaSaldo } from "./saldo";
import { saldoNaoMedido } from "./saldo-pendentes";

const linha = (arvore: number): LinhaSaldo => ({ autex: "AUTESP-1", arvore, secao: "", especie: "Abiurana", nome_cientifico: "Pouteria", volume: 1.25 });
const tora = (arvore: number) => ({ ...linha(arvore), empresa_id: "rj", plaqueta: arvore, carregada: false, serrada_em: null, d_topo1: 50, comprimento: 6 }) as unknown as Tora;

it("exporta as 439 restantes de 1981 linhas sem incluir as 1542 já medidas", () => {
  const linhas = Array.from({ length: 1981 }, (_, i) => linha(i + 1));
  const medidas = Array.from({ length: 1542 }, (_, i) => tora(i + 1));
  const restantes = saldoNaoMedido(linhas, medidas, [], "rj");
  expect(restantes).toHaveLength(439);
  expect(restantes[0]).toEqual({ ...linha(1543), plaqueta: null });
  expect(restantes.at(-1)?.arvore).toBe(1981);
  expect(restantes.reduce((n, l) => n + (l.volume ?? 0), 0)).toBe(548.75);
});
it("inclui tora cadastrada sem medidas uma única vez e preserva seção vazia", () => {
  expect(saldoNaoMedido([linha(48)], [{ ...tora(48), d_topo1: null, comprimento: null }], [], "rj")).toEqual([{ ...linha(48), plaqueta: 48 }]);
});
it("não exporta identidade medida offline na empresa, inclusive fila com erro", () => {
  const dados = { ...linha(48), empresa_id: "rj" };
  expect(saldoNaoMedido([linha(48), linha(49)], [], [{ id: "op", criadoEm: 1, erro: "Sem conexão", op: { tipo: "tora_insert", dados } }], "rj").map((l) => l.arvore)).toEqual([49]);
});
it("atualização offline com medidas retira tora cadastrada da exportação", () => {
  expect(saldoNaoMedido([linha(48)], [{ ...tora(48), d_topo1: null, comprimento: null }], [{ id: "op", criadoEm: 1, op: { tipo: "tora_update", empresa_id: "rj", plaqueta: 48, autex: "AUTESP-1", dados: { d_topo1: 50, comprimento: 6 } } }], "rj")).toEqual([]);
});