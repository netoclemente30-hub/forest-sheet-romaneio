// Regras da emissão fiscal Spedy em HOMOLOGAÇÃO. Sem segredos nem I/O direto:
// HTTP e armazenamento são injetados para testes e para o servidor.
import { z } from "zod";
import { cnpjValido } from "./cnpj";

export const SPEDY_SANDBOX = "https://sandbox-api.spedy.com.br/v1";
export const AMBIENTE_PERMITIDO = "development"; // Homologação na Spedy
const FINAIS = ["authorized", "denied", "canceled", "disabled", "removed"];
const EM_PROCESSO = ["enqueued", "received", "inContingent", "created"];
const REENVIAVEIS = ["preparada", "rejected", "erro", "incerto"];
export const TEMPO_TRAVA_MS = 2 * 60_000;

export class ErroFiscal extends Error {
  constructor(public codigo: string, mensagem: string) {
    super(mensagem);
  }
}

const so = (s: string) => s.replace(/\D/g, "");
function cpfValido(c: string) {
  if (!/^\d{11}$/.test(c) || /^(\d)\1+$/.test(c)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}
const texto = (min: number, max: number) => z.string().trim().min(min).max(max);
const fretes = {
  "0": "byIssuer", "1": "byReceiver", "2": "byThirdParties",
  "3": "byIssuerOwnTransport", "4": "byReceiverOwnTransport", "9": "free",
} as const;

export const notaSchema = z.object({
  tipo: z.enum(["0","1"]).default("1"),
  emitenteCnpj: z.string().transform(so).refine(cnpjValido, "CNPJ do emitente inválido."),
  natureza: texto(3, 60),
  serie: z.string().regex(/^\d{1,3}$/, "Série inválida.").optional(),
  consumidorFinal: z.boolean(),
  destinatario: z.object({
    nome: texto(2, 60),
    documento: z.string().transform(so).refine((d) => (d.length === 14 ? cnpjValido(d) : cpfValido(d)), "CPF/CNPJ do destinatário inválido."),
    ie: z.string().trim().max(14).optional(),
    email: z.string().trim().email().optional().or(z.literal("")),
    endereco: z.object({
      logradouro: texto(2, 60), numero: texto(1, 60), complemento: z.string().trim().max(60).optional(),
      bairro: texto(2, 60), municipio: texto(2, 60),
      uf: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "UF inválida."),
      cep: z.string().transform(so).refine((c) => c.length === 8, "CEP inválido."),
    }),
  }),
  itens: z.array(z.object({
    codigo: texto(1, 60), descricao: texto(2, 120),
    ncm: z.string().transform(so).refine((n) => n.length === 8, "NCM deve ter 8 dígitos."),
    cfop: z.string().transform(so).refine((n) => /^[1-7]\d{3}$/.test(n), "CFOP inválido."),
    unidade: texto(1, 6),
    quantidade: z.number().positive().finite(),
    preco: z.number().positive().finite(),
  })).min(1).max(990),
  tributacao: z.object({
    origem: z.number().int().min(0).max(8),
    icms: z.union([z.object({ csosn: z.number().int().min(101).max(900) }), z.object({ cst: z.number().int().min(0).max(90) })]),
    pisCst: z.number().int().min(1).max(99),
    cofinsCst: z.number().int().min(1).max(99),
  }),
  pagamento: z.enum(["money", "pix", "bankDeposit", "creditCard", "debitCard", "noPayment"]),
  frete: z.enum(["0", "1", "2", "3", "4", "9"]),
  informacoes: z.string().trim().max(2000).optional(),
}).superRefine((nota,ctx)=>{
  const prefixos=nota.tipo==="0"?["1","2","3"]:["5","6","7"];
  nota.itens.forEach((item,index)=>{
    if(!prefixos.includes(item.cfop.charAt(0)))ctx.addIssue({
      code:"custom",path:["itens",index,"cfop"],message:"Confira o CFOP do item para a operação de "+(nota.tipo==="0"?"entrada.":"saída."),
    });
  });
});
export type NotaFiscalEntrada = z.input<typeof notaSchema>;

