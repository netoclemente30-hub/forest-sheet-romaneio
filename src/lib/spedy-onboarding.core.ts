// Cadastro/vínculo da empresa na Spedy e envio do certificado A1, só em HOMOLOGAÇÃO.
// Sem I/O direto: HTTP e armazenamento são injetados (servidor real ou testes).
// Nunca devolve apiCredentials, conteúdo do certificado nem a senha.
import { z } from "zod";
import { cnpjValido } from "./cnpj";
import { ErroFiscal, TEMPO_TRAVA_MS, type Http, type Resposta, type Store } from "./fiscal-spedy.core";

const so = (s: string) => s.replace(/\D/g, "");
const obj = (x: unknown): Record<string, unknown> => (x && typeof x === "object" ? (x as Record<string, unknown>) : {});
const lista = (x: unknown): Record<string, unknown>[] => {
  const o = obj(x);
  const v = Array.isArray(x) ? x : (o["items"] ?? obj(o["result"])["items"] ?? o["result"] ?? o["data"]);
  return Array.isArray(v) ? v.map(obj) : [];
};
const corpo = (x: unknown) => { const o = obj(x); return o["result"] && !Array.isArray(o["result"]) ? obj(o["result"]) : o; };
/** Remove sequências parecidas com chaves/tokens antes de mostrar mensagens da API. */
export const sanitizar = (s: string) => s.replace(/[A-Za-z0-9_\-+/=]{24,}/g, "[omitido]").slice(0, 300);
function mensagemApi(x: unknown) {
  const o = obj(x);
  const errs = Array.isArray(o["errors"]) ? (o["errors"] as unknown[]).map((e) => String(obj(e)["message"] ?? "")) : [];
  return sanitizar(errs.filter(Boolean).join(" ") || String(o["message"] ?? o["title"] ?? "")) || "Resposta sem detalhe.";
}

export type HttpForm = (caminho: string, form: FormData) => Promise<Resposta>;
export type OnboardingStore = Pick<Store, "config" | "salvarConfig" | "evento"> & {
  /** Há tentativa de criação sem desfecho registrada depois de `desde`? */
  criacaoPendente(empresa: string, desde: Date): Promise<boolean>;
};
type Ctx = { http: Http | null; store: OnboardingStore; empresa: string; usuario: string; cnpjAutorizado: string | null; agora?: Date };

export const REGIMES = {
  simplesNacional: "Simples Nacional",
  simplesNacionalExcessoSublimite: "Simples Nacional — excesso de sublimite",
  regimeNormal: "Regime Normal (Lucro Presumido ou Real)",
  simplesNacionalMEI: "Simples Nacional — MEI",
} as const;
const UFS = ["ro","ac","am","rr","pa","ap","to","ma","pi","ce","rn","pb","pe","al","se","ba","mg","es","rj","sp","pr","sc","rs","ms","mt","go","df"] as const;
const t = (min: number, max: number) => z.string().trim().min(min).max(max);
export const empresaSchema = z.object({
  nome: t(2, 80), razao: t(2, 80),
  cnpj: z.string().transform(so).refine(cnpjValido, "CNPJ inválido."),
  ie: z.string().trim().max(20).optional().or(z.literal("")),
  regime: z.enum(Object.keys(REGIMES) as [keyof typeof REGIMES]),
  endereco: z.object({
    logradouro: t(2, 100), numero: t(1, 10), complemento: z.string().trim().max(150).optional().or(z.literal("")),
    bairro: t(2, 100), municipio: t(2, 100),
    ibge: z.string().transform(so).refine((c) => c.length === 7, "Código IBGE do município deve ter 7 dígitos."),
    uf: z.string().trim().toLowerCase().refine((u) => (UFS as readonly string[]).includes(u), "UF inválida."),
    cep: z.string().transform(so).refine((c) => c.length === 8, "CEP inválido."),
  }),
});
export type EmpresaSpedyEntrada = z.input<typeof empresaSchema>;

