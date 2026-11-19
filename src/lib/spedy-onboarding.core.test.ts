import { describe, it, expect, vi } from "vitest";
import { criarEmpresa, vincularEmpresa, verificarCadastro, enviarCertificado, pareceePkcs12, type OnboardingStore, type HttpForm, type EmpresaSpedyEntrada } from "./spedy-onboarding.core";
import type { Http } from "./fiscal-spedy.core";

const CNPJ = "11222333000181";
const OUTRO = "11444777000161";
const EMP = "6d4582f7-b121-4d90-9708-e8c544591397";
const entrada: EmpresaSpedyEntrada = {
  nome: "Madeireira", razao: "Madeireira Ltda", cnpj: "11.222.333/0001-81", ie: "", regime: "simplesNacional",
  endereco: { logradouro: "Rua A", numero: "1", bairro: "Centro", municipio: "Porto Velho", ibge: "1100205", uf: "RO", cep: "76800-000" },
};
const pfx = () => new Uint8Array([0x30, 0x82, 0x00, 0x05, 0x02, 0x01, 0x03, 0x30, 0x00]);

function store(cfg: { spedy_company_id: string | null; cnpj: string | null } | null = null, pendente = false) {
  const eventos: { acao: string; resultado: string }[] = [];
  const salvo: string[] = [];
  const s: OnboardingStore = {
    config: async () => cfg, salvarConfig: async (_e, id) => { salvo.push(id); },
    evento: async (e) => { eventos.push({ acao: e.acao, resultado: e.resultado }); },
    criacaoPendente: async () => pendente,
  };
  return { s, eventos, salvo };
}
const ctx = (http: Http | null, st: OnboardingStore, cnpj: string | null = CNPJ) => ({ http, store: st, empresa: EMP, usuario: "u1", cnpjAutorizado: cnpj });

describe("cadastro da empresa na Spedy", () => {
  it("recusa CNPJ diferente do cadastro da empresa sem chamar a Spedy", async () => {
    const http = vi.fn<Http>();
    await expect(criarEmpresa(ctx(http, store().s), { ...entrada, cnpj: OTRO_FMT() })).rejects.toThrow(/diferente/);
    expect(http).not.toHaveBeenCalled();
  });
  it("recusa quando o CNPJ da empresa no Gestor está vazio", async () => {
    await expect(verificarCadastro(ctx(vi.fn<Http>(), store().s, null), CNPJ)).rejects.toThrow(/vazio ou inválido/);
  });
  it("sem chave, orienta sem chamar nada", async () => {
    await expect(verificarCadastro(ctx(null, store().s), CNPJ)).rejects.toThrow(/não configurada/);
  });
  it("procura em várias páginas e não cria se o CNPJ já existe", async () => {
    const pag1 = Array.from({ length: 100 }, (_, i) => ({ id: `x${i}`, federalTaxNumber: "000" }));
    const http = vi.fn<Http>(async (c) => c.includes("page=1&") ? { status: 200, json: { items: pag1 } } : { status: 200, json: { items: [{ id: "sp-1", federalTaxNumber: CNPJ }] } });
    await expect(criarEmpresa(ctx(http, store().s), entrada)).rejects.toThrow(/já está cadastrado/);
    expect(http.mock.calls.some(([, i]) => i?.method === "POST")).toBe(false);
    expect(http).toHaveBeenCalledTimes(2);
  });
  it("vincula empresa existente usando o id achado no servidor, sem POST", async () => {
    const st = store();
    const http = vi.fn<Http>(async () => ({ status: 200, json: { items: [{ id: "sp-1", federalTaxNumber: CNPJ }] } }));
    await vincularEmpresa(ctx(http, st.s), CNPJ);
    expect(st.salvo).toEqual(["sp-1"]);
    expect(http.mock.calls.every(([, i]) => !i?.method)).toBe(true);
  });
  it("cria com id estável e descarta apiCredentials", async () => {
    const st = store();
    let corpo: Record<string, unknown> = {};
    const http = vi.fn<Http>(async (_c, i) => {
      if (i?.method === "POST") { corpo = i.body as Record<string, unknown>; return { status: 200, json: { id: "sp-9", apiCredentials: { apiKey: "SEGREDO_NAO_PODE_SAIR_1234567890" } } }; }
      return { status: 200, json: { items: [] } };
    });
    const r = await criarEmpresa(ctx(http, st.s), entrada);
    expect(r.situacao).toBe("criada");
    expect(JSON.stringify(r)).not.toContain("SEGREDO");
    expect(JSON.stringify(st.eventos)).not.toContain("SEGREDO");
    expect(corpo["id"]).toBe(EMP);
    expect(corpo["federalTaxNumber"]).toBe(CNPJ);
    expect(st.salvo).toEqual(["sp-9"]);
  });
  it("timeout na criação fica incerto e bloqueia nova criação até reconciliar", async () => {
    const st = store();
    const http = vi.fn<Http>(async (_c, i) => { if (i?.method === "POST") throw new Error("timeout"); return { status: 200, json: { items: [] } }; });
    const r = await criarEmpresa(ctx(http, st.s), entrada);
    expect(r.situacao).toBe("incerto");
    expect(r.mensagem).toMatch(/Verificar CNPJ/);
    await expect(criarEmpresa(ctx(http, store(null, true).s), entrada)).rejects.toThrow(/em andamento/);
  });
  it("erro da API não vaza tokens", async () => {
    const http = vi.fn<Http>(async (_c, i) => i?.method === "POST" ? { status: 400, json: { message: "chave abcdefghijklmnopqrstuvwxyz123456 inválida" } } : { status: 200, json: { items: [] } });
    const r = await criarEmpresa(ctx(http, store().s), entrada);
    expect(r.mensagem).not.toContain("abcdefghijklmnopqrstuvwxyz");
  });
});