const r2 = (n: number) => Math.round(n * 100) / 100;
export function montarPayload(entrada: NotaFiscalEntrada) {
  const v = notaSchema.safeParse(entrada);
  if (!v.success) throw new ErroFiscal("validacao", v.error.issues.map((i) => i.message).join(" "));
  const n = v.data;
  const itens = n.itens.map((i) => {
    const total = r2(i.quantidade * i.preco);
    return {
      code: i.codigo, description: i.descricao, ncm: i.ncm, cfop: Number(i.cfop), unit: i.unidade,
      quantity: i.quantidade, unitAmount: i.preco, unitTax: i.unidade, quantityTax: i.quantidade,
      unitTaxAmount: i.preco, totalAmount: total,
      taxes: {
        icms: { origin: n.tributacao.origem, ...n.tributacao.icms },
        pis: { cst: n.tributacao.pisCst }, cofins: { cst: n.tributacao.cofinsCst },
      },
    };
  });
  const total = r2(itens.reduce((s, i) => s + i.totalAmount, 0));
  const d = n.destinatario;
  return {
    emitenteCnpj: n.emitenteCnpj,
    payload: {
      operationNature: n.natureza,
      operationType: n.tipo==="0"?"incoming":"outgoing",
      ...(n.serie ? { series: n.serie } : {}),
      isFinalCustomer: n.consumidorFinal,
      receiver: {
        name: d.nome, federalTaxNumber: d.documento,
        ...(d.ie ? { stateTaxNumber: d.ie } : {}), ...(d.email ? { email: d.email } : {}),
        address: {
          street: d.endereco.logradouro, number: d.endereco.numero,
          ...(d.endereco.complemento ? { additionalInformation: d.endereco.complemento } : {}),
          district: d.endereco.bairro, postalCode: d.endereco.cep,
          city: { name: d.endereco.municipio, state: d.endereco.uf },
        },
      },
      items: itens,
      payments: [{ method: n.pagamento, amount: n.pagamento === "noPayment" ? 0 : total }],
      transport: { freightModality: fretes[n.frete] },
      ...(n.informacoes ? { additionalInformation: n.informacoes } : {}),
    },
  };
}

export async function hashPayload(p: unknown) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(p)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// ---------- dependências ----------
export type Resposta = { status: number; json: unknown };
export type Http = (caminho: string, init?: { method?: string; body?: unknown }) => Promise<Resposta>;
export type Documento = {
  id: string; empresa_id: string; rascunho_id: string; status: string; payload_hash: string | null;
  spedy_id: string | null; numero: string | null; serie: string | null; chave_acesso: string | null;
  protocolo: string | null; mensagem: string | null; tentativa_em: string | null;
};
export type Inutilizacao = { id: string; status: string; spedy_id: string | null; protocolo: string | null; mensagem: string | null };
export type Store = {
  config(empresa: string): Promise<{ spedy_company_id: string | null; cnpj: string | null } | null>;
  salvarConfig(empresa: string, spedyCompanyId: string, cnpj: string): Promise<void>;
  documento(empresa: string, rascunho: string): Promise<Documento | null>;
  criarDocumento(empresa: string, rascunho: string, origem: string | null): Promise<Documento>;
  /** Trava atômica: só uma tentativa por vez; devolve null se outra está em andamento ou estado não permite. */
  reservar(id: string, hash: string, usuario: string, agora: Date): Promise<Documento | null>;
  atualizar(id: string, campos: Partial<Documento>): Promise<void>;
  inutilizacao(empresa: string, serie: number, inicio: number, fim: number, justificativa: string): Promise<{ registro: Inutilizacao; sobreposta: boolean }>;
  reservarInutilizacao(id: string, usuario: string, agora: Date): Promise<Inutilizacao | null>;
  atualizarInutilizacao(id: string, campos: Partial<Inutilizacao>): Promise<void>;
  evento(e: { empresa_id: string; documento_id?: string; inutilizacao_id?: string; acao: string; resultado: string; usuario_id: string }): Promise<void>;
};

