import { expect, it } from "vitest";
import { conferirSaldo, lerSaldo, novasTorasDoSaldo, mesmaArvoreSecao } from "./saldo";

const rows = [["AUTEX", "Nome científico", "Espécie", "Árvore", "Secção", "Volume"], ["A1", "Qualea", "Mandioqueira", 5, "a", "1,2"], ["A1", "Qualea", "Mandioqueira", 9, "B", 2]];
it("importa AUTESP sem coluna de seção e cadastra sem inventar seção", () => {
  const linhas = lerSaldo([["AUTESP", "Árvore", "Espécie", "Volume"], ["AUTESP-2011.E.2026.00115", 48, "Abiurana", "1,2"]]);
  expect(linhas[0]).toMatchObject({ autex: "AUTESP-2011.E.2026.00115", arvore: 48, secao: "", volume: 1.2 });
  expect(novasTorasDoSaldo(linhas, 100, new Set())[0]).toMatchObject({ autex: "AUTESP-2011.E.2026.00115", arvore: 48, secao: null });
});
it("localiza para medição somente a identidade sem seção quando o campo está vazio", () => {
  expect(mesmaArvoreSecao({ arvore: 48, secao: null }, 48, "")).toBe(true);
  expect(mesmaArvoreSecao({ arvore: 48, secao: "" }, 48, " ")).toBe(true);
  expect(mesmaArvoreSecao({ arvore: 48, secao: "A" }, 48, "")).toBe(false);
  expect(mesmaArvoreSecao({ arvore: 49, secao: null }, 48, "")).toBe(false);
});
it("lê rastreio AUTESP sem seção e compara com tora de seção nula", () => {
  const linhas = lerSaldo([["Código Rastreio", "Volume"], ["AUTESP-2011.E.2026.00115-48", "1,2"]]);
  expect(linhas[0]).toMatchObject({ autex: "AUTESP-2011.E.2026.00115", arvore: 48, secao: "" });
  expect(conferirSaldo(linhas, [{ plaqueta: 100, arvore: 48, secao: null, autex: "AUTESP-2011.E.2026.00115" }])[0]?.tora?.plaqueta).toBe(100);
});
it("lê colunas pelo cabeçalho", () => expect(lerSaldo(rows)[0]).toEqual({ autex: "A1", nome_cientifico: "Qualea", especie: "Mandioqueira", arvore: 5, secao: "A", volume: 1.2 }));
it("tora sem cadastro fica fora de estoque", () => {
  const r = conferirSaldo(lerSaldo(rows), [{ plaqueta: 10, arvore: 5, secao: "A", autex: "A1" }]);
  expect(r[0]?.tora?.plaqueta).toBe(10);
  expect(r[1]?.tora).toBeNull();
});
it("lê o código de rastreio do saldo (AUTEX-árvore-secção)", () => {
  const l = lerSaldo([["Produto", "Nome Científico", "Nome Popular", "Quantidade", "Unidade", "Código Rastreio"], ["Tora", "Pouteria caimito", "Abiurana", "1,3301", "m³", "AUTEX-2011.2.2026.10587-1848-A"]]);
  expect(l[0]).toEqual({ autex: "AUTEX-2011.2.2026.10587", arvore: 1848, secao: "A", especie: "Abiurana", nome_cientifico: "Pouteria caimito", volume: 1.3301 });
  expect(conferirSaldo(l, [{ plaqueta: 3, arvore: 1848, secao: "A", autex: "2011.2.2026.10587" }])[0]?.tora?.plaqueta).toBe(3);
});
it("plaquetas em sequência a partir do número escolhido, pulando as já usadas", () => {
  const l = lerSaldo(rows);
  expect(novasTorasDoSaldo(l, 100, new Set([101])).map((t) => t.plaqueta)).toEqual([100, 102]);
});
it("mantém AUTEX separadas e não reutiliza tora quando o saldo repete uma linha", () => {
  const base = { arvore: 1861, secao: "B", especie: "Abiurana", nome_cientifico: "Pouteria", volume: 2 };
  const linhas = [{ ...base, autex: "AUTEX-A1" }, { ...base, autex: "" }, { ...base, autex: "A1" }];
  const toras = [{ plaqueta: 10, arvore: 1861, secao: "b", autex: "A1" }, { plaqueta: 11, arvore: 1861, secao: "B", autex: "A2" }];
  expect(conferirSaldo(linhas, toras).map((r) => r.tora?.plaqueta ?? null)).toEqual([10, 11, null]);
});
it("confere 1981 linhas sem varrer todas as toras para cada árvore", () => {
  let leituras = 0;
  const toras = Array.from({ length: 1981 }, (_, i) => ({ plaqueta: i + 1, get arvore() { leituras++; return i + 1; }, secao: "A", autex: "RJ" }));
  const linhas = Array.from({ length: 1981 }, (_, i) => ({ arvore: i + 1, secao: "A", autex: "RJ", especie: "Abiurana", nome_cientifico: "Pouteria", volume: 1 }));
  const resultado = conferirSaldo(linhas, toras);
  expect(resultado.filter((r) => r.tora).length).toBe(1981);
  expect(resultado.at(-1)?.tora?.plaqueta).toBe(1981);
  expect(leituras).toBeLessThanOrEqual(1981 * 2);
});
