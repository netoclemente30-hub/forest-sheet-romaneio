import { describe, it, expect } from "vitest";
import { gerarTxtNfe, itensDeToras, itensDeSerrada, movimentoDoDia, resumoWhatsapp } from "./nfe-txt";

describe("TXT NF-e", () => {
  const dados = { numero: "C-12", data: "2026-11-10", cliente: { nome: "Madeireira X", documento: "12.345.678/0001-90" }, motorista: { nome: "João", cpf: "123.456.789-01" }, placa: "abc-1d23", reboque: "XYZ9876", itens: itensDeSerrada([{ especie: "Ipê", tipo_peca: "Tábua", grossura: 5, largura: 15, total_pecas: 10, volume_m3: 1.5 }, { especie: "Ipê", tipo_peca: "Tábua", grossura: 5, largura: 15, total_pecas: 4, volume_m3: 0.5 }]) };
  const txt = gerarTxtNfe(dados);
  it("usa CNPJ, CPF do motorista e placas", () => {
    expect(txt).toContain("E02|12345678000190|");
    expect(txt).toContain("X05|12345678901|");
    expect(txt).toContain("X18|ABC1D23|");
    expect(txt).toContain("X22|XYZ9876|");
  });
  it("soma bitolas iguais em um item com volume em m³", () => {
    expect(txt.split("\n").filter((l) => l.startsWith("I|"))).toHaveLength(1);
    expect(txt).toContain("|M3|2.0000|");
  });
  it("cliente com CPF usa E03", () => {
    expect(gerarTxtNfe({ ...dados, cliente: { nome: "Ana", documento: "111.222.333-44" } })).toContain("E03|11122233344|");
  });
  it("toras agrupadas por espécie e resumo com total", () => {
    const it = itensDeToras([{ especie: "Cedro", volume: 1 }, { especie: "Cedro", volume: 2 }]);
    expect(it[0].pecas).toBe(3 - 1);
    expect(resumoWhatsapp("ROMANEIO DE TORAS", { numero: "1", data: "2026-11-10", itens: it })).toContain("*Total: 2 toras · 3,0000 m³*");
  });
});

describe("movimento do dia", () => {
  it("conta só o que é de hoje", () => {
    const hoje = "2026-11-10";
    const r = movimentoDoDia(hoje,
      [{ recebido_em: "2026-11-10T15:00:00", qtd_toras: 5, total_volume: 10, data: "2026-11-09" }, { recebido_em: null, qtd_toras: 3, total_volume: 4, data: hoje }],
      [{ serrada_em: "2026-11-10T12:00:00", volume: 2 }, { serrada_em: "2026-11-01T12:00:00", volume: 9 }],
      [{ data: hoje, total_volume_m3: 6 }]);
    expect(r).toEqual({ recebidas: 5, volRecebido: 10, serradas: 1, volSerrado: 2, cargas: 2, volCargas: 10 });
  });
});
