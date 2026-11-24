import { describe, it, expect, vi } from "vitest";
import { emitirNota, consultarNota, diagnosticar, inutilizar, montarPayload, type Documento, type Http, type Store, type NotaFiscalEntrada } from "./fiscal-spedy.core";

const CNPJ = "11222333000181";
const nota: NotaFiscalEntrada = {
  emitenteCnpj: CNPJ, natureza: "Venda de madeira", consumidorFinal: false,
  destinatario: { nome: "Cliente", documento: "11144477735", endereco: { logradouro: "Rua A", numero: "1", bairro: "Centro", municipio: "Porto Velho", uf: "ro", cep: "76800-000" } },
  itens: [{ codigo: "J1", descricao: "Jatobá", ncm: "44034900", cfop: "5102", unidade: "M3", quantidade: 1.5, preco: 100 }],
  tributacao: { origem: 0, icms: { csosn: 102 }, pisCst: 49, cofinsCst: 49 }, pagamento: "pix", frete: "9",
};

function memoria() {
  const docs = new Map<string, Documento & { empresa_id: string }>();
  const eventos: string[] = [];
  const inut = new Map<string, { id: string; status: string; spedy_id: null; protocolo: null; mensagem: null; faixa: [string, number, number, number] }>();
  let n = 0;
  const store: Store = {
    config: async () => null,
    salvarConfig: async () => {},
    documento: async (e, r) => [...docs.values()].find((d) => d.empresa_id === e && d.rascunho_id === r) ?? null,
    criarDocumento: async (e, r) => {
      const d: Documento = { id: `doc-${++n}`, empresa_id: e, rascunho_id: r, status: "preparada", payload_hash: null, spedy_id: null, numero: null, serie: null, chave_acesso: null, protocolo: null, mensagem: null, tentativa_em: null };
      docs.set(d.id, d); return d;
    },
    reservar: async (id, hash, _u, agora) => {
      const d = docs.get(id)!;
      const velho = d.tentativa_em && agora.getTime() - Date.parse(d.tentativa_em) > 120000;
      if (!["preparada", "rejected", "erro", "incerto"].includes(d.status) && !(d.status === "enviando" && velho)) return null;
      Object.assign(d, { status: "enviando", payload_hash: hash, tentativa_em: agora.toISOString() }); return { ...d };
    },
    atualizar: async (id, c) => { Object.assign(docs.get(id)!, c); },
    inutilizacao: async (e, s, i, f) => {
      const outras = [...inut.values()].filter((x) => x.faixa[0] === e && x.faixa[1] === s && x.faixa[2] <= f && x.faixa[3] >= i);
      const exata = outras.find((x) => x.faixa[2] === i && x.faixa[3] === f);
      if (outras.some((x) => x !== exata)) return { registro: { id: "", status: "", spedy_id: null, protocolo: null, mensagem: null }, sobreposta: true };
      const r = exata ?? { id: `in-${++n}`, status: "preparada", spedy_id: null, protocolo: null, mensagem: null, faixa: [e, s, i, f] as [string, number, number, number] };
      inut.set(r.id, r); return { registro: r, sobreposta: false };
    },
    reservarInutilizacao: async (id) => { const r = inut.get(id)!; if (!["preparada", "erro", "incerto"].includes(r.status)) return null; r.status = "enviando"; return r; },
    atualizarInutilizacao: async (id, c) => { Object.assign(inut.get(id)!, c); },
    evento: async (e) => { eventos.push(`${e.empresa_id}:${e.acao}:${e.resultado}`); },
  };
  return { store, docs, eventos };
}

function spedy(opts: { env?: string; cert?: string; cnpj?: string; post?: (body: unknown) => { status: number; json: unknown } | "timeout"; status?: number } = {}) {
  const posts: unknown[] = [];
  const http: Http = vi.fn(async (caminho, init) => {
    if (opts.status) return { status: opts.status, json: {} };
    if (caminho.startsWith("/companies?")) return { status: 200, json: { items: [{ id: "sp-1", federalTaxNumber: opts.cnpj ?? CNPJ }] } };
    if (caminho.endsWith("/settings")) return { status: 200, json: { productInvoice: { environmentType: opts.env ?? "development" } } };
    if (caminho.endsWith("/certificates")) return { status: 200, json: { items: [{ isActive: true, expirationAt: opts.cert ?? "2099-01-01T00:00:00Z" }] } };
    if (init?.method === "POST") {
      posts.push(init.body);
      const r = opts.post?.(init.body) ?? { status: 200, json: { id: "nfe-1", status: "enqueued", environmentType: "development" } };
      if (r === "timeout") throw new DOMException("timeout", "TimeoutError");
      return r;
    }
    if (caminho.startsWith("/product-invoices/nfe-1")) return { status: 200, json: { id: "nfe-1", status: "authorized", number: 15, series: "1", accessKey: "1".repeat(44), authorization: { protocol: "P123" }, environmentType: "development" } };
    if (caminho.startsWith("/product-invoices?integrationId=")) return { status: 200, json: { items: [{ id: "nfe-1", status: "enqueued", environmentType: "development" }] } };
    return { status: 404, json: {} };
  });
  return { http, posts };
}
const ctx = (http: Http | null, store: Store, empresa = "emp-a") => ({ http, store, empresa, usuario: "u1" });

