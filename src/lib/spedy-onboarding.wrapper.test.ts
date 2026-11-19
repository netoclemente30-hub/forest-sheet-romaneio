import { describe, it, expect, vi } from "vitest";
import { onboardingVerificar, onboardingCadastrar, onboardingCertificado, type DepsOnboarding } from "./spedy-onboarding.wrapper";
import { criarEmpresa } from "./spedy-onboarding.core";
const cod = (r: unknown) => (r as { codigo?: string }).codigo;

const EMP = "6d4582f7-b121-4d90-9708-e8c544591397";
const OUTRA = "11111111-2222-4333-8444-555555555555";
const pfx = new Uint8Array([0x30, 0x82, 0x00, 0x05, 0x02, 0x01, 0x03, 0x30, 0x00]);

function deps(autorizado: (e: string) => boolean, servidor?: DepsOnboarding["servidor"]) {
  const srv = vi.fn(servidor ?? (async () => { throw new Error("não deveria acessar o servidor"); }));
  const cnpj = vi.fn(async () => "11222333000181");
  return { d: { usuario: "u1", autorizar: async (e: string) => autorizado(e), cnpj, servidor: srv } as DepsOnboarding, srv, cnpj };
}
const fd = (empresa: string) => { const f = new FormData(); f.append("empresa", empresa); f.append("confirmacao", "HOMOLOGACAO"); f.append("arquivo", new File([pfx], "a.pfx")); f.append("senha", "SENHA-SECRETA"); return f; };

describe("wrappers de onboarding", () => {
  it("pode_fiscal falso: nada de segredo nem HTTP", async () => {
    const { d, srv, cnpj } = deps(() => false);
    expect(cod(await onboardingVerificar(d, EMP, "x"))).toBe("acesso");
    expect(cod(await onboardingCadastrar(d, EMP, "criar", {}))).toBe("acesso");
    expect(cod(await onboardingCertificado(d, fd(EMP)))).toBe("acesso");
    expect(srv).not.toHaveBeenCalled();
    expect(cnpj).not.toHaveBeenCalled();
  });
  it("outra empresa (sem vínculo) é negada antes do servidor", async () => {
    const { d, srv } = deps((e) => e === EMP);
    expect(cod(await onboardingCertificado(d, fd(OUTRA)))).toBe("acesso");
    expect(srv).not.toHaveBeenCalled();
  });
  it("exceção inesperada vira mensagem genérica sem log e sem vazar dados", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { d } = deps(() => true, async () => ({
      httpSandbox: () => async () => { throw new Error("X-Api-Key: CHAVE-SECRETA SENHA-SECRETA"); },
      formSandbox: () => null,
      storeOnboarding: async () => { throw new Error("SENHA-SECRETA CHAVE-SECRETA"); },
    }));
    const r = await onboardingCertificado(d, fd(EMP));
    expect(cod(r)).toBe("interno");
    expect(JSON.stringify(r)).not.toMatch(/SECRETA/);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("entrada que não é FormData não lança", async () => {
    const { d } = deps(() => true);
    expect(cod(await onboardingCertificado(d, null))).toBe("entrada");
  });
});

describe("mensagens de criação", () => {
  it("não devolve texto da API, mesmo curto", async () => {
    const r = await criarEmpresa({
      http: async (_c, i) => i?.method === "POST" ? { status: 400, json: { message: "senha123 e dado interno" } } : { status: 200, json: { items: [] } },
      store: { config: async () => null, salvarConfig: async () => {}, evento: async () => {}, criacaoPendente: async () => false },
      empresa: EMP, usuario: "u", cnpjAutorizado: "11222333000181",
    }, { nome: "Mad", razao: "Mad Ltda", cnpj: "11222333000181", regime: "simplesNacional", endereco: { logradouro: "Rua", numero: "1", bairro: "Cen", municipio: "Porto Velho", ibge: "1100205", uf: "ro", cep: "76800000" } });
    expect(r.mensagem).not.toContain("senha123");
    expect(r.mensagem).toMatch(/recusou os dados/);
  });
});