const obj = (x: unknown): Record<string, unknown> => (x && typeof x === "object" ? (x as Record<string, unknown>) : {});
const lista = (x: unknown): Record<string, unknown>[] => {
  const o = obj(x);
  const v = Array.isArray(x) ? x : (o["items"] ?? obj(o["result"])["items"] ?? o["result"] ?? o["data"]);
  return Array.isArray(v) ? v.map(obj) : [];
};
const corpo = (x: unknown) => { const o = obj(x); return o["result"] && !Array.isArray(o["result"]) ? obj(o["result"]) : o; };
function mensagemApi(x: unknown) {
  const o = obj(x);
  const errs = Array.isArray(o["errors"]) ? (o["errors"] as unknown[]).map((e) => String(obj(e)["message"] ?? e)) : [];
  return (errs.join(" ") || String(o["message"] ?? o["title"] ?? "")).slice(0, 500) || "Resposta sem detalhe.";
}

// ---------- diagnóstico ----------
export type Diagnostico = {
  chave: "ok" | "ausente" | "recusada" | "indisponivel";
  cadastro: "ok" | "nao_encontrado" | "pendente";
  certificado: "ok" | "ausente" | "vencido" | "pendente";
  ambiente: "homologacao" | "producao_bloqueada" | "desconhecido" | "pendente";
  spedyCompanyId?: string;
  validadeCertificado?: string;
};
export async function diagnosticar(http: Http | null, store: Store, empresa: string, cnpj: string, agora = new Date()): Promise<Diagnostico> {
  const d: Diagnostico = { chave: "ausente", cadastro: "pendente", certificado: "pendente", ambiente: "pendente" };
  if (!http) return d;
  let r: Resposta;
  try { r = await http("/companies?pageSize=100"); } catch { d.chave = "indisponivel"; return d; }
  if (r.status === 401 || r.status === 403) { d.chave = "recusada"; return d; }
  if (r.status >= 300) { d.chave = "indisponivel"; return d; }
  d.chave = "ok";
  const alvo = so(cnpj);
  const empresaSpedy = lista(r.json).find((c) => so(String(c["federalTaxNumber"] ?? "")) === alvo);
  if (!alvo || !empresaSpedy?.["id"]) { d.cadastro = "nao_encontrado"; return d; }
  d.cadastro = "ok";
  const id = String(empresaSpedy["id"]);
  d.spedyCompanyId = id;
  const atual = await store.config(empresa);
  if (atual?.spedy_company_id !== id) await store.salvarConfig(empresa, id, alvo);
  try {
    const s = await http(`/companies/${encodeURIComponent(id)}/settings`);
    const env = obj(corpo(s.json)["productInvoice"])["environmentType"];
    d.ambiente = s.status < 300 && env === AMBIENTE_PERMITIDO ? "homologacao" : env === "production" ? "producao_bloqueada" : "desconhecido";
  } catch { d.ambiente = "desconhecido"; }
  try {
    const c = await http(`/companies/${encodeURIComponent(id)}/certificates`);
    const certs = c.status < 300 ? lista(c.json) : [];
    const ativo = certs.find((x) => x["isActive"] === true);
    if (!ativo) d.certificado = "ausente";
    else {
      d.validadeCertificado = String(ativo["expirationAt"] ?? "");
      const exp = Date.parse(d.validadeCertificado);
      d.certificado = Number.isFinite(exp) && exp > agora.getTime() ? "ok" : "vencido";
    }
  } catch { d.certificado = "pendente"; }
  return d;
}
function exigirPronto(d: Diagnostico) {
  if (d.chave === "ausente") throw new ErroFiscal("chave_ausente", "Chave de homologação da empresa não configurada no servidor.");
  if (d.chave !== "ok") throw new ErroFiscal("chave", "A Spedy não aceitou a chave ou está indisponível.");
  if (d.cadastro !== "ok") throw new ErroFiscal("cadastro", "Empresa com este CNPJ não encontrada na conta Spedy de homologação.");
  if (d.ambiente !== "homologacao") throw new ErroFiscal("producao_bloqueada", "Emissão bloqueada: o modelo NF-e da empresa na Spedy não está em Homologação.");
  if (d.certificado !== "ok") throw new ErroFiscal("certificado", "Certificado A1 ativo e válido não encontrado na Spedy.");
}