function OTRO_FMT() { return OUTRO; }

describe("certificado A1", () => {
  const httpOk = (ativo: boolean): Http => vi.fn<Http>(async (c) =>
    c.endsWith("/certificates") ? { status: 200, json: { items: ativo ? [{ id: "c0", isActive: true, expirationAt: "2027-01-01T00:00:00Z", subject: "ANTIGO" }] : [] } }
      : { status: 200, json: { id: "sp-1", federalTaxNumber: CNPJ } });
  const cfg = { spedy_company_id: "sp-1", cnpj: CNPJ };

  it("estrutura PKCS#12 mínima", () => {
    expect(pareceePkcs12(pfx())).toBe(true);
    expect(pareceePkcs12(new TextEncoder().encode("not a pfx file"))).toBe(false);
  });
  it("recusa extensão, tamanho e conteúdo inválidos sem HTTP", async () => {
    const form = vi.fn<HttpForm>();
    const c = { ...ctx(httpOk(false), store(cfg).s), form };
    await expect(enviarCertificado(c, { nome: "a.p12", bytes: pfx() }, "s", false)).rejects.toThrow(/\.pfx/);
    await expect(enviarCertificado(c, { nome: "a.pfx", bytes: new Uint8Array(200_000) }, "s", false)).rejects.toThrow(/100 KB/);
    await expect(enviarCertificado(c, { nome: "a.pfx", bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) }, "s", false)).rejects.toThrow(/estrutura/);
    expect(form).not.toHaveBeenCalled();
  });
  it("exige vínculo e confere CNPJ da empresa vinculada", async () => {
    const form = vi.fn<HttpForm>();
    await expect(enviarCertificado({ ...ctx(httpOk(false), store(null).s), form }, { nome: "a.pfx", bytes: pfx() }, "s", false)).rejects.toThrow(/vincule/);
    const outro: Http = async () => ({ status: 200, json: { id: "sp-1", federalTaxNumber: OUTRO } });
    await expect(enviarCertificado({ ...ctx(outro, store(cfg).s), form }, { nome: "a.pfx", bytes: pfx() }, "s", false)).rejects.toThrow(/não confere/);
    expect(form).not.toHaveBeenCalled();
  });
  it("pede confirmação antes de substituir o ativo", async () => {
    const form = vi.fn<HttpForm>(async () => ({ status: 200, json: { id: "c1", isActive: true, expirationAt: "2028-01-01T00:00:00Z", subject: "NOVO", issuer: "AC" } }));
    const st = store(cfg);
    const r1 = await enviarCertificado({ ...ctx(httpOk(true), st.s), form }, { nome: "a.pfx", bytes: pfx() }, "senha123", false);
    expect(r1.situacao).toBe("confirmar_substituicao");
    expect(form).not.toHaveBeenCalled();
    const r2 = await enviarCertificado({ ...ctx(httpOk(true), st.s), form }, { nome: "a.pfx", bytes: pfx() }, "senha123", true);
    expect(r2.situacao).toBe("enviado");
    const fd = form.mock.calls[0]![1];
    expect(fd.get("certificateFile")).toBeInstanceOf(Blob);
    expect(fd.get("password")).toBe("senha123");
    expect(JSON.stringify(r2)).not.toContain("senha123");
    expect(JSON.stringify(st.eventos)).not.toContain("senha123");
    expect(st.eventos.at(-1)).toEqual({ acao: "spedy_certificado", resultado: "ok:substituido" });
  });
  it("timeout não repete o envio e erro não expõe resposta bruta", async () => {
    const form = vi.fn<HttpForm>(async () => { throw new Error("timeout"); });
    const r = await enviarCertificado({ ...ctx(httpOk(false), store(cfg).s), form }, { nome: "a.pfx", bytes: pfx() }, "s", false);
    expect(r.situacao).toBe("incerto");
    expect(form).toHaveBeenCalledTimes(1);
    const form2 = vi.fn<HttpForm>(async () => ({ status: 400, json: { message: "senha s errada detalhe interno" } }));
    const r2 = await enviarCertificado({ ...ctx(httpOk(false), store(cfg).s), form: form2 }, { nome: "a.pfx", bytes: pfx() }, "s", false);
    expect(r2.mensagem).toBe("A Spedy recusou o certificado. Confira o arquivo e a senha.");
  });
});
