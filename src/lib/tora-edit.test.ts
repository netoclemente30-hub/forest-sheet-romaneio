import { describe, expect, it } from "vitest";
import { dadosDaEdicao, editarDe, validarEdicao, volumeMedido, type EdicaoTora } from "./tora-edit";
import type { Tora } from "./data";

const tora = (p: Partial<Tora>): Tora =>
  ({
    plaqueta: 1,
    empresa_id: "e1",
    arvore: 11,
    autex: "A1",
    carregada: false,
    comprimento: 7.6,
    created_at: "",
    d_pe1: 67,
    d_pe2: 62,
    d_topo1: 73,
    d_topo2: 68,
    especie: "Mandioqueira",
    nome_cientifico: "Qualea albiflora",
    romaneio_id: null,
    secao: "A",
    serrada_em: null,
    volume: 0.5,
    ...p,
  }) as Tora;

const ed = (p: Partial<EdicaoTora>): EdicaoTora => ({ ...editarDe(tora({})), ...p });

describe("editarDe", () => {
  it("preenche o formulário com os dados da tora", () => {
    const e = editarDe(tora({}));
    expect(e).toMatchObject({ plaqueta: 1, empresa_id: "e1", arvore: "11", secao: "A", autex: "A1", especie: "Mandioqueira", volume: "0.5", d_topo1: "73", comprimento: "7.6" });
  });

  it("deixa em branco o que a tora não tem", () => {
    const e = editarDe(tora({ secao: null, autex: null, nome_cientifico: null, d_topo1: null, volume: 0 }));
    expect([e.secao, e.autex, e.nome_cientifico, e.d_topo1]).toEqual(["", "", "", ""]);
  });
});

describe("validarEdicao", () => {
  it("aceita a tora sem mudar nada", () => {
    expect(validarEdicao(editarDe(tora({})), [tora({})])).toBeNull();
  });

  it("rejeita árvore ou volume que não são número", () => {
    expect(validarEdicao(ed({ arvore: "abc" }), [])).toMatch(/árvore/i);
    expect(validarEdicao(ed({ volume: "" }), [])).toMatch(/volume/i);
  });

  it("rejeita medida digitada zero ou negativa", () => {
    expect(validarEdicao(ed({ d_topo1: "0" }), [])).toMatch(/D\. topo 1/);
    expect(validarEdicao(ed({ comprimento: "-3" }), [])).toMatch(/Comprimento/);
  });

  it("não deixa repetir a secção na mesma árvore e AUTEX", () => {
    const erros = validarEdicao(ed({ secao: "B" }), [tora({}), tora({ plaqueta: 2, secao: "b" })]);
    expect(erros).toBe("Árvore 11 já tem a secção B (plaqueta 2)");
  });

  it("libera a secção quando a AUTEX é outra", () => {
    expect(validarEdicao(ed({ secao: "B", autex: "A2" }), [tora({}), tora({ plaqueta: 2, secao: "B", autex: "A1" })])).toBeNull();
  });

  it("libera a secção quando a árvore é outra", () => {
    expect(validarEdicao(ed({ secao: "B", arvore: "12" }), [tora({}), tora({ plaqueta: 2, secao: "B" })])).toBeNull();
  });
});

describe("dadosDaEdicao", () => {
  it("converte vírgula em número e guarda a secção em maiúscula", () => {
    const d = dadosDaEdicao(ed({ volume: "1,25", secao: "b", comprimento: "7,6", nome_cientifico: "  " }));
    expect(d).toMatchObject({ arvore: 11, volume: 1.25, secao: "B", comprimento: 7.6, nome_cientifico: null });
  });

  it("calcula o volume de Smalian das medidas digitadas", () => {
    expect(volumeMedido(ed({ d_topo1: "73", d_topo2: "68", d_pe1: "67", d_pe2: "62", comprimento: "7,6" }))).toBeCloseTo(2.725, 3);
  });

  it("não calcula volume enquanto faltar medida", () => {
    expect(volumeMedido(ed({ d_topo2: "" }))).toBe(0);
  });
});