function aplicarNota(json: unknown): { [K in keyof Documento]?: Documento[K] | undefined } & { ambienteRetornado?: unknown } {
  const n = corpo(json);
  const aut = obj(n["authorization"]);
  const proc = obj(n["processingDetail"]);
  return {
    spedy_id: n["id"] ? String(n["id"]) : undefined,
    status: n["status"] ? String(n["status"]) : undefined,
    numero: n["number"] != null ? String(n["number"]) : undefined,
    serie: n["series"] != null ? String(n["series"]) : undefined,
    chave_acesso: n["accessKey"] ? String(n["accessKey"]) : undefined,
    protocolo: aut["protocol"] ? String(aut["protocol"]) : undefined,
    mensagem: proc["message"] ? String(proc["message"]).slice(0, 500) : undefined,
    ambienteRetornado: n["environmentType"],
  };
}
const limpo = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([k, v]) => v !== undefined && k !== "ambienteRetornado")) as Partial<Documento>;

// ---------- emissão ----------
export type ResultadoEmissao = { situacao: string; documento: Documento | null; mensagem: string };
export async function emitirNota(
  ctx: { http: Http | null; store: Store; empresa: string; usuario: string; agora?: Date },
  rascunhoId: string, origem: string | null, entrada: NotaFiscalEntrada,
): Promise<ResultadoEmissao> {
  const { store, empresa, usuario } = ctx;
  const agora = ctx.agora ?? new Date();
  const { payload, emitenteCnpj } = montarPayload(entrada);
  const hash = await hashPayload(payload);
  const diag = await diagnosticar(ctx.http, store, empresa, emitenteCnpj, agora);
  exigirPronto(diag);
  const http = ctx.http!;
  let doc = (await store.documento(empresa, rascunhoId)) ?? (await store.criarDocumento(empresa, rascunhoId, origem));
  if(doc.status==="evento_pendente")throw new ErroFiscal("evento_pendente","Existe um evento pendente. Consulte os eventos fiscais da nota.");
  if (FINAIS.includes(doc.status))
    return { situacao: doc.status, documento: doc, mensagem: "Nota já está em estado final; nada foi reenviado." };
  if (EM_PROCESSO.includes(doc.status)) {
    if (doc.payload_hash !== hash) throw new ErroFiscal("em_processo", "Nota em processamento; não pode ser alterada agora.");
    return consultarNota({ ...ctx, http }, rascunhoId);
  }
  const reservado = await store.reservar(doc.id, hash, usuario, agora);
  if (!reservado) return { situacao: "em_andamento", documento: doc, mensagem: "Outro envio desta nota está em andamento." };
  doc = reservado;
  await store.evento({ empresa_id: empresa, documento_id: doc.id, acao: "emitir_inicio", resultado: "enviando", usuario_id: usuario });
  let r: Resposta;
  try {
    // integrationId = id interno estável: retry após timeout atualiza a mesma nota na Spedy.
    r = await http("/product-invoices", { method: "POST", body: { integrationId: doc.id, ...payload } });
  } catch {
    await store.atualizar(doc.id, { status: "incerto", mensagem: "Sem resposta da Spedy; reenvio seguro usa o mesmo identificador." });
    await store.evento({ empresa_id: empresa, documento_id: doc.id, acao: "emitir", resultado: "incerto", usuario_id: usuario });
    return { situacao: "incerto", documento: { ...doc, status: "incerto" }, mensagem: "Sem resposta da Spedy. Consulte ou reenvie; não haverá duplicidade." };
  }
  if (r.status >= 300) {
    const msg = mensagemApi(r.json);
    const status = r.status >= 500 || r.status === 429 ? "incerto" : "erro";
    await store.atualizar(doc.id, { status, mensagem: msg });
    await store.evento({ empresa_id: empresa, documento_id: doc.id, acao: "emitir", resultado: `${status}:${r.status}`, usuario_id: usuario });
    return { situacao: status, documento: { ...doc, status, mensagem: msg }, mensagem: msg };
  }
  const a = aplicarNota(r.json);
  if (a.ambienteRetornado && a.ambienteRetornado !== AMBIENTE_PERMITIDO) {
    await store.atualizar(doc.id, { ...limpo(a), mensagem: "ALERTA: Spedy informou ambiente diferente de homologação." });
    await store.evento({ empresa_id: empresa, documento_id: doc.id, acao: "alerta_ambiente", resultado: String(a.ambienteRetornado), usuario_id: usuario });
    throw new ErroFiscal("producao_bloqueada", "A Spedy informou ambiente diferente de homologação. Revise a configuração imediatamente.");
  }
  const campos = { ...limpo(a), status: a.status ?? "enqueued" };
  await store.atualizar(doc.id, campos);
  await store.evento({ empresa_id: empresa, documento_id: doc.id, acao: "emitir", resultado: campos.status, usuario_id: usuario });
  return { situacao: campos.status, documento: { ...doc, ...campos }, mensagem: "Nota enviada para a SEFAZ em homologação." };
}

