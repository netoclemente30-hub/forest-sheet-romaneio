// Camada entre as server functions e as regras de onboarding: autoriza antes de qualquer
// segredo/HTTP e devolve só mensagens seguras. Nunca registra exceções, pedido ou resposta.
import { ErroFiscal } from "./fiscal-spedy.core";
import type { EmpresaSpedyEntrada, HttpForm, OnboardingStore } from "./spedy-onboarding.core";
import type { Http } from "./fiscal-spedy.core";

export type DepsOnboarding = {
  usuario: string;
  autorizar(empresa: string): Promise<boolean>;
  cnpj(empresa: string): Promise<string | null>;
  servidor(): Promise<{
    httpSandbox(empresa: string): Http | null;
    formSandbox(empresa: string): HttpForm | null;
    storeOnboarding(): Promise<OnboardingStore>;
  }>;
};
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const falha = (codigo: string, mensagem: string) => ({ ok: false as const, codigo, mensagem });
export const NEGADO = falha("acesso", "Acesso fiscal restrito ao administrador da empresa.");

export function erroOnboarding(e: unknown) {
  if (e instanceof ErroFiscal) return falha(e.codigo, e.message); // mensagens fixas do próprio código
  return falha("interno", "Falha ao processar a operação. Tente novamente.");
}

async function contexto(deps: DepsOnboarding, empresa: string) {
  if (!UUID.test(empresa) || !(await deps.autorizar(empresa))) return null;
  const s = await deps.servidor();
  return { s, ctx: { http: s.httpSandbox(empresa), store: await s.storeOnboarding(), empresa, usuario: deps.usuario, cnpjAutorizado: await deps.cnpj(empresa) } };
}

export async function onboardingVerificar(deps: DepsOnboarding, empresa: string, cnpj: string) {
  try {
    const c = await contexto(deps, empresa);
    if (!c) return NEGADO;
    const { verificarCadastro } = await import("./spedy-onboarding.core");
    return { ok: true as const, ...(await verificarCadastro(c.ctx, cnpj)) };
  } catch (e) { return erroOnboarding(e); }
}

export async function onboardingCadastrar(deps: DepsOnboarding, empresa: string, modo: "criar" | "vincular", dados: unknown) {
  try {
    const c = await contexto(deps, empresa);
    if (!c) return NEGADO;
    const m = await import("./spedy-onboarding.core");
    const r = modo === "vincular"
      ? await m.vincularEmpresa(c.ctx, String((dados as { cnpj?: unknown } | null)?.cnpj ?? ""))
      : await m.criarEmpresa(c.ctx, dados as EmpresaSpedyEntrada);
    return { ok: r.situacao !== "erro" && r.situacao !== "incerto", situacao: r.situacao, mensagem: r.mensagem };
  } catch (e) { return erroOnboarding(e); }
}

export async function onboardingCertificado(deps: DepsOnboarding, fd: FormData | null) {
  let bytes: Uint8Array | null = null;
  try {
    if (!fd) return falha("entrada", "Envio inválido.");
    const empresa = String(fd.get("empresa") ?? "");
    const arquivo = fd.get("arquivo");
    if (fd.get("confirmacao") !== "HOMOLOGACAO") return falha("entrada", "Confirmação obrigatória.");
    if (!(arquivo instanceof File)) return falha("arquivo", "Arquivo ausente.");
    const c = await contexto(deps, empresa);
    if (!c) return NEGADO;
    const { enviarCertificado, MAX_CERTIFICADO } = await import("./spedy-onboarding.core");
    if (arquivo.size === 0 || arquivo.size > MAX_CERTIFICADO) return falha("arquivo", "Arquivo vazio ou maior que 100 KB.");
    bytes = new Uint8Array(await arquivo.arrayBuffer());
    const r = await enviarCertificado({ ...c.ctx, form: c.s.formSandbox(empresa) }, { nome: arquivo.name, bytes }, String(fd.get("senha") ?? ""), fd.get("substituir") === "1");
    return { ok: r.situacao === "enviado" || r.situacao === "confirmar_substituicao", ...r };
  } catch (e) {
    return erroOnboarding(e);
  } finally {
    bytes?.fill(0);
  }
}