describe("payload", () => {
  it("envia a escolha Entrada à Spedy",()=>{
    const {payload}=montarPayload({...nota,tipo:"0",itens:nota.itens.map(i=>({...i,cfop:"1102"}))});
    expect(payload.operationType).toBe("incoming");
    expect(montarPayload(nota).payload.operationType).toBe("outgoing");
    expect(()=>montarPayload({...nota,tipo:"0"})).toThrow(/CFOP/);
  });
  it("valida e calcula totais", () => {
    const { payload } = montarPayload(nota);
    const item = payload.items[0]!;
    expect(item.totalAmount).toBe(150);
    expect(payload.payments[0]!.amount).toBe(150);
    expect(payload.receiver.address.postalCode).toBe("76800000");
    expect(payload.receiver.address.city.state).toBe("RO");
  });
  it("rejeita NCM, CPF e CFOP inválidos", () => {
    expect(() => montarPayload({ ...nota, itens: [{ ...nota.itens[0]!, ncm: "123" }] })).toThrow(/NCM/);
    expect(() => montarPayload({ ...nota, destinatario: { ...nota.destinatario, documento: "12345678900" } })).toThrow(/destinatário/);
    expect(() => montarPayload({ ...nota, itens: [{ ...nota.itens[0]!, cfop: "9999" }] })).toThrow(/CFOP/);
  });
});