export async function consultarNota(ctx: { http: Http | null; store: Store; empresa: string; usuario: string }, rascunhoId: string): Promise<ResultadoEmissao> {
  const doc = await ctx.store.documento(ctx.empresa, rascunhoId);
  if (!doc) return { situacao: "inexistente", documento: null, mensagem: "Nota ainda não enviada." };
  if(doc.status==="evento_pendente")return {situacao:doc.status,documento:doc,mensagem:"Consulte os eventos fiscais para acompanhar o cancelamento ou a carta de correção."};
  if (!ctx.http) throw new ErroFiscal("chave_ausente", "Chave de homologação da empresa não configurada no servidor.");
  let r: Resposta;
  try {
    r = doc.spedy_id
      ? await ctx.http(`/product-invoices/${encodeURIComponent(doc.spedy_id)}`)
      : await ctx.http(`/product-invoices?integrationId=${encodeURIComponent(doc.id)}&pageSize=1`);
  } catch {
    return { situacao: doc.status, documento: doc, mensagem: "Spedy indisponível; tente consultar novamente." };
  }
  if (r.status >= 300) return { situacao: doc.status, documento: doc, mensagem: mensagemApi(r.json) };
  const nota = doc.spedy_id ? r.json : lista(r.json)[0];
  if (!nota) return { situacao: doc.status, documento: doc, mensagem: "A Spedy não registrou esta nota; o reenvio é seguro." };
  const a = aplicarNota(nota);
  const campos = limpo(a);
  if (a.ambienteRetornado && a.ambienteRetornado !== AMBIENTE_PERMITIDO) campos.mensagem = "ALERTA: ambiente diferente de homologação.";
  await ctx.store.atualizar(doc.id, campos);
  await ctx.store.evento({ empresa_id: ctx.empresa, documento_id: doc.id, acao: "consultar", resultado: String(campos.status ?? doc.status), usuario_id: ctx.usuario });
  const atual = { ...doc, ...campos };
  return { situacao: atual.status, documento: atual, mensagem: atual.mensagem ?? "Situação atualizada." };
}

