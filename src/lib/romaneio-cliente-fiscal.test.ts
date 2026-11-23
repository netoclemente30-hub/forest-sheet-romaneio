import { afterEach, describe, expect, it } from "vitest";
import { detalhesIniciais } from "./fiscal";
import { clienteDoRomaneio } from "./fiscal-cargas";
import { chaveSandbox } from "./spedy.server";

const emp = "6d4582f7-b121-4d90-9708-e8c544591397";
afterEach(() => { delete process.env["SPEDY_SANDBOX_KEY"]; delete process.env["SPEDY_SANDBOX_KEY_6D4582F7_B121_4D90_9708_E8C544591397"]; });

describe("romaneio de toras → nota fiscal", () => {
  it("reboque vai para Informações adicionais de interesse do Fisco", () => {
    expect(detalhesIniciais({ numero: "1", data: "2026-11-19", reboque: "abc1d23", itens: [] }).infAdFisco).toBe("Reboque: ABC1D23");
    expect(detalhesIniciais({ numero: "1", data: "2026-11-19", reboque: "", itens: [] }).infAdFisco).toBe("");
  });
  it("cliente e endereço do romaneio preenchem o destinatário", () => {
    const cliente = clienteDoRomaneio({ nome: "José Clemente", documento: "123", logradouro: "Rua A", numero: "10", bairro: "Centro", municipio: "Ariquemes", uf: "ro", cep: "76870000" });
    const d = detalhesIniciais({ numero: "1", data: "2026-11-19", cliente, itens: [] });
    expect(d.nome).toBe("José Clemente");
    expect(d.endereco.municipio).toBe("Ariquemes");
    expect(d.endereco.uf).toBe("RO");
    expect(clienteDoRomaneio(null)).toBeNull();
  });
});

describe("chave Spedy", () => {
  it("usa a chave mestra quando a empresa não tem chave própria", () => {
    expect(chaveSandbox("11111111-2222-3333-4444-555555555555")).toBeUndefined();
    process.env["SPEDY_SANDBOX_KEY"] = "mestra";
    expect(chaveSandbox(emp)).toBe("mestra");
  });
  it("chave própria da empresa tem prioridade", () => {
    process.env["SPEDY_SANDBOX_KEY"] = "mestra";
    process.env["SPEDY_SANDBOX_KEY_6D4582F7_B121_4D90_9708_E8C544591397"] = "propria";
    expect(chaveSandbox(emp)).toBe("propria");
  });
});

describe("chave da Madenorte como mestra", () => {
  it("outra empresa usa a chave da Madenorte quando não tem chave própria", () => {
    process.env["SPEDY_SANDBOX_KEY_6D4582F7_B121_4D90_9708_E8C544591397"] = "madenorte";
    expect(chaveSandbox("11111111-2222-3333-4444-555555555555")).toBe("madenorte");
  });
});