function exigirCnpj(ctx: Ctx, informado: string) {
  const autorizado = so(ctx.cnpjAutorizado ?? "");
  if (!cnpjValido(autorizado)) throw new ErroFiscal("cnpj_cadastro", "O CNPJ desta empresa no Gestor está vazio ou inválido. Corrija o cadastro da empresa antes.");
  if (so(informado) !== autorizado) throw new ErroFiscal("cnpj_divergente", "O CNPJ informado é diferente do CNPJ cadastrado para esta empresa no Gestor.");
  return autorizado;
}
function exigirChave(http: Http | null): Http {
  if (!http) throw new ErroFiscal("chave_ausente", "Chave de homologação da empresa não configurada no servidor. Peça ao responsável para adicioná-la nos segredos do projeto.");
  return http;
}

/** Procura a empresa pelo CNPJ em todas as páginas da conta Spedy (limite de segurança de 50 páginas). */
export async function localizarPorCnpj(http: Http, cnpj: string) {
  for (let page = 1; page <= 50; page++) {
    const r = await http(`/companies?page=${page}&pageSize=100`);
    if (r.status === 401 || r.status === 403) throw new ErroFiscal("chave", "A Spedy recusou a chave desta empresa.");
    if (r.status >= 300) throw new ErroFiscal("indisponivel", "Spedy indisponível. Tente novamente.");
    const itens = lista(r.json);
    const achada = itens.find((c) => so(String(c["federalTaxNumber"] ?? "")) === cnpj);
    if (achada?.["id"]) return { id: String(achada["id"]), nome: String(achada["name"] ?? achada["legalName"] ?? "") };
    if (itens.length < 100) return null;
  }
  throw new ErroFiscal("indisponivel", "Muitas empresas na conta Spedy; não foi possível concluir a busca.");
}

export async function verificarCadastro(ctx: Ctx, cnpjInformado: string) {
  const cnpj = exigirCnpj(ctx, cnpjInformado);
  const http = exigirChave(ctx.http);
  const atual = await ctx.store.config(ctx.empresa);
  const achada = await localizarPorCnpj(http, cnpj);
  return {
    existe: !!achada,
    nome: achada?.nome ?? null,
    vinculada: !!achada && atual?.spedy_company_id === achada.id,
  };
}

export async function vincularEmpresa(ctx: Ctx, cnpjInformado: string) {
  const cnpj = exigirCnpj(ctx, cnpjInformado);
  const http = exigirChave(ctx.http);
  const achada = await localizarPorCnpj(http, cnpj);
  if (!achada) throw new ErroFiscal("nao_encontrada", "Nenhuma empresa com este CNPJ na conta Spedy de homologação.");
  // Só guarda o vínculo local; nada é alterado no cadastro nem no certificado da Spedy.
  await ctx.store.salvarConfig(ctx.empresa, achada.id, cnpj);
  await ctx.store.evento({ empresa_id: ctx.empresa, acao: "spedy_empresa_vincular", resultado: "ok", usuario_id: ctx.usuario });
  return { situacao: "vinculada" as const, mensagem: "Empresa da Spedy vinculada a esta empresa do Gestor." };
}