describe("emissão em homologação", () => {
  it("segredo ausente não chama a Spedy", async () => {
    const { store, docs } = memoria();
    await expect(emitirNota(ctx(null, store), "r1", null, nota)).rejects.toMatchObject({ codigo: "chave_ausente" });
    expect(docs.size).toBe(0);
  });
  it("bloqueia produção configurada no modelo NF-e mesmo dentro do sandbox", async () => {
    const { store, docs } = memoria(); const s = spedy({ env: "production" });
    await expect(emitirNota(ctx(s.http, store), "r1", null, nota)).rejects.toMatchObject({ codigo: "producao_bloqueada" });
    expect(s.posts).toHaveLength(0); expect(docs.size).toBe(0);
  });
  it("bloqueia certificado vencido e CNPJ sem cadastro", async () => {
    const { store } = memoria();
    await expect(emitirNota(ctx(spedy({ cert: "2020-01-01" }).http, store), "r1", null, nota)).rejects.toMatchObject({ codigo: "certificado" });
    await expect(emitirNota(ctx(spedy({ cnpj: "00000000000000" }).http, store), "r1", null, nota)).rejects.toMatchObject({ codigo: "cadastro" });
  });
  it("chave recusada vira diagnóstico separado", async () => {
    const { store } = memoria();
    const d = await diagnosticar(spedy({ status: 403 }).http, store, "emp-a", CNPJ);
    expect(d).toMatchObject({ chave: "recusada", cadastro: "pendente" });
  });
  it("envia com integrationId estável e não reenvia nota autorizada", async () => {
    const { store, eventos } = memoria(); const s = spedy();
    const r = await emitirNota(ctx(s.http, store), "r1", "toras/1", nota);
    expect(r.situacao).toBe("enqueued");
    expect((s.posts[0] as { integrationId: string }).integrationId).toBe(r.documento!.id);
    const c = await consultarNota(ctx(s.http, store), "r1");
    expect(c.documento).toMatchObject({ status: "authorized", protocolo: "P123", numero: "15" });
    const de = await emitirNota(ctx(s.http, store), "r1", "toras/1", nota);
    expect(de.mensagem).toMatch(/estado final/); expect(s.posts).toHaveLength(1);
    expect(eventos.every((e) => e.startsWith("emp-a:"))).toBe(true);
  });
  it("timeout fica incerto e o reenvio reutiliza o mesmo identificador", async () => {
    const { store } = memoria(); let primeira = true;
    const s = spedy({ post: () => (primeira ? ((primeira = false), "timeout") : { status: 200, json: { id: "nfe-1", status: "enqueued", environmentType: "development" } }) });
    const r1 = await emitirNota(ctx(s.http, store), "r1", null, nota);
    expect(r1.situacao).toBe("incerto");
    const r2 = await emitirNota(ctx(s.http, store), "r1", null, nota);
    expect(r2.situacao).toBe("enqueued");
    expect((s.posts[0] as { integrationId: string }).integrationId).toBe((s.posts[1] as { integrationId: string }).integrationId);
  });
  it("timeout recuperado por consulta pelo integrationId", async () => {
    const { store } = memoria();
    const s = spedy({ post: () => "timeout" });
    await emitirNota(ctx(s.http, store), "r1", null, nota);
    const c = await consultarNota(ctx(s.http, store), "r1");
    expect(c.documento).toMatchObject({ spedy_id: "nfe-1", status: "enqueued" });
  });
  it("envio simultâneo da mesma nota manda só uma requisição", async () => {
    const { store } = memoria(); const s = spedy();
    const [a, b] = await Promise.all([emitirNota(ctx(s.http, store), "r1", null, nota), emitirNota(ctx(s.http, store), "r1", null, nota)]);
    expect(s.posts).toHaveLength(1);
    expect(a.documento!.id).toBe(b.documento!.id);
    expect(["em_andamento", "enqueued", "authorized"]).toContain(b.situacao);
  });
  it("rejeição da API grava erro e permite correção com o mesmo id", async () => {
    const { store } = memoria(); let n = 0;
    const s = spedy({ post: () => (n++ === 0 ? { status: 400, json: { errors: [{ message: "NCM inexistente" }] } } : { status: 200, json: { id: "nfe-1", status: "enqueued", environmentType: "development" } }) });
    const r = await emitirNota(ctx(s.http, store), "r1", null, nota);
    expect(r).toMatchObject({ situacao: "erro", mensagem: "NCM inexistente" });
    expect((await emitirNota(ctx(s.http, store), "r1", null, nota)).situacao).toBe("enqueued");
  });
  it("alerta se a Spedy responder ambiente de produção", async () => {
    const { store, eventos } = memoria();
    const s = spedy({ post: () => ({ status: 200, json: { id: "nfe-1", status: "enqueued", environmentType: "production" } }) });
    await expect(emitirNota(ctx(s.http, store), "r1", null, nota)).rejects.toMatchObject({ codigo: "producao_bloqueada" });
    expect(eventos.some((e) => e.includes("alerta_ambiente"))).toBe(true);
  });
  it("empresas diferentes com o mesmo rascunho ficam isoladas", async () => {
    const { store, docs } = memoria(); const s = spedy();
    await emitirNota(ctx(s.http, store, "emp-a"), "r1", null, nota);
    const b = await consultarNota(ctx(s.http, store, "emp-b"), "r1");
    expect(b.situacao).toBe("inexistente");
    await emitirNota(ctx(s.http, store, "emp-b"), "r1", null, nota);
    expect(new Set([...docs.values()].map((d) => d.empresa_id))).toEqual(new Set(["emp-a", "emp-b"]));
  });
});

describe("inutilização", () => {
  const base = { emitenteCnpj: CNPJ, serie: 1, inicio: 10, fim: 12, justificativa: "Falha de sequência no sistema" };
  it("bloqueia sobreposição e produção, envia em homologação", async () => {
    const { store } = memoria();
    await expect(inutilizar(ctx(spedy({ env: "production" }).http, store), base)).rejects.toMatchObject({ codigo: "producao_bloqueada" });
    const s = spedy({ post: () => ({ status: 200, json: { id: "i1", status: "registered", protocolNumber: "PX", environment: "development" } }) });
    expect((await inutilizar(ctx(s.http, store), base)).situacao).toBe("registered");
    await expect(inutilizar(ctx(s.http, store), { ...base, inicio: 11, fim: 20 })).rejects.toMatchObject({ codigo: "sobreposta" });
    expect((await inutilizar(ctx(s.http, store), base)).mensagem).toMatch(/já inutilizada/);
    expect(s.posts).toHaveLength(1);
  });
  it("exige justificativa mínima", async () => {
    const { store } = memoria();
    await expect(inutilizar(ctx(spedy().http, store), { ...base, justificativa: "curta" })).rejects.toMatchObject({ codigo: "validacao" });
  });
});