export async function baixarArquivo(ctx: { http: Http | null; store: Store; empresa: string }, rascunhoId: string, tipo: "xml" | "pdf") {
  const doc = await ctx.store.documento(ctx.empresa, rascunhoId);
  if (!doc?.spedy_id || doc.status !== "authorized") throw new ErroFiscal("indisponivel", "XML e DANFE ficam disponíveis após a autorização.");
  if (!ctx.http) throw new ErroFiscal("chave_ausente", "Chave de homologação da empresa não configurada no servidor.");
  return { caminho: `/product-invoices/${encodeURIComponent(doc.spedy_id)}/${tipo}` };
}

// ---------- inutilização ----------
export const inutilizacaoSchema = z.object({
  emitenteCnpj: z.string(),
  serie: z.number().int().min(0).max(999),
  inicio: z.number().int().positive(),
  fim: z.number().int().positive(),
  justificativa: z.string().trim().min(15).max(255),
}).refine((v) => v.fim >= v.inicio && v.fim - v.inicio < 10000, "Faixa inválida.");

export async function inutilizar(ctx: { http: Http | null; store: Store; empresa: string; usuario: string; agora?: Date }, entrada: z.input<typeof inutilizacaoSchema>) {
  const v = inutilizacaoSchema.safeParse(entrada);
  if (!v.success) throw new ErroFiscal("validacao", v.error.issues.map((i) => i.message).join(" "));
  const n = v.data;
  const diag = await diagnosticar(ctx.http, ctx.store, ctx.empresa, n.emitenteCnpj, ctx.agora);
  exigirPronto(diag);
  const { registro, sobreposta } = await ctx.store.inutilizacao(ctx.empresa, n.serie, n.inicio, n.fim, n.justificativa);
  if (sobreposta) throw new ErroFiscal("sobreposta", "A faixa sobrepõe outra inutilização ou nota desta empresa.");
  if (registro.status === "registered") return { situacao: "registered", registro, mensagem: "Faixa já inutilizada." };
  if (!REENVIAVEIS.includes(registro.status) && registro.status !== "inProcessing")
    return { situacao: registro.status, registro, mensagem: "Inutilização em estado final." };
  const res = await ctx.store.reservarInutilizacao(registro.id, ctx.usuario, ctx.agora ?? new Date());
  if (!res) return { situacao: "em_andamento", registro, mensagem: "Outro envio desta faixa está em andamento." };
  let r: Resposta;
  try {
    r = await ctx.http!("/product-invoices/disablements", { method: "POST", body: { series: String(n.serie), initialNumber: n.inicio, finalNumber: n.fim, reason: n.justificativa } });
  } catch {
    await ctx.store.atualizarInutilizacao(registro.id, { status: "incerto", mensagem: "Sem resposta da Spedy; consulte antes de reenviar." });
    return { situacao: "incerto", registro, mensagem: "Sem resposta da Spedy." };
  }
  const b = corpo(r.json);
  const status = r.status < 300 ? String(b["status"] ?? "inProcessing") : "erro";
  const campos: Partial<Inutilizacao> = {
    status, spedy_id: b["id"] ? String(b["id"]) : null, protocolo: b["protocolNumber"] ? String(b["protocolNumber"]) : null,
    mensagem: r.status < 300 ? (b["messageText"] ? String(b["messageText"]).slice(0, 500) : null) : mensagemApi(r.json),
  };
  if (r.status < 300 && b["environment"] && b["environment"] !== AMBIENTE_PERMITIDO) campos.mensagem = "ALERTA: ambiente diferente de homologação.";
  await ctx.store.atualizarInutilizacao(registro.id, campos);
  await ctx.store.evento({ empresa_id: ctx.empresa, inutilizacao_id: registro.id, acao: "inutilizar", resultado: status, usuario_id: ctx.usuario });
  return { situacao: status, registro: { ...registro, ...campos }, mensagem: campos.mensagem ?? "Inutilização enviada." };
}