export async function criarEmpresa(ctx: Ctx, entrada: EmpresaSpedyEntrada) {
  const v = empresaSchema.safeParse(entrada);
  if (!v.success) throw new ErroFiscal("validacao", v.error.issues.map((i) => i.message).join(" "));
  const d = v.data;
  const cnpj = exigirCnpj(ctx, d.cnpj);
  const http = exigirChave(ctx.http);
  const agora = ctx.agora ?? new Date();
  if (await ctx.store.criacaoPendente(ctx.empresa, new Date(agora.getTime() - TEMPO_TRAVA_MS)))
    throw new ErroFiscal("em_andamento", "Já existe um cadastro em andamento ou sem resposta. Use \"Verificar CNPJ na Spedy\" antes de tentar de novo.");
  // Reconciliação obrigatória: nunca cria se o CNPJ já existe na conta.
  if (await localizarPorCnpj(http, cnpj))
    throw new ErroFiscal("ja_existe", "Este CNPJ já está cadastrado na Spedy. Use \"Vincular\" em vez de criar.");
  await ctx.store.evento({ empresa_id: ctx.empresa, acao: "spedy_empresa_criar_inicio", resultado: "enviando", usuario_id: ctx.usuario });
  const e = d.endereco;
  let r: Resposta;
  try {
    r = await http("/companies", {
      method: "POST",
      body: {
        // id estável = código da empresa no Gestor; a documentação aceita id, mas não garante idempotência.
        id: ctx.empresa,
        name: d.nome, legalName: d.razao, federalTaxNumber: cnpj, taxRegime: d.regime,
        ...(d.ie ? { stateTaxNumber: d.ie } : {}),
        address: {
          street: e.logradouro, number: e.numero, district: e.bairro, postalCode: e.cep,
          ...(e.complemento ? { additionalInformation: e.complemento } : {}),
          city: { code: e.ibge, name: e.municipio, state: e.uf },
        },
      },
    });
  } catch {
    await ctx.store.evento({ empresa_id: ctx.empresa, acao: "spedy_empresa_criar", resultado: "incerto", usuario_id: ctx.usuario });
    return { situacao: "incerto" as const, mensagem: "Sem resposta da Spedy. Antes de repetir, use \"Verificar CNPJ na Spedy\": se a empresa aparecer, vincule-a." };
  }
  if (r.status >= 300) {
    const msg = r.status === 403 ? "A chave desta empresa não pode cadastrar empresas (é preciso a chave da empresa titular da conta Spedy)." : mensagemApi(r.json);
    await ctx.store.evento({ empresa_id: ctx.empresa, acao: "spedy_empresa_criar", resultado: `erro:${r.status}`, usuario_id: ctx.usuario });
    return { situacao: "erro" as const, mensagem: msg };
  }
  const id = corpo(r.json)["id"]; // apiCredentials é descartado aqui e nunca sai do servidor.
  if (!id) {
    await ctx.store.evento({ empresa_id: ctx.empresa, acao: "spedy_empresa_criar", resultado: "incerto:sem_id", usuario_id: ctx.usuario });
    return { situacao: "incerto" as const, mensagem: "A Spedy respondeu sem identificar a empresa. Use \"Verificar CNPJ na Spedy\" antes de repetir." };
  }
  await ctx.store.salvarConfig(ctx.empresa, String(id), cnpj);
  await ctx.store.evento({ empresa_id: ctx.empresa, acao: "spedy_empresa_criar", resultado: "ok", usuario_id: ctx.usuario });
  return { situacao: "criada" as const, mensagem: "Empresa cadastrada na Spedy (homologação) e vinculada." };
}

// ---------- certificado A1 ----------
export const MAX_CERTIFICADO = 100 * 1024; // um A1 .pfx costuma ter poucos KB
/** Checagem estrutural mínima: DER SEQUENCE seguido de INTEGER versão 3 (PFX). Não abre o arquivo nem testa a senha. */
export function pareceePkcs12(b: Uint8Array) {
  if (b.length < 8 || b[0] !== 0x30) return false;
  let i = 1;
  const l = b[i++]!;
  if (l & 0x80) { const n = l & 0x7f; if (n < 1 || n > 3) return false; let len = 0; for (let k = 0; k < n; k++) len = len * 256 + b[i++]!; if (len + i > b.length) return false; }
  else if (l + i > b.length) return false;
  return b[i] === 0x02 && b[i + 1] === 0x01 && b[i + 2] === 0x03;
}
export function validarArquivo(nome: string, bytes: Uint8Array, senha: string) {
  if (!/\.pfx$/i.test(nome)) throw new ErroFiscal("arquivo", "Envie o certificado A1 no formato .pfx.");
  if (bytes.length === 0 || bytes.length > MAX_CERTIFICADO) throw new ErroFiscal("arquivo", "Arquivo vazio ou maior que 100 KB.");
  if (!pareceePkcs12(bytes)) throw new ErroFiscal("arquivo", "O arquivo não tem a estrutura de um certificado A1 (.pfx).");
  if (!senha || senha.length > 128) throw new ErroFiscal("senha", "Informe a senha do certificado.");
}
export type CertificadoMeta = { id: string | null; expirationAt: string | null; subject: string | null; issuer: string | null; isActive: boolean };
const meta = (c: Record<string, unknown>): CertificadoMeta => ({
  id: c["id"] ? String(c["id"]) : null,
  expirationAt: c["expirationAt"] ? String(c["expirationAt"]) : null,
  subject: c["subject"] ? sanitizar(String(c["subject"])) : null,
  issuer: c["issuer"] ? sanitizar(String(c["issuer"])) : null,
  isActive: c["isActive"] === true,
});

export async function enviarCertificado(
  ctx: Ctx & { form: HttpForm | null },
  arquivo: { nome: string; bytes: Uint8Array; tipo?: string }, senha: string, confirmarSubstituicao: boolean,
) {
  validarArquivo(arquivo.nome, arquivo.bytes, senha);
  const cnpj = exigirCnpj(ctx, ctx.cnpjAutorizado ?? "");
  const http = exigirChave(ctx.http);
  if (!ctx.form) throw new ErroFiscal("chave_ausente", "Chave de homologação da empresa não configurada no servidor.");
  const cfg = await ctx.store.config(ctx.empresa);
  if (!cfg?.spedy_company_id) throw new ErroFiscal("sem_vinculo", "Cadastre ou vincule a empresa na Spedy antes de enviar o certificado.");
  const id = encodeURIComponent(cfg.spedy_company_id);
  // Revalida no servidor: a empresa vinculada pertence a este CNPJ.
  const emp = await http(`/companies/${id}`);
  if (emp.status >= 300 || so(String(corpo(emp.json)["federalTaxNumber"] ?? "")) !== cnpj)
    throw new ErroFiscal("sem_vinculo", "A empresa vinculada na Spedy não confere com o CNPJ desta empresa. Verifique o cadastro novamente.");
  const certs = await http(`/companies/${id}/certificates`);
  if (certs.status >= 300) throw new ErroFiscal("indisponivel", "Não foi possível conferir o certificado atual na Spedy.");
  const ativo = lista(certs.json).find((c) => c["isActive"] === true);
  if (ativo && !confirmarSubstituicao)
    return { situacao: "confirmar_substituicao" as const, mensagem: "Já existe um certificado ativo. Confirme para substituí-lo.", atual: meta(ativo) };
  const fd = new FormData(); // boundary gerado pelo próprio FormData
  fd.append("certificateFile", new Blob([arquivo.bytes as BlobPart], { type: "application/x-pkcs12" }), "certificado.pfx");
  fd.append("password", senha);
  let r: Resposta;
  try { r = await ctx.form(`/companies/${id}/certificates`, fd); }
  catch {
    await ctx.store.evento({ empresa_id: ctx.empresa, acao: "spedy_certificado", resultado: "incerto", usuario_id: ctx.usuario });
    return { situacao: "incerto" as const, mensagem: "Sem resposta da Spedy. Rode o Diagnóstico antes de enviar de novo; o envio não é repetido automaticamente." };
  }
  if (r.status >= 300) {
    const msg = r.status === 400 || r.status === 422 ? "A Spedy recusou o certificado. Confira o arquivo e a senha." : r.status === 401 || r.status === 403 ? "A Spedy recusou a chave desta empresa." : "Spedy indisponível. Tente novamente mais tarde.";
    await ctx.store.evento({ empresa_id: ctx.empresa, acao: "spedy_certificado", resultado: `erro:${r.status}`, usuario_id: ctx.usuario });
    return { situacao: "erro" as const, mensagem: msg };
  }
  await ctx.store.evento({ empresa_id: ctx.empresa, acao: "spedy_certificado", resultado: ativo ? "ok:substituido" : "ok", usuario_id: ctx.usuario });
  return { situacao: "enviado" as const, mensagem: "Certificado enviado à Spedy (homologação).", certificado: meta(corpo(r.json)) };
}
